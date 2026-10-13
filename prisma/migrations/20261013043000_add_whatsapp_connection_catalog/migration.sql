ALTER TABLE "WhatsAppConnection"
ADD COLUMN "metaCatalogId" TEXT;

CREATE INDEX "WhatsAppConnection_metaCatalogId_idx"
ON "WhatsAppConnection"("metaCatalogId");
