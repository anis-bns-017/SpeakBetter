-- AlterEnum
ALTER TYPE "XpReason" ADD VALUE 'VOCAB_TEST';

-- CreateTable
CREATE TABLE "KnownWord" (
    "userId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'marked',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnownWord_pkey" PRIMARY KEY ("userId","wordId")
);

-- CreateTable
CREATE TABLE "VocabSizeTest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "estimate" INTEGER,
    "level" TEXT,
    "bands" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "VocabSizeTest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnownWord_userId_idx" ON "KnownWord"("userId");

-- CreateIndex
CREATE INDEX "VocabSizeTest_userId_createdAt_idx" ON "VocabSizeTest"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "KnownWord" ADD CONSTRAINT "KnownWord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabSizeTest" ADD CONSTRAINT "VocabSizeTest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

