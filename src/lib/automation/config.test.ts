import { describe, expect, it } from "vitest";
import { buildAutomationAction, parseAutomationAction } from "./config";

describe("automation config", () => {
  it("normaliza opções Jev e remove duplicadas", () => {
    const action = buildAutomationAction({
      type: "jev.decide",
      instruction: "Escolha uma ação",
      optionsText: "processar, revisar, processar",
    });

    expect(action.type).toBe("jev.decide");
    if (action.type === "jev.decide") {
      expect(action.options).toEqual(["processar", "revisar"]);
    }
  });

  it("exige duas opções para Jev", () => {
    expect(() => buildAutomationAction({
      type: "jev.decide",
      optionsText: "processar",
    })).toThrow(/pelo menos duas opções/);
  });

  it("cria configuração GPT com instrução padrão", () => {
    const action = buildAutomationAction({ type: "gpt.generate" });
    expect(action.type).toBe("gpt.generate");
    if (action.type === "gpt.generate") expect(action.instruction.length).toBeGreaterThan(10);
  });

  it("rejeita ação persistida inválida", () => {
    expect(() => parseAutomationAction({ type: "desconhecida" })).toThrow(/Ação de automação inválida/);
  });
});
