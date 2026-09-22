import { describe, expect, it } from "vitest";
import { evaluateOpenAiBudget, evaluateOpenAiReservation } from "./budget";

const limits = {
  calls: 10,
  inputTokens: 1000,
  outputTokens: 500,
};

describe("evaluateOpenAiBudget", () => {
  it("permite uso abaixo dos limites", () => {
    const result = evaluateOpenAiBudget({ calls: 2, inputTokens: 200, outputTokens: 100 }, limits);
    expect(result.allowed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("bloqueia ao atingir limite de chamadas", () => {
    const result = evaluateOpenAiBudget({ calls: 10, inputTokens: 200, outputTokens: 100 }, limits);
    expect(result.allowed).toBe(false);
    expect(result.reasons[0]).toContain("chamadas");
  });

  it("bloqueia ao atingir limite de entrada", () => {
    const result = evaluateOpenAiBudget({ calls: 2, inputTokens: 1000, outputTokens: 100 }, limits);
    expect(result.allowed).toBe(false);
    expect(result.reasons[0]).toContain("entrada");
  });

  it("bloqueia ao atingir limite de saída", () => {
    const result = evaluateOpenAiBudget({ calls: 2, inputTokens: 200, outputTokens: 500 }, limits);
    expect(result.allowed).toBe(false);
    expect(result.reasons[0]).toContain("saída");
  });

  it("trata limite zero como desativado", () => {
    const result = evaluateOpenAiBudget(
      { calls: 999, inputTokens: 999999, outputTokens: 999999 },
      { calls: 0, inputTokens: 0, outputTokens: 0 },
    );
    expect(result.allowed).toBe(true);
  });
});


describe("evaluateOpenAiReservation", () => {
  const status = {
    allowed: true,
    windowHours: 24,
    calls: 8,
    inputTokens: 900,
    outputTokens: 350,
    limits,
    reasons: [],
  };

  it("permite chamada que cabe no saldo restante", () => {
    const result = evaluateOpenAiReservation(status, 150, 100);
    expect(result.allowed).toBe(true);
    expect(result.estimatedInputTokens).toBe(50);
    expect(result.reservedOutputTokens).toBe(100);
  });

  it("bloqueia antes de ultrapassar tokens de entrada", () => {
    const result = evaluateOpenAiReservation(status, 400, 50);
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(" ")).toContain("Entrada estimada");
  });

  it("bloqueia antes de ultrapassar tokens de saída", () => {
    const result = evaluateOpenAiReservation(status, 30, 200);
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(" ")).toContain("Reserva de saída");
  });

  it("respeita orçamento já bloqueado", () => {
    const result = evaluateOpenAiReservation({
      ...status,
      allowed: false,
      reasons: ["Limite já atingido."],
    }, 30, 20);

    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("Limite já atingido.");
  });
});
