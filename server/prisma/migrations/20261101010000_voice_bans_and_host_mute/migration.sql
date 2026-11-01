-- Kick bans and enforceable host mute. Additive only.
--
-- "mutedByHost" starts false for existing rows: before this column a mute
-- by the host and a self-mute were stored the same way, so they cannot be told apart.

-- AlterTable
ALTER TABLE "VoiceParticipant" ADD COLUMN     "mutedByHost" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "VoiceRoomBan" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bannedById" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceRoomBan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoiceRoomBan_roomId_idx" ON "VoiceRoomBan"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceRoomBan_roomId_userId_key" ON "VoiceRoomBan"("roomId", "userId");

-- AddForeignKey
ALTER TABLE "VoiceRoomBan" ADD CONSTRAINT "VoiceRoomBan_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "VoiceRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceRoomBan" ADD CONSTRAINT "VoiceRoomBan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
