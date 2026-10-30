-- AlterEnum
ALTER TYPE "XpReason" ADD VALUE 'MISSION_COMPLETED';

-- CreateTable
CREATE TABLE "VoiceSessionReport" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "speakingSec" INTEGER NOT NULL DEFAULT 0,
    "words" INTEGER NOT NULL DEFAULT 0,
    "uniqueWords" INTEGER NOT NULL DEFAULT 0,
    "fillerCount" INTEGER NOT NULL DEFAULT 0,
    "repeatCount" INTEGER NOT NULL DEFAULT 0,
    "wpm" INTEGER,
    "fluencyScore" INTEGER,
    "missionsCompleted" INTEGER NOT NULL DEFAULT 0,
    "missionXp" INTEGER NOT NULL DEFAULT 0,
    "correctionsReceived" INTEGER NOT NULL DEFAULT 0,
    "correctionsGiven" INTEGER NOT NULL DEFAULT 0,
    "topFillers" JSONB NOT NULL DEFAULT '[]',
    "missionWords" TEXT[],
    "richWords" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceSessionReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoiceSessionReport_roomId_userId_key" ON "VoiceSessionReport"("roomId", "userId");

-- CreateIndex
CREATE INDEX "VoiceSessionReport_userId_createdAt_idx" ON "VoiceSessionReport"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "VoiceSessionReport" ADD CONSTRAINT "VoiceSessionReport_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "VoiceRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceSessionReport" ADD CONSTRAINT "VoiceSessionReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
