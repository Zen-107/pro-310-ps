-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "hn" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "patients_organizationId_hn_key" ON "patients"("organizationId", "hn");

