-- CreateTable
CREATE TABLE "ShadowingProgress" (
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "bestScore" INTEGER,
    "completions" INTEGER NOT NULL DEFAULT 0,
    "linesSpoken" INTEGER NOT NULL DEFAULT 0,
    "lineScores" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShadowingProgress_pkey" PRIMARY KEY ("userId","lessonId")
);

-- AddForeignKey
ALTER TABLE "ShadowingProgress" ADD CONSTRAINT "ShadowingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
