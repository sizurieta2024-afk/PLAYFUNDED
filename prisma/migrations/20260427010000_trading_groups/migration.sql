-- CreateEnum
CREATE TYPE "TradingGroupRole" AS ENUM ('owner', 'member');

-- CreateTable
CREATE TABLE "TradingGroup" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradingGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradingGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TradingGroupRole" NOT NULL DEFAULT 'member',
    "showStakeAmounts" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradingGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TradingGroup_ownerId_key" ON "TradingGroup"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "TradingGroup_code_key" ON "TradingGroup"("code");

-- CreateIndex
CREATE INDEX "TradingGroup_code_idx" ON "TradingGroup"("code");

-- CreateIndex
CREATE INDEX "TradingGroup_createdAt_idx" ON "TradingGroup"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TradingGroupMember_userId_key" ON "TradingGroupMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TradingGroupMember_groupId_userId_key" ON "TradingGroupMember"("groupId", "userId");

-- CreateIndex
CREATE INDEX "TradingGroupMember_groupId_idx" ON "TradingGroupMember"("groupId");

-- CreateIndex
CREATE INDEX "TradingGroupMember_role_idx" ON "TradingGroupMember"("role");

-- CreateIndex
CREATE INDEX "TradingGroupMember_joinedAt_idx" ON "TradingGroupMember"("joinedAt");

-- AddForeignKey
ALTER TABLE "TradingGroup" ADD CONSTRAINT "TradingGroup_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradingGroupMember" ADD CONSTRAINT "TradingGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TradingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradingGroupMember" ADD CONSTRAINT "TradingGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
