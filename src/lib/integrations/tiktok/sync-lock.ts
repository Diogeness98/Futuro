import { randomUUID } from "node:crypto";
import { db } from "../../db";

const DEFAULT_STALE_MINUTES = 15;

export async function acquireTikTokSyncLock(
  organizationId: string,
  options: { staleMinutes?: number; now?: Date } = {},
): Promise<string | null> {
  const staleMinutes = Math.max(1, options.staleMinutes ?? DEFAULT_STALE_MINUTES);
  const now = options.now ?? new Date();
  const staleBefore = new Date(now.getTime() - staleMinutes * 60 * 1000);
  const token = randomUUID();

  const claimed = await db.integration.updateMany({
    where: {
      organizationId,
      provider: "tiktok_shop",
      status: "connected",
      OR: [
        { syncLockedAt: null },
        { syncLockedAt: { lt: staleBefore } },
      ],
    },
    data: {
      syncLockedAt: now,
      syncLockToken: token,
    },
  });

  return claimed.count === 1 ? token : null;
}

export async function releaseTikTokSyncLock(
  organizationId: string,
  token: string,
) {
  const released = await db.integration.updateMany({
    where: {
      organizationId,
      provider: "tiktok_shop",
      syncLockToken: token,
    },
    data: {
      syncLockedAt: null,
      syncLockToken: null,
    },
  });

  return released.count === 1;
}
