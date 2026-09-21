export type TaskType = "deterministic" | "decision" | "generation" | "complex";
export type Provider = "code" | "jev" | "openai" | "work";

export interface AiTask {
  input: string;
  taskType?: TaskType;
  options?: string[];
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
  model?: string;
  confidence?: number;
  usage?: ProviderUsage;
  escalated?: boolean;
  workRecommended?: boolean;
  initialJevDecision?: JevDecision;
}
