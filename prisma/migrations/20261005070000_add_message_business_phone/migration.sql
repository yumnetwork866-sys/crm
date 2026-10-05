ALTER TABLE "WhatsAppMessage"
  ADD COLUMN IF NOT EXISTS "businessPhoneNumberId" TEXT;

CREATE INDEX IF NOT EXISTS "WhatsAppMessage_businessPhoneNumberId_timestamp_idx"
  ON "WhatsAppMessage"("businessPhoneNumberId", "timestamp" DESC);

-- Messages created after the latest successful connection belong to the active
-- business number. Older rows remain unassigned so they stay preserved but do
-- not appear in the newly connected number's inbox.
UPDATE "WhatsAppMessage" AS message
SET "businessPhoneNumberId" = setting."whatsappPhoneNumberId"
FROM "IntegrationSetting" AS setting
WHERE setting."id" = 'default'
  AND setting."whatsappPhoneNumberId" IS NOT NULL
  AND setting."lastConnectedAt" IS NOT NULL
  AND message."businessPhoneNumberId" IS NULL
  AND message."timestamp" >= setting."lastConnectedAt";
