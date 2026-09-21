import { aiConfig } from "../config";
import type { ProviderUsage } from "../types";

interface OpenAIResponseBody {
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
}

export async function generateWithOpenAI(input: string, model = aiConfig.openai.defaultModel): Promise<{ text: string; usage?: ProviderUsage }> {
  if (!aiConfig.openai.apiKey) throw new Error("OPENAI_API_KEY não configurada.");
  if (input.length > aiConfig.openai.maxInputChars) throw new Error(`Entrada excede o limite econômico de ${aiConfig.openai.maxInputChars} caracteres.`);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${aiConfig.openai.apiKey}`,
    },
    body: JSON.stringify({
      model,
      input,
      store: false,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI API falhou (${response.status}): ${details.slice(0, 500)}`);
  }

  const body = (await response.json()) as OpenAIResponseBody;
  const text = extractOutputText(body);
  if (!text) throw new Error("OpenAI respondeu sem texto utilizável.");

  return {
    text,
    usage: body.usage ? {
      inputTokens: body.usage.input_tokens,
      outputTokens: body.usage.output_tokens,
      totalTokens: body.usage.total_tokens,
    } : undefined,
  };
}

export function extractOutputText(body: OpenAIResponseBody): string {
  return (body.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text" || typeof part.text === "string")
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
}
