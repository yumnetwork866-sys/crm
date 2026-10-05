CREATE TABLE IF NOT EXISTS "WhatsAppConnection" (
  "phoneNumberId" TEXT NOT NULL,
  "wabaId" TEXT NOT NULL,
  "businessId" TEXT,
  "displayPhoneNumber" TEXT,
  "verifiedName" TEXT,
  "accessTokenEncrypted" TEXT,
  "registrationPinEncrypted" TEXT,
  "tokenExpiresAt" TIMESTAMP(3),
  "usesEnvironmentToken" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'connected',
  "lastConnectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppConnection_pkey" PRIMARY KEY ("phoneNumberId")
);

CREATE INDEX IF NOT EXISTS "WhatsAppConnection_wabaId_idx"
  ON "WhatsAppConnection"("wabaId");
CREATE INDEX IF NOT EXISTS "WhatsAppConnection_status_idx"
  ON "WhatsAppConnection"("status");

-- Preserve the currently active Embedded Signup connection as the first row.
INSERT INTO "WhatsAppConnection" (
  "phoneNumberId",
  "wabaId",
  "businessId",
  "accessTokenEncrypted",
  "registrationPinEncrypted",
  "tokenExpiresAt",
  "usesEnvironmentToken",
  "status",
  "lastConnectedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  "whatsappPhoneNumberId",
  "whatsappWabaId",
  "metaBusinessId",
  "whatsappAccessTokenEncrypted",
  "whatsappRegistrationPinEncrypted",
  "whatsappTokenExpiresAt",
  false,
  "status",
  "lastConnectedAt",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "IntegrationSetting"
WHERE "id" = 'default'
  AND "whatsappPhoneNumberId" IS NOT NULL
  AND "whatsappWabaId" IS NOT NULL
ON CONFLICT ("phoneNumberId") DO NOTHING;
