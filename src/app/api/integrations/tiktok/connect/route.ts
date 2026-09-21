import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { integrationEncryptionKey } from "@/lib/crypto/secrets";
import { tikTokShopConfig, requireTikTokAppCredentials } from "@/lib/integrations/tiktok/config";

const STATE_COOKIE = "futuro_tiktok_oauth_state";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  try {
    requireTikTokAppCredentials();
    integrationEncryptionKey();

    if (!tikTokShopConfig.authorizationUrl) {
      return NextResponse.json({
        error: "TIKTOK_SHOP_AUTH_URL não configurada. Copie o Seller Authorization Link do TikTok Shop Partner Center.",
      }, { status: 503 });
    }

    const state = randomBytes(32).toString("hex");
    const cookieStore = await cookies();
    cookieStore.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });

    const authorizationUrl = new URL(tikTokShopConfig.authorizationUrl);
    authorizationUrl.searchParams.set("state", state);

    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Não foi possível iniciar a conexão com TikTok Shop.",
    }, { status: 503 });
  }
}
