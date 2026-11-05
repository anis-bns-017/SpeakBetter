-- CreateTable
CREATE TABLE "DictationResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "sentences" INTEGER NOT NULL,
    "perfectSentences" INTEGER NOT NULL,
    "correctWords" INTEGER NOT NULL,
    "totalWords" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DictationResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DictationResult_userId_day_idx" ON "DictationResult"("userId", "day");

-- AddForeignKey
ALTER TABLE "DictationResult" ADD CONSTRAINT "DictationResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
