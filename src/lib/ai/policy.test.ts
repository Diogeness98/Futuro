import { describe, expect, it } from "vitest";
import { aiConfig } from "./config";
import { routeTask } from "./policy";

describe("routeTask", () => {
  it("prioriza código em tarefa determinística", () => {
    expect(routeTask({ input: "somar valores", taskType: "deterministic" }).provider).toBe("code");
  });

  it("prioriza Jev em decisão com opções", () => {
    expect(routeTask({ input: "qual categoria?", options: ["A", "B"] }).provider).toBe("jev");
  });

  it("usa modelo econômico para geração comum", () => {
    const result = routeTask({ input: "escreva uma descrição de produto" });
    expect(result.provider).toBe("openai");
    expect(result.model).toBeTruthy();
  });

  it("não pula direto para Work em ação externa", () => {
    const result = routeTask({ input: "entre no site e baixe o arquivo" });
    expect(result.provider).toBe("openai");
    expect(result.model).toBe(aiConfig.openai.defaultModel);
    expect(result.workRecommended).toBe(true);
  });
});
