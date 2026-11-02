-- AlterEnum
ALTER TYPE "XpReason" ADD VALUE 'AI_PRACTICE';

-- AlterTable
ALTER TABLE "AiChat" ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "level" TEXT,
ADD COLUMN     "scenario" TEXT,
ADD COLUMN     "summary" JSONB;

-- AlterTable
ALTER TABLE "AiMessage" ADD COLUMN     "metadata" JSONB;

-- CreateIndex
CREATE INDEX "AiChat_userId_createdAt_idx" ON "AiChat"("userId", "createdAt");
