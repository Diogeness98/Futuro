import { describe, expect, it } from "vitest";
import { shouldQueueTikTokOrderEvent } from "./sync-policy";

describe("TikTok sync automation policy", () => {
  it("não dispara automações durante a importação inicial", () => {
    expect(shouldQueueTikTokOrderEvent({
      initialImport: true,
      orderCreatedEventAt: null,
    })).toBe(false);
  });

  it("permite evento novo após a primeira sincronização", () => {
    expect(shouldQueueTikTokOrderEvent({
      initialImport: false,
      orderCreatedEventAt: null,
    })).toBe(true);
  });

  it("não repete evento que já foi entregue", () => {
    expect(shouldQueueTikTokOrderEvent({
      initialImport: false,
      orderCreatedEventAt: new Date(),
    })).toBe(false);
  });
});
