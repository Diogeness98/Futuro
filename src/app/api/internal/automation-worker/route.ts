import { NextResponse } from "next/server";
import { processAllAutomationQueues } from "@/lib/automation/queue";
import { automationRuntimeConfig } from "@/lib/automation/runtime-config";
import { cronAuthorized } from "@/lib/internal/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

async function handle(request: Request) {
  const auth = cronAuthorized(request);
  if (!auth.configured) {
    return NextResponse.json(
      { error: "AUTOMATION_CRON_SECRET não configurado." },
      { status: 503 },
    );
  }
  if (!auth.authorized) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const summary = await processAllAutomationQueues({
    organizationLimit: automationRuntimeConfig.organizationLimit,
    perOrganizationLimit: automationRuntimeConfig.batchSize,
  });

  return NextResponse.json({
    ok: true,
    summary,
    processedAt: new Date().toISOString(),
  });
}

