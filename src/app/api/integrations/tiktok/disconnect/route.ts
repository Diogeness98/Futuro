import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";
import { disconnectTikTok } from "@/lib/integrations/tiktok/storage";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  await disconnectTikTok(session.organizationId);
  await recordActivity({
    organizationId: session.organizationId,
    actorId: session.userId,
    action: "integration.tiktok.disconnected",
    entityType: "Integration",
    metadata: { provider: "tiktok_shop" },
  });

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return NextResponse.json({ ok: true });
  return NextResponse.redirect(new URL("/integrations?tiktok=disconnected", request.url), 303);
}
