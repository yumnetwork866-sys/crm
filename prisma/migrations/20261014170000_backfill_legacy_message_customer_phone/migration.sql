-- Repair legacy messages that stored the display label instead of the customer's recipient.
-- Only rows linked to an existing customer with a non-empty phone are changed.
UPDATE "WhatsAppMessage" AS message
SET "customerPhone" = customer."phone"
FROM "Customer" AS customer
WHERE message."customerId" = customer."id"
  AND BTRIM(message."customerPhone") = 'Khách Hàng'
  AND BTRIM(customer."phone") <> '';
