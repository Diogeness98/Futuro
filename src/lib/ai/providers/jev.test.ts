import { describe, expect, it } from "vitest";
import { normalizeJevChoiceResponse } from "./jev";

describe("normalizeJevChoiceResponse", () => {
  it("normaliza answers.decision de Choice", () => {
    const result = normalizeJevChoiceResponse({
      model: "jev-latest",
      answers: {
        decision: {
          type: "choice",
          choice: "technical_support",
          confidence: 0.97,
          probabilities: {
            technical_support: 0.97,
            billing: 0.03,
          },
        },
      },
      usage: {
        input_tokens: 123,
        output_tokens: 17,
      },
    }, ["technical_support", "billing"]);

    expect(result.decision).toBe("technical_support");
    expect(result.confidence).toBe(0.97);
    expect(result.probabilities?.technical_support).toBe(0.97);
    expect(result.model).toBe("jev-latest");
    expect(result.usage?.inputTokens).toBe(123);
  });

  it("preserva a grafia canônica das opções", () => {
    const result = normalizeJevChoiceResponse({
      answers: {
        decision: {
          type: "choice",
          choice: "SIM",
          confidence: 0.9,
          probabilities: { SIM: 0.9, NAO: 0.1 },
        },
      },
    }, ["sim", "nao"]);

    expect(result.decision).toBe("sim");
  });

  it("rejeita opção fora dos critérios permitidos", () => {
    expect(() => normalizeJevChoiceResponse({
      answers: {
        decision: {
          type: "choice",
          choice: "outro",
          confidence: 0.8,
        },
      },
    }, ["sim", "nao"])).toThrow(/fora dos critérios/);
  });

  it("rejeita resposta sem Choice válido", () => {
    expect(() => normalizeJevChoiceResponse({
      answers: {
        decision: {
          type: "noul",
        },
      },
    }, ["sim", "nao"])).toThrow(/answers\.decision\.choice/);
  });
});
