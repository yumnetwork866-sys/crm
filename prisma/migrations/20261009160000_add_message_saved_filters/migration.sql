CREATE TABLE IF NOT EXISTS "MessageSavedFilter" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "filter" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MessageSavedFilter_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MessageSavedFilter_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "MessageSavedFilter_userId_createdAt_idx"
  ON "MessageSavedFilter"("userId", "createdAt");
