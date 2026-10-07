-- AlterTable
ALTER TABLE "WhatsAppMessage"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS "errorCode" TEXT,
  ADD COLUMN IF NOT EXISTS "errorMessage" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_status_idx"
  ON "WhatsAppMessage"("status");
