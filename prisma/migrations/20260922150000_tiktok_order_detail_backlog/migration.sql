ALTER TABLE "Order"
ADD COLUMN "externalUpdatedAt" TIMESTAMP(3);

CREATE INDEX "Order_tiktok_detail_backlog_idx"
ON "Order"("organizationId", "channel", "detailsSyncedAt", "externalUpdatedAt");
