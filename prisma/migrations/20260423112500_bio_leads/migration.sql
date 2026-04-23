-- CreateTable
CREATE TABLE "BioLead" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'es-419',
    "ref" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "submissionCount" INTEGER NOT NULL DEFAULT 1,
    "lastSubmittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BioLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BioLead_email_key" ON "BioLead"("email");

-- CreateIndex
CREATE INDEX "BioLead_country_idx" ON "BioLead"("country");

-- CreateIndex
CREATE INDEX "BioLead_createdAt_idx" ON "BioLead"("createdAt");

-- CreateIndex
CREATE INDEX "BioLead_lastSubmittedAt_idx" ON "BioLead"("lastSubmittedAt");

-- CreateIndex
CREATE INDEX "BioLead_utmSource_utmCampaign_idx" ON "BioLead"("utmSource", "utmCampaign");
