CREATE TABLE IF NOT EXISTS "WhatsAppTemplateArchive" (
  "id" TEXT NOT NULL,
  "wabaId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "templateName" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "archivedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WhatsAppTemplateArchive_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppTemplateArchive_wabaId_templateId_key"
  ON "WhatsAppTemplateArchive"("wabaId", "templateId");

CREATE INDEX IF NOT EXISTS "WhatsAppTemplateArchive_wabaId_createdAt_idx"
  ON "WhatsAppTemplateArchive"("wabaId", "createdAt" DESC);
