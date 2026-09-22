import { randomUUID } from "node:crypto";
import { enqueueProductLowStockEvent } from "../../automation/events";
import { db } from "../../db";
import { inventoryConfig, shouldEmitLowStockEvent } from "../../inventory/config";
import { searchTikTokProducts } from "./client";
import {
  normalizeTikTokProduct,
  type NormalizedTikTokProduct,
} from "./product-normalize";
import { acquireTikTokSyncLock, releaseTikTokSyncLock } from "./sync-lock";
import { loadTikTokConnection, updateTikTokTokens } from "./storage";
import { refreshTikTokAccessToken } from "./tokens";

const CHANNEL = "tiktok_shop";

export interface TikTokProductSyncSummary {
  synced: number;
  created: number;
  updated: number;
  variants: number;
  pages: number;
  shops: number;
  initialImport: boolean;
  lowStockEventsQueued: number;
}

export async function syncTikTokProducts(
  organizationId: string,
  options: { maxPagesPerShop?: number } = {},
): Promise<TikTokProductSyncSummary> {
  const connection = await loadTikTokConnection(organizationId);
  if (!connection) throw new Error("TikTok Shop não está conectado.");

  const lockToken = await acquireTikTokSyncLock(organizationId);
  if (!lockToken) {
    throw new Error("Uma sincronização TikTok Shop já está em andamento para esta organização.");
  }

  try {
    assertProductScope(connection.config.grantedScopes);

    let accessToken = connection.tokens.accessToken;
    if (shouldRefresh(connection.config.accessTokenExpiresAt)) {
      const refreshed = await refreshTikTokAccessToken(connection.tokens.refreshToken);
      await updateTikTokTokens(organizationId, refreshed);
      accessToken = refreshed.accessToken;
    }

    const shops = connection.config.shops.filter((shop) => Boolean(shop.cipher));
    if (shops.length === 0) throw new Error("Nenhuma loja TikTok autorizada foi encontrada.");

    const lastSync = await db.activityLog.findFirst({
      where: {
        organizationId,
        action: "integration.tiktok.products_synced",
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const initialImport = !lastSync;

    const summary: TikTokProductSyncSummary = {
      synced: 0,
      created: 0,
      updated: 0,
      variants: 0,
      pages: 0,
      shops: shops.length,
      initialImport,
      lowStockEventsQueued: 0,
    };

    for (const shop of shops) {
      let pageToken: string | undefined;
      const maxPages = Math.min(50, Math.max(1, options.maxPagesPerShop ?? 20));

      for (let page = 0; page < maxPages; page += 1) {
        const result = await searchTikTokProducts(accessToken, shop.cipher, {
          pageToken,
          pageSize: 100,
          status: "ALL",
        });

        const normalized = result.products
          .map(normalizeTikTokProduct)
          .filter((product): product is NonNullable<typeof product> => Boolean(product));

        if (normalized.length > 0) {
          const externalIds = normalized.map((product) => product.externalId);
          const existing = await db.product.findMany({
            where: {
              organizationId,
              channel: CHANNEL,
              externalId: { in: externalIds },
            },
            select: {
              id: true,
              externalId: true,
              stock: true,
              active: true,
              lowStockEpisodeId: true,
              lowStockEventAt: true,
            },
          });
          const existingByExternalId = new Map(
            existing
              .filter((product) => Boolean(product.externalId))
              .map((product) => [product.externalId as string, product]),
          );

          for (const product of normalized) {
            const previous = existingByExternalId.get(product.externalId);
            let persisted = await persistTikTokProduct(organizationId, product);

            summary.synced += 1;
            summary.variants += product.variants.length;
            if (previous) summary.updated += 1;
            else summary.created += 1;

            if (initialImport) {
              if (!persisted.lowStockEpisodeId || !persisted.lowStockEventAt) {
                persisted = await db.product.update({
                  where: { id: persisted.id },
                  data: {
                    lowStockEpisodeId: persisted.lowStockEpisodeId ?? `baseline:${persisted.id}`,
                    lowStockEventAt: persisted.lowStockEventAt ?? new Date(),
                  },
                  include: { variants: { orderBy: { externalId: "asc" } } },
                });
              }
              continue;
            }

            const isLowStock = persisted.active &&
              persisted.stock <= inventoryConfig.lowStockThreshold;

            if (!isLowStock) {
              if (persisted.lowStockEpisodeId || persisted.lowStockEventAt) {
                await db.product.update({
                  where: { id: persisted.id },
                  data: {
                    lowStockEpisodeId: null,
                    lowStockEventAt: null,
                  },
                });
              }
              continue;
            }

            const enteredLowStock = shouldEmitLowStockEvent({
              stock: persisted.stock,
              active: persisted.active,
              threshold: inventoryConfig.lowStockThreshold,
              previousStock: previous?.stock,
              previousActive: previous?.active,
            });
            const retryUndelivered = Boolean(
              persisted.lowStockEpisodeId && !persisted.lowStockEventAt,
            );

            if (!enteredLowStock && !retryUndelivered) continue;

            const episodeId = persisted.lowStockEpisodeId ?? randomUUID();

            if (!persisted.lowStockEpisodeId) {
              persisted = await db.product.update({
                where: { id: persisted.id },
                data: { lowStockEpisodeId: episodeId },
                include: { variants: { orderBy: { externalId: "asc" } } },
              });
            }

            try {
              const queued = await enqueueProductLowStockEvent({
                organizationId,
                product: persisted,
                threshold: inventoryConfig.lowStockThreshold,
                episodeId,
              });
              summary.lowStockEventsQueued += queued.events;

              await db.product.update({
                where: { id: persisted.id },
                data: { lowStockEventAt: new Date() },
              });
            } catch (queueError) {
              console.error(
                "Produto TikTok sincronizado, mas falhou ao enfileirar estoque baixo:",
                queueError instanceof Error ? queueError.message : "erro desconhecido",
              );
            }
          }
        }

        summary.pages += 1;
        pageToken = result.nextPageToken;
        if (!pageToken) break;
      }

      if (pageToken) {
        throw new Error(
          `A sincronização de catálogo da loja ${shop.name ?? shop.code ?? "TikTok"} atingiu o limite seguro de páginas.`,
        );
      }
    }

    return summary;
  } finally {
    await releaseTikTokSyncLock(organizationId, lockToken).catch((error) => {
      console.error(
        "Falha ao liberar lock de sincronização TikTok:",
        error instanceof Error ? error.message : "erro desconhecido",
      );
    });
  }
}

export async function persistTikTokProduct(
  organizationId: string,
  product: NormalizedTikTokProduct,
) {
  return db.$transaction(async (tx) => {
    const persisted = await tx.product.upsert({
      where: {
        organizationId_channel_externalId: {
          organizationId,
          channel: CHANNEL,
          externalId: product.externalId,
        },
      },
      create: {
        organizationId,
        channel: CHANNEL,
        externalId: product.externalId,
        sku: product.sku,
        name: product.name,
        priceCents: product.priceCents,
        currency: product.currency,
        stock: product.stock,
        active: product.active,
        externalStatus: product.externalStatus,
        externalUpdatedAt: product.externalUpdatedAt,
      },
      update: {
        sku: product.sku,
        name: product.name,
        priceCents: product.priceCents,
        currency: product.currency,
        stock: product.stock,
        active: product.active,
        externalStatus: product.externalStatus,
        externalUpdatedAt: product.externalUpdatedAt,
      },
    });

    const variantIds = product.variants.map((variant) => variant.externalId);

    for (const variant of product.variants) {
      await tx.productVariant.upsert({
        where: {
          productId_externalId: {
            productId: persisted.id,
            externalId: variant.externalId,
          },
        },
        create: {
          productId: persisted.id,
          externalId: variant.externalId,
          sellerSku: variant.sellerSku,
          priceCents: variant.priceCents,
          currency: variant.currency,
          stock: variant.stock,
        },
        update: {
          sellerSku: variant.sellerSku,
          priceCents: variant.priceCents,
          currency: variant.currency,
          stock: variant.stock,
        },
      });
    }

    await tx.productVariant.deleteMany({
      where: {
        productId: persisted.id,
        ...(variantIds.length > 0
          ? { externalId: { notIn: variantIds } }
          : {}),
      },
    });

    return tx.product.findUniqueOrThrow({
      where: { id: persisted.id },
      include: { variants: { orderBy: { externalId: "asc" } } },
    });
  });
}

function shouldRefresh(accessTokenExpiresAt?: number) {
  if (!accessTokenExpiresAt) return false;
  return accessTokenExpiresAt <= Math.floor(Date.now() / 1000) + 5 * 60;
}

function assertProductScope(scopes?: string[]) {
  if (!scopes || scopes.length === 0) return;
  if (scopes.includes("seller.product.basic")) return;

  throw new Error("O token TikTok não possui o scope seller.product.basic necessário para sincronizar catálogo.");
}
