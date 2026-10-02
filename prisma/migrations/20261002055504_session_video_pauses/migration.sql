-- AlterTable
ALTER TABLE "session_videos" ADD COLUMN     "pauses" JSONB NOT NULL DEFAULT '[]';
