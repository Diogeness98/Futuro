import { createHash } from "node:crypto";
import { db } from "../db";

const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

export function loginThrottleKey(email: string, request: Request) {
  const origin = clientOrigin(request);
  return createHash("sha256")
    .update(`${email.trim().toLowerCase()}|${origin}`, "utf8")
    .digest("hex");
}

export async function loginThrottleBlocked(
  keyHash: string,
  now = new Date(),
) {
  const record = await db.loginThrottle.findUnique({
    where: { keyHash },
    select: { blockedUntil: true },
  });

  return Boolean(record?.blockedUntil && record.blockedUntil > now);
}

export async function recordLoginFailure(
  keyHash: string,
  now = new Date(),
) {
  const current = await db.loginThrottle.findUnique({
    where: { keyHash },
  });

  if (!current) {
    return db.loginThrottle.create({
      data: {
        keyHash,
        failedAttempts: 1,
        windowStartedAt: now,
      },
    });
  }

  if (current.blockedUntil && current.blockedUntil > now) {
    return current;
  }

  const windowExpired =
    now.getTime() - current.windowStartedAt.getTime() > WINDOW_MS;

  const failedAttempts = windowExpired
    ? 1
    : current.failedAttempts + 1;

  const blockedUntil = failedAttempts >= MAX_FAILURES
    ? new Date(now.getTime() + BLOCK_MS)
    : null;

  return db.loginThrottle.update({
    where: { keyHash },
    data: {
      failedAttempts,
      windowStartedAt: windowExpired ? now : current.windowStartedAt,
      blockedUntil,
    },
  });
}

export async function clearLoginThrottle(keyHash: string) {
  await db.loginThrottle.deleteMany({ where: { keyHash } });
}

function clientOrigin(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const firstForwarded = forwarded?.split(",")[0]?.trim();
  if (firstForwarded) return firstForwarded;

  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || "unknown";
}
