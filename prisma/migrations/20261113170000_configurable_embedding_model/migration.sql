ALTER TABLE "AiConfiguration"
  ADD COLUMN "embeddingModel" TEXT NOT NULL DEFAULT 'embeddinggemma:300m',
  ADD COLUMN "embeddingDimensions" INTEGER NOT NULL DEFAULT 768;
