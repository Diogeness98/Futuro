import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";
import { loadTikTokConnection, updateTikTokTokens } from "@/lib/integrations/tiktok/storage";
import { refreshTikTokAccessToken } from "@/lib/integrations/tiktok/tokens";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  try {
    const connection = await loadTikTokConnection(session.organizationId);
    if (!connection) return NextResponse.json({ error: "TikTok Shop não conectado." }, { status: 409 });

    const tokens = await refreshTikTokAccessToken(connection.tokens.refreshToken);
    await updateTikTokTokens(session.organizationId, tokens);

    await recordActivity({
      organizationId: session.organizationId,
      actorId: session.userId,
      action: "integration.tiktok.token_refreshed",
      entityType: "Integration",
      entityId: connection.integration.id,
      metadata: { provider: "tiktok_shop" },
    });

    return NextResponse.json({
      ok: true,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt ?? null,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt ?? null,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Falha ao renovar TikTok Shop.",
    }, { status: 400 });
  }
}
