import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { executeAiTask } from "@/lib/ai/router";
import { routeTask } from "@/lib/ai/policy";
import { getOpenAiBudgetStatus } from "@/lib/ai/budget";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

const taskSchema = z.object({
  input: z.string().min(1).max(20_000),
  taskType: z.enum(["deterministic", "decision", "generation", "complex"]).optional(),
  options: z.array(z.string().min(1)).min(1).max(30).optional(),
  requiresExternalInteraction: z.boolean().optional(),
  dryRun: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  try {
    const parsed = taskSchema.parse(await request.json());
    const { dryRun, ...task } = parsed;
    const plan = routeTask(task);
    const budget = await getOpenAiBudgetStatus(session.organizationId);

    if (dryRun) {
      return NextResponse.json({ ok: true, plan, budget });
    }

    const result = await executeAiTask(task, {
      allowOpenAI: budget.allowed,
      budgetReason: budget.reasons.join(" "),
    });

    const decisionPayload = JSON.parse(JSON.stringify({
      plan,
      result: result.result,
      escalated: result.escalated ?? false,
      manualReview: result.manualReview ?? false,
      workRecommended: result.workRecommended ?? false,
      openAiBudget: {
        allowed: budget.allowed,
        calls: budget.calls,
        inputTokens: budget.inputTokens,
        outputTokens: budget.outputTokens,
        reasons: budget.reasons,
      },
    })) as Prisma.InputJsonValue;

    await db.aiDecision.create({
      data: {
        organizationId: session.organizationId,
        provider: result.provider,
        taskType: task.taskType ?? "auto",
        inputSummary: task.input.slice(0, 500),
        confidence: result.confidence,
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
        decision: decisionPayload,
      },
    });

    return NextResponse.json({ ok: true, plan, budget, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
