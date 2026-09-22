import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { bodyFromRequest } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { processAutomationQueue } from "@/lib/automation/queue";

const inputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const wantsJson = (request.headers.get("content-type") ?? "").includes("application/json");

  try {
    const raw = await bodyFromRequest(request);
    const input = inputSchema.parse(raw);

    const summary = await processAutomationQueue({
      organizationId: session.organizationId,
      actorId: session.userId,
      limit: input.limit ?? 5,
    });

    await recordActivity({
      organizationId: session.organizationId,
      actorId: session.userId,
      action: "automation.queue_processed",
      entityType: "AutomationEvent",
      metadata: {
        claimed: summary.claimed,
        succeeded: summary.succeeded,
        failed: summary.failed,
        skipped: summary.skipped,
      },
    });

    if (wantsJson) return NextResponse.json({ ok: true, summary });

    const destination = new URL("/automations", request.url);
    destination.searchParams.set("queue", "processed");
    destination.searchParams.set("succeeded", String(summary.succeeded));
    destination.searchParams.set("failed", String(summary.failed));
    return NextResponse.redirect(destination, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao processar fila de automações.";
    if (wantsJson) return NextResponse.json({ error: message }, { status: 400 });

    return NextResponse.redirect(new URL("/automations?queue=error", request.url), 303);
  }
}
