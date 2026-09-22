import { afterEach, describe, expect, it } from "vitest";
import { db } from "../../db";
import { persistTikTokProduct } from "./product-sync";

const describeDb = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;
const organizations: string[] = [];

describeDb("TikTok product sync integration", () => {
  afterEach(async () => {
    if (organizations.length === 0) return;
    await db.organization.deleteMany({
      where: { id: { in: organizations.splice(0) } },
    });
  });

  it("cria produto externo e mantém variantes sincronizadas", async () => {
    const organization = await db.organization.create({
      data: { name: "TikTok Catalog Test" },
    });
    organizations.push(organization.id);

    const first = await persistTikTokProduct(organization.id, {
      externalId: "product-1",
      name: "Camiseta",
      sku: null,
      priceCents: 5990,
      currency: "BRL",
      stock: 7,
      active: true,
      externalStatus: "ACTIVATE",
      externalUpdatedAt: new Date("2026-09-22T01:00:00Z"),
      variants: [
        {
          externalId: "sku-1",
          sellerSku: "CAM-P",
          priceCents: 5990,
          currency: "BRL",
          stock: 3,
        },
        {
          externalId: "sku-2",
          sellerSku: "CAM-M",
          priceCents: 6990,
          currency: "BRL",
          stock: 4,
        },
      ],
    });

    expect(first.channel).toBe("tiktok_shop");
    expect(first.variants).toHaveLength(2);

    const second = await persistTikTokProduct(organization.id, {
      externalId: "product-1",
      name: "Camiseta atualizada",
      sku: "CAM-P",
      priceCents: 6490,
      currency: "BRL",
      stock: 5,
      active: false,
      externalStatus: "SELLER_DEACTIVATED",
      externalUpdatedAt: new Date("2026-09-22T02:00:00Z"),
      variants: [
        {
          externalId: "sku-1",
          sellerSku: "CAM-P",
          priceCents: 6490,
          currency: "BRL",
          stock: 5,
        },
      ],
    });

    expect(second.id).toBe(first.id);
    expect(second.name).toBe("Camiseta atualizada");
    expect(second.stock).toBe(5);
    expect(second.active).toBe(false);
    expect(second.variants).toHaveLength(1);
    expect(second.variants[0]?.externalId).toBe("sku-1");
    expect(second.variants[0]?.priceCents).toBe(6490);

    const removed = await db.productVariant.findFirst({
      where: { productId: first.id, externalId: "sku-2" },
    });
    expect(removed).toBeNull();
  });
});
