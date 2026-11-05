-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'FRIEND_CHALLENGE';

-- CreateTable
CREATE TABLE "FriendChallenge" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "responseScore" INTEGER,
    "responseTotal" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FriendChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FriendChallenge_toUserId_status_idx" ON "FriendChallenge"("toUserId", "status");

-- CreateIndex
CREATE INDEX "FriendChallenge_fromUserId_createdAt_idx" ON "FriendChallenge"("fromUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "FriendChallenge" ADD CONSTRAINT "FriendChallenge_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendChallenge" ADD CONSTRAINT "FriendChallenge_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
