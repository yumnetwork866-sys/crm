UPDATE "WhatsAppMessage"
SET "isAi" = true
WHERE "sender" = 'agent'
  AND "isAi" = false
  AND "agentName" ILIKE '%yum assistant%';
