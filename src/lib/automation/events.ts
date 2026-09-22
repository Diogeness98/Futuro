import { enqueueAutomationEvents } from "./queue";

interface LowStockProduct {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  active: boolean;
  updatedAt: Date;
}

export async function enqueueProductLowStockEvent(input: {
  organizationId: string;
  product: LowStockProduct;
  threshold: number;
}) {
  return enqueueAutomationEvents({
    organizationId: input.organizationId,
    triggerType: "product.low_stock",
    events: [{
      entityType: "Product",
      entityId: input.product.id,
      dedupeKey: `Product:${input.product.id}:${input.product.updatedAt.getTime()}`,
      payload: {
        event: "product.low_stock",
        product: {
          id: input.product.id,
          name: input.product.name,
          sku: input.product.sku,
          stock: input.product.stock,
          active: input.product.active,
        },
        threshold: input.threshold,
      },
    }],
  });
}
