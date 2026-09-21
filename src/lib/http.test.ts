import { describe, expect, it } from "vitest";
import { moneyToCents } from "./http";

describe("moneyToCents", () => {
  it("interpreta vírgula decimal brasileira", () => {
    expect(moneyToCents("10,50")).toBe(1050);
  });

  it("interpreta ponto decimal", () => {
    expect(moneyToCents("10.50")).toBe(1050);
  });

  it("interpreta milhar brasileiro", () => {
    expect(moneyToCents("1.234,56")).toBe(123456);
  });

  it("interpreta milhar internacional", () => {
    expect(moneyToCents("1,234.56")).toBe(123456);
  });

  it("interpreta número enviado por JSON como unidade monetária", () => {
    expect(moneyToCents(10.5)).toBe(1050);
  });

  it("rejeita negativos", () => {
    expect(moneyToCents("-10,00")).toBe(0);
  });
});
