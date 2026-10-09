ALTER TABLE "WhatsAppMessage"
  ADD COLUMN IF NOT EXISTS "agentId" TEXT;

CREATE INDEX IF NOT EXISTS "WhatsAppMessage_agentId_idx"
  ON "WhatsAppMessage"("agentId");

-- Backfill messages whose stored name or email still matches a current user.
UPDATE "WhatsAppMessage" AS message
SET "agentId" = app_user."id",
    "agentName" = app_user."name"
FROM "User" AS app_user
WHERE message."agentId" IS NULL
  AND message."sender" = 'agent'
  AND message."isAi" = FALSE
  AND (
    LOWER(TRIM(message."agentName")) = LOWER(TRIM(app_user."name"))
    OR LOWER(TRIM(message."agentName")) = LOWER(TRIM(app_user."email"))
  );

-- One-time repair for the account renamed before stable agent IDs were stored.
UPDATE "WhatsAppMessage" AS message
SET "agentId" = app_user."id",
    "agentName" = app_user."name"
FROM "User" AS app_user
WHERE message."agentId" IS NULL
  AND message."sender" = 'agent'
  AND message."isAi" = FALSE
  AND message."agentName" = 'Nguyễn Văn Ánh'
  AND app_user."name" = 'Vũ Viết Du';
