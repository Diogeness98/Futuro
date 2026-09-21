import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { recordAiExecution } from "@/lib/ai/audit";
import { executeAiTask } from "@/lib/ai/router";
import { routeTask } from "@/lib/ai/policy";

const taskSchema = z.object({
  input: z.string().min(1).max(20_000),
  taskType: z.enum(["deterministic", "decision", "generation", "complex"]).optional(),
  options: z.array(z.string().min(1)).min(1).max(30).optional(),
  requiresExternalInteraction: z.boolean().optional(),
  dryRun: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });

  try {
    const parsed = taskSchema.parse(await request.json());
    const { dryRun, ...task } = parsed;
    const plan = routeTask(task);

    // Dry-run é gratuito: mostra a rota sem chamar Jev/GPT e sem gravar consumo.
    if (dryRun) return NextResponse.json({ ok: true, plan, charged: false });

    const result = await executeAiTask(task);
    const audit = await recordAiExecution({
      organizationId: session.organizationId,
      userId: session.userId,
      task,
      plan,
      result,
    });

    return NextResponse.json({
      ok: true,
      plan,
      result,
      auditId: audit.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
