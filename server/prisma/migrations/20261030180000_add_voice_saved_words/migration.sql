-- CreateTable
CREATE TABLE "VoiceSavedWord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "sentence" TEXT,
    "meaning" TEXT,
    "speakerName" TEXT,
    "roomName" TEXT,
    "box" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceSavedWord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoiceSavedWord_userId_word_key" ON "VoiceSavedWord"("userId", "word");

-- CreateIndex
CREATE INDEX "VoiceSavedWord_userId_dueAt_idx" ON "VoiceSavedWord"("userId", "dueAt");

-- AddForeignKey
ALTER TABLE "VoiceSavedWord" ADD CONSTRAINT "VoiceSavedWord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
