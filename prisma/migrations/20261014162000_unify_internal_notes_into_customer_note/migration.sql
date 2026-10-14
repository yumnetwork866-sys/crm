-- Migrate existing MessageInternalNote records into unified CustomerNote table
INSERT INTO "CustomerNote" ("id", "customerId", "author", "content", "createdAt", "type")
SELECT DISTINCT ON (m."id")
  m."id",
  c."id" AS "customerId",
  m."author",
  m."content",
  m."createdAt",
  'note' AS "type"
FROM "MessageInternalNote" m
INNER JOIN "Customer" c
  ON c."id" = m."threadId"
  OR (
    LENGTH(REGEXP_REPLACE(m."threadId", '\D', '', 'g')) >= 7
    AND RIGHT(REGEXP_REPLACE(c."phone", '\D', '', 'g'), 9) = RIGHT(REGEXP_REPLACE(m."threadId", '\D', '', 'g'), 9)
  )
ON CONFLICT ("id") DO NOTHING;

DELETE FROM "MessageInternalNote"
WHERE "id" IN (SELECT "id" FROM "CustomerNote");
