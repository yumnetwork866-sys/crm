ALTER TABLE "AiKnowledgeDocument"
  ADD COLUMN "embeddingStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "embeddingError" TEXT,
  ADD COLUMN "embeddingModel" TEXT,
  ADD COLUMN "indexingToken" TEXT,
  ADD COLUMN "indexingLeaseUntil" TIMESTAMP(3);
ALTER TABLE "AiKnowledgeChunk"
  ADD COLUMN "embedding" REAL[] NOT NULL DEFAULT ARRAY[]::REAL[],
  ADD COLUMN "embeddingModel" TEXT;
CREATE INDEX "AiKnowledgeDocument_embeddingStatus_indexingLeaseUntil_idx" ON "AiKnowledgeDocument"("embeddingStatus", "indexingLeaseUntil");
CREATE INDEX "AiKnowledgeChunk_embeddingModel_idx" ON "AiKnowledgeChunk"("embeddingModel");
-- Exact cosine search with native PostgreSQL arrays; no system extension required.
CREATE FUNCTION crm_ai_cosine(a REAL[], b REAL[]) RETURNS DOUBLE PRECISION
LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT CASE WHEN cardinality(a) = cardinality(b) AND cardinality(a) > 0
  THEN (SELECT SUM(x::DOUBLE PRECISION * y) /
    NULLIF(SQRT(SUM(x::DOUBLE PRECISION * x) * SUM(y::DOUBLE PRECISION * y)), 0)
    FROM unnest(a, b) AS v(x, y))
  ELSE NULL END
$$;
