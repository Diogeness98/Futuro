import { describe, expect, it } from "vitest";
import { estimateOpenAICost } from "./cost";

describe("estimateOpenAICost", () => {
  it("estima custo do modelo econômico", () => {
    expect(estimateOpenAICost("gpt-5.6-luna", { inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBeCloseTo(1.4);
  });

  it("estima custo do modelo de escalonamento", () => {
    expect(estimateOpenAICost("gpt-5.6-sol", { inputTokens: 500_000, outputTokens: 100_000 })).toBeCloseTo(4);
  });

  it("não inventa preço para modelo desconhecido", () => {
    expect(estimateOpenAICost("modelo-desconhecido", { inputTokens: 10, outputTokens: 10 })).toBeNull();
  });
});
