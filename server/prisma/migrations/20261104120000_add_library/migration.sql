-- CreateTable
CREATE TABLE "LibraryProgress" (
    "userId" TEXT NOT NULL,
    "textId" TEXT NOT NULL,
    "bestScore" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryProgress_pkey" PRIMARY KEY ("userId","textId")
);

-- CreateIndex
CREATE INDEX "LibraryProgress_userId_completedAt_idx" ON "LibraryProgress"("userId", "completedAt");

-- AddForeignKey
ALTER TABLE "LibraryProgress" ADD CONSTRAINT "LibraryProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

