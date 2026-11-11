## Run Locally
**Prerequisites:**  Node.js
1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Production with PM2

Build the frontend, then start or update only the CRM process:

```bash
npm run build
pm2 startOrRestart ecosystem.config.cjs --only crm --update-env
pm2 save
```

The configuration runs `npm run server` with `NODE_ENV=production` and disables
watching. The server serves the built frontend from `dist`. Rebuild the frontend
and restart the CRM process when deploying changes.

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

## Cài đặt Redis cho Message Queue (BullMQ)

Hệ thống tích hợp sẵn **BullMQ + Redis** để xử lý hàng đợi Webhook, Dify AI và Broadcast Campaign. Nếu máy chưa bật Redis, server sẽ tự động dùng **In-Memory Async Queue** để chạy dev bình thường.

### 1. Cài đặt trên Arch Linux
Trên Arch Linux, gói `redis` được cung cấp bởi `valkey` (tương thích 100% giao thức Redis, chạy trên cổng `6379`):

```bash
# Cài đặt gói
sudo pacman -S valkey

# Bật dịch vụ chạy nền và tự khởi động cùng máy
sudo systemctl enable --now valkey

# Kiểm tra kết nối (trả về PONG là thành công)
valkey-cli ping
# Hoặc: redis-cli ping
```

### 2. Cài đặt trên Ubuntu / Debian (VPS Production)
```bash
sudo apt update && sudo apt install -y redis-server
sudo systemctl enable --now redis-server
redis-cli ping
```

### 3. Biến môi trường tùy chọn (`.env`)
Mặc định server tự động kết nối tới `redis://127.0.0.1:6379` mà không cần cấu hình thêm. Nếu dùng Redis từ xa hoặc có mật khẩu, bạn có thể khai báo trong `.env`:

```env
REDIS_URL=redis://127.0.0.1:6379
# Tốc độ bắn chiến dịch Broadcast tối đa mỗi giây theo Meta Tier (mặc định: 20)
CAMPAIGN_RATE_LIMIT_PER_SEC=20
# Số luồng xử lý đồng thời cho từng Worker
WEBHOOK_WORKER_CONCURRENCY=10
DIFY_WORKER_CONCURRENCY=5
CAMPAIGN_WORKER_CONCURRENCY=5
```


## Server logging

Server modules use Pino through `server/lib/logger.ts`. Development defaults to
compact, colored terminal output when attached to a terminal; production writes
one JSON record per line to stdout. Configure `LOG_FORMAT=pretty|json` to override,
`LOG_LEVEL=trace|debug|info|warn|error|fatal|silent` to filter, and `NO_COLOR=1` to disable color.
The `npm run dev` script uses the development environment; `npm run server` uses production.

Each HTTP response includes `X-Request-Id`. A valid incoming ID (1–100 letters,
digits, dots, underscores or hyphens) is reused; otherwise the server creates a UUID.
The ID follows asynchronous work, including Redis jobs, in-memory jobs and retries.
Queue records also carry a `jobId` and `queue`. For older Redis jobs created before
this change, the originating request ID is unavailable.

Successful GET/HEAD/OPTIONS requests, SSE broadcasts, DB saves and job completions
are debug logs. Mutating requests and message send/receive events are info logs;
HTTP 4xx responses are warnings and 5xx responses are errors. Requests log their
path, status and duration without query strings, headers or bodies. Aborted
requests log status 499. Webhook payloads and chat contents are not logged by default.
Known credential fields are redacted in structured records; never interpolate
credentials into log messages. JSON error records retain structured error details and stacks. Pretty output hides
error stacks unless `LOG_LEVEL=debug` or `trace`. Ordinary SSE disconnects stay at debug level.

Use a module logger and searchable fields for new events:

```ts
const log = createLogger('whatsapp');
log.info({ messageId, wabaId }, 'Message sent');
log.error({ err, messageId }, 'Message send failed');
```

JSON stdout can be collected later by a log aggregation service such as Loki.
No external logging service is required or configured by this change.
