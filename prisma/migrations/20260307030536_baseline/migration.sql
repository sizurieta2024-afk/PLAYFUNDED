-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('es', 'en');

-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('active', 'passed', 'failed', 'funded');

-- CreateEnum
CREATE TYPE "PhaseType" AS ENUM ('phase1', 'phase2', 'funded');

-- CreateEnum
CREATE TYPE "PickStatus" AS ENUM ('pending', 'won', 'lost', 'void', 'push');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('card', 'usdt', 'usdc', 'btc', 'mercadopago');

-- CreateEnum
CREATE TYPE "CheckoutMethod" AS ENUM ('card', 'crypto', 'pix', 'mercadopago');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('bank_wire', 'usdt', 'usdc', 'btc', 'paypal');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('pending', 'processing', 'paid', 'failed');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('not_required', 'pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "IdType" AS ENUM ('passport', 'national_id', 'drivers_license');

-- CreateEnum
CREATE TYPE "MarketRequestStatus" AS ENUM ('pending', 'reviewed', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "AffiliateCommissionRate" AS ENUM ('five', 'ten');

-- CreateEnum
CREATE TYPE "CountryPolicyStatus" AS ENUM ('blocked', 'review', 'enabled');

-- CreateEnum
CREATE TYPE "OpsLevel" AS ENUM ('info', 'warn', 'error');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "language" "Language" NOT NULL DEFAULT 'es',
    "country" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "selfExcludedUntil" TIMESTAMP(3),
    "isPermExcluded" BOOLEAN NOT NULL DEFAULT false,
    "weeklyDepositLimit" INTEGER,
    "supabaseId" TEXT,
    "referredByCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fee" INTEGER NOT NULL,
    "fundedBankroll" INTEGER NOT NULL,
    "profitSplitPct" INTEGER NOT NULL,
    "minPicks" INTEGER NOT NULL DEFAULT 15,
    "guideIncluded" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'active',
    "phase" "PhaseType" NOT NULL DEFAULT 'phase1',
    "balance" INTEGER NOT NULL,
    "startBalance" INTEGER NOT NULL,
    "dailyStartBalance" INTEGER NOT NULL DEFAULT 0,
    "highestBalance" INTEGER NOT NULL,
    "peakBalance" INTEGER NOT NULL,
    "phase1StartBalance" INTEGER,
    "phase2StartBalance" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pausedUntil" TIMESTAMP(3),
    "pauseUsed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "fundedAt" TIMESTAMP(3),
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "bonusSplitPct" INTEGER NOT NULL DEFAULT 0,
    "isGift" BOOLEAN NOT NULL DEFAULT false,
    "giftedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pick" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "eventName" TEXT,
    "marketType" TEXT NOT NULL,
    "selection" TEXT NOT NULL,
    "odds" DOUBLE PRECISION NOT NULL,
    "linePoint" DOUBLE PRECISION,
    "stake" INTEGER NOT NULL,
    "potentialPayout" INTEGER NOT NULL,
    "actualPayout" INTEGER NOT NULL DEFAULT 0,
    "status" "PickStatus" NOT NULL DEFAULT 'pending',
    "isParlay" BOOLEAN NOT NULL DEFAULT false,
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "eventStart" TIMESTAMP(3),
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "showStakeAmt" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParlayLeg" (
    "id" TEXT NOT NULL,
    "pickId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "eventName" TEXT,
    "marketType" TEXT NOT NULL,
    "selection" TEXT NOT NULL,
    "odds" DOUBLE PRECISION NOT NULL,
    "status" "PickStatus" NOT NULL DEFAULT 'pending',

    CONSTRAINT "ParlayLeg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "providerRef" TEXT,
    "metadata" JSONB,
    "cryptoAddress" TEXT,
    "cryptoAmount" DOUBLE PRECISION,
    "cryptoNetwork" TEXT,
    "cryptoExpiry" TIMESTAMP(3),
    "isGift" BOOLEAN NOT NULL DEFAULT false,
    "giftRecipientEmail" TEXT,
    "giftToken" TEXT,
    "giftClaimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT,
    "amount" INTEGER NOT NULL,
    "splitPct" INTEGER NOT NULL,
    "method" "PayoutMethod" NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "txRef" TEXT,
    "providerData" JSONB,
    "isRollover" BOOLEAN NOT NULL DEFAULT false,
    "isAffiliate" BOOLEAN NOT NULL DEFAULT false,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "legalFirstName" TEXT NOT NULL,
    "legalLastName" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "bankCode" TEXT,
    "bankBranch" TEXT,
    "bankAccountNumber" TEXT,
    "bankAccountType" TEXT,
    "bankCity" TEXT,
    "bankStreet" TEXT,
    "pixKeyType" TEXT,
    "pixKeyValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'pending',
    "fullName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "country" TEXT NOT NULL,
    "idType" "IdType" NOT NULL,
    "idFrontUrl" TEXT NOT NULL,
    "idBackUrl" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Affiliate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "commissionRate" "AffiliateCommissionRate" NOT NULL DEFAULT 'five',
    "totalClicks" INTEGER NOT NULL DEFAULT 0,
    "totalConversions" INTEGER NOT NULL DEFAULT 0,
    "totalEarned" INTEGER NOT NULL DEFAULT 0,
    "pendingPayout" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Affiliate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateClick" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT,
    "convertedToUserId" TEXT,
    "conversionAmount" INTEGER,
    "commissionEarned" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CountryPolicyOverride" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "displayName" TEXT,
    "marketStatus" "CountryPolicyStatus",
    "publicAccess" BOOLEAN,
    "challengePurchasesEnabled" BOOLEAN,
    "payoutsEnabled" BOOLEAN,
    "requiresReviewNotice" BOOLEAN,
    "reviewNote" TEXT,
    "overrideCheckoutMethods" BOOLEAN NOT NULL DEFAULT false,
    "checkoutMethods" "CheckoutMethod"[] DEFAULT ARRAY[]::"CheckoutMethod"[],
    "overridePayoutMethods" BOOLEAN NOT NULL DEFAULT false,
    "payoutMethods" "PayoutMethod"[] DEFAULT ARRAY[]::"PayoutMethod"[],
    "showExactCommercialTerms" BOOLEAN,
    "affiliateProgramEnabled" BOOLEAN,
    "giftsEnabled" BOOLEAN,
    "showProcessorNames" BOOLEAN,
    "legalApproved" BOOLEAN,
    "pspApproved" BOOLEAN,
    "copyApproved" BOOLEAN,
    "kycEnabled" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CountryPolicyOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "MarketRequestStatus" NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OddsCache" (
    "id" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "eventName" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "markets" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider" TEXT NOT NULL,
    "isLive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OddsCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsEventLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "level" "OpsLevel" NOT NULL DEFAULT 'info',
    "source" TEXT,
    "actorUserId" TEXT,
    "subjectType" TEXT,
    "subjectId" TEXT,
    "country" TEXT,
    "policyVersion" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpsEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_supabaseId_key" ON "User"("supabaseId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Tier_name_key" ON "Tier"("name");

-- CreateIndex
CREATE INDEX "Challenge_userId_idx" ON "Challenge"("userId");

-- CreateIndex
CREATE INDEX "Challenge_status_idx" ON "Challenge"("status");

-- CreateIndex
CREATE INDEX "Challenge_phase_idx" ON "Challenge"("phase");

-- CreateIndex
CREATE INDEX "Challenge_userId_status_idx" ON "Challenge"("userId", "status");

-- CreateIndex
CREATE INDEX "Pick_challengeId_idx" ON "Pick"("challengeId");

-- CreateIndex
CREATE INDEX "Pick_status_idx" ON "Pick"("status");

-- CreateIndex
CREATE INDEX "Pick_placedAt_idx" ON "Pick"("placedAt");

-- CreateIndex
CREATE INDEX "Pick_challengeId_status_idx" ON "Pick"("challengeId", "status");

-- CreateIndex
CREATE INDEX "Pick_challengeId_placedAt_idx" ON "Pick"("challengeId", "placedAt");

-- CreateIndex
CREATE INDEX "ParlayLeg_pickId_idx" ON "ParlayLeg"("pickId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_giftToken_key" ON "Payment"("giftToken");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_providerRef_idx" ON "Payment"("providerRef");

-- CreateIndex
CREATE INDEX "Payout_userId_idx" ON "Payout"("userId");

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- CreateIndex
CREATE INDEX "Payout_challengeId_idx" ON "Payout"("challengeId");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutProfile_userId_key" ON "PayoutProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "KycSubmission_userId_key" ON "KycSubmission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_userId_key" ON "Affiliate"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_code_key" ON "Affiliate"("code");

-- CreateIndex
CREATE INDEX "Affiliate_code_idx" ON "Affiliate"("code");

-- CreateIndex
CREATE INDEX "AffiliateClick_affiliateId_idx" ON "AffiliateClick"("affiliateId");

-- CreateIndex
CREATE INDEX "AffiliateClick_convertedToUserId_idx" ON "AffiliateClick"("convertedToUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CountryPolicyOverride_country_key" ON "CountryPolicyOverride"("country");

-- CreateIndex
CREATE INDEX "CountryPolicyOverride_marketStatus_idx" ON "CountryPolicyOverride"("marketStatus");

-- CreateIndex
CREATE INDEX "CountryPolicyOverride_updatedAt_idx" ON "CountryPolicyOverride"("updatedAt");

-- CreateIndex
CREATE INDEX "MarketRequest_status_idx" ON "MarketRequest"("status");

-- CreateIndex
CREATE INDEX "MarketRequest_userId_idx" ON "MarketRequest"("userId");

-- CreateIndex
CREATE INDEX "OddsCache_sport_league_idx" ON "OddsCache"("sport", "league");

-- CreateIndex
CREATE INDEX "OddsCache_startTime_idx" ON "OddsCache"("startTime");

-- CreateIndex
CREATE INDEX "OddsCache_fetchedAt_idx" ON "OddsCache"("fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OddsCache_sport_league_event_startTime_key" ON "OddsCache"("sport", "league", "event", "startTime");

-- CreateIndex
CREATE INDEX "AuditLog_adminId_idx" ON "AuditLog"("adminId");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "OpsEventLog_type_idx" ON "OpsEventLog"("type");

-- CreateIndex
CREATE INDEX "OpsEventLog_level_idx" ON "OpsEventLog"("level");

-- CreateIndex
CREATE INDEX "OpsEventLog_source_idx" ON "OpsEventLog"("source");

-- CreateIndex
CREATE INDEX "OpsEventLog_subjectType_subjectId_idx" ON "OpsEventLog"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "OpsEventLog_country_idx" ON "OpsEventLog"("country");

-- CreateIndex
CREATE INDEX "OpsEventLog_createdAt_idx" ON "OpsEventLog"("createdAt");

-- CreateIndex
CREATE INDEX "Follow_followerId_idx" ON "Follow"("followerId");

-- CreateIndex
CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "Tier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParlayLeg" ADD CONSTRAINT "ParlayLeg_pickId_fkey" FOREIGN KEY ("pickId") REFERENCES "Pick"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "Tier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutProfile" ADD CONSTRAINT "PayoutProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycSubmission" ADD CONSTRAINT "KycSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateClick" ADD CONSTRAINT "AffiliateClick_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketRequest" ADD CONSTRAINT "MarketRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
