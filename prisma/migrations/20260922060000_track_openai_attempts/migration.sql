ALTER TABLE "AiDecision"
ADD COLUMN "openAiAttempted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "openAiInputTokens" INTEGER,
ADD COLUMN "openAiOutputTokens" INTEGER;

UPDATE "AiDecision"
SET
  "openAiAttempted" = true,
  "openAiInputTokens" = "inputTokens",
  "openAiOutputTokens" = "outputTokens"
WHERE "provider" = 'openai';
