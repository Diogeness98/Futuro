import { describe, expect, it } from "vitest";
import { normalizeTokenSet } from "./tokens";

describe("normalizeTokenSet", () => {
  it("normaliza resposta de seller dentro de data", () => {
    const result = normalizeTokenSet({
      code: 0,
      data: {
        access_token: "access",
        refresh_token: "refresh",
        open_id: "open",
        user_type: 0,
        granted_scopes: ["seller.order.info", "seller.product.basic"],
        access_token_expire_in: 3600,
      },
    });

    expect(result.accessToken).toBe("access");
    expect(result.refreshToken).toBe("refresh");
    expect(result.userType).toBe(0);
    expect(result.grantedScopes).toEqual(["seller.order.info", "seller.product.basic"]);
    expect(result.accessTokenExpiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("aceita scopes como string", () => {
    const result = normalizeTokenSet({
      access_token: "access",
      refresh_token: "refresh",
      user_type: 0,
      granted_scopes: "seller.order.info,seller.product.basic",
    });
    expect(result.grantedScopes).toEqual(["seller.order.info", "seller.product.basic"]);
  });

  it("rejeita autorização que não seja seller", () => {
    expect(() => normalizeTokenSet({
      access_token: "access",
      refresh_token: "refresh",
      user_type: 1,
    })).toThrow(/não é de seller/);
  });

  it("rejeita resposta sem tokens", () => {
    expect(() => normalizeTokenSet({ code: 0, data: {} })).toThrow(/access_token/);
  });
});
