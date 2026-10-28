-- CreateTable
CREATE TABLE "VoiceCorrection" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "original" TEXT NOT NULL,
    "corrected" TEXT NOT NULL,
    "note" TEXT,
    "category" TEXT NOT NULL DEFAULT 'other',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "VoiceCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoiceCorrection_roomId_createdAt_idx" ON "VoiceCorrection"("roomId", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceCorrection_targetUserId_status_idx" ON "VoiceCorrection"("targetUserId", "status");

-- AddForeignKey
ALTER TABLE "VoiceCorrection" ADD CONSTRAINT "VoiceCorrection_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "VoiceRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCorrection" ADD CONSTRAINT "VoiceCorrection_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCorrection" ADD CONSTRAINT "VoiceCorrection_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

