ALTER TABLE "Integration"
ADD COLUMN "syncLockedAt" TIMESTAMP(3);

CREATE INDEX "Integration_provider_status_syncLockedAt_idx"
ON "Integration"("provider", "status", "syncLockedAt");
