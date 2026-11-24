-- The password of a private voice room (hashed), kept apart from the room row
CREATE TABLE "VoiceRoomSecret" (
    "roomId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceRoomSecret_pkey" PRIMARY KEY ("roomId")
);

ALTER TABLE "VoiceRoomSecret" ADD CONSTRAINT "VoiceRoomSecret_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "VoiceRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
