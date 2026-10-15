ALTER TABLE "Order"
ADD COLUMN "whatsappMessageId" TEXT;

CREATE UNIQUE INDEX "Order_whatsappMessageId_key"
ON "Order"("whatsappMessageId");
