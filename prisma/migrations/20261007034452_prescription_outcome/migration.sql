-- CreateEnum
CREATE TYPE "PrescriptionOutcome" AS ENUM ('GOAL_MET', 'PARTIAL', 'NOT_IMPROVED', 'REINJURY', 'DROPPED_OUT', 'REFERRED');

-- AlterTable
ALTER TABLE "prescriptions" ADD COLUMN     "outcome" "PrescriptionOutcome",
ADD COLUMN     "outcomeAt" TIMESTAMP(3),
ADD COLUMN     "outcomeNote" TEXT;
