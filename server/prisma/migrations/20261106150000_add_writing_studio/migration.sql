-- AlterEnum
ALTER TYPE "XpReason" ADD VALUE 'WRITING_PRACTICE';

-- CreateTable
CREATE TABLE "WritingPiece" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "variant" TEXT NOT NULL DEFAULT 'en-GB',
    "issues" JSONB,
    "firstIssues" JSONB,
    "firstText" TEXT,
    "checks" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WritingPiece_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WritingPiece_userId_updatedAt_idx" ON "WritingPiece"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "WritingPiece_userId_submittedAt_idx" ON "WritingPiece"("userId", "submittedAt");

-- CreateIndex
CREATE INDEX "WritingPiece_userId_promptId_idx" ON "WritingPiece"("userId", "promptId");

-- AddForeignKey
ALTER TABLE "WritingPiece" ADD CONSTRAINT "WritingPiece_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

