-- CreateTable
CREATE TABLE "RoleplayProgress" (
    "userId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "bestScore" INTEGER,
    "completions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleplayProgress_pkey" PRIMARY KEY ("userId","scenarioId")
);

-- AddForeignKey
ALTER TABLE "RoleplayProgress" ADD CONSTRAINT "RoleplayProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
