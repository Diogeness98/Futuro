import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptJson, encryptJson } from "./secrets";

describe("integration secret encryption", () => {
  it("round-trips JSON with AES-GCM", () => {
    const key = randomBytes(32);
    const source = { accessToken: "token", refreshToken: "refresh", expiresAt: 123 };

    const encrypted = encryptJson(source, "futuro:test", key);
    expect(encrypted).not.toContain("token");

    const decoded = decryptJson<typeof source>(encrypted, "futuro:test", key);
    expect(decoded).toEqual(source);
  });

  it("rejects a different AAD context", () => {
    const key = randomBytes(32);
    const encrypted = encryptJson({ secret: "value" }, "futuro:one", key);
    expect(() => decryptJson(encrypted, "futuro:two", key)).toThrow();
  });
});
