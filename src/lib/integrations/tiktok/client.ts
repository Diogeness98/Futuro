import { tikTokShopConfig, requireTikTokAppCredentials } from "./config";
import { signTikTokRequest } from "./signing";

type QueryValue = string | number | boolean | null | undefined;

interface TikTokRequestInput {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  accessToken: string;
  shopCipher?: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
}

interface TikTokEnvelope<T> {
  code?: number;
  message?: string;
  request_id?: string;
  data?: T;
}

export interface TikTokAuthorizedShop {
  cipher: string;
  code?: string;
  id?: string;
  name?: string;
  region?: string;
  seller_type?: string;
}

export async function tikTokShopRequest<T>(input: TikTokRequestInput): Promise<T> {
  requireTikTokAppCredentials();

  const timestamp = Math.floor(Date.now() / 1000);
  const query: Record<string, QueryValue> = {
    ...(input.query ?? {}),
    app_key: tikTokShopConfig.appKey,
    timestamp,
  };
  if (input.shopCipher) query.shop_cipher = input.shopCipher;

  const contentType = "application/json";
  const body = input.body === undefined ? "" : JSON.stringify(input.body);
  const sign = signTikTokRequest({
    appSecret: tikTokShopConfig.appSecret,
    path: input.path,
    query,
    body,
    contentType,
  });

  const url = new URL(input.path, tikTokShopConfig.apiBaseUrl);
  for (const [key, value] of Object.entries({ ...query, sign })) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method: input.method,
    headers: {
      "Content-Type": contentType,
      "x-tts-access-token": input.accessToken,
    },
    body: body || undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(tikTokShopConfig.timeoutMs),
  });

  const raw = await response.json().catch(() => null) as TikTokEnvelope<T> | null;
  if (!response.ok || !raw) {
    throw new Error(`TikTok Shop API falhou (${response.status}).`);
  }
  if (typeof raw.code === "number" && raw.code !== 0) {
    throw new Error(`TikTok Shop API erro ${raw.code}: ${String(raw.message ?? "sem mensagem")}`);
  }
  if (raw.data === undefined) throw new Error("TikTok Shop respondeu sem data.");

  return raw.data;
}

export async function getTikTokAuthorizedShops(accessToken: string) {
  const data = await tikTokShopRequest<{ shops?: TikTokAuthorizedShop[] }>({
    method: "GET",
    path: "/authorization/202309/shops",
    accessToken,
  });

  return data.shops ?? [];
}
