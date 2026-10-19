-- These contacts were marked unreachable while the integration incorrectly
-- placed BSUIDs in the phone-only `to` field. Re-open them after switching
-- outbound BSUID addressing to `recipient`; a genuine future 131026 will lock
-- the contact again through the normal webhook flow.
UPDATE "Customer"
SET
  "whatsappReachability" = 'reachable',
  "whatsappUnreachableAt" = NULL,
  "whatsappUnreachableReason" = NULL
WHERE "whatsappRecipientId" LIKE 'MY.%'
  AND "whatsappUnreachableReason" = '131026';
