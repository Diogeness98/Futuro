DROP INDEX "Product_organizationId_sku_key";

ALTER TABLE "Product"
ADD COLUMN "externalId" TEXT,
ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN "currency" TEXT,
ADD COLUMN "externalStatus" TEXT,
ADD COLUMN "externalUpdatedAt" TIMESTAMP(3);

CREATE INDEX "Product_organizationId_channel_idx"
ON "Product"("organizationId", "channel");

CREATE UNIQUE INDEX "Product_organizationId_channel_sku_key"
ON "Product"("organizationId", "channel", "sku");

CREATE UNIQUE INDEX "Product_organizationId_channel_externalId_key"
ON "Product"("organizationId", "channel", "externalId");

CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "sellerSku" TEXT,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductVariant_productId_idx"
ON "ProductVariant"("productId");

CREATE UNIQUE INDEX "ProductVariant_productId_externalId_key"
ON "ProductVariant"("productId", "externalId");

ALTER TABLE "ProductVariant"
ADD CONSTRAINT "ProductVariant_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
