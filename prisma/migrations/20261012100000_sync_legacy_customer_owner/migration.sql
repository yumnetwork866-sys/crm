-- The seeded admin was renamed after customers had already stored the old
-- display name. Reattach those legacy assignments to the admin's current name.
UPDATE "Customer"
SET "owner" = admin_user."name"
FROM "User" AS admin_user
WHERE admin_user."id" = 'usr_001'
  AND "Customer"."owner" = 'Nguyễn Văn Ánh'
  AND admin_user."name" <> 'Nguyễn Văn Ánh';
