-- CreateTable
CREATE TABLE "MemoryModel" (
    "userId" TEXT NOT NULL,
    "weights" DOUBLE PRECISION[],
    "active" BOOLEAN NOT NULL DEFAULT false,
    "lessons" INTEGER NOT NULL DEFAULT 0,
    "defaultError" DOUBLE PRECISION,
    "fittedError" DOUBLE PRECISION,
    "defaultLoss" DOUBLE PRECISION,
    "fittedLoss" DOUBLE PRECISION,
    "logCount" INTEGER NOT NULL DEFAULT 0,
    "fittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryModel_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "MemoryModel" ADD CONSTRAINT "MemoryModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
