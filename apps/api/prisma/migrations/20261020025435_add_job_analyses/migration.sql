-- CreateTable
CREATE TABLE "job_analyses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "jobDescription" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "status" "ResumeStatus" NOT NULL DEFAULT 'PENDING',
    "jobTitle" TEXT,
    "company" TEXT,
    "score" INTEGER,
    "result" JSONB,
    "errorCode" TEXT,
    "aiModel" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_analyses_userId_createdAt_idx" ON "job_analyses"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "job_analyses_resumeId_idx" ON "job_analyses"("resumeId");

-- AddForeignKey
ALTER TABLE "job_analyses" ADD CONSTRAINT "job_analyses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_analyses" ADD CONSTRAINT "job_analyses_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
