import { describe, expect, it } from "vitest";
import { getTikTokOrderDetails } from "./client";

describe("getTikTokOrderDetails", () => {
  it("não chama a API quando a lista está vazia", async () => {
    await expect(getTikTokOrderDetails("token", "shop", [])).resolves.toEqual([]);
  });

  it("rejeita mais de 50 IDs por chamada", async () => {
    const ids = Array.from({ length: 51 }, (_, index) => String(index + 1));

    await expect(
      getTikTokOrderDetails("token", "shop", ids),
    ).rejects.toThrow(/no máximo 50 IDs/);
  });
});
