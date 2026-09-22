import { describe, expect, it } from "vitest";
import { buildAutomationAction, buildAutomationConditions, evaluateAutomationConditions, parseAutomationAction } from "./config";

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


describe("automation conditions", () => {
  it("cria condição numérica a partir do formulário", () => {
    const conditions = buildAutomationConditions({
      path: "order.totalCents",
      operator: "gte",
      value: "50000",
    });

    expect(conditions).toEqual([{
      path: "order.totalCents",
      operator: "gte",
      value: 50000,
    }]);
  });

  it("permite quando a condição numérica é atendida", () => {
    const result = evaluateAutomationConditions(
      { order: { totalCents: 75000 } },
      [{ path: "order.totalCents", operator: "gte", value: 50000 }],
    );

    expect(result.matched).toBe(true);
  });

  it("pula quando a condição não é atendida", () => {
    const result = evaluateAutomationConditions(
      { product: { stock: 4 } },
      [{ path: "product.stock", operator: "lte", value: 2 }],
    );

    expect(result.matched).toBe(false);
    expect(result.reason).toContain("product.stock");
  });

  it("avalia contexto recebido como JSON string", () => {
    const result = evaluateAutomationConditions(
      JSON.stringify({ order: { channel: "tiktok_shop" } }),
      [{ path: "order.channel", operator: "eq", value: "tiktok_shop" }],
    );

    expect(result.matched).toBe(true);
  });

  it("sem condição sempre permite seguir sem IA adicional", () => {
    expect(evaluateAutomationConditions({ anything: true }, []).matched).toBe(true);
  });

  it("rejeita paths inseguros", () => {
    expect(() => buildAutomationConditions({
      path: "__proto__.polluted",
      operator: "eq",
      value: "true",
    })).toThrow(/Campo de condição inválido/);
  });

  it("exige condição completa quando algum campo é preenchido", () => {
    expect(() => buildAutomationConditions({
      path: "order.totalCents",
      value: "50000",
    })).toThrow(/Condição determinística incompleta/);
  });
});
