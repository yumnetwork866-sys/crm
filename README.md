## Run Locally
**Prerequisites:**  Node.js
1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Meta WhatsApp Embedded Signup

The Meta connection page is available to CRM administrators at `/meta-verification`.

Before using it:

1. Allowlist the production origin (`https://crm.yumnetwork.vn`) in Meta's Embedded Signup Builder.
2. Set `META_APP_SECRET` and a unique `META_TOKEN_ENCRYPTION_KEY` of at least 32 characters in the backend environment.
3. Apply database migrations with `npx prisma migrate deploy`.
4. Restart the backend after changing environment variables.

Never expose `META_APP_SECRET`, `META_TOKEN_ENCRYPTION_KEY`, or a Meta access token through a `VITE_` variable.

## Linting & Code Quality

Run linting and formatting commands:

- **Check lint:**
  ```bash
  npm run lint
  ```
- **Auto-fix lint issues:**
  ```bash
  npm run lint:fix
  ```
- **Strict lint check:**
  ```bash
  npm run lint:strict
  ```
- **Strict lint auto-fix:**
  ```bash
  npm run lint:strict:fix
  ```
- **Audit lint:**
  ```bash
  npm run lint:audit
  ```
- **Format code (Prettier):**
  ```bash
  npm run format
  ```
- **Check formatting:**
  ```bash
  npm run format:check
  ```
- **Type check:**
  ```bash
  npm run typecheck
  ```
- **Run all checks (typecheck, lint, test):**
  ```bash
  npm run check
  ```
