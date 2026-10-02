-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "videoConsentAt" TIMESTAMP(3),
ADD COLUMN     "videoConsentVersion" TEXT;

-- CreateTable
CREATE TABLE "session_videos" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "recordStartAt" TIMESTAMP(3) NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "session_videos_sessionId_key" ON "session_videos"("sessionId");

-- AddForeignKey
ALTER TABLE "session_videos" ADD CONSTRAINT "session_videos_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "exercise_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
