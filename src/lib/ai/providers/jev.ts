import { aiConfig } from "../config";
import type { JevDecision } from "../types";

interface JevInput {
  state: string;
  options: string[];
  instructions?: string;
  criteria?: Record<string, string>;
}

interface JevChoiceAnswer {
  type?: string;
  choice?: string;
  confidence?: number;
  probabilities?: Record<string, number>;
}

interface JevSystemOneResponse {
  model?: string;
  answers?: Record<string, JevChoiceAnswer>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

export async function decideWithJev(input: JevInput): Promise<JevDecision> {
  if (aiConfig.jev.mode === "mock") return mockJevDecision(input);
  if (!aiConfig.jev.apiKey) throw new Error("JEV_API_KEY/TYPESAFE_API_KEY não configurada.");
  if (input.options.length < 2) throw new Error("Choice do Jev precisa de pelo menos duas opções.");

  const criteria = buildCriteria(input.options, input.criteria);

  const response = await fetch(aiConfig.jev.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${aiConfig.jev.apiKey}`,
    },
    body: JSON.stringify({
      model: aiConfig.jev.model,
      state: input.state,
      questions: {
        decision: {
          type: "choice",
          instructions: input.instructions ?? "Escolha a opção que melhor representa a decisão correta para este estado.",
          criteria,
        },
      },
    }),
    signal: AbortSignal.timeout(aiConfig.jev.timeoutMs),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Jev API falhou (${response.status}): ${details.slice(0, 500)}`);
  }

  return normalizeJevChoiceResponse(await response.json(), input.options);
}

export function normalizeJevChoiceResponse(raw: unknown, options: string[]): JevDecision {
  const body = raw as JevSystemOneResponse;
  const answer = body.answers?.decision;

  if (!answer || answer.type !== "choice" || !answer.choice) {
    throw new Error("Resposta do Jev não contém answers.decision.choice válido.");
  }

  const canonical = options.find((option) => option.toLowerCase() === answer.choice?.toLowerCase());
  if (!canonical) {
    throw new Error("Jev retornou uma opção fora dos critérios permitidos.");
  }

  const confidence = Number(answer.confidence ?? 0);
  const probabilities = normalizeProbabilities(answer.probabilities, options);

  return {
    decision: canonical,
    confidence: Number.isFinite(confidence) ? clamp01(confidence) : 0,
    probabilities,
    model: body.model,
    usage: {
      inputTokens: body.usage?.input_tokens,
      outputTokens: body.usage?.output_tokens,
    },
    raw,
  };
}

function buildCriteria(options: string[], supplied?: Record<string, string>) {
  return Object.fromEntries(options.map((option) => [
    option,
    supplied?.[option]?.trim() || option,
  ]));
}

function normalizeProbabilities(raw: Record<string, number> | undefined, options: string[]) {
  if (!raw) return undefined;
  return Object.fromEntries(options.map((option) => {
    const matchingKey = Object.keys(raw).find((key) => key.toLowerCase() === option.toLowerCase());
    const value = matchingKey ? Number(raw[matchingKey]) : 0;
    return [option, Number.isFinite(value) ? clamp01(value) : 0];
  }));
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function mockJevDecision(input: JevInput): JevDecision {
  if (input.options.length === 0) throw new Error("Jev precisa de pelo menos uma opção.");
  return {
    decision: input.options[0],
    confidence: 0.5,
    probabilities: Object.fromEntries(input.options.map((option, index) => [
      option,
      index === 0 ? 0.5 : 0.5 / Math.max(1, input.options.length - 1),
    ])),
    model: "mock",
    raw: { mode: "mock", warning: "Não executar automaticamente decisões mock." },
  };
}
