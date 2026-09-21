function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export const tikTokShopConfig = {
  appKey: process.env.TIKTOK_SHOP_APP_KEY ?? "",
  appSecret: process.env.TIKTOK_SHOP_APP_SECRET ?? "",
  authorizationUrl: process.env.TIKTOK_SHOP_AUTH_URL ?? "",
  authBaseUrl: process.env.TIKTOK_SHOP_AUTH_BASE_URL ?? "https://auth.tiktok-shops.com",
  apiBaseUrl: process.env.TIKTOK_SHOP_API_BASE_URL ?? "https://open-api.tiktokglobalshop.com",
  timeoutMs: numberFromEnv("TIKTOK_SHOP_TIMEOUT_MS", 20_000),
};

export function requireTikTokAppCredentials() {
  if (!tikTokShopConfig.appKey || !tikTokShopConfig.appSecret) {
    throw new Error("TIKTOK_SHOP_APP_KEY/TIKTOK_SHOP_APP_SECRET não configurados.");
  }
}
