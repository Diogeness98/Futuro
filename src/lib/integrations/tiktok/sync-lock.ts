import { db } from "../../db";

const DEFAULT_STALE_MINUTES = 15;

export async function acquireTikTokSyncLock(
  organizationId: string,
  options: { staleMinutes?: number; now?: Date } = {},
) {
  const staleMinutes = Math.max(1, options.staleMinutes ?? DEFAULT_STALE_MINUTES);
  const now = options.now ?? new Date();
  const staleBefore = new Date(now.getTime() - staleMinutes * 60 * 1000);

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
    },
  });

  return claimed.count === 1;
}

export async function releaseTikTokSyncLock(organizationId: string) {
  await db.integration.updateMany({
    where: {
      organizationId,
      provider: "tiktok_shop",
    },
    data: {
      syncLockedAt: null,
    },
  });
}
