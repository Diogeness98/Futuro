import type { ProviderUsage } from "./types";

type Rate = { input: number; output: number };

// USD por 1 milhão de tokens. Valores de referência em 2026-09-21.
// O cálculo é estimativo e fica isolado aqui para atualização simples.
const OPENAI_RATES: Record<string, Rate> = {
  "gpt-5.6-luna": { input: 0.2, output: 1.2 },
  "gpt-5.6-terra": { input: 2, output: 12 },
  "gpt-5.6-sol": { input: 4, output: 20 },
};

export function estimateOpenAICost(model: string | undefined, usage: ProviderUsage | undefined): number | null {
  if (!model || !usage) return null;
  const rate = resolveRate(model);
  if (!rate) return null;

  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  return (inputTokens / 1_000_000) * rate.input + (outputTokens / 1_000_000) * rate.output;
}

function resolveRate(model: string): Rate | undefined {
  const exact = OPENAI_RATES[model];
  if (exact) return exact;
  const base = Object.keys(OPENAI_RATES).find((name) => model.startsWith(name));
  return base ? OPENAI_RATES[base] : undefined;
}
