import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "../db";
import {
  clearLoginThrottle,
  loginThrottleBlocked,
  loginThrottleKey,
  recordLoginFailure,
} from "./login-throttle";

const describeDb = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;
const keys: string[] = [];

describeDb("login throttle integration", () => {
  afterEach(async () => {
    if (keys.length === 0) return;
    await db.loginThrottle.deleteMany({
      where: { keyHash: { in: keys.splice(0) } },
    });
  });

  it("bloqueia na quinta falha e expira após 15 minutos", async () => {
    const suffix = randomUUID();
    const request = new Request("https://example.test/login", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });
    const key = loginThrottleKey(`USER-${suffix}@Example.com`, request);
    keys.push(key);

    const start = new Date("2026-09-22T12:00:00Z");

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await recordLoginFailure(key, new Date(start.getTime() + attempt * 1000));
    }

    await expect(loginThrottleBlocked(key, new Date(start.getTime() + 4_000))).resolves.toBe(false);

    await recordLoginFailure(key, new Date(start.getTime() + 5_000));
    await expect(loginThrottleBlocked(key, new Date(start.getTime() + 6_000))).resolves.toBe(true);

    await expect(
      loginThrottleBlocked(key, new Date(start.getTime() + 16 * 60 * 1000)),
    ).resolves.toBe(false);
  });

  it("limpa o throttle depois de autenticação válida", async () => {
    const key = `test-${randomUUID()}`;
    keys.push(key);

    await recordLoginFailure(key);
    await clearLoginThrottle(key);

    await expect(db.loginThrottle.findUnique({ where: { keyHash: key } })).resolves.toBeNull();
  });

  it("normaliza e-mail e usa origem sem armazenar dados em claro", () => {
    const request = new Request("https://example.test/login", {
      headers: { "x-forwarded-for": "203.0.113.20, 10.0.0.1" },
    });

    const a = loginThrottleKey(" User@Example.COM ", request);
    const b = loginThrottleKey("user@example.com", request);

    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(a).not.toContain("user@example.com");
    expect(a).not.toContain("203.0.113.20");
  });
});
