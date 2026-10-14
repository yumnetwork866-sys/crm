ALTER TABLE "Customer"
ADD COLUMN "whatsappRecipientId" TEXT;

ALTER TABLE "WhatsAppMessage"
ADD COLUMN "recipientId" TEXT;

CREATE INDEX "Customer_whatsappRecipientId_idx"
ON "Customer"("whatsappRecipientId");

CREATE INDEX "WhatsAppMessage_recipientId_idx"
ON "WhatsAppMessage"("recipientId");

-- Preserve every usable legacy recipient independently from the display phone field.
UPDATE "WhatsAppMessage"
SET "recipientId" = "customerPhone"
WHERE BTRIM("customerPhone") <> ''
  AND BTRIM("customerPhone") <> 'Khách Hàng';

UPDATE "Customer"
SET "whatsappRecipientId" = "phone"
WHERE "phone" LIKE 'MY.%' OR "phone" LIKE '@%';

-- Jiha's pre-BSUID messages lost their sender field, but the original WAMID retains
-- the business-scoped recipient MY.941245582048923. Repair the complete thread.
UPDATE "WhatsAppMessage"
SET "recipientId" = 'MY.941245582048923',
    "customerPhone" = 'MY.941245582048923'
WHERE "customerName" = 'Jiha'
  AND "customerPhone" = 'Khách Hàng'
  AND "businessPhoneNumberId" = '1412496995272289';
