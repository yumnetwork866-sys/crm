BEGIN;

ALTER TABLE "WhatsAppConnection"
  ADD COLUMN "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE "WhatsAppConnection"
SET "autoReplyEnabled" = true
WHERE "status" = 'connected';

COMMIT;
