-- CreateEnum
CREATE TYPE "FaultType" AS ENUM ('INCOMPLETE_ROM', 'COMPENSATION', 'LOW_ACCURACY');

-- AlterTable
ALTER TABLE "exercises" ADD COLUMN     "formChecks" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "exercise_sessions" ADD COLUMN     "clinicianId" TEXT,
ADD COLUMN     "prescriptionId" TEXT,
ADD COLUMN     "prescriptionItemId" TEXT;

-- AlterTable
ALTER TABLE "session_reps" ADD COLUMN     "isCorrect" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "session_faults" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "repId" TEXT,
    "type" "FaultType" NOT NULL,
    "checkId" TEXT,
    "joint" "JointName" NOT NULL,
    "measuredAngle" DOUBLE PRECISION NOT NULL,
    "expectedMin" DOUBLE PRECISION,
    "expectedMax" DOUBLE PRECISION,
    "deficit" DOUBLE PRECISION,
    "message" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_faults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_messages" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_thread_reads" (
    "patientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_thread_reads_pkey" PRIMARY KEY ("patientId","userId")
);

-- CreateIndex
CREATE INDEX "session_faults_sessionId_idx" ON "session_faults"("sessionId");

-- CreateIndex
CREATE INDEX "care_messages_patientId_createdAt_idx" ON "care_messages"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "exercise_sessions_prescriptionId_idx" ON "exercise_sessions"("prescriptionId");

-- CreateIndex
CREATE INDEX "exercise_sessions_clinicianId_status_idx" ON "exercise_sessions"("clinicianId", "status");

-- AddForeignKey
ALTER TABLE "exercise_sessions" ADD CONSTRAINT "exercise_sessions_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_sessions" ADD CONSTRAINT "exercise_sessions_prescriptionItemId_fkey" FOREIGN KEY ("prescriptionItemId") REFERENCES "prescription_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_sessions" ADD CONSTRAINT "exercise_sessions_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "clinicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_faults" ADD CONSTRAINT "session_faults_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "exercise_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_faults" ADD CONSTRAINT "session_faults_repId_fkey" FOREIGN KEY ("repId") REFERENCES "session_reps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_messages" ADD CONSTRAINT "care_messages_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_messages" ADD CONSTRAINT "care_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_thread_reads" ADD CONSTRAINT "care_thread_reads_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_thread_reads" ADD CONSTRAINT "care_thread_reads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
