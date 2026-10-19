ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "whatsappParentRecipientId" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsappUsername" TEXT;

CREATE INDEX IF NOT EXISTS "Customer_whatsappParentRecipientId_idx"
  ON "Customer"("whatsappParentRecipientId");

CREATE INDEX IF NOT EXISTS "Customer_whatsappUsername_idx"
  ON "Customer"("whatsappUsername");
