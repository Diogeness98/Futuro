import { db } from "@/lib/db";
import { estimateOpenAICost } from "./cost";
import type { AiExecutionResult, AiTask, RoutingDecision } from "./types";

export async function recordAiExecution(input: {
  organizationId: string;
  userId: string;
  task: AiTask;
  plan: RoutingDecision;
  result: AiExecutionResult;
}) {
  const { organizationId, userId, task, plan, result } = input;
  const costUsd = result.provider === "openai" ? estimateOpenAICost(result.model, result.usage) : 0;
  const taskType = task.taskType ?? inferTaskType(plan);
  const decisionPayload = {
    resultPreview: typeof result.result === "string" ? result.result.slice(0, 500) : sanitizeStructuredResult(result.result),
    initialJev: result.initialJevDecision
      ? {
          decision: result.initialJevDecision.decision,
          confidence: result.initialJevDecision.confidence,
          probabilities: result.initialJevDecision.probabilities,
        }
      : undefined,
    workRecommended: Boolean(result.workRecommended),
  };

  const decision = await db.aiDecision.create({
    data: {
      organizationId,
      provider: result.provider,
      model: result.model ?? null,
      taskType,
      routeReason: plan.reason,
      inputSummary: summarize(task.input),
      decision: JSON.parse(JSON.stringify(decisionPayload)),
      confidence: result.confidence ?? null,
      inputTokens: result.usage?.inputTokens ?? null,
      outputTokens: result.usage?.outputTokens ?? null,
      costUsd,
      escalated: Boolean(result.escalated),
      workRecommended: Boolean(result.workRecommended),
    },
  });

  await db.activityLog.create({
    data: {
      organizationId,
      actorType: "user",
      actorId: userId,
      action: "ai.execution",
      entityType: "AiDecision",
      entityId: decision.id,
      metadata: JSON.parse(JSON.stringify({
        provider: result.provider,
        model: result.model,
        escalated: Boolean(result.escalated),
        workRecommended: Boolean(result.workRecommended),
      })),
    },
  });

  return decision;
}

function summarize(input: string) {
  const compact = input.replace(/\s+/g, " ").trim();
  return compact.length <= 220 ? compact : `${compact.slice(0, 217)}...`;
}

function inferTaskType(plan: RoutingDecision) {
  if (plan.provider === "code") return "deterministic";
  if (plan.provider === "jev") return "decision";
  return "generation";
}

function sanitizeStructuredResult(value: Record<string, unknown>) {
  const clone = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  delete clone.raw;
  return clone;
}
