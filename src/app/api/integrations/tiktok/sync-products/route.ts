import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";
import { syncTikTokProducts } from "@/lib/integrations/tiktok/product-sync";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const wantsJson = (request.headers.get("content-type") ?? "").includes("application/json");

  try {
    const summary = await syncTikTokProducts(session.organizationId);

    await recordActivity({
      organizationId: session.organizationId,
      actorId: session.userId,
      action: "integration.tiktok.products_synced",
      entityType: "Integration",
      metadata: {
        provider: "tiktok_shop",
        synced: summary.synced,
        created: summary.created,
        updated: summary.updated,
        variants: summary.variants,
        pages: summary.pages,
        shops: summary.shops,
      },
    });

    if (wantsJson) return NextResponse.json({ ok: true, summary });
    return NextResponse.redirect(new URL("/products?tiktok=synced", request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao sincronizar catálogo TikTok.";

    await recordActivity({
      organizationId: session.organizationId,
      actorId: session.userId,
      action: "integration.tiktok.products_sync_failed",
      entityType: "Integration",
      metadata: { provider: "tiktok_shop", error: message.slice(0, 300) },
    });

    if (wantsJson) return NextResponse.json({ error: message }, { status: 400 });
    return NextResponse.redirect(new URL("/integrations?tiktok=products_sync_error", request.url), 303);
  }
}
