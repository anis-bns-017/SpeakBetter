-- AlterTable
ALTER TABLE "VoiceRoomMessage" ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "isEdited" BOOLEAN NOT NULL DEFAULT false;
