-- CreateEnum
CREATE TYPE "PlacementStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "levelAssessedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PlacementAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PlacementStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "answers" JSONB NOT NULL DEFAULT '[]',
    "currentItemId" TEXT,
    "level" TEXT,
    "result" JSONB,
    "speaking" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PlacementAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlacementAttempt_userId_startedAt_idx" ON "PlacementAttempt"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "PlacementAttempt_userId_status_idx" ON "PlacementAttempt"("userId", "status");

-- AddForeignKey
ALTER TABLE "PlacementAttempt" ADD CONSTRAINT "PlacementAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
