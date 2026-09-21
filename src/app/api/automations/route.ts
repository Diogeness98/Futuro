import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { bodyFromRequest } from "@/lib/http";
import { recordActivity } from "@/lib/activity";

const automationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  triggerType: z.enum(["order.created", "product.low_stock", "manual"]),
  actionType: z.enum(["jev.decide", "gpt.generate", "manual.review"]),
  enabled: z.union([z.string(), z.boolean()]).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const automations = await db.automation.findMany({
    where: { organizationId: session.organizationId },
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

    const automation = await db.automation.create({
      data: {
        organizationId: session.organizationId,
        name: input.name,
        enabled,
        trigger: { type: input.triggerType },
        action: { type: input.actionType },
      },
    });

    await recordActivity({
      organizationId: session.organizationId,
      actorId: session.userId,
      action: "automation.created",
      entityType: "Automation",
      entityId: automation.id,
      metadata: { name: automation.name, enabled },
    });

    if ((request.headers.get("content-type") ?? "").includes("application/json")) {
      return NextResponse.json({ automation }, { status: 201 });
    }

    return NextResponse.redirect(new URL("/automations", request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao criar automação.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
