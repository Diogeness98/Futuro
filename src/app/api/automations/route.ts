import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { bodyFromRequest } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { buildAutomationAction, buildAutomationConditions } from "@/lib/automation/config";

const automationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  triggerType: z.enum(["order.created", "product.low_stock", "manual"]),
  actionType: z.enum(["jev.decide", "gpt.generate", "manual.review"]),
  actionInstruction: z.string().trim().max(2_000).optional().or(z.literal("")),
  jevOptions: z.string().trim().max(2_000).optional().or(z.literal("")),
  jevCriteria: z.string().trim().max(4_000).optional().or(z.literal("")),
  conditionPath: z.string().trim().max(120).optional().or(z.literal("")),
  conditionOperator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "contains"]).optional().or(z.literal("")),
  conditionValue: z.string().trim().max(500).optional().or(z.literal("")),
  enabled: z.union([z.string(), z.boolean()]).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const automations = await db.automation.findMany({
    where: { organizationId: session.organizationId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ automations });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  try {
    const input = automationSchema.parse(await bodyFromRequest(request));
    const enabled = input.enabled === true || input.enabled === "true" || input.enabled === "on";
    const action = buildAutomationAction({
      type: input.actionType,
      instruction: input.actionInstruction,
      optionsText: input.jevOptions,
      criteriaText: input.jevCriteria,
    });
    const conditions = buildAutomationConditions({
      path: input.conditionPath,
      operator: input.conditionOperator,
      value: input.conditionValue,
    });

    const automation = await db.automation.create({
      data: {
        organizationId: session.organizationId,
        name: input.name,
        enabled,
        trigger: toJson({ type: input.triggerType }),
        conditions: conditions ? toJson(conditions) : undefined,
        action: toJson(action),
      },
    });

    await recordActivity({
      organizationId: session.organizationId,
      actorId: session.userId,
      action: "automation.created",
      entityType: "Automation",
      entityId: automation.id,
      metadata: {
        name: automation.name,
        enabled,
        triggerType: input.triggerType,
        actionType: input.actionType,
        hasCondition: Boolean(conditions?.length),
      },
    });

    if ((request.headers.get("content-type") ?? "").includes("application/json")) {
      return NextResponse.json({ automation }, { status: 201 });
    }

    return NextResponse.redirect(new URL("/automations?created=1", request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao criar automação.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
