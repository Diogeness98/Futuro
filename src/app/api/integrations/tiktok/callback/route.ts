import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";
import { getTikTokAuthorizedShops } from "@/lib/integrations/tiktok/client";
import { saveTikTokConnection } from "@/lib/integrations/tiktok/storage";
import { exchangeTikTokAuthorizationCode } from "@/lib/integrations/tiktok/tokens";

const STATE_COOKIE = "futuro_tiktok_oauth_state";

export async function GET(request: Request) {
  const session = await getSession();
  const destination = new URL("/integrations", request.url);

  if (!session) {
    destination.searchParams.set("tiktok", "login_required");
    return NextResponse.redirect(destination);
  }

  const url = new URL(request.url);
  const returnedState = url.searchParams.get("state");
  const authCode = url.searchParams.get("code") ?? url.searchParams.get("auth_code");
  const providerError = url.searchParams.get("error") ?? url.searchParams.get("message");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (providerError) {
    await recordActivity({
      organizationId: session.organizationId,
      actorId: session.userId,
      action: "integration.tiktok.authorization_denied",
      entityType: "Integration",
      metadata: { provider: "tiktok_shop" },
    });
    destination.searchParams.set("tiktok", "denied");
    return NextResponse.redirect(destination);
  }

  if (!expectedState || !returnedState || expectedState !== returnedState) {
    destination.searchParams.set("tiktok", "invalid_state");
    return NextResponse.redirect(destination);
  }

  if (!authCode) {
    destination.searchParams.set("tiktok", "missing_code");
    return NextResponse.redirect(destination);
  }

  try {
    const tokens = await exchangeTikTokAuthorizationCode(authCode);
    const shops = await getTikTokAuthorizedShops(tokens.accessToken);
    await saveTikTokConnection(session.organizationId, tokens, shops);

    await recordActivity({
      organizationId: session.organizationId,
      actorId: session.userId,
      action: "integration.tiktok.connected",
      entityType: "Integration",
      metadata: {
        provider: "tiktok_shop",
        shopCount: shops.length,
        scopes: tokens.grantedScopes?.join(",") ?? null,
      },
    });

    destination.searchParams.set("tiktok", "connected");
    return NextResponse.redirect(destination);
  } catch (error) {
    await recordActivity({
      organizationId: session.organizationId,
      actorId: session.userId,
      action: "integration.tiktok.connection_failed",
      entityType: "Integration",
      metadata: {
        provider: "tiktok_shop",
        error: safeError(error),
      },
    });

    destination.searchParams.set("tiktok", "error");
    return NextResponse.redirect(destination);
  }
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "erro desconhecido";
  return message.replace(/TTP_[A-Za-z0-9_-]+/g, "[token]").slice(0, 300);
}
