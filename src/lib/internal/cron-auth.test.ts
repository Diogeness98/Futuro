import { afterEach, describe, expect, it } from "vitest";
import { cronAuthorized } from "./cron-auth";

const originalSecret = process.env.AUTOMATION_CRON_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.AUTOMATION_CRON_SECRET;
  else process.env.AUTOMATION_CRON_SECRET = originalSecret;
});

describe("cronAuthorized", () => {
  it("considera segredo curto como configuração inválida", () => {
    process.env.AUTOMATION_CRON_SECRET = "short-secret";

    const result = cronAuthorized(new Request("https://example.test", {
      headers: { authorization: "Bearer short-secret" },
    }));

    expect(result.configured).toBe(false);
    expect(result.authorized).toBe(false);
  });

  it("autoriza Bearer exato com segredo forte", () => {
    const secret = "x".repeat(32);
    process.env.AUTOMATION_CRON_SECRET = secret;

    const result = cronAuthorized(new Request("https://example.test", {
      headers: { authorization: `Bearer ${secret}` },
    }));

    expect(result.configured).toBe(true);
    expect(result.authorized).toBe(true);
  });

  it("rejeita Bearer incorreto", () => {
    process.env.AUTOMATION_CRON_SECRET = "x".repeat(32);

    const result = cronAuthorized(new Request("https://example.test", {
      headers: { authorization: `Bearer ${"y".repeat(32)}` },
    }));

    expect(result.configured).toBe(true);
    expect(result.authorized).toBe(false);
  });
});
