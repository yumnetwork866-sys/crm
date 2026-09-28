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
2. Create a Facebook Login for Business configuration from the current WhatsApp Embedded Signup v4 template and set `META_EMBEDDED_SIGNUP_CONFIG_ID`.
3. Set `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_VERSION`, `META_VERIFY_TOKEN`, and a unique `META_TOKEN_ENCRYPTION_KEY` of at least 32 characters in the backend environment.
4. Subscribe the WhatsApp Business Account webhook product to `messages` and `account_update`. If Coexistence is enabled, also subscribe to `history`, `smb_app_state_sync`, `smb_message_echoes`, and `account_offboarded`.
5. Apply database migrations with `npx prisma migrate deploy`.
6. Restart the backend after changing environment variables.

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
