-- CreateTable
CREATE TABLE "VocabPackProgress" (
    "userId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "bestScore" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VocabPackProgress_pkey" PRIMARY KEY ("userId","packId")
);

-- CreateIndex
CREATE INDEX "VocabPackProgress_userId_completedAt_idx" ON "VocabPackProgress"("userId", "completedAt");

-- AddForeignKey
ALTER TABLE "VocabPackProgress" ADD CONSTRAINT "VocabPackProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
