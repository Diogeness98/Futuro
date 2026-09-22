import { describe, expect, it } from "vitest";
import {
  createTikTokOAuthStateCookie,
  verifyTikTokOAuthStateCookie,
} from "./oauth-state";

const secret = "test-secret-with-at-least-thirty-two-characters";

describe("TikTok OAuth state", () => {
  it("aceita nonce, usuário e organização originais", () => {
    const cookieValue = createTikTokOAuthStateCookie({
      nonce: "nonce-1",
      userId: "user-1",
      organizationId: "org-1",
      issuedAt: 1_000,
    }, secret);

    const result = verifyTikTokOAuthStateCookie({
      cookieValue,
      returnedNonce: "nonce-1",
      userId: "user-1",
      organizationId: "org-1",
      now: 2_000,
      secret,
    });

    expect(result?.organizationId).toBe("org-1");
  });

  it("rejeita callback em outra organização", () => {
    const cookieValue = createTikTokOAuthStateCookie({
      nonce: "nonce-1",
      userId: "user-1",
      organizationId: "org-1",
      issuedAt: 1_000,
    }, secret);

    expect(verifyTikTokOAuthStateCookie({
      cookieValue,
      returnedNonce: "nonce-1",
      userId: "user-1",
      organizationId: "org-2",
      now: 2_000,
      secret,
    })).toBeNull();
  });

  it("rejeita cookie adulterado", () => {
    const cookieValue = createTikTokOAuthStateCookie({
      nonce: "nonce-1",
      userId: "user-1",
      organizationId: "org-1",
      issuedAt: 1_000,
    }, secret);

    const last = cookieValue.at(-1);
    const tampered = cookieValue.slice(0, -1) + (last === "A" ? "B" : "A");

    expect(verifyTikTokOAuthStateCookie({
      cookieValue: tampered,
      returnedNonce: "nonce-1",
      userId: "user-1",
      organizationId: "org-1",
      now: 2_000,
      secret,
    })).toBeNull();
  });

  it("rejeita estado expirado", () => {
    const cookieValue = createTikTokOAuthStateCookie({
      nonce: "nonce-1",
      userId: "user-1",
      organizationId: "org-1",
      issuedAt: 1_000,
    }, secret);

    expect(verifyTikTokOAuthStateCookie({
      cookieValue,
      returnedNonce: "nonce-1",
      userId: "user-1",
      organizationId: "org-1",
      now: 1_000 + 11 * 60 * 1000,
      secret,
    })).toBeNull();
  });
});
