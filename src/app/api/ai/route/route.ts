import { NextResponse } from "next/server";
import { z } from "zod";
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
  try {
    const parsed = taskSchema.parse(await request.json());
    const { dryRun, ...task } = parsed;
    const plan = routeTask(task);

    if (dryRun) return NextResponse.json({ ok: true, plan });

    const result = await executeAiTask(task);
    return NextResponse.json({ ok: true, plan, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
