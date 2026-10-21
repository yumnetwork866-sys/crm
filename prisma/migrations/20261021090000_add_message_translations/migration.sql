ALTER TABLE "WhatsAppMessage"
  ADD COLUMN IF NOT EXISTS "translatedContent" TEXT,
  ADD COLUMN IF NOT EXISTS "translatedLanguage" TEXT,
  ADD COLUMN IF NOT EXISTS "translationModel" TEXT,
  ADD COLUMN IF NOT EXISTS "translatedAt" TIMESTAMP(3);

ALTER TABLE "MessageThreadState"
  ADD COLUMN IF NOT EXISTS "autoTranslate" BOOLEAN NOT NULL DEFAULT false;
