ALTER TABLE "Order"
ADD COLUMN "orderCreatedEventAt" TIMESTAMP(3);

-- Existing TikTok orders are historical baseline. Do not replay their
-- order.created automations after this migration.
UPDATE "Order"
SET "orderCreatedEventAt" = CURRENT_TIMESTAMP
WHERE "channel" = 'tiktok_shop';
