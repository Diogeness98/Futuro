import { randomUUID } from "node:crypto";
import { db } from "../db";

const DEFAULT_STALE_MINUTES = 15;

export async function acquireAutomationWorkerLock(
  organizationId: string,
  options: { staleMinutes?: number; now?: Date } = {},
): Promise<string | null> {
  const staleMinutes = Math.max(1, options.staleMinutes ?? DEFAULT_STALE_MINUTES);
  const now = options.now ?? new Date();
  const staleBefore = new Date(now.getTime() - staleMinutes * 60 * 1000);
  const token = randomUUID();

  const claimed = await db.organization.updateMany({
    where: {
      id: organizationId,
      OR: [
        { automationLockedAt: null },
        { automationLockedAt: { lt: staleBefore } },
      ],
    },
    data: {
      automationLockedAt: now,
      automationLockToken: token,
    },
  });

  return claimed.count === 1 ? token : null;
}

export async function releaseAutomationWorkerLock(
  organizationId: string,
  token: string,
) {
  const released = await db.organization.updateMany({
    where: {
      id: organizationId,
      automationLockToken: token,
    },
    data: {
      automationLockedAt: null,
      automationLockToken: null,
    },
  });

  return released.count === 1;
}
