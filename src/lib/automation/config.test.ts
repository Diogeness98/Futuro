import { describe, expect, it } from "vitest";
import { buildAutomationAction, parseAutomationAction } from "./config";

describe("automation config", () => {
  it("normaliza opções Jev e remove duplicadas", () => {
    const action = buildAutomationAction({
      type: "jev.decide",
      instruction: "Escolha uma ação",
      optionsText: "processar, revisar, processar",
      criteriaText: "processar: Pedido normal\nrevisar: Pedido com exceção",
    });

    expect(action.type).toBe("jev.decide");
    if (action.type === "jev.decide") {
      expect(action.options).toEqual(["processar", "revisar"]);
      expect(action.criteria).toEqual({
        processar: "Pedido normal",
        revisar: "Pedido com exceção",
      });
    }
  });

  it("usa nome da opção como critério quando descrição falta", () => {
    const action = buildAutomationAction({
      type: "jev.decide",
      optionsText: "aprovar,revisar",
      criteriaText: "aprovar: Pode seguir",
    });

    expect(action.type).toBe("jev.decide");
    if (action.type === "jev.decide") {
      expect(action.criteria.aprovar).toBe("Pode seguir");
      expect(action.criteria.revisar).toBe("revisar");
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
