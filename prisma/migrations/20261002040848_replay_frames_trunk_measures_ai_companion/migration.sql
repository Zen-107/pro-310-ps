-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('CARE_TEAM', 'ASSISTANT_QUESTION', 'ASSISTANT_REPLY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JointName" ADD VALUE 'left_hip_abduction';
ALTER TYPE "JointName" ADD VALUE 'right_hip_abduction';
ALTER TYPE "JointName" ADD VALUE 'trunk_lateral_flexion';
ALTER TYPE "JointName" ADD VALUE 'trunk_inclination';
ALTER TYPE "JointName" ADD VALUE 'trunk_rotation';

-- AlterTable
ALTER TABLE "care_messages" ADD COLUMN     "escalated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kind" "MessageKind" NOT NULL DEFAULT 'CARE_TEAM',
ADD COLUMN     "model" TEXT,
ALTER COLUMN "senderId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "session_frame_chunks" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "frames" JSONB NOT NULL,

    CONSTRAINT "session_frame_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "session_frame_chunks_sessionId_seq_key" ON "session_frame_chunks"("sessionId", "seq");

-- AddForeignKey
ALTER TABLE "session_frame_chunks" ADD CONSTRAINT "session_frame_chunks_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "exercise_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
