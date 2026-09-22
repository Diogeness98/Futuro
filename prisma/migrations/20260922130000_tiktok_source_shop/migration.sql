ALTER TABLE "Order"
ADD COLUMN "sourceShopCipher" TEXT,
ADD COLUMN "sourceShopName" TEXT;

ALTER TABLE "Product"
ADD COLUMN "sourceShopCipher" TEXT,
ADD COLUMN "sourceShopName" TEXT;
