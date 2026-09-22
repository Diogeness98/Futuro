import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processAllAutomationQueues } from "@/lib/automation/queue";
import { automationRuntimeConfig } from "@/lib/automation/runtime-config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

async function handle(request: Request) {
  const secret = process.env.AUTOMATION_CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "AUTOMATION_CRON_SECRET não configurado." },
      { status: 503 },
    );
  }

  if (!authorized(request, secret)) {
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

function authorized(request: Request, secret: string) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return false;

  const provided = authorization.slice("Bearer ".length);
  const expectedBuffer = Buffer.from(secret);
  const providedBuffer = Buffer.from(provided);

  return expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer);
}

