-- AlterEnum
ALTER TYPE "MessageType" ADD VALUE 'CORRECTION';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "metadata" JSONB;

