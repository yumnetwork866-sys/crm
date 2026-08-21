## Run Locally
**Prerequisites:**  Node.js
1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

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

