-- CreateTable
CREATE TABLE "MessageQuickTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageQuickTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageQuickTemplate_code_key" ON "MessageQuickTemplate"("code");

-- CreateIndex
CREATE INDEX "MessageQuickTemplate_createdAt_idx" ON "MessageQuickTemplate"("createdAt" ASC);

-- AddForeignKey
ALTER TABLE "MessageQuickTemplate" ADD CONSTRAINT "MessageQuickTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
