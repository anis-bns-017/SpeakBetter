-- Session rotation: one row per refresh token, grouped in families.
-- Additive and rollout-safe: the legacy "token" column stays (now nullable) and
-- "familyId" has a DB default, so instances still running the old code can keep
-- inserting rows while the new code is rolled out.

-- AlterTable
ALTER TABLE "Session"
    ALTER COLUMN "token" DROP NOT NULL,
    ADD COLUMN "tokenHash" TEXT,
    ADD COLUMN "familyId" TEXT NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN "lastUsedAt" TIMESTAMP(3),
    ADD COLUMN "rotatedAt" TIMESTAMP(3),
    ADD COLUMN "replacedById" TEXT,
    ADD COLUMN "revokedAt" TIMESTAMP(3),
    ADD COLUMN "revokedReason" TEXT,
    ADD COLUMN "reuseHits" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "userAgent" TEXT,
    ADD COLUMN "ip" TEXT;

-- Backfill: hex SHA-256 of the stored refresh token. sha256(bytea) is built in
-- since PostgreSQL 11; convert_to() gives the UTF-8 bytes (no bytea escape parsing).
UPDATE "Session"
SET "tokenHash" = encode(sha256(convert_to("token", 'UTF8')), 'hex')
WHERE "token" IS NOT NULL AND "tokenHash" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Session_replacedById_key" ON "Session"("replacedById");

-- CreateIndex
CREATE INDEX "Session_familyId_idx" ON "Session"("familyId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
