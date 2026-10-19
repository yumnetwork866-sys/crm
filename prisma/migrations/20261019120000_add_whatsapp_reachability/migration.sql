ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "whatsappReachability" TEXT NOT NULL DEFAULT 'reachable',
  ADD COLUMN IF NOT EXISTS "whatsappUnreachableAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "whatsappUnreachableReason" TEXT;

ALTER TABLE "WhatsAppMessage"
  ADD COLUMN IF NOT EXISTS "errorDetails" TEXT;

CREATE INDEX IF NOT EXISTS "Customer_whatsappReachability_idx"
  ON "Customer"("whatsappReachability");

-- Backfill only contacts whose 131026 failure has not been followed by a new
-- inbound message. A later inbound message proves the recipient is reachable
-- again and must leave the contact unlocked.
WITH latest_undeliverable AS (
  SELECT "customerId", MAX("timestamp") AS failed_at
  FROM "WhatsAppMessage"
  WHERE "errorCode" = '131026' AND "customerId" IS NOT NULL
  GROUP BY "customerId"
)
UPDATE "Customer" AS customer
SET
  "whatsappReachability" = 'unreachable',
  "whatsappUnreachableAt" = failure.failed_at,
  "whatsappUnreachableReason" = '131026'
FROM latest_undeliverable AS failure
WHERE customer.id = failure."customerId"
  AND NOT EXISTS (
    SELECT 1
    FROM "WhatsAppMessage" AS inbound
    WHERE inbound."customerId" = customer.id
      AND inbound.sender = 'customer'
      AND inbound."timestamp" > failure.failed_at
  );
