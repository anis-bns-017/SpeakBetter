-- AlterEnum
ALTER TYPE "MessageType" ADD VALUE 'CHALLENGE_REACTION';

-- AlterTable
ALTER TABLE "NotificationPreference" ADD COLUMN     "challenges" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ChallengeEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "stats" JSONB NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeReaction" (
    "entryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeReaction_pkey" PRIMARY KEY ("entryId","userId")
);

-- CreateIndex
CREATE INDEX "ChallengeEntry_day_visibility_idx" ON "ChallengeEntry"("day", "visibility");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeEntry_userId_day_key" ON "ChallengeEntry"("userId", "day");

-- CreateIndex
CREATE INDEX "ChallengeReaction_userId_idx" ON "ChallengeReaction"("userId");

-- AddForeignKey
ALTER TABLE "ChallengeEntry" ADD CONSTRAINT "ChallengeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeReaction" ADD CONSTRAINT "ChallengeReaction_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ChallengeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeReaction" ADD CONSTRAINT "ChallengeReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

