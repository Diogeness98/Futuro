import { describe, expect, it } from "vitest";
import { normalizeTikTokOrder } from "./order-normalize";

describe("normalizeTikTokOrder", () => {
  it("normaliza id, status e valor", () => {
    const result = normalizeTikTokOrder({
      id: "576461413038785752",
      status: "AWAITING_SHIPMENT",
      payment: {
        currency: "BRL",
        total_amount: "123.45",
      },
      create_time: 1700000000,
      update_time: 1700000100,
    });

    expect(result.externalId).toBe("576461413038785752");
    expect(result.status).toBe("awaiting_shipment");
    expect(result.totalCents).toBe(12345);
    expect(result.currency).toBe("BRL");
  });

  it("mantém valor zero quando payment não existe", () => {
    const result = normalizeTikTokOrder({ id: "1", status: "UNPAID" });
    expect(result.totalCents).toBe(0);
    expect(result.status).toBe("unpaid");
  });
});
