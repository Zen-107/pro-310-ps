-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('HOSPITAL', 'CLINIC');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CLINICIAN', 'PATIENT');

-- CreateEnum
CREATE TYPE "ClinicianTitle" AS ENUM ('DOCTOR', 'PHYSIOTHERAPIST');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "CareRole" AS ENUM ('PRIMARY', 'SUPPORTING');

-- CreateEnum
CREATE TYPE "ExerciseCategory" AS ENUM ('knee', 'shoulder', 'hip', 'back', 'neck', 'ankle');

-- CreateEnum
CREATE TYPE "BodyPart" AS ENUM ('upper', 'lower', 'full');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('beginner', 'intermediate', 'advanced');

-- CreateEnum
CREATE TYPE "ExerciseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "JointName" AS ENUM ('left_knee', 'right_knee', 'left_hip', 'right_hip', 'left_hip_flexion', 'right_hip_flexion', 'hip_opening', 'left_shoulder', 'right_shoulder', 'left_shoulder_extension', 'right_shoulder_extension', 'left_elbow', 'right_elbow', 'left_ankle', 'right_ankle', 'neck', 'spine_flexion');

-- CreateEnum
CREATE TYPE "AngleBasis" AS ENUM ('DEVELOPER_ESTIMATE', 'SOURCE_STATED', 'GROUND_TRUTH_EXTRACTED', 'CLINICIAN_SET');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('PATIENT_EDUCATION', 'CLINICAL_GUIDELINE', 'JOURNAL_ARTICLE', 'TEXTBOOK', 'VIDEO');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VerifierType" AS ENUM ('CLINICIAN', 'DEVELOPER');

-- CreateEnum
CREATE TYPE "ReferenceRelevance" AS ENUM ('EXACT', 'CLOSE', 'PARTIAL');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'MISSED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('APPROVED', 'NEEDS_ATTENTION');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrgType" NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinicians" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" "ClinicianTitle" NOT NULL,
    "licenseNumber" TEXT,
    "specialty" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinicians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateOfBirth" DATE,
    "gender" "Gender" NOT NULL DEFAULT 'UNSPECIFIED',
    "condition" TEXT,
    "phone" TEXT,
    "consentVersion" TEXT,
    "consentAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_assignments" (
    "patientId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "role" "CareRole" NOT NULL DEFAULT 'PRIMARY',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_assignments_pkey" PRIMARY KEY ("patientId","clinicianId")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "category" "ExerciseCategory" NOT NULL,
    "bodyPart" "BodyPart" NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'beginner',
    "description" TEXT NOT NULL,
    "instructions" JSONB NOT NULL,
    "defaultSets" INTEGER NOT NULL DEFAULT 3,
    "defaultReps" INTEGER NOT NULL DEFAULT 10,
    "defaultRestSeconds" INTEGER NOT NULL DEFAULT 30,
    "icon" TEXT NOT NULL DEFAULT 'Activity',
    "status" "ExerciseStatus" NOT NULL DEFAULT 'DRAFT',
    "statusNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_joint_targets" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "joint" "JointName" NOT NULL,
    "nameTh" TEXT NOT NULL,
    "idealAngle" DOUBLE PRECISION NOT NULL,
    "minAngle" DOUBLE PRECISION NOT NULL,
    "maxAngle" DOUBLE PRECISION NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "formula" TEXT,
    "angleBasis" "AngleBasis" NOT NULL DEFAULT 'DEVELOPER_ESTIMATE',
    "rationale" TEXT,
    "sourceId" TEXT,

    CONSTRAINT "exercise_joint_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_sources" (
    "id" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "authors" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "publishedAt" TIMESTAMP(3),
    "accessedAt" TIMESTAMP(3) NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedByType" "VerifierType",
    "verifiedByName" TEXT,
    "verifiedByClinicianId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercise_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_references" (
    "exerciseId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "relevance" "ReferenceRelevance" NOT NULL,
    "sourceExerciseName" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "exercise_references_pkey" PRIMARY KEY ("exerciseId","sourceId")
);

-- CreateTable
CREATE TABLE "reference_measurements" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "joint" "JointName" NOT NULL,
    "measuredAngle" DOUBLE PRECISION NOT NULL,
    "sampleCount" INTEGER NOT NULL,
    "videoStartSec" DOUBLE PRECISION,
    "videoEndSec" DOUBLE PRECISION,
    "extractorVersion" TEXT NOT NULL,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reference_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_items" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "sets" INTEGER NOT NULL,
    "repsPerSet" INTEGER NOT NULL,
    "restSeconds" INTEGER NOT NULL,
    "daysOfWeek" INTEGER[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_target_overrides" (
    "itemId" TEXT NOT NULL,
    "joint" "JointName" NOT NULL,
    "idealAngle" DOUBLE PRECISION NOT NULL,
    "minAngle" DOUBLE PRECISION NOT NULL,
    "maxAngle" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "prescription_target_overrides_pkey" PRIMARY KEY ("itemId","joint")
);

-- CreateTable
CREATE TABLE "quests" (
    "id" TEXT NOT NULL,
    "prescriptionItemId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "QuestStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_sessions" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "questId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" "SessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "totalReps" INTEGER NOT NULL DEFAULT 0,
    "avgAccuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "romMinAngle" DOUBLE PRECISION,
    "romMaxAngle" DOUBLE PRECISION,
    "romDegrees" DOUBLE PRECISION,
    "primaryJoint" "JointName",
    "targetSnapshot" JSONB NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercise_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_reps" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "repNumber" INTEGER NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "bestAngle" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "session_reps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "joint_angle_logs" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "repId" TEXT,
    "joint" "JointName" NOT NULL,
    "angle" DOUBLE PRECISION NOT NULL,
    "idealAngle" DOUBLE PRECISION NOT NULL,
    "minAngle" DOUBLE PRECISION NOT NULL,
    "maxAngle" DOUBLE PRECISION NOT NULL,
    "deviation" DOUBLE PRECISION NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "joint_angle_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_reviews" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL,
    "comment" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_reports" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clinicians_userId_key" ON "clinicians"("userId");

-- CreateIndex
CREATE INDEX "clinicians_organizationId_idx" ON "clinicians"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "patients_userId_key" ON "patients"("userId");

-- CreateIndex
CREATE INDEX "patients_organizationId_idx" ON "patients"("organizationId");

-- CreateIndex
CREATE INDEX "care_assignments_clinicianId_idx" ON "care_assignments"("clinicianId");

-- CreateIndex
CREATE UNIQUE INDEX "exercises_slug_key" ON "exercises"("slug");

-- CreateIndex
CREATE INDEX "exercises_status_category_idx" ON "exercises"("status", "category");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_joint_targets_exerciseId_joint_key" ON "exercise_joint_targets"("exerciseId", "joint");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_sources_url_key" ON "exercise_sources"("url");

-- CreateIndex
CREATE INDEX "exercise_sources_verificationStatus_idx" ON "exercise_sources"("verificationStatus");

-- CreateIndex
CREATE INDEX "reference_measurements_exerciseId_idx" ON "reference_measurements"("exerciseId");

-- CreateIndex
CREATE INDEX "prescriptions_patientId_status_idx" ON "prescriptions"("patientId", "status");

-- CreateIndex
CREATE INDEX "prescriptions_clinicianId_idx" ON "prescriptions"("clinicianId");

-- CreateIndex
CREATE INDEX "prescription_items_prescriptionId_idx" ON "prescription_items"("prescriptionId");

-- CreateIndex
CREATE INDEX "quests_patientId_dueDate_idx" ON "quests"("patientId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "quests_prescriptionItemId_dueDate_key" ON "quests"("prescriptionItemId", "dueDate");

-- CreateIndex
CREATE INDEX "exercise_sessions_patientId_startedAt_idx" ON "exercise_sessions"("patientId", "startedAt");

-- CreateIndex
CREATE INDEX "exercise_sessions_questId_idx" ON "exercise_sessions"("questId");

-- CreateIndex
CREATE UNIQUE INDEX "session_reps_sessionId_repNumber_key" ON "session_reps"("sessionId", "repNumber");

-- CreateIndex
CREATE INDEX "joint_angle_logs_sessionId_idx" ON "joint_angle_logs"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "session_reviews_sessionId_key" ON "session_reviews"("sessionId");

-- CreateIndex
CREATE INDEX "session_reviews_clinicianId_idx" ON "session_reviews"("clinicianId");

-- CreateIndex
CREATE INDEX "clinical_reports_sessionId_idx" ON "clinical_reports"("sessionId");

-- AddForeignKey
ALTER TABLE "clinicians" ADD CONSTRAINT "clinicians_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinicians" ADD CONSTRAINT "clinicians_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_assignments" ADD CONSTRAINT "care_assignments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_assignments" ADD CONSTRAINT "care_assignments_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "clinicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_joint_targets" ADD CONSTRAINT "exercise_joint_targets_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_joint_targets" ADD CONSTRAINT "exercise_joint_targets_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "exercise_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_sources" ADD CONSTRAINT "exercise_sources_verifiedByClinicianId_fkey" FOREIGN KEY ("verifiedByClinicianId") REFERENCES "clinicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_references" ADD CONSTRAINT "exercise_references_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_references" ADD CONSTRAINT "exercise_references_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "exercise_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference_measurements" ADD CONSTRAINT "reference_measurements_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "exercise_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference_measurements" ADD CONSTRAINT "reference_measurements_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "clinicians"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_target_overrides" ADD CONSTRAINT "prescription_target_overrides_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "prescription_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quests" ADD CONSTRAINT "quests_prescriptionItemId_fkey" FOREIGN KEY ("prescriptionItemId") REFERENCES "prescription_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quests" ADD CONSTRAINT "quests_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_sessions" ADD CONSTRAINT "exercise_sessions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_sessions" ADD CONSTRAINT "exercise_sessions_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_sessions" ADD CONSTRAINT "exercise_sessions_questId_fkey" FOREIGN KEY ("questId") REFERENCES "quests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_reps" ADD CONSTRAINT "session_reps_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "exercise_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "joint_angle_logs" ADD CONSTRAINT "joint_angle_logs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "exercise_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "joint_angle_logs" ADD CONSTRAINT "joint_angle_logs_repId_fkey" FOREIGN KEY ("repId") REFERENCES "session_reps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_reviews" ADD CONSTRAINT "session_reviews_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "exercise_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_reviews" ADD CONSTRAINT "session_reviews_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "clinicians"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_reports" ADD CONSTRAINT "clinical_reports_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "exercise_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
