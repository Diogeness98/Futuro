import { describe, expect, it } from "vitest";
import { normalizeTikTokProduct } from "./product-normalize";

describe("normalizeTikTokProduct", () => {
  it("agrega variantes, estoque e menor preço", () => {
    const result = normalizeTikTokProduct({
      id: "product-1",
      title: "Camiseta",
      status: "ACTIVATE",
      update_time: 1_700_000_000,
      skus: [
        {
          id: "sku-1",
          seller_sku: "CAM-P",
          price: { currency: "BRL", sale_price: "59.90" },
          inventory: [{ quantity: 2 }, { quantity: 3 }],
        },
        {
          id: "sku-2",
          seller_sku: "CAM-M",
          price: { currency: "BRL", sale_price: "69.90" },
          inventory: [{ quantity: 4 }],
        },
      ],
    });

    expect(result?.externalId).toBe("product-1");
    expect(result?.sku).toBeNull();
    expect(result?.priceCents).toBe(5990);
    expect(result?.stock).toBe(9);
    expect(result?.currency).toBe("BRL");
    expect(result?.active).toBe(true);
    expect(result?.variants).toHaveLength(2);
  });

  it("usa seller_sku no produto quando há uma única variante", () => {
    const result = normalizeTikTokProduct({
      id: "product-2",
      title: "Caneca",
      status: "SELLER_DEACTIVATED",
      skus: [{
        id: "sku-3",
        seller_sku: "CAN-01",
        list_price: { amount: "30.00", currency: "BRL" },
        inventory: [{ quantity: 1 }],
      }],
    });

    expect(result?.sku).toBe("CAN-01");
    expect(result?.priceCents).toBe(3000);
    expect(result?.active).toBe(false);
  });

  it("rejeita produto sem ID TikTok", () => {
    expect(normalizeTikTokProduct({ title: "Sem ID" })).toBeNull();
  });
});
