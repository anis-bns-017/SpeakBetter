-- AlterEnum
ALTER TYPE "XpReason" ADD VALUE 'PRONUNCIATION_PRACTICE';

-- CreateTable
CREATE TABLE "PronunciationAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "heard" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "sound" TEXT,
    "source" TEXT NOT NULL DEFAULT 'sentence',
    "missedWords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PronunciationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PronunciationAttempt_userId_createdAt_idx" ON "PronunciationAttempt"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "PronunciationAttempt" ADD CONSTRAINT "PronunciationAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
