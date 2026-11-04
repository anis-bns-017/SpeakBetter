-- AlterTable
ALTER TABLE "NotificationPreference" ADD COLUMN     "achievements" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "LeagueProfile" (
    "userId" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 0,
    "bestTier" INTEGER NOT NULL DEFAULT 0,
    "promotions" INTEGER NOT NULL DEFAULT 0,
    "podiums" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "LeagueGroup" (
    "id" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "xp" INTEGER,
    "rank" INTEGER,
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeagueGroup_weekStart_tier_idx" ON "LeagueGroup"("weekStart", "tier");

-- CreateIndex
CREATE INDEX "LeagueGroup_finalizedAt_idx" ON "LeagueGroup"("finalizedAt");

-- CreateIndex
CREATE INDEX "LeagueMember_groupId_idx" ON "LeagueMember"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueMember_userId_weekStart_key" ON "LeagueMember"("userId", "weekStart");

-- AddForeignKey
ALTER TABLE "LeagueProfile" ADD CONSTRAINT "LeagueProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMember" ADD CONSTRAINT "LeagueMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LeagueGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMember" ADD CONSTRAINT "LeagueMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

