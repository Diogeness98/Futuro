ALTER TABLE "Order"
ADD COLUMN "needUploadInvoice" TEXT,
ADD COLUMN "orderType" TEXT,
ADD COLUMN "fulfillmentType" TEXT,
ADD COLUMN "shippingType" TEXT,
ADD COLUMN "detailsSyncedAt" TIMESTAMP(3);

ALTER TABLE "OrderItem"
ADD COLUMN "externalId" TEXT,
ADD COLUMN "externalSkuId" TEXT,
ADD COLUMN "sellerSku" TEXT,
ADD COLUMN "currency" TEXT;

CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
