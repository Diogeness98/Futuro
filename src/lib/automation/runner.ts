import { Prisma } from "../../generated/prisma/client";
import { recordActivity } from "../activity";
import { getOpenAiBudgetStatus } from "../ai/budget";
import { executeAiTask } from "../ai/router";
import type { AiExecutionResult, AiTask } from "../ai/types";
import { db } from "../db";
import { evaluateAutomationConditions, parseAutomationAction, parseAutomationConditions, parseAutomationTrigger } from "./config";

export interface AutomationRunResult {
  automationId: string;
  automationName: string;
  triggerType: string;
  actionType: string;
  result: AiExecutionResult;
}

export async function runAutomation(input: {
  automationId: string;
  organizationId: string;
  actorId?: string;
  context: unknown;
}): Promise<AutomationRunResult> {
  const automation = await db.automation.findFirst({
    where: {
      id: input.automationId,
      organizationId: input.organizationId,
      deletedAt: null,
    },
  });

  if (!automation) throw new Error("Automação não encontrada.");
  if (!automation.enabled) throw new Error("Automação está inativa.");

  const trigger = parseAutomationTrigger(automation.trigger);
  const action = parseAutomationAction(automation.action);
  const conditions = parseAutomationConditions(automation.conditions);
  const conditionResult = evaluateAutomationConditions(input.context, conditions);
  const contextText = serializeContext(input.context);

  if (!conditionResult.matched) {
    const result: AiExecutionResult = {
      provider: "code",
      result: {
        skipped: true,
        conditionMatched: false,
        reason: conditionResult.reason,
      },
      manualReview: false,
      workRecommended: false,
    };

    await recordActivity({
      organizationId: input.organizationId,
      actorId: input.actorId,
      actorType: input.actorId ? "user" : "system",
      action: "automation.condition_skipped",
      entityType: "Automation",
      entityId: automation.id,
      metadata: {
        automationName: automation.name,
        triggerType: trigger.type,
        reason: conditionResult.reason,
      },
    });

    return {
      automationId: automation.id,
      automationName: automation.name,
      triggerType: trigger.type,
      actionType: action.type,
      result,
    };
  }

  if (action.type === "manual.review") {
    const result: AiExecutionResult = {
      provider: "code",
      result: {
        queuedForManualReview: true,
        instruction: action.instruction ?? null,
        context: contextText.slice(0, 1000),
      },
      manualReview: true,
    };

    await recordActivity({
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: "automation.manual_review_queued",
      entityType: "Automation",
      entityId: automation.id,
      metadata: {
        automationName: automation.name,
        triggerType: trigger.type,
      },
    });

    return {
      automationId: automation.id,
      automationName: automation.name,
      triggerType: trigger.type,
      actionType: action.type,
      result,
    };
  }

  const budget = await getOpenAiBudgetStatus(input.organizationId);
  const task = buildAiTask(action, contextText);
  const result = await executeAiTask(task, {
    allowOpenAI: budget.allowed,
    budgetReason: budget.reasons.join(" "),
    openAiBudget: budget,
  });

  await persistAiDecision({
    organizationId: input.organizationId,
    automationId: automation.id,
    automationName: automation.name,
    task,
    result,
    budget,
  });

  await recordActivity({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "automation.executed",
    entityType: "Automation",
    entityId: automation.id,
    metadata: {
      automationName: automation.name,
      triggerType: trigger.type,
      actionType: action.type,
      provider: result.provider,
      manualReview: result.manualReview ?? false,
    },
  });

  return {
    automationId: automation.id,
    automationName: automation.name,
    triggerType: trigger.type,
    actionType: action.type,
    result,
  };
}

function buildAiTask(
  action: ReturnType<typeof parseAutomationAction>,
  contextText: string,
): AiTask {
  if (action.type === "jev.decide") {
    return {
      input: contextText,
      taskType: "decision",
      options: action.options,
      decisionInstructions: action.instruction,
      criteria: action.criteria,
    };
  }

  return {
    input: [
      action.instruction,
      "",
      "Contexto do evento:",
      contextText,
    ].join("\n"),
    taskType: "generation",
  };
}

async function persistAiDecision(input: {
  organizationId: string;
  automationId: string;
  automationName: string;
  task: AiTask;
  result: AiExecutionResult;
  budget: Awaited<ReturnType<typeof getOpenAiBudgetStatus>>;
}) {
  const decision = toJson({
    source: "automation",
    automationId: input.automationId,
    automationName: input.automationName,
    result: input.result.result,
    escalated: input.result.escalated ?? false,
    manualReview: input.result.manualReview ?? false,
    workRecommended: input.result.workRecommended ?? false,
    openAiBudget: {
      allowed: input.budget.allowed,
      calls: input.budget.calls,
      inputTokens: input.budget.inputTokens,
      outputTokens: input.budget.outputTokens,
      reasons: input.budget.reasons,
    },
  });

  await db.aiDecision.create({
    data: {
      organizationId: input.organizationId,
      provider: input.result.provider,
      taskType: input.task.taskType ?? "automation",
      inputSummary: input.task.input.slice(0, 500),
      confidence: input.result.confidence,
      inputTokens: input.result.usage?.inputTokens,
      outputTokens: input.result.usage?.outputTokens,
      decision,
    },
  });
}

function serializeContext(value: unknown) {
  const serialized = typeof value === "string"
    ? value
    : JSON.stringify(value, null, 2);

  const text = serialized?.trim() ?? "";
  if (!text) throw new Error("Contexto da automação está vazio.");
  return text.slice(0, 10_000);
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
