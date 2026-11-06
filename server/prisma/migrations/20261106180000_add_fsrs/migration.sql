-- AlterTable
ALTER TABLE "FlashcardReview" ADD COLUMN     "difficulty" DOUBLE PRECISION,
ADD COLUMN     "stability" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "desiredRetention" DOUBLE PRECISION NOT NULL DEFAULT 0.9;

-- AlterTable
ALTER TABLE "VoiceSavedWord" ADD COLUMN     "difficulty" DOUBLE PRECISION,
ADD COLUMN     "interval" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lapses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastReviewedAt" TIMESTAMP(3),
ADD COLUMN     "stability" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "ReviewLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "elapsedDays" DOUBLE PRECISION,
    "retrievability" DOUBLE PRECISION,
    "stability" DOUBLE PRECISION NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewLog_userId_reviewedAt_idx" ON "ReviewLog"("userId", "reviewedAt");

-- CreateIndex
CREATE INDEX "ReviewLog_itemType_itemId_idx" ON "ReviewLog"("itemType", "itemId");

-- AddForeignKey
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

