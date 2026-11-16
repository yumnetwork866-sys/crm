CREATE TABLE "AiConfiguration" (
  "id" TEXT NOT NULL DEFAULT 'default', "model" TEXT NOT NULL DEFAULT 'gemma4:latest',
  "suggestionsEnabled" BOOLEAN NOT NULL DEFAULT true, "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
  "ragEnabled" BOOLEAN NOT NULL DEFAULT true, "timeoutMs" INTEGER NOT NULL DEFAULT 45000,
  "instructions" TEXT NOT NULL DEFAULT '', "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiConfiguration_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AiKnowledgeDocument" (
  "id" TEXT NOT NULL, "title" TEXT NOT NULL, "brand" TEXT NOT NULL DEFAULT '*', "brandKey" TEXT NOT NULL DEFAULT '*',
  "content" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiKnowledgeDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiKnowledgeDocument_brandKey_enabled_idx" ON "AiKnowledgeDocument"("brandKey", "enabled");
CREATE TABLE "AiKnowledgeChunk" (
  "id" TEXT NOT NULL, "documentId" TEXT NOT NULL, "ordinal" INTEGER NOT NULL, "content" TEXT NOT NULL, "searchText" TEXT NOT NULL,
  CONSTRAINT "AiKnowledgeChunk_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiKnowledgeChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "AiKnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AiKnowledgeChunk_documentId_ordinal_key" ON "AiKnowledgeChunk"("documentId", "ordinal");
CREATE INDEX "AiKnowledgeChunk_search_idx" ON "AiKnowledgeChunk" USING GIN(to_tsvector('simple', "searchText"));
CREATE TABLE "AiRun" (
  "id" TEXT NOT NULL, "requestId" TEXT, "operation" TEXT NOT NULL, "status" TEXT NOT NULL, "stage" TEXT NOT NULL,
  "model" TEXT NOT NULL, "brand" TEXT NOT NULL, "durationMs" INTEGER NOT NULL, "errorCode" TEXT,
  "errorMessage" TEXT, "rawOutput" TEXT, "output" JSONB, "sources" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiRun_createdAt_idx" ON "AiRun"("createdAt" DESC);
CREATE TABLE "AiConversationState" (
  "id" TEXT NOT NULL, "pausedUntil" TIMESTAMP(3), "lastAttemptMessageId" TEXT, "lastSentMessageId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiConversationState_pkey" PRIMARY KEY ("id")
);
