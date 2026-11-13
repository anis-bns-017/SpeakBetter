-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "onboardedAt" TIMESTAMP(3);

-- Everyone who already has an account has found their way around: only new sign-ups see the first-day guide
UPDATE "Profile" SET "onboardedAt" = CURRENT_TIMESTAMP WHERE "onboardedAt" IS NULL;
