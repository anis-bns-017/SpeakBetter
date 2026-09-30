-- CreateTable
CREATE TABLE "VoiceRoomMessageReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceRoomMessageReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoiceRoomMessageReaction_userId_idx" ON "VoiceRoomMessageReaction"("userId");

-- CreateIndex
CREATE INDEX "VoiceRoomMessageReaction_messageId_idx" ON "VoiceRoomMessageReaction"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceRoomMessageReaction_messageId_userId_key" ON "VoiceRoomMessageReaction"("messageId", "userId");

-- AddForeignKey
ALTER TABLE "VoiceRoomMessageReaction" ADD CONSTRAINT "VoiceRoomMessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "VoiceRoomMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceRoomMessageReaction" ADD CONSTRAINT "VoiceRoomMessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
