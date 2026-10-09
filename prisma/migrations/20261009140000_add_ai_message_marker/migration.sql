ALTER TABLE "WhatsAppMessage"
  ADD COLUMN IF NOT EXISTS "isAi" BOOLEAN NOT NULL DEFAULT false;

-- Preserve correct rendering for AI messages created before this explicit marker existed.
UPDATE "WhatsAppMessage"
SET "isAi" = true
WHERE "sender" = 'agent'
  AND (
    "agentName" ILIKE '%trợ lý ai%'
    OR "agentName" ILIKE '%ai assistant%'
    OR "agentName" LIKE '🤖%'
  );
