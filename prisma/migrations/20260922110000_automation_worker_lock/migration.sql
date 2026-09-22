ALTER TABLE "Organization"
ADD COLUMN "automationLockedAt" TIMESTAMP(3),
ADD COLUMN "automationLockToken" TEXT;

CREATE INDEX "Organization_automationLockedAt_idx"
ON "Organization"("automationLockedAt");
