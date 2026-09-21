import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { bodyFromRequest } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { runAutomation } from "@/lib/automation/runner";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { id } = await context.params;
  const wantsJson = (request.headers.get("content-type") ?? "").includes("application/json");

  try {
    const body = await bodyFromRequest(request);
    const eventContext = body.context ?? body;
    const result = await runAutomation({
      automationId: id,
      organizationId: session.organizationId,
      actorId: session.userId,
      context: eventContext,
    });

    if (wantsJson) return NextResponse.json({ ok: true, result });
    return NextResponse.redirect(new URL("/automations?run=success", request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao executar automação.";

    await recordActivity({
      organizationId: session.organizationId,
      actorId: session.userId,
      action: "automation.execution_failed",
      entityType: "Automation",
      entityId: id,
      metadata: { error: message.slice(0, 300) },
    });

    if (wantsJson) return NextResponse.json({ error: message }, { status: 400 });
    return NextResponse.redirect(new URL("/automations?run=error", request.url), 303);
  }
}
