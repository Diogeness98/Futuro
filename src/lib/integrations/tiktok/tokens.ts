import { tikTokShopConfig, requireTikTokAppCredentials } from "./config";

export interface TikTokTokenSet {
  accessToken: string;
  refreshToken: string;
  openId?: string;
  userType?: number;
  grantedScopes?: string[];
  accessTokenExpiresAt?: number;
  refreshTokenExpiresAt?: number;
}

interface TikTokTokenEnvelope {
  code?: number;
  message?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export async function exchangeTikTokAuthorizationCode(authCode: string): Promise<TikTokTokenSet> {
  requireTikTokAppCredentials();
  return requestToken("/api/v2/token/get", {
    app_key: tikTokShopConfig.appKey,
    app_secret: tikTokShopConfig.appSecret,
    auth_code: authCode,
    grant_type: "authorized_code",
  });
}

export async function refreshTikTokAccessToken(refreshToken: string): Promise<TikTokTokenSet> {
  requireTikTokAppCredentials();
  return requestToken("/api/v2/token/refresh", {
    app_key: tikTokShopConfig.appKey,
    app_secret: tikTokShopConfig.appSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
}

async function requestToken(path: string, params: Record<string, string>) {
  const url = new URL(path, tikTokShopConfig.authBaseUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(tikTokShopConfig.timeoutMs),
  });

  const raw = await response.json().catch(() => null) as TikTokTokenEnvelope | null;
  if (!response.ok || !raw) {
    throw new Error(`TikTok token API falhou (${response.status}).`);
  }

  if (typeof raw.code === "number" && raw.code !== 0) {
    throw new Error(`TikTok token API retornou erro ${raw.code}: ${String(raw.message ?? "sem mensagem")}`);
  }

  return normalizeTokenSet(raw);
}

export function normalizeTokenSet(raw: TikTokTokenEnvelope): TikTokTokenSet {
  const source = (raw.data && typeof raw.data === "object" ? raw.data : raw) as Record<string, unknown>;

  const accessToken = stringValue(source.access_token ?? source.accessToken);
  const refreshToken = stringValue(source.refresh_token ?? source.refreshToken);
  if (!accessToken || !refreshToken) {
    throw new Error("Resposta do TikTok não contém access_token/refresh_token.");
  }

  const userType = numberValue(source.user_type ?? source.userType);
  if (userType !== undefined && userType !== 0) {
    throw new Error(`Autorização TikTok não é de seller (user_type=${userType}).`);
  }

  const now = Math.floor(Date.now() / 1000);
  const accessExpiresIn = numberValue(
    source.access_token_expire_in ?? source.access_token_expires_in ?? source.expires_in,
  );
  const refreshExpiresIn = numberValue(
    source.refresh_token_expire_in ?? source.refresh_token_expires_in,
  );

  return {
    accessToken,
    refreshToken,
    openId: stringValue(source.open_id ?? source.openId) || undefined,
    userType,
    grantedScopes: scopesValue(source.granted_scopes ?? source.grantedScopes),
    accessTokenExpiresAt: accessExpiresIn ? now + accessExpiresIn : undefined,
    refreshTokenExpiresAt: refreshExpiresIn ? now + refreshExpiresIn : undefined,
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function numberValue(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function scopesValue(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split(/[,s]+/).map((item) => item.trim()).filter(Boolean);
  return undefined;
}
