type ReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh" | "max";

function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function booleanFromEnv(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function effortFromEnv(name: string, fallback: ReasoningEffort): ReasoningEffort {
  const value = process.env[name];
  const allowed: ReasoningEffort[] = ["none", "low", "medium", "high", "xhigh", "max"];
  return allowed.includes(value as ReasoningEffort) ? (value as ReasoningEffort) : fallback;
}

export const aiConfig = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? "",
    defaultModel: process.env.OPENAI_DEFAULT_MODEL ?? "gpt-5.6-luna",
    escalationModel: process.env.OPENAI_ESCALATION_MODEL ?? "gpt-5.6-sol",
    maxInputChars: numberFromEnv("OPENAI_MAX_INPUT_CHARS", 12_000),
    defaultReasoningEffort: effortFromEnv("OPENAI_DEFAULT_REASONING_EFFORT", "low"),
    escalationReasoningEffort: effortFromEnv("OPENAI_ESCALATION_REASONING_EFFORT", "medium"),
    defaultMaxOutputTokens: numberFromEnv("OPENAI_DEFAULT_MAX_OUTPUT_TOKENS", 1_600),
    escalationMaxOutputTokens: numberFromEnv("OPENAI_ESCALATION_MAX_OUTPUT_TOKENS", 6_000),
    maxCallsPer24h: numberFromEnv("OPENAI_MAX_CALLS_PER_24H", 100),
    maxInputTokensPer24h: numberFromEnv("OPENAI_MAX_INPUT_TOKENS_PER_24H", 200_000),
    maxOutputTokensPer24h: numberFromEnv("OPENAI_MAX_OUTPUT_TOKENS_PER_24H", 40_000),
    timeoutMs: numberFromEnv("OPENAI_TIMEOUT_MS", 30_000),
  },
  jev: {
    mode: process.env.JEV_MODE ?? "mock",
    apiKey: process.env.JEV_API_KEY ?? process.env.TYPESAFE_API_KEY ?? "",
    apiUrl: process.env.JEV_API_URL ?? "https://api.typesafe.ai/v1/systemone",
    model: process.env.JEV_MODEL ?? "jev-latest",
    autoExecuteThreshold: numberFromEnv("JEV_AUTO_EXECUTE_THRESHOLD", 0.92),
    gptReviewThreshold: numberFromEnv("JEV_GPT_REVIEW_THRESHOLD", 0.75),
    timeoutMs: numberFromEnv("JEV_TIMEOUT_MS", 12_000),
    fallbackToGptOnError: booleanFromEnv("JEV_FALLBACK_TO_GPT_ON_ERROR", false),
  },
};
