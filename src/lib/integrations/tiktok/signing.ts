import { createHmac } from "node:crypto";

interface SignTikTokRequestInput {
  appSecret: string;
  path: string;
  query: Record<string, string | number | boolean | null | undefined>;
  body?: string;
  contentType?: string;
}

export function signTikTokRequest(input: SignTikTokRequestInput) {
  const cleaned = Object.entries(input.query)
    .filter(([key, value]) => key !== "sign" && key !== "access_token" && value !== undefined && value !== null)
    .map(([key, value]) => [key, String(value)] as const)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);

  let canonical = input.path;
  for (const [key, value] of cleaned) canonical += key + value;

  const mediaType = input.contentType?.split(";")[0]?.trim().toLowerCase();
  if (mediaType !== "multipart/form-data" && input.body) canonical += input.body;

  canonical = input.appSecret + canonical + input.appSecret;

  return createHmac("sha256", input.appSecret)
    .update(canonical, "utf8")
    .digest("hex");
}
