import { aiConfig } from "./config";
import { db } from "../db";

export interface OpenAiBudgetUsage {
  calls: number;
  inputTokens: number;
  outputTokens: number;
}

export interface OpenAiBudgetStatus extends OpenAiBudgetUsage {
  allowed: boolean;
  windowHours: number;
  limits: {
    calls: number;
    inputTokens: number;
    outputTokens: number;
  };
  reasons: string[];
}

export function evaluateOpenAiBudget(
  usage: OpenAiBudgetUsage,
  limits = {
    calls: aiConfig.openai.maxCallsPer24h,
    inputTokens: aiConfig.openai.maxInputTokensPer24h,
    outputTokens: aiConfig.openai.maxOutputTokensPer24h,
  },
): Omit<OpenAiBudgetStatus, "windowHours"> {
  const reasons: string[] = [];

  if (limits.calls > 0 && usage.calls >= limits.calls) {
    reasons.push("Limite de chamadas OpenAI nas últimas 24h atingido.");
  }
  if (limits.inputTokens > 0 && usage.inputTokens >= limits.inputTokens) {
    reasons.push("Limite de tokens de entrada OpenAI nas últimas 24h atingido.");
  }
  if (limits.outputTokens > 0 && usage.outputTokens >= limits.outputTokens) {
    reasons.push("Limite de tokens de saída OpenAI nas últimas 24h atingido.");
  }

  return {
    ...usage,
    limits,
    allowed: reasons.length === 0,
    reasons,
  };
}

export async function getOpenAiBudgetStatus(organizationId: string): Promise<OpenAiBudgetStatus> {
  const windowHours = 24;
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const aggregate = await db.aiDecision.aggregate({
    where: {
      organizationId,
      provider: "openai",
      createdAt: { gte: since },
    },
    _count: { _all: true },
    _sum: {
      inputTokens: true,
      outputTokens: true,
    },
  });

  const evaluated = evaluateOpenAiBudget({
    calls: aggregate._count._all,
    inputTokens: aggregate._sum.inputTokens ?? 0,
    outputTokens: aggregate._sum.outputTokens ?? 0,
  });

  return { ...evaluated, windowHours };
}
