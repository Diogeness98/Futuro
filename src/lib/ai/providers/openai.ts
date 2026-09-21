import { aiConfig } from "../config";
import type { ProviderUsage } from "../types";

interface OpenAIResponseBody {
  status?: string;
  incomplete_details?: { reason?: string };
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
}

export interface StructuredDecision {
  decision: string;
  justification: string;
}

export async function generateWithOpenAI(
  input: string,
  model = aiConfig.openai.defaultModel,
): Promise<{ text: string; usage?: ProviderUsage }> {
  validateOpenAiInput(input);

  const response = await requestOpenAI({
    model,
    input,
  });

  const text = extractOutputText(response);
  if (!text) throw new Error("OpenAI respondeu sem texto utilizável.");

  return { text, usage: usageFromResponse(response) };
}

export async function reviewDecisionWithOpenAI(
  input: string,
  allowedOptions: string[],
  model = aiConfig.openai.defaultModel,
): Promise<{ decision: StructuredDecision; usage?: ProviderUsage }> {
  validateOpenAiInput(input);
  if (allowedOptions.length < 2) throw new Error("A revisão estruturada precisa de pelo menos duas opções.");

  const response = await requestOpenAI({
    model,
    input,
    text: {
      format: {
        type: "json_schema",
        name: "futuro_decision_review",
        strict: true,
        schema: {
          type: "object",
          properties: {
            decision: {
              type: "string",
              enum: allowedOptions,
              description: "Uma e somente uma das opções permitidas.",
            },
            justification: {
              type: "string",
              description: "Justificativa curta para auditoria operacional.",
            },
          },
          required: ["decision", "justification"],
          additionalProperties: false,
        },
      },
    },
  });

  const text = extractOutputText(response);
  const decision = parseStructuredDecisionText(text, allowedOptions);

  return { decision, usage: usageFromResponse(response) };
}

export function parseStructuredDecisionText(text: string, allowedOptions: string[]): StructuredDecision {
  if (!text) throw new Error("OpenAI respondeu sem decisão estruturada.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("OpenAI retornou JSON inválido na revisão de decisão.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("OpenAI retornou formato inválido na revisão de decisão.");
  }

  const record = parsed as Record<string, unknown>;
  const decision = typeof record.decision === "string" ? record.decision : "";
  const justification = typeof record.justification === "string" ? record.justification.trim() : "";

  if (!allowedOptions.includes(decision)) {
    throw new Error("OpenAI retornou uma decisão fora das opções permitidas.");
  }
  if (!justification) {
    throw new Error("OpenAI retornou revisão sem justificativa.");
  }

  return { decision, justification };
}

async function requestOpenAI(input: {
  model: string;
  input: string;
  text?: Record<string, unknown>;
}): Promise<OpenAIResponseBody> {
  const escalated = input.model === aiConfig.openai.escalationModel;
  const reasoningEffort = escalated
    ? aiConfig.openai.escalationReasoningEffort
    : aiConfig.openai.defaultReasoningEffort;
  const maxOutputTokens = escalated
    ? aiConfig.openai.escalationMaxOutputTokens
    : aiConfig.openai.defaultMaxOutputTokens;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${aiConfig.openai.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      input: input.input,
      store: false,
      reasoning: { effort: reasoningEffort },
      max_output_tokens: maxOutputTokens,
      ...(input.text ? { text: input.text } : {}),
    }),
    signal: AbortSignal.timeout(aiConfig.openai.timeoutMs),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI API falhou (${response.status}): ${details.slice(0, 500)}`);
  }

  const body = (await response.json()) as OpenAIResponseBody;
  if (body.status === "incomplete") {
    throw new Error(
      `OpenAI interrompeu a resposta pelo limite econômico (${body.incomplete_details?.reason ?? "limite de saída"}).`,
    );
  }

  return body;
}

function validateOpenAiInput(input: string) {
  if (!aiConfig.openai.apiKey) throw new Error("OPENAI_API_KEY não configurada.");
  if (input.length > aiConfig.openai.maxInputChars) {
    throw new Error(`Entrada excede o limite econômico de ${aiConfig.openai.maxInputChars} caracteres.`);
  }
}

function usageFromResponse(body: OpenAIResponseBody): ProviderUsage | undefined {
  return body.usage ? {
    inputTokens: body.usage.input_tokens,
    outputTokens: body.usage.output_tokens,
    totalTokens: body.usage.total_tokens,
  } : undefined;
}

export function extractOutputText(body: OpenAIResponseBody): string {
  return (body.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text" || typeof part.text === "string")
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
}
