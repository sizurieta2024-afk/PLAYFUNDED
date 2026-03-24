-- AlterTable
ALTER TABLE "Affiliate"
ADD COLUMN     "discountPct" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Payment"
ADD COLUMN     "discountAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discountCode" TEXT,
ADD COLUMN     "discountPct" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "listPriceAmount" INTEGER;

UPDATE "Payment"
SET "listPriceAmount" = "amount"
WHERE "listPriceAmount" IS NULL;

ALTER TABLE "Payment"
ALTER COLUMN "listPriceAmount" SET NOT NULL;

-- AlterTable
ALTER TABLE "Payout"
ADD COLUMN     "destinationAddress" TEXT,
ADD COLUMN     "providerPayoutId" TEXT;

-- CreateTable
CREATE TABLE "AffiliateConversion" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "listPriceAmount" INTEGER NOT NULL,
    "paidAmount" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "discountPct" INTEGER NOT NULL DEFAULT 0,
    "commissionEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateConversion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateConversion_paymentId_key" ON "AffiliateConversion"("paymentId");

-- CreateIndex
CREATE INDEX "AffiliateConversion_affiliateId_idx" ON "AffiliateConversion"("affiliateId");

-- CreateIndex
CREATE INDEX "AffiliateConversion_userId_idx" ON "AffiliateConversion"("userId");

-- CreateIndex
CREATE INDEX "Payment_discountCode_idx" ON "Payment"("discountCode");

-- AddForeignKey
ALTER TABLE "AffiliateConversion" ADD CONSTRAINT "AffiliateConversion_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateConversion" ADD CONSTRAINT "AffiliateConversion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateConversion" ADD CONSTRAINT "AffiliateConversion_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
