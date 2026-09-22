import { db } from "../../db";
import { moneyToCents } from "../../http";
import type { TikTokOrderDetail } from "./client";

const CHANNEL = "tiktok_shop";

export async function persistTikTokOrderDetail(
  organizationId: string,
  detail: TikTokOrderDetail,
  sourceShop?: { cipher: string; name?: string | null },
) {
  const externalId = stringValue(detail.id);
  if (!externalId) throw new Error("Detalhe TikTok sem order id.");

  const order = await db.order.findFirst({
    where: {
      organizationId,
      channel: CHANNEL,
      externalId,
    },
    select: { id: true },
  });

  if (!order) return null;

  const lineItems = (detail.line_items ?? [])
    .map(normalizeLineItem)
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const productExternalIds = [...new Set(
    lineItems.map((item) => item.productExternalId).filter(Boolean),
  )] as string[];

  const products = productExternalIds.length > 0
    ? await db.product.findMany({
        where: {
          organizationId,
          channel: CHANNEL,
          externalId: { in: productExternalIds },
        },
        select: { id: true, externalId: true },
      })
    : [];

  const productByExternalId = new Map(
    products
      .filter((product) => Boolean(product.externalId))
      .map((product) => [product.externalId as string, product.id]),
  );

  return db.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        status: detail.status ? String(detail.status).toLowerCase() : undefined,
        needUploadInvoice: stringValue(detail.need_upload_invoice) || null,
        orderType: stringValue(detail.order_type) || null,
        fulfillmentType: stringValue(detail.fulfillment_type) || null,
        shippingType: stringValue(detail.shipping_type) || null,
        sourceShopCipher: sourceShop?.cipher,
        sourceShopName: sourceShop?.name ?? undefined,
        detailsSyncedAt: new Date(),
      },
    });

    await tx.orderItem.deleteMany({ where: { orderId: order.id } });

    if (lineItems.length > 0) {
      await tx.orderItem.createMany({
        data: lineItems.map((item) => ({
          orderId: order.id,
          productId: item.productExternalId
            ? productByExternalId.get(item.productExternalId) ?? null
            : null,
          externalId: item.externalId,
          externalSkuId: item.externalSkuId,
          sellerSku: item.sellerSku,
          name: item.name,
          quantity: 1,
          unitCents: item.unitCents,
          currency: item.currency,
        })),
      });
    }

    return tx.order.findUniqueOrThrow({
      where: { id: updated.id },
      include: {
        items: {
          orderBy: { id: "asc" },
          include: { product: true },
        },
      },
    });
  });
}

function normalizeLineItem(item: NonNullable<TikTokOrderDetail["line_items"]>[number]) {
  const externalId = stringValue(item.id);
  const productExternalId = stringValue(item.product_id) || null;
  const name = stringValue(item.product_name) || stringValue(item.sku_name) || "Item TikTok";
  const currency = stringValue(item.currency) || null;

  if (!externalId && !productExternalId && !name) return null;

  return {
    externalId: externalId || null,
    externalSkuId: stringValue(item.sku_id) || null,
    sellerSku: stringValue(item.seller_sku) || null,
    productExternalId,
    name,
    unitCents: moneyToCents(item.sale_price ?? 0),
    currency,
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}
