-- AlterTable
ALTER TABLE "Flashcard" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'word',
ADD COLUMN     "note" TEXT,
ADD COLUMN     "pattern" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "sourceId" TEXT;

-- AlterTable
ALTER TABLE "FlashcardReview" ADD COLUMN     "lapses" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Flashcard_userId_kind_createdAt_idx" ON "Flashcard"("userId", "kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Flashcard_userId_source_sourceId_key" ON "Flashcard"("userId", "source", "sourceId");
