-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ROOM_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE 'ROOM_LIVE';
ALTER TYPE "NotificationType" ADD VALUE 'ROOM_SCHEDULED';
ALTER TYPE "NotificationType" ADD VALUE 'NEW_FOLLOWER';
ALTER TYPE "NotificationType" ADD VALUE 'CORRECTION';

-- AlterEnum
ALTER TYPE "XpReason" ADD VALUE 'DAILY_PLAN';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "data" JSONB,
ADD COLUMN     "dedupeKey" TEXT;

-- AlterTable
ALTER TABLE "NotificationPreference" ADD COLUMN     "corrections" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "followedLive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "friendRequests" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "newFollowers" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "roomReminders" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "dailyGoalMinutes" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "VoiceRoom" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DailyPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "goalMinutes" INTEGER NOT NULL,
    "tasks" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("followerId","followingId")
);

-- CreateTable
CREATE TABLE "VoiceRoomInterest" (
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceRoomInterest_pkey" PRIMARY KEY ("roomId","userId")
);

-- CreateIndex
CREATE INDEX "DailyPlan_userId_completedAt_idx" ON "DailyPlan"("userId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyPlan_userId_day_key" ON "DailyPlan"("userId", "day");

-- CreateIndex
CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");

-- CreateIndex
CREATE INDEX "VoiceRoomInterest_userId_idx" ON "VoiceRoomInterest"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "DailyPlan" ADD CONSTRAINT "DailyPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceRoomInterest" ADD CONSTRAINT "VoiceRoomInterest_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "VoiceRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceRoomInterest" ADD CONSTRAINT "VoiceRoomInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

