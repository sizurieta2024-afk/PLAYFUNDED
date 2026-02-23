-- PlayFunded — Initial Schema Migration
-- Paste this entire file into: Supabase Dashboard → SQL Editor → New query → Run

-- ENUMS
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');
CREATE TYPE "Language" AS ENUM ('es', 'en');
CREATE TYPE "ChallengeStatus" AS ENUM ('active', 'passed', 'failed', 'funded');
CREATE TYPE "PhaseType" AS ENUM ('phase1', 'phase2', 'funded');
CREATE TYPE "PickStatus" AS ENUM ('pending', 'won', 'lost', 'void', 'push');
CREATE TYPE "PaymentMethod" AS ENUM ('card', 'usdt', 'usdc', 'btc', 'mercadopago');
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');
CREATE TYPE "PayoutMethod" AS ENUM ('bank_wire', 'usdt', 'usdc', 'btc', 'paypal');
CREATE TYPE "PayoutStatus" AS ENUM ('pending', 'processing', 'paid', 'failed');
CREATE TYPE "KycStatus" AS ENUM ('not_required', 'pending', 'approved', 'rejected');
CREATE TYPE "IdType" AS ENUM ('passport', 'national_id', 'drivers_license');
CREATE TYPE "MarketRequestStatus" AS ENUM ('pending', 'reviewed', 'approved', 'rejected');
CREATE TYPE "AffiliateCommissionRate" AS ENUM ('five', 'ten');

-- USER
CREATE TABLE "User" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
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
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_supabaseId_key" ON "User"("supabaseId");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");

-- TIER
CREATE TABLE "Tier" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "fee" INTEGER NOT NULL,
  "fundedBankroll" INTEGER NOT NULL,
  "profitSplitPct" INTEGER NOT NULL,
  "minPicks" INTEGER NOT NULL DEFAULT 15,
  "guideIncluded" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tier_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tier_name_key" ON "Tier"("name");

-- CHALLENGE
CREATE TABLE "Challenge" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "tierId" TEXT NOT NULL,
  "status" "ChallengeStatus" NOT NULL DEFAULT 'active',
  "phase" "PhaseType" NOT NULL DEFAULT 'phase1',
  "balance" INTEGER NOT NULL,
  "startBalance" INTEGER NOT NULL,
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Challenge_userId_idx" ON "Challenge"("userId");
CREATE INDEX "Challenge_status_idx" ON "Challenge"("status");
CREATE INDEX "Challenge_phase_idx" ON "Challenge"("phase");
CREATE INDEX "Challenge_userId_status_idx" ON "Challenge"("userId", "status");

-- PICK
CREATE TABLE "Pick" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "challengeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sport" TEXT NOT NULL,
  "league" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "eventName" TEXT,
  "marketType" TEXT NOT NULL,
  "selection" TEXT NOT NULL,
  "odds" DOUBLE PRECISION NOT NULL,
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Pick_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Pick_challengeId_idx" ON "Pick"("challengeId");
CREATE INDEX "Pick_status_idx" ON "Pick"("status");
CREATE INDEX "Pick_placedAt_idx" ON "Pick"("placedAt");
CREATE INDEX "Pick_challengeId_status_idx" ON "Pick"("challengeId", "status");
CREATE INDEX "Pick_challengeId_placedAt_idx" ON "Pick"("challengeId", "placedAt");

-- PARLAY LEG
CREATE TABLE "ParlayLeg" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
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
CREATE INDEX "ParlayLeg_pickId_idx" ON "ParlayLeg"("pickId");

-- PAYMENT
CREATE TABLE "Payment" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
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
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Payment_giftToken_key" ON "Payment"("giftToken");
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");
CREATE INDEX "Payment_providerRef_idx" ON "Payment"("providerRef");

-- PAYOUT
CREATE TABLE "Payout" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "splitPct" INTEGER NOT NULL,
  "method" "PayoutMethod" NOT NULL,
  "status" "PayoutStatus" NOT NULL DEFAULT 'pending',
  "adminNote" TEXT,
  "txRef" TEXT,
  "isRollover" BOOLEAN NOT NULL DEFAULT false,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Payout_userId_idx" ON "Payout"("userId");
CREATE INDEX "Payout_status_idx" ON "Payout"("status");
CREATE INDEX "Payout_challengeId_idx" ON "Payout"("challengeId");

-- KYC SUBMISSION
CREATE TABLE "KycSubmission" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KycSubmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "KycSubmission_userId_key" ON "KycSubmission"("userId");

-- AFFILIATE
CREATE TABLE "Affiliate" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "commissionRate" "AffiliateCommissionRate" NOT NULL DEFAULT 'five',
  "totalClicks" INTEGER NOT NULL DEFAULT 0,
  "totalConversions" INTEGER NOT NULL DEFAULT 0,
  "totalEarned" INTEGER NOT NULL DEFAULT 0,
  "pendingPayout" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Affiliate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Affiliate_userId_key" ON "Affiliate"("userId");
CREATE UNIQUE INDEX "Affiliate_code_key" ON "Affiliate"("code");
CREATE INDEX "Affiliate_code_idx" ON "Affiliate"("code");

-- AFFILIATE CLICK
CREATE TABLE "AffiliateClick" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "affiliateId" TEXT NOT NULL,
  "ip" TEXT NOT NULL,
  "userAgent" TEXT,
  "convertedToUserId" TEXT,
  "conversionAmount" INTEGER,
  "commissionEarned" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliateClick_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AffiliateClick_affiliateId_idx" ON "AffiliateClick"("affiliateId");
CREATE INDEX "AffiliateClick_convertedToUserId_idx" ON "AffiliateClick"("convertedToUserId");

-- MARKET REQUEST
CREATE TABLE "MarketRequest" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "sport" TEXT NOT NULL,
  "league" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "MarketRequestStatus" NOT NULL DEFAULT 'pending',
  "adminNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MarketRequest_status_idx" ON "MarketRequest"("status");
CREATE INDEX "MarketRequest_userId_idx" ON "MarketRequest"("userId");

-- ODDS CACHE
CREATE TABLE "OddsCache" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
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
CREATE UNIQUE INDEX "OddsCache_sport_league_event_startTime_key" ON "OddsCache"("sport", "league", "event", "startTime");
CREATE INDEX "OddsCache_sport_league_idx" ON "OddsCache"("sport", "league");
CREATE INDEX "OddsCache_startTime_idx" ON "OddsCache"("startTime");
CREATE INDEX "OddsCache_fetchedAt_idx" ON "OddsCache"("fetchedAt");

-- FOLLOW
CREATE TABLE "Follow" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "followerId" TEXT NOT NULL,
  "followingId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");
CREATE INDEX "Follow_followerId_idx" ON "Follow"("followerId");
CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");

-- FOREIGN KEYS
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "Tier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ParlayLeg" ADD CONSTRAINT "ParlayLeg_pickId_fkey" FOREIGN KEY ("pickId") REFERENCES "Pick"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "Tier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KycSubmission" ADD CONSTRAINT "KycSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AffiliateClick" ADD CONSTRAINT "AffiliateClick_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketRequest" ADD CONSTRAINT "MarketRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SEED: 4 challenge tiers
INSERT INTO "Tier" ("id", "name", "fee", "fundedBankroll", "profitSplitPct", "minPicks", "guideIncluded", "isActive", "sortOrder", "createdAt", "updatedAt") VALUES
  (gen_random_uuid()::text, 'Starter $1K',    2000,   100000,  70, 15, false, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Pro $5K',         9900,   500000,  75, 15, true,  true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Elite $10K',     19900,  1000000,  80, 15, true,  true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Champion $25K',  49900,  2500000,  80, 15, true,  true, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
