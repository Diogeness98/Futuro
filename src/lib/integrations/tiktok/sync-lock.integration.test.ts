import { afterEach, describe, expect, it } from "vitest";
import { db } from "../../db";
import { acquireTikTokSyncLock, releaseTikTokSyncLock } from "./sync-lock";

const describeDb = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;
const organizations: string[] = [];

describeDb("TikTok sync lock integration", () => {
  afterEach(async () => {
    if (organizations.length === 0) return;
    await db.organization.deleteMany({
      where: { id: { in: organizations.splice(0) } },
    });
  });

  it("permite um único claim e libera depois", async () => {
    const organization = await db.organization.create({
      data: { name: "TikTok Lock Test" },
    });
    organizations.push(organization.id);

    await db.integration.create({
      data: {
        organizationId: organization.id,
        provider: "tiktok_shop",
        status: "connected",
        config: { credentials: "test" },
      },
    });

    const first = await acquireTikTokSyncLock(organization.id);
    const second = await acquireTikTokSyncLock(organization.id);

    expect(first).toBe(true);
    expect(second).toBe(false);

    await releaseTikTokSyncLock(organization.id);

    const third = await acquireTikTokSyncLock(organization.id);
    expect(third).toBe(true);
  });

  it("recupera lock expirado", async () => {
    const organization = await db.organization.create({
      data: { name: "TikTok Stale Lock Test" },
    });
    organizations.push(organization.id);

    const stale = new Date(Date.now() - 30 * 60 * 1000);

    await db.integration.create({
      data: {
        organizationId: organization.id,
        provider: "tiktok_shop",
        status: "connected",
        config: { credentials: "test" },
        syncLockedAt: stale,
      },
    });

    const claimed = await acquireTikTokSyncLock(organization.id, {
      staleMinutes: 15,
      now: new Date(),
    });

    expect(claimed).toBe(true);
  });
});
