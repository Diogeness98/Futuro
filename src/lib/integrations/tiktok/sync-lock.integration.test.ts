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

  it("permite um único claim e libera somente com o token dono", async () => {
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

    expect(first).toEqual(expect.any(String));
    expect(second).toBeNull();

    const wrongRelease = await releaseTikTokSyncLock(organization.id, "wrong-token");
    expect(wrongRelease).toBe(false);

    if (!first) throw new Error("Lock esperado no teste.");
    const released = await releaseTikTokSyncLock(organization.id, first);
    expect(released).toBe(true);

    const third = await acquireTikTokSyncLock(organization.id);
    expect(third).toEqual(expect.any(String));
  });

  it("recupera lock expirado sem permitir que o dono antigo libere o novo", async () => {
    const organization = await db.organization.create({
      data: { name: "TikTok Stale Lock Test" },
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

    const oldToken = await acquireTikTokSyncLock(organization.id);
    expect(oldToken).toEqual(expect.any(String));
    if (!oldToken) throw new Error("Lock inicial esperado no teste.");

    await db.integration.updateMany({
      where: {
        organizationId: organization.id,
        provider: "tiktok_shop",
      },
      data: {
        syncLockedAt: new Date(Date.now() - 30 * 60 * 1000),
      },
    });

    const newToken = await acquireTikTokSyncLock(organization.id, {
      staleMinutes: 15,
      now: new Date(),
    });

    expect(newToken).toEqual(expect.any(String));
    expect(newToken).not.toBe(oldToken);

    const oldOwnerReleased = await releaseTikTokSyncLock(organization.id, oldToken);
    expect(oldOwnerReleased).toBe(false);

    const stillLocked = await acquireTikTokSyncLock(organization.id);
    expect(stillLocked).toBeNull();

    if (!newToken) throw new Error("Novo lock esperado no teste.");
    expect(await releaseTikTokSyncLock(organization.id, newToken)).toBe(true);
  });
});
