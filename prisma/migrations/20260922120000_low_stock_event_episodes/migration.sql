ALTER TABLE "Product"
ADD COLUMN "lowStockEpisodeId" TEXT,
ADD COLUMN "lowStockEventAt" TIMESTAMP(3);

-- Existing TikTok products are historical baseline. They must not flood
-- the automation queue immediately after this migration.
UPDATE "Product"
SET
  "lowStockEpisodeId" = 'baseline:' || "id",
  "lowStockEventAt" = CURRENT_TIMESTAMP
WHERE "channel" = 'tiktok_shop';
