import { Prisma } from "../../../generated/prisma/client";
import { recordActivity } from "../../activity";
import { db } from "../../db";
import { syncTikTokOrders } from "./order-sync";
import { syncTikTokProducts } from "./product-sync";

export interface TikTokScheduledSyncSummary {
  organizations: number;
  succeeded: number;
  failed: number;
  ordersSynced: number;
  ordersCreated: number;
  ordersUpdated: number;
  automationEventsQueued: number;
  productSyncAttempted: number;
  productSyncSucceeded: number;
  productSyncFailed: number;
  productsSynced: number;
  productsCreated: number;
  productsUpdated: number;
  productVariants: number;
  productLowStockEventsQueued: number;
}

export async function syncConnectedTikTokOrganizations(input: {
  organizationLimit?: number;
  maxPagesPerShop?: number;
  productSyncIntervalMinutes?: number;
} = {}): Promise<TikTokScheduledSyncSummary> {
  const organizationLimit = Math.min(20, Math.max(1, input.organizationLimit ?? 5));
  const maxPagesPerShop = Math.min(50, Math.max(1, input.maxPagesPerShop ?? 20));
  const productSyncIntervalMinutes = Math.min(
    1440,
    Math.max(5, input.productSyncIntervalMinutes ?? 60),
  );

  const connections = await db.integration.findMany({
    where: {
      provider: "tiktok_shop",
      status: "connected",
    },
    select: {
      id: true,
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
    productSyncAttempted: 0,
    productSyncSucceeded: 0,
    productSyncFailed: 0,
    productsSynced: 0,
    productsCreated: 0,
    productsUpdated: 0,
    productVariants: 0,
    productLowStockEventsQueued: 0,
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

      await db.integration.update({
        where: { id: connection.id },
        data: { status: "connected" },
      });

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
          initialImport: result.initialImport,
          automationEventsQueued: result.automationEventsQueued,
        }),
      });
    } catch (error) {
      summary.failed += 1;
      await db.integration.update({
        where: { id: connection.id },
        data: { status: "connected" },
      }).catch(() => undefined);

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

    if (await catalogSyncDue(connection.organizationId, productSyncIntervalMinutes)) {
      summary.productSyncAttempted += 1;

      try {
        const result = await syncTikTokProducts(connection.organizationId, {
          maxPagesPerShop,
        });

        summary.productSyncSucceeded += 1;
        summary.productsSynced += result.synced;
        summary.productsCreated += result.created;
        summary.productsUpdated += result.updated;
        summary.productVariants += result.variants;
        summary.productLowStockEventsQueued += result.lowStockEventsQueued;

        await recordActivity({
          organizationId: connection.organizationId,
          actorType: "system",
          action: "integration.tiktok.products_synced",
          entityType: "Integration",
          metadata: toJson({
            provider: "tiktok_shop",
            source: "scheduler",
            synced: result.synced,
            created: result.created,
            updated: result.updated,
            variants: result.variants,
            pages: result.pages,
            shops: result.shops,
            initialImport: result.initialImport,
            lowStockEventsQueued: result.lowStockEventsQueued,
          }),
        });
      } catch (error) {
        summary.productSyncFailed += 1;
        const message = error instanceof Error
          ? error.message
          : "Falha desconhecida no sync de catálogo TikTok.";

        await recordActivity({
          organizationId: connection.organizationId,
          actorType: "system",
          action: "integration.tiktok.products_sync_failed",
          entityType: "Integration",
          metadata: toJson({
            provider: "tiktok_shop",
            source: "scheduler",
            error: message.slice(0, 300),
          }),
        });
      }
    }
  }

  return summary;
}

export async function catalogSyncDue(
  organizationId: string,
  intervalMinutes: number,
  now = new Date(),
) {
  const lastSync = await db.activityLog.findFirst({
    where: {
      organizationId,
      action: "integration.tiktok.products_synced",
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (!lastSync) return true;
  return lastSync.createdAt.getTime() <= now.getTime() - intervalMinutes * 60 * 1000;
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
