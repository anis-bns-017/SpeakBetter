-- AlterEnum
ALTER TYPE "XpReason" ADD VALUE 'QUEST_COMPLETED';

-- AlterTable
ALTER TABLE "Streak" ADD COLUMN     "freezes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "xpSpent" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "StreakFreezeUse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "streak" INTEGER NOT NULL,
    "seenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreakFreezeUse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestWeek" (
    "userId" TEXT NOT NULL,
    "week" TEXT NOT NULL,
    "quests" JSONB NOT NULL,
    "rewardedMask" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "freezeGiven" BOOLEAN NOT NULL DEFAULT false,
    "seenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestWeek_pkey" PRIMARY KEY ("userId","week")
);

-- CreateIndex
CREATE INDEX "StreakFreezeUse_userId_seenAt_idx" ON "StreakFreezeUse"("userId", "seenAt");

-- CreateIndex
CREATE UNIQUE INDEX "StreakFreezeUse_userId_day_key" ON "StreakFreezeUse"("userId", "day");

-- AddForeignKey
ALTER TABLE "StreakFreezeUse" ADD CONSTRAINT "StreakFreezeUse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestWeek" ADD CONSTRAINT "QuestWeek_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

