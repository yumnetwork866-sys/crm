-- 1. Add Customer.ownerId foreign key referencing User(id) and backfill from legacy Customer.owner
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Customer' AND column_name = 'owner'
  ) THEN
    UPDATE "Customer" c
    SET "ownerId" = u."id"
    FROM "User" u
    WHERE c."ownerId" IS NULL
      AND (LOWER(TRIM(c."owner")) = LOWER(TRIM(u."name")) OR LOWER(TRIM(c."owner")) = LOWER(TRIM(u."email")));

    DROP INDEX IF EXISTS "Customer_owner_idx";
    DROP INDEX IF EXISTS "Customer_owner_updatedAt_idx";
    ALTER TABLE "Customer" DROP COLUMN IF EXISTS "owner";
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Customer_ownerId_fkey'
  ) THEN
    ALTER TABLE "Customer"
      ADD CONSTRAINT "Customer_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Customer_ownerId_idx" ON "Customer"("ownerId");
CREATE INDEX IF NOT EXISTS "Customer_ownerId_updatedAt_idx" ON "Customer"("ownerId", "updatedAt" DESC);

-- 2. Convert Float currency fields to exact DECIMAL(18, 2)
ALTER TABLE "User"
  ALTER COLUMN "totalRevenue" TYPE DECIMAL(18, 2) USING "totalRevenue"::DECIMAL(18, 2);

ALTER TABLE "Customer"
  ALTER COLUMN "totalSpent" TYPE DECIMAL(18, 2) USING "totalSpent"::DECIMAL(18, 2);

ALTER TABLE "Product"
  ALTER COLUMN "price" TYPE DECIMAL(18, 2) USING "price"::DECIMAL(18, 2),
  ALTER COLUMN "costPrice" TYPE DECIMAL(18, 2) USING "costPrice"::DECIMAL(18, 2);

ALTER TABLE "Order"
  ALTER COLUMN "totalAmount" TYPE DECIMAL(18, 2) USING "totalAmount"::DECIMAL(18, 2);

ALTER TABLE "OrderItem"
  ALTER COLUMN "price" TYPE DECIMAL(18, 2) USING "price"::DECIMAL(18, 2);

ALTER TABLE "MarketingReport"
  ALTER COLUMN "adSpend" TYPE DECIMAL(18, 2) USING "adSpend"::DECIMAL(18, 2),
  ALTER COLUMN "revenue" TYPE DECIMAL(18, 2) USING "revenue"::DECIMAL(18, 2),
  ALTER COLUMN "cpl" TYPE DECIMAL(18, 2) USING "cpl"::DECIMAL(18, 2),
  ALTER COLUMN "roas" TYPE DECIMAL(10, 2) USING "roas"::DECIMAL(10, 2);
