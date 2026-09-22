export type TaskType = "deterministic" | "decision" | "generation" | "complex";
export type Provider = "code" | "jev" | "openai" | "work";

export interface AiTask {
  input: string;
  taskType?: TaskType;
  options?: string[];
  decisionInstructions?: string;
  criteria?: Record<string, string>;
  requiresExternalInteraction?: boolean;
  metadata?: Record<string, unknown>;
}

export interface RoutingDecision {
  provider: Provider;
  reason: string;
  model?: string;
  workRecommended?: boolean;
}

export interface JevDecision {
  decision: string;
  confidence: number;
  probabilities?: Record<string, number>;
  model?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  raw?: unknown;
}

export interface ProviderUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AiExecutionResult {
  provider: Provider;
  result: string | JevDecision | Record<string, unknown>;
  confidence?: number;
  usage?: ProviderUsage;
  openAiAttempted?: boolean;
  openAiUsage?: ProviderUsage;
  escalated?: boolean;
  manualReview?: boolean;
  workRecommended?: boolean;
}
