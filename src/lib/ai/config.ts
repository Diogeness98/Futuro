function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export const aiConfig = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? "",
    defaultModel: process.env.OPENAI_DEFAULT_MODEL ?? "gpt-5.6-luna",
    escalationModel: process.env.OPENAI_ESCALATION_MODEL ?? "gpt-5.6-sol",
    maxInputChars: numberFromEnv("OPENAI_MAX_INPUT_CHARS", 12_000),
  },
  jev: {
    mode: process.env.JEV_MODE ?? "mock",
    apiKey: process.env.JEV_API_KEY ?? "",
    apiUrl: process.env.JEV_API_URL ?? "",
    autoExecuteThreshold: numberFromEnv("JEV_AUTO_EXECUTE_THRESHOLD", 0.92),
    gptReviewThreshold: numberFromEnv("JEV_GPT_REVIEW_THRESHOLD", 0.75),
  },
};
