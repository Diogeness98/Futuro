import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/internal/cron-auth";
import { tikTokShopConfig } from "@/lib/integrations/tiktok/config";
import { syncConnectedTikTokOrganizations } from "@/lib/integrations/tiktok/scheduler";

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

  const summary = await syncConnectedTikTokOrganizations({
    organizationLimit: tikTokShopConfig.syncOrganizationLimit,
    maxPagesPerShop: tikTokShopConfig.syncMaxPagesPerShop,
    productSyncIntervalMinutes: tikTokShopConfig.productSyncIntervalMinutes,
  });

  return NextResponse.json({
    ok: true,
    summary,
    syncedAt: new Date().toISOString(),
  });
}
