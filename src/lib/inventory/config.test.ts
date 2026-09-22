import { describe, expect, it } from "vitest";
import { shouldEmitLowStockEvent } from "./config";

describe("shouldEmitLowStockEvent", () => {
  it("dispara para produto novo já em estoque baixo", () => {
    expect(shouldEmitLowStockEvent({
      stock: 3,
      active: true,
      threshold: 5,
    })).toBe(true);
  });

  it("dispara ao cruzar o limiar", () => {
    expect(shouldEmitLowStockEvent({
      stock: 5,
      active: true,
      threshold: 5,
      previousStock: 6,
      previousActive: true,
    })).toBe(true);
  });

  it("não repete enquanto continua abaixo do limiar", () => {
    expect(shouldEmitLowStockEvent({
      stock: 3,
      active: true,
      threshold: 5,
      previousStock: 4,
      previousActive: true,
    })).toBe(false);
  });

  it("dispara ao reativar produto que já está baixo", () => {
    expect(shouldEmitLowStockEvent({
      stock: 2,
      active: true,
      threshold: 5,
      previousStock: 2,
      previousActive: false,
    })).toBe(true);
  });

  it("não dispara para produto inativo ou acima do limiar", () => {
    expect(shouldEmitLowStockEvent({
      stock: 2,
      active: false,
      threshold: 5,
    })).toBe(false);

    expect(shouldEmitLowStockEvent({
      stock: 7,
      active: true,
      threshold: 5,
    })).toBe(false);
  });
});
