import { aiConfig } from "../config";
import type { JevDecision } from "../types";

interface JevInput {
  state: string;
  options: string[];
}

export async function decideWithJev(input: JevInput): Promise<JevDecision> {
  if (aiConfig.jev.mode === "mock") return mockJevDecision(input);
  if (!aiConfig.jev.apiKey || !aiConfig.jev.apiUrl) throw new Error("JEV_API_KEY/JEV_API_URL não configurados.");

  /*
   * Jev está em early access. Mantemos todo o transporte isolado neste arquivo.
   * Quando a conta TypeSafe fornecer o contrato exato do endpoint, somente este
   * adapter precisa ser ajustado; o restante do Futuro continua inalterado.
   */
  const response = await fetch(aiConfig.jev.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${aiConfig.jev.apiKey}`,
    },
    body: JSON.stringify({
      state: input.state,
      questions: [{ key: "decision", type: "choice", options: input.options }],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Jev API falhou (${response.status}): ${details.slice(0, 500)}`);
  }

  return normalizeJevResponse(await response.json(), input.options);
}

function normalizeJevResponse(raw: unknown, options: string[]): JevDecision {
  const data = raw as Record<string, unknown>;
  const nested = (data.decision ?? data.result ?? data.output ?? data) as Record<string, unknown> | string;
  const decision = typeof nested === "string"
    ? nested
    : String(nested.choice ?? nested.answer ?? nested.value ?? data.choice ?? data.answer ?? "");

  const confidenceRaw = typeof nested === "object" ? (nested.confidence ?? nested.probability) : data.confidence;
  const confidence = Number(confidenceRaw ?? 0);
  if (!decision || !options.some((option) => option.toLowerCase() === decision.toLowerCase())) {
    throw new Error("Resposta do Jev não pôde ser normalizada para uma opção permitida.");
  }

  return { decision, confidence: Number.isFinite(confidence) ? confidence : 0, raw };
}

function mockJevDecision(input: JevInput): JevDecision {
  if (input.options.length === 0) throw new Error("Jev precisa de pelo menos uma opção.");
  return {
    decision: input.options[0],
    confidence: 0.5,
    probabilities: Object.fromEntries(input.options.map((option, index) => [option, index === 0 ? 0.5 : 0.5 / Math.max(1, input.options.length - 1)])),
    raw: { mode: "mock", warning: "Não executar automaticamente decisões mock." },
  };
}
