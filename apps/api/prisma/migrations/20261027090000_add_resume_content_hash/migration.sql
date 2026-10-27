-- AlterEnum
ALTER TYPE "ResumeStatus" ADD VALUE 'UPLOADED';

-- AlterTable
ALTER TABLE "resumes" ADD COLUMN     "contentHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "resumes_userId_contentHash_key" ON "resumes"("userId", "contentHash");

