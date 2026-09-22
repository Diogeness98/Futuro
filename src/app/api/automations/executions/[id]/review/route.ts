import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { bodyFromRequest } from "@/lib/http";
import { resolveAutomationReview } from "@/lib/automation/queue";

const schema = z.object({
  note: z.string().trim().max(1_000).optional().or(z.literal("")),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  try {
    const { id } = await context.params;
    const input = schema.parse(await bodyFromRequest(request));

    const result = await resolveAutomationReview({
      organizationId: session.organizationId,
      executionId: id,
      actorId: session.userId,
      note: input.note || undefined,
    });

    if ((request.headers.get("content-type") ?? "").includes("application/json")) {
      return NextResponse.json({ ok: true, result });
    }

    return NextResponse.redirect(new URL("/automations?review=resolved", request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao concluir revisão.";
    if ((request.headers.get("content-type") ?? "").includes("application/json")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.redirect(new URL("/automations?review=error", request.url), 303);
  }
}
