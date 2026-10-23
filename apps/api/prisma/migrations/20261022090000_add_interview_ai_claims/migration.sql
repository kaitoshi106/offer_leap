-- AlterTable
ALTER TABLE "interview_questions" ADD COLUMN     "scoringStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "interview_sessions" ADD COLUMN     "summaryStartedAt" TIMESTAMP(3);
