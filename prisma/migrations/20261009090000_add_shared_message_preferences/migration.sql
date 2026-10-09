CREATE TABLE IF NOT EXISTS "MessageThreadState" (
  "id" TEXT NOT NULL,
  "businessPhoneNumberId" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'consulting',
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageThreadState_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MessageThreadState_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "MessageThreadState_businessPhoneNumberId_threadId_key"
  ON "MessageThreadState"("businessPhoneNumberId", "threadId");
CREATE INDEX IF NOT EXISTS "MessageThreadState_businessPhoneNumberId_isPinned_idx"
  ON "MessageThreadState"("businessPhoneNumberId", "isPinned");

CREATE TABLE IF NOT EXISTS "MessageInternalNote" (
  "id" TEXT NOT NULL,
  "businessPhoneNumberId" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "authorId" TEXT,
  "author" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageInternalNote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MessageInternalNote_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "MessageInternalNote_businessPhoneNumberId_threadId_createdAt_idx"
  ON "MessageInternalNote"("businessPhoneNumberId", "threadId", "createdAt" DESC);
