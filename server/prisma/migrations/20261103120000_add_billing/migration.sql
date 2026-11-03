-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'SANDBOX';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "interval" "BillingInterval",
ADD COLUMN     "plan" "SubscriptionPlan";

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "canceledAt" TIMESTAMP(3),
ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "interval" "BillingInterval",
ADD COLUMN     "provider" TEXT;
