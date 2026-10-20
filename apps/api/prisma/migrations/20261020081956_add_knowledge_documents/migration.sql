-- pgvector: the Postgres image ships the extension; enabling it is idempotent.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "KnowledgeSource" AS ENUM ('UPLOAD', 'TEXT');

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" "KnowledgeSource" NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "storageKey" TEXT,
    "status" "ResumeStatus" NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "charCount" INTEGER NOT NULL DEFAULT 0,
    "embeddingModel" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(768),

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_documents_storageKey_key" ON "knowledge_documents"("storageKey");

-- CreateIndex
CREATE INDEX "knowledge_documents_userId_createdAt_idx" ON "knowledge_documents"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "knowledge_chunks_userId_idx" ON "knowledge_chunks"("userId");

-- CreateIndex
CREATE INDEX "knowledge_chunks_documentId_idx" ON "knowledge_chunks"("documentId");

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
