import { describe, expect, it } from "vitest";
import { parseStructuredDecisionText } from "./openai";

describe("parseStructuredDecisionText", () => {
  const options = ["processar", "revisar"];

  it("aceita uma decisão permitida", () => {
    const result = parseStructuredDecisionText(
      JSON.stringify({ decision: "processar", justification: "Pedido sem sinais de exceção." }),
      options,
    );

    expect(result.decision).toBe("processar");
    expect(result.justification).toContain("Pedido");
  });

  it("rejeita decisão fora do enum permitido", () => {
    expect(() => parseStructuredDecisionText(
      JSON.stringify({ decision: "cancelar", justification: "Teste" }),
      options,
    )).toThrow(/fora das opções/);
  });

  it("rejeita JSON inválido", () => {
    expect(() => parseStructuredDecisionText("processar", options)).toThrow(/JSON inválido/);
  });

  it("rejeita justificativa vazia", () => {
    expect(() => parseStructuredDecisionText(
      JSON.stringify({ decision: "revisar", justification: "" }),
      options,
    )).toThrow(/sem justificativa/);
  });
});
