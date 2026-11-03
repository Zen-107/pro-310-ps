-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CareRole" ADD VALUE 'GUARDIAN';
ALTER TYPE "CareRole" ADD VALUE 'TEACHER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ClinicianTitle" ADD VALUE 'TEACHER';
ALTER TYPE "ClinicianTitle" ADD VALUE 'PARENT';

-- AlterEnum
ALTER TYPE "OrgType" ADD VALUE 'SCHOOL';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'TEACHER';
ALTER TYPE "UserRole" ADD VALUE 'PARENT';

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "kidCode" TEXT,
ADD COLUMN     "nickname" TEXT,
ADD COLUMN     "parentLinkCode" TEXT,
ADD COLUMN     "picturePinHash" TEXT,
ADD COLUMN     "pinFailCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pinLockedUntil" TIMESTAMP(3),
ADD COLUMN     "schoolConsentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "prescriptions" ADD COLUMN     "classroomId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "adultPinHash" TEXT;

-- CreateTable
CREATE TABLE "classrooms" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gradeLabel" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classroom_members" (
    "classroomId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classroom_members_pkey" PRIMARY KEY ("classroomId","patientId")
);

-- CreateIndex
CREATE INDEX "classrooms_teacherId_idx" ON "classrooms"("teacherId");

-- CreateIndex
CREATE INDEX "classroom_members_patientId_idx" ON "classroom_members"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "patients_kidCode_key" ON "patients"("kidCode");

-- CreateIndex
CREATE UNIQUE INDEX "patients_parentLinkCode_key" ON "patients"("parentLinkCode");

-- CreateIndex
CREATE INDEX "prescriptions_classroomId_idx" ON "prescriptions"("classroomId");

-- AddForeignKey
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "clinicians"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_members" ADD CONSTRAINT "classroom_members_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_members" ADD CONSTRAINT "classroom_members_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "classrooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

