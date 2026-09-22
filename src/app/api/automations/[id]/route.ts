import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { bodyFromRequest } from "@/lib/http";

const actionSchema = z.object({
  intent: z.enum(["toggle", "delete"]),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { id } = await context.params;
  const automation = await db.automation.findFirst({
    where: { id, organizationId: session.organizationId, deletedAt: null },
  });
  if (!automation) return NextResponse.json({ error: "Automação não encontrada." }, { status: 404 });

  try {
    const { intent } = actionSchema.parse(await bodyFromRequest(request));

    if (intent === "delete") {
      await db.automation.update({
        where: { id },
        data: { enabled: false, deletedAt: new Date() },
      });
      await recordActivity({
        organizationId: session.organizationId,
        actorId: session.userId,
        action: "automation.deleted",
        entityType: "Automation",
        entityId: id,
        metadata: { name: automation.name },
      });

      return NextResponse.redirect(new URL("/automations?deleted=1", request.url), 303);
    }

    const updated = await db.automation.update({
      where: { id },
      data: { enabled: !automation.enabled },
    });

    await recordActivity({
      organizationId: session.organizationId,
      actorId: session.userId,
      action: updated.enabled ? "automation.enabled" : "automation.disabled",
      entityType: "Automation",
      entityId: id,
      metadata: { name: automation.name },
    });

    return NextResponse.redirect(new URL("/automations?toggled=1", request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao alterar automação.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
