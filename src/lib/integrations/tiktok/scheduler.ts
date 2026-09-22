import { Prisma } from "../../../generated/prisma/client";
import { recordActivity } from "../../activity";
import { db } from "../../db";
import { syncTikTokOrders } from "./order-sync";

export interface TikTokScheduledSyncSummary {
  organizations: number;
  succeeded: number;
  failed: number;
  ordersSynced: number;
  ordersCreated: number;
  ordersUpdated: number;
  automationEventsQueued: number;
}

export async function syncConnectedTikTokOrganizations(input: {
  organizationLimit?: number;
  maxPagesPerShop?: number;
} = {}): Promise<TikTokScheduledSyncSummary> {
  const organizationLimit = Math.min(20, Math.max(1, input.organizationLimit ?? 5));
  const maxPagesPerShop = Math.min(50, Math.max(1, input.maxPagesPerShop ?? 20));

  const connections = await db.integration.findMany({
    where: {
      provider: "tiktok_shop",
      status: "connected",
    },
    select: {
      organizationId: true,
    },
    orderBy: { updatedAt: "asc" },
    take: organizationLimit,
  });

  const summary: TikTokScheduledSyncSummary = {
    organizations: connections.length,
    succeeded: 0,
    failed: 0,
    ordersSynced: 0,
    ordersCreated: 0,
    ordersUpdated: 0,
    automationEventsQueued: 0,
  };

  for (const connection of connections) {
    try {
      const result = await syncTikTokOrders(connection.organizationId, {
        maxPagesPerShop,
      });

      summary.succeeded += 1;
      summary.ordersSynced += result.synced;
      summary.ordersCreated += result.created;
      summary.ordersUpdated += result.updated;
      summary.automationEventsQueued += result.automationEventsQueued;

      await recordActivity({
        organizationId: connection.organizationId,
        actorType: "system",
        action: "integration.tiktok.orders_synced",
        entityType: "Integration",
        metadata: toJson({
          provider: "tiktok_shop",
          source: "scheduler",
          synced: result.synced,
          created: result.created,
          updated: result.updated,
          pages: result.pages,
          shops: result.shops,
          automationEventsQueued: result.automationEventsQueued,
        }),
      });
    } catch (error) {
      summary.failed += 1;
      const message = error instanceof Error ? error.message : "Falha desconhecida no sync TikTok.";

      await recordActivity({
        organizationId: connection.organizationId,
        actorType: "system",
        action: "integration.tiktok.orders_sync_failed",
        entityType: "Integration",
        metadata: toJson({
          provider: "tiktok_shop",
          source: "scheduler",
          error: message.slice(0, 300),
        }),
      });
    }
  }

  return summary;
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
