import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";
import { retryDeadLetterExecutions } from "@/lib/automation/queue";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json({ error: "Apenas o proprietário pode executar esta ação de automação." }, { status: 403 });

  const result = await retryDeadLetterExecutions({
    organizationId: session.organizationId,
    limit: 20,
  });

  await recordActivity({
    organizationId: session.organizationId,
    actorId: session.userId,
    action: "automation.dead_letter_retried",
    entityType: "AutomationEventExecution",
    metadata: {
      reset: result.reset,
      events: result.events,
    },
  });

  if ((request.headers.get("content-type") ?? "").includes("application/json")) {
    return NextResponse.json({ ok: true, result });
  }

  return NextResponse.redirect(new URL("/automations?deadLetter=reset", request.url), 303);
}
