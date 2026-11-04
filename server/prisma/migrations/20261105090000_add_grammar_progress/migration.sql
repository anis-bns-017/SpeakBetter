-- CreateTable
CREATE TABLE "GrammarProgress" (
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "bestScore" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrammarProgress_pkey" PRIMARY KEY ("userId","lessonId")
);

-- CreateIndex
CREATE INDEX "GrammarProgress_userId_completedAt_idx" ON "GrammarProgress"("userId", "completedAt");

-- AddForeignKey
ALTER TABLE "GrammarProgress" ADD CONSTRAINT "GrammarProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
