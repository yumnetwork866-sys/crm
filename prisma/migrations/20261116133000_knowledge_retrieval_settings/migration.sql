ALTER TABLE "AiConfiguration"
  ADD COLUMN "retrievalSettings" JSONB NOT NULL DEFAULT '{}';
