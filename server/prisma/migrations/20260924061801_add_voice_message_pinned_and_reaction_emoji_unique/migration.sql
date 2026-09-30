/*
  Warnings:

  - A unique constraint covering the columns `[messageId,userId,emoji]` on the table `VoiceRoomMessageReaction` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "VoiceRoomMessageReaction_messageId_userId_key";

-- AlterTable
ALTER TABLE "VoiceRoomMessage" ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "VoiceRoomMessage_isPinned_idx" ON "VoiceRoomMessage"("isPinned");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceRoomMessageReaction_messageId_userId_emoji_key" ON "VoiceRoomMessageReaction"("messageId", "userId", "emoji");
