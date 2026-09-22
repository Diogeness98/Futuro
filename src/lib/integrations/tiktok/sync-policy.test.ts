import { describe, expect, it } from "vitest";
import { shouldQueueTikTokOrderEvent } from "./sync-policy";

describe("TikTok sync automation policy", () => {
  it("não dispara automações durante a importação inicial", () => {
    expect(shouldQueueTikTokOrderEvent({ initialImport: true })).toBe(false);
  });

  it("permite eventos após a primeira sincronização concluída", () => {
    expect(shouldQueueTikTokOrderEvent({ initialImport: false })).toBe(true);
  });
});
