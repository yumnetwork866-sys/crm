ALTER TABLE "AutomationStep"
  ADD COLUMN IF NOT EXISTS "templateLanguage" TEXT,
  ADD COLUMN IF NOT EXISTS "templateParameterMappings" JSONB;
