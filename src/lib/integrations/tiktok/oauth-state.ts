import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_AGE_MS = 10 * 60 * 1000;

export interface TikTokOAuthStateContext {
  nonce: string;
  userId: string;
  organizationId: string;
  issuedAt: number;
}

export function createTikTokOAuthStateCookie(
  context: Omit<TikTokOAuthStateContext, "issuedAt"> & { issuedAt?: number },
  secret = authSecret(),
) {
  const payload: TikTokOAuthStateContext = {
    ...context,
    issuedAt: context.issuedAt ?? Date.now(),
  };

  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${signature(encoded, secret)}`;
}

export function verifyTikTokOAuthStateCookie(input: {
  cookieValue?: string;
  returnedNonce?: string | null;
  userId: string;
  organizationId: string;
  now?: number;
  secret?: string;
}): TikTokOAuthStateContext | null {
  if (!input.cookieValue || !input.returnedNonce) return null;

  const separator = input.cookieValue.lastIndexOf(".");
  if (separator <= 0) return null;

  const encoded = input.cookieValue.slice(0, separator);
  const providedSignature = input.cookieValue.slice(separator + 1);
  const expectedSignature = signature(encoded, input.secret ?? authSecret());

  if (!safeEqual(providedSignature, expectedSignature)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;

  const context: TikTokOAuthStateContext = {
    nonce: typeof record.nonce === "string" ? record.nonce : "",
    userId: typeof record.userId === "string" ? record.userId : "",
    organizationId: typeof record.organizationId === "string" ? record.organizationId : "",
    issuedAt: typeof record.issuedAt === "number" ? record.issuedAt : 0,
  };

  if (!context.nonce || !context.userId || !context.organizationId || !context.issuedAt) return null;
  if (!safeEqual(context.nonce, input.returnedNonce)) return null;
  if (context.userId !== input.userId || context.organizationId !== input.organizationId) return null;

  const now = input.now ?? Date.now();
  if (context.issuedAt > now + 60_000) return null;
  if (now - context.issuedAt > MAX_AGE_MS) return null;

  return context;
}

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload, "utf8").digest("base64url");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET precisa ter pelo menos 32 caracteres.");
  }
  return secret;
}
