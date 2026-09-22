import { afterEach, describe, expect, it } from "vitest";
import { db } from "../../db";
import { persistTikTokOrderDetail } from "./order-detail";

const describeDb = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;
const organizations: string[] = [];

describeDb("TikTok order detail persistence", () => {
  afterEach(async () => {
    if (organizations.length === 0) return;
    await db.organization.deleteMany({
      where: { id: { in: organizations.splice(0) } },
    });
  });

  it("persiste campos operacionais e substitui itens de forma idempotente", async () => {
    const organization = await db.organization.create({
      data: { name: "Order Detail Test" },
    });
    organizations.push(organization.id);

    const product = await db.product.create({
      data: {
        organizationId: organization.id,
        channel: "tiktok_shop",
        externalId: "product-1",
        name: "Produto TikTok",
        stock: 10,
      },
    });

    await db.order.create({
      data: {
        organizationId: organization.id,
        channel: "tiktok_shop",
        externalId: "order-1",
        status: "pending",
        totalCents: 15000,
        sourceShopCipher: "SHOP_CIPHER_1",
      },
    });

    const first = await persistTikTokOrderDetail(
      organization.id,
      {
        id: "order-1",
        status: "AWAITING_SHIPMENT",
        need_upload_invoice: "NEED_INVOICE",
        order_type: "NORMAL",
        fulfillment_type: "FULFILLMENT_BY_SELLER",
        shipping_type: "SELLER",
        line_items: [
          {
            id: "line-1",
            product_id: "product-1",
            product_name: "Produto TikTok",
            sku_id: "sku-1",
            seller_sku: "SKU-1",
            sale_price: "100.00",
            currency: "BRL",
          },
          {
            id: "line-2",
            product_id: "product-2",
            product_name: "Produto sem vínculo",
            sku_id: "sku-2",
            seller_sku: "SKU-2",
            sale_price: "50.00",
            currency: "BRL",
          },
        ],
      },
      { cipher: "SHOP_CIPHER_1", name: "Loja Brasil" },
    );

    expect(first?.status).toBe("awaiting_shipment");
    expect(first?.needUploadInvoice).toBe("NEED_INVOICE");
    expect(first?.fulfillmentType).toBe("FULFILLMENT_BY_SELLER");
    expect(first?.shippingType).toBe("SELLER");
    expect(first?.sourceShopName).toBe("Loja Brasil");
    expect(first?.detailsSyncedAt).not.toBeNull();
    expect(first?.items).toHaveLength(2);
    expect(first?.items.find((item) => item.externalId === "line-1")?.productId).toBe(product.id);
    expect(first?.items.find((item) => item.externalId === "line-1")?.unitCents).toBe(10000);

    const second = await persistTikTokOrderDetail(
      organization.id,
      {
        id: "order-1",
        status: "IN_TRANSIT",
        need_upload_invoice: "INVOICE_UPLOADED",
        line_items: [
          {
            id: "line-1",
            product_id: "product-1",
            product_name: "Produto TikTok",
            sku_id: "sku-1",
            seller_sku: "SKU-1",
            sale_price: "110.00",
            currency: "BRL",
          },
        ],
      },
      { cipher: "SHOP_CIPHER_1", name: "Loja Brasil" },
    );

    expect(second?.status).toBe("in_transit");
    expect(second?.needUploadInvoice).toBe("INVOICE_UPLOADED");
    expect(second?.items).toHaveLength(1);
    expect(second?.items[0]?.externalId).toBe("line-1");
    expect(second?.items[0]?.unitCents).toBe(11000);
  });
});
