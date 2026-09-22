import { timingSafeEqual } from "node:crypto";

export function cronAuthorized(request: Request) {
  const secret = process.env.AUTOMATION_CRON_SECRET;
  if (!secret) return { authorized: false as const, configured: false as const };

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return { authorized: false as const, configured: true as const };
  }

  const provided = authorization.slice("Bearer ".length);
  const expectedBuffer = Buffer.from(secret);
  const providedBuffer = Buffer.from(provided);

  const authorized =
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer);

  return { authorized, configured: true as const };
}
