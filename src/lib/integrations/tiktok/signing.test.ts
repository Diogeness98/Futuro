import { describe, expect, it } from "vitest";
import { signTikTokRequest } from "./signing";

const base = {
  appSecret: "test-secret",
  path: "/authorization/202309/shops",
};

describe("signTikTokRequest", () => {
  it("ordena query params antes de assinar", () => {
    const a = signTikTokRequest({ ...base, query: { timestamp: 123, app_key: "abc", shop_cipher: "shop" } });
    const b = signTikTokRequest({ ...base, query: { shop_cipher: "shop", app_key: "abc", timestamp: 123 } });
    expect(a).toBe(b);
  });

  it("ignora sign e access_token no material assinado", () => {
    const a = signTikTokRequest({ ...base, query: { app_key: "abc", timestamp: 123 } });
    const b = signTikTokRequest({
      ...base,
      query: { app_key: "abc", timestamp: 123, sign: "old", access_token: "legacy" },
    });
    expect(a).toBe(b);
  });

  it("inclui JSON body para requests não multipart", () => {
    const a = signTikTokRequest({ ...base, query: { app_key: "abc", timestamp: 123 }, body: '{"a":1}', contentType: "application/json" });
    const b = signTikTokRequest({ ...base, query: { app_key: "abc", timestamp: 123 }, body: '{"a":2}', contentType: "application/json" });
    expect(a).not.toBe(b);
  });

  it("não inclui body multipart", () => {
    const a = signTikTokRequest({ ...base, query: { app_key: "abc", timestamp: 123 }, body: "one", contentType: "multipart/form-data; boundary=x" });
    const b = signTikTokRequest({ ...base, query: { app_key: "abc", timestamp: 123 }, body: "two", contentType: "multipart/form-data; boundary=x" });
    expect(a).toBe(b);
  });
});
