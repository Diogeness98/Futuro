import { db } from "../../db";
import { enqueueAutomationEvents } from "../../automation/queue";
import { searchTikTokOrders } from "./client";
import { normalizeTikTokOrder } from "./order-normalize";
import { shouldQueueTikTokOrderEvent } from "./sync-policy";
import { acquireTikTokSyncLock, releaseTikTokSyncLock } from "./sync-lock";
import { loadTikTokConnection, updateTikTokTokens } from "./storage";
import { refreshTikTokAccessToken } from "./tokens";

const CHANNEL = "tiktok_shop";
const FIRST_SYNC_SECONDS = 7 * 24 * 60 * 60;
const OVERLAP_SECONDS = 2 * 60 * 60;

export interface TikTokOrderSyncSummary {
  synced: number;
  created: number;
  updated: number;
  pages: number;
  shops: number;
  since: number;
  initialImport: boolean;
  automationEventsQueued: number;
}

export async function syncTikTokOrders(
  organizationId: string,
  options: { maxPagesPerShop?: number } = {},
): Promise<TikTokOrderSyncSummary> {
  const connection = await loadTikTokConnection(organizationId);
  if (!connection) throw new Error("TikTok Shop não está conectado.");

  const lockToken = await acquireTikTokSyncLock(organizationId);
  if (!lockToken) {
    throw new Error("Uma sincronização TikTok Shop já está em andamento para esta organização.");
  }

  try {
    assertOrderScope(connection.config.grantedScopes);

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
        action: "integration.tiktok.orders_synced",
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    const initialImport = !lastSync;
    const nowSeconds = Math.floor(Date.now() / 1000);
    const since = lastSync
      ? Math.max(0, Math.floor(lastSync.createdAt.getTime() / 1000) - OVERLAP_SECONDS)
      : nowSeconds - FIRST_SYNC_SECONDS;

    const summary: TikTokOrderSyncSummary = {
      synced: 0,
      created: 0,
      updated: 0,
      pages: 0,
      shops: shops.length,
      since,
      initialImport,
      automationEventsQueued: 0,
    };

    for (const shop of shops) {
      let pageToken: string | undefined;
      const maxPages = Math.min(50, Math.max(1, options.maxPagesPerShop ?? 20));

      for (let page = 0; page < maxPages; page += 1) {
        const result = await searchTikTokOrders(accessToken, shop.cipher, {
          updateTimeGe: since,
          pageToken,
          pageSize: 100,
        });

        const queueEvents: Array<{
          entityType: string;
          entityId: string;
          payload: unknown;
        }> = [];
        const queueOrderIds: string[] = [];
        const baselineAt = initialImport ? new Date() : undefined;

        if (result.orders.length > 0) {
          const ids = result.orders.map((order) => String(order.id)).filter(Boolean);
          const existing = await db.order.findMany({
            where: {
              organizationId,
              channel: CHANNEL,
              externalId: { in: ids },
            },
            select: { externalId: true },
          });
          const existingIds = new Set(existing.map((order) => order.externalId).filter(Boolean));

          for (const order of result.orders) {
            const normalized = normalizeTikTokOrder(order);
            if (!normalized.externalId) continue;

            const persisted = await db.order.upsert({
              where: {
                organizationId_channel_externalId: {
                  organizationId,
                  channel: CHANNEL,
                  externalId: normalized.externalId,
                },
              },
              create: {
                organizationId,
                externalId: normalized.externalId,
                channel: CHANNEL,
                status: normalized.status,
                totalCents: normalized.totalCents,
                sourceShopCipher: shop.cipher,
                sourceShopName: shop.name ?? null,
                orderCreatedEventAt: baselineAt,
              },
              update: {
                status: normalized.status,
                totalCents: normalized.totalCents,
                sourceShopCipher: shop.cipher,
                sourceShopName: shop.name ?? null,
                ...(initialImport ? { orderCreatedEventAt: baselineAt } : {}),
              },
            });

            summary.synced += 1;
            if (existingIds.has(normalized.externalId)) summary.updated += 1;
            else summary.created += 1;

            if (shouldQueueTikTokOrderEvent({
              initialImport,
              orderCreatedEventAt: persisted.orderCreatedEventAt,
            })) {
              queueOrderIds.push(persisted.id);
              queueEvents.push({
                entityType: "Order",
                entityId: persisted.id,
                payload: {
                  event: "order.created",
                  source: "tiktok_shop",
                  shop: {
                    cipher: shop.cipher,
                    code: shop.code,
                    id: shop.id,
                    name: shop.name,
                    region: shop.region,
                  },
                  order: {
                    id: persisted.id,
                    externalId: persisted.externalId,
                    channel: persisted.channel,
                    status: persisted.status,
                    totalCents: persisted.totalCents,
                    currency: normalized.currency,
                    createTime: normalized.createTime,
                    updateTime: normalized.updateTime,
                  },
                },
              });
            }
          }
        }

        if (queueEvents.length > 0) {
          try {
            const queued = await enqueueAutomationEvents({
              organizationId,
              triggerType: "order.created",
              events: queueEvents,
            });
            summary.automationEventsQueued += queued.events;

            await db.order.updateMany({
              where: {
                organizationId,
                id: { in: queueOrderIds },
                orderCreatedEventAt: null,
              },
              data: { orderCreatedEventAt: new Date() },
            });
          } catch (queueError) {
            console.error(
              "Pedidos TikTok sincronizados, mas falhou ao enfileirar automações:",
              queueError instanceof Error ? queueError.message : "erro desconhecido",
            );
          }
        }

        summary.pages += 1;
        pageToken = result.nextPageToken;
        if (!pageToken) break;
      }

      if (pageToken) {
        throw new Error(
          `A sincronização da loja ${shop.name ?? shop.code ?? "TikTok"} atingiu o limite seguro de páginas. A execução não será marcada como concluída para evitar perda silenciosa de pedidos.`,
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

function shouldRefresh(accessTokenExpiresAt?: number) {
  if (!accessTokenExpiresAt) return false;
  return accessTokenExpiresAt <= Math.floor(Date.now() / 1000) + 5 * 60;
}

function assertOrderScope(scopes?: string[]) {
  if (!scopes || scopes.length === 0) return;
  if (
    scopes.includes("seller.order.info") ||
    scopes.includes("seller.fs.order&fufillment.management")
  ) return;

  throw new Error("O token TikTok não possui o scope seller.order.info necessário para sincronizar pedidos.");
}
