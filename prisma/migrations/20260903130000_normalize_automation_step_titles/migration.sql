UPDATE "AutomationStep"
SET
  "title" = regexp_replace(
    "title",
    '^Ngày[[:space:]]*\+[[:digit:]]+[[:space:]]*:[[:space:]]*',
    '',
    'i'
  ),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "title" ~* '^Ngày[[:space:]]*\+[[:digit:]]+[[:space:]]*:';
