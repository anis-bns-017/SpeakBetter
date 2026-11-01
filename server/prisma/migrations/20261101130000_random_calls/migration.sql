-- CreateTable
CREATE TABLE "RandomCallProfile" (
    "userId" TEXT NOT NULL,
    "ageConfirmedAt" TIMESTAMP(3),
    "restrictedUntil" TIMESTAMP(3),
    "permanentlyBanned" BOOLEAN NOT NULL DEFAULT false,
    "restrictionCount" INTEGER NOT NULL DEFAULT 0,
    "restrictionReason" TEXT,
    "callsCount" INTEGER NOT NULL DEFAULT 0,
    "ratingSum" INTEGER NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RandomCallProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "RandomCall" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'English',
    "levelA" TEXT NOT NULL,
    "levelB" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "liveKitRoomId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "extensions" INTEGER NOT NULL DEFAULT 0,
    "extendA" BOOLEAN NOT NULL DEFAULT false,
    "extendB" BOOLEAN NOT NULL DEFAULT false,
    "endedAt" TIMESTAMP(3),
    "endedById" TEXT,
    "endReason" TEXT,
    "talkSecondsA" INTEGER,
    "talkSecondsB" INTEGER,

    CONSTRAINT "RandomCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RandomCallRating" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "raterId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "keepInTouch" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RandomCallRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RandomCallReport" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RandomCallReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RandomCall_userAId_startedAt_idx" ON "RandomCall"("userAId", "startedAt");

-- CreateIndex
CREATE INDEX "RandomCall_userBId_startedAt_idx" ON "RandomCall"("userBId", "startedAt");

-- CreateIndex
CREATE INDEX "RandomCall_endedAt_endsAt_idx" ON "RandomCall"("endedAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "RandomCallRating_callId_raterId_key" ON "RandomCallRating"("callId", "raterId");

-- CreateIndex
CREATE INDEX "RandomCallReport_reportedId_createdAt_idx" ON "RandomCallReport"("reportedId", "createdAt");

-- CreateIndex
CREATE INDEX "RandomCallReport_reporterId_createdAt_idx" ON "RandomCallReport"("reporterId", "createdAt");

-- CreateIndex
CREATE INDEX "RandomCallReport_status_idx" ON "RandomCallReport"("status");

-- AddForeignKey
ALTER TABLE "RandomCallProfile" ADD CONSTRAINT "RandomCallProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RandomCall" ADD CONSTRAINT "RandomCall_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RandomCall" ADD CONSTRAINT "RandomCall_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RandomCallRating" ADD CONSTRAINT "RandomCallRating_callId_fkey" FOREIGN KEY ("callId") REFERENCES "RandomCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RandomCallRating" ADD CONSTRAINT "RandomCallRating_raterId_fkey" FOREIGN KEY ("raterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RandomCallReport" ADD CONSTRAINT "RandomCallReport_callId_fkey" FOREIGN KEY ("callId") REFERENCES "RandomCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RandomCallReport" ADD CONSTRAINT "RandomCallReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RandomCallReport" ADD CONSTRAINT "RandomCallReport_reportedId_fkey" FOREIGN KEY ("reportedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

