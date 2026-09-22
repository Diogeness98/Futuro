import { db } from "../../db";
import {
  getTikTokOrderDetails,
  type TikTokAuthorizedShop,
} from "./client";
import { persistTikTokOrderDetail } from "./order-detail";

const CHANNEL = "tiktok_shop";
const MAX_IDS_PER_BATCH = 50;

export interface TikTokOrderDetailSyncSummary {
  batches: number;
  requested: number;
  synced: number;
  failedBatches: number;
  itemsSynced: number;
}

export async function syncTikTokOrderDetailBacklog(input: {
  organizationId: string;
  accessToken: string;
  shops: TikTokAuthorizedShop[];
  maxBatches: number;
}): Promise<TikTokOrderDetailSyncSummary> {
  const summary: TikTokOrderDetailSyncSummary = {
    batches: 0,
    requested: 0,
    synced: 0,
    failedBatches: 0,
    itemsSynced: 0,
  };

  const maxBatches = Math.min(10, Math.max(0, Math.floor(input.maxBatches)));
  if (maxBatches === 0) return summary;

  for (const shop of input.shops) {
    if (!shop.cipher || summary.batches >= maxBatches) break;

    while (summary.batches < maxBatches) {
      const backlog = await db.order.findMany({
        where: {
          organizationId: input.organizationId,
          channel: CHANNEL,
          sourceShopCipher: shop.cipher,
          externalId: { not: null },
          detailsSyncedAt: null,
        },
        select: {
          externalId: true,
        },
        orderBy: [
          { externalUpdatedAt: "asc" },
          { createdAt: "asc" },
        ],
        take: MAX_IDS_PER_BATCH,
      });

      const ids = backlog
        .map((order) => order.externalId)
        .filter((id): id is string => Boolean(id));

      if (ids.length === 0) break;

      summary.batches += 1;
      summary.requested += ids.length;

      try {
        const details = await getTikTokOrderDetails(
          input.accessToken,
          shop.cipher,
          ids,
        );

        for (const detail of details) {
          try {
            const persisted = await persistTikTokOrderDetail(
              input.organizationId,
              detail,
              {
                cipher: shop.cipher,
                name: shop.name ?? null,
              },
            );

            if (!persisted) continue;
            summary.synced += 1;
            summary.itemsSynced += persisted.items.length;
          } catch (error) {
            console.error(
              "Falha ao persistir detalhe de pedido TikTok:",
              error instanceof Error ? error.message : "erro desconhecido",
            );
          }
        }

        // Se a API não devolver algum ID solicitado, ele permanece com
        // detailsSyncedAt=null e volta para o backlog no próximo ciclo.
        if (details.length === 0) break;
      } catch (error) {
        summary.failedBatches += 1;
        console.error(
          "Falha ao buscar lote de detalhes TikTok:",
          error instanceof Error ? error.message : "erro desconhecido",
        );
        break;
      }
    }
  }

  return summary;
}
