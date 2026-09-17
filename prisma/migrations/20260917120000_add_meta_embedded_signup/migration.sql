ALTER TABLE "IntegrationSetting"
  ADD COLUMN IF NOT EXISTS "metaBusinessId" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsappAccessTokenEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsappTokenExpiresAt" TIMESTAMP(3);
