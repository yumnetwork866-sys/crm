## Run Locally
**Prerequisites:**  Node.js
1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Development (manual only, on the existing domain)

PM2 manages production only. To use frontend dev on `crm.yumnetwork.vn`, manually
release frontend port `5080`, then run Vite from a terminal:

```bash
pm2 stop crm-frontend
npm run dev
```

`npm run dev` uses the same loopback port `5080` already targeted by the domain,
with hot reload over WSS on port 443. No tunnel config changes or PM2 dev process
are needed. This command never starts/stops PM2 itself. If production is still
using `5080`, Vite exits with a port-in-use error instead of choosing another port.
The backend `crm-backend` remains production at `5002`; API, upload, webhooks and
realtime requests are proxied to it. All users on the domain see the dev frontend
and actions still use live data. Refresh once after switching modes.

After finishing, press Ctrl+C to stop Vite and manually restore production:

```bash
pm2 start crm-frontend
```

Do not save the temporary stopped frontend state with `pm2 save`. For local-only
frontend work without replacing the public frontend, use `npm run frontend:dev`
(or `npm run dev:vite`) on `127.0.0.1:5174`; access it through an SSH tunnel if needed.

## Production with PM2

PM2 manages exactly two CRM processes, defined together in `ecosystem.config.cjs`:

- `crm-frontend`: standalone Nginx on `127.0.0.1:5080`, serving `frontend-dist`.
- `crm-backend`: Express on port `5002`, with `NODE_ENV=production` and `SERVE_FRONTEND=false`.

The Cloudflare Tunnel route for `crm.yumnetwork.vn` points to
`http://127.0.0.1:5080`. Nginx forwards API, uploads, webhooks and realtime requests
to Express; ordinary pages and assets are served directly by Nginx.

```bash
npm run frontend:build
npm run frontend:check
pm2 startOrRestart ecosystem.config.cjs --update-env
pm2 save
```

For a frontend-only deployment, run `npm run frontend:build`; no process restart
is required. The build runs in a fresh `.runtime/frontend-releases/<release>`
directory and is published by swapping the `frontend-dist` symlink. A failed build
leaves the active release intact. `frontend-previous` points to the preceding
release, and old releases remain on disk for rollback. Nginx can also serve bundles
from the old combined `dist` for tabs opened before the split.

For backend-only changes, run `pm2 startOrRestart ecosystem.config.cjs --only crm-backend --update-env`.
Use `npm run frontend:check && npm run frontend:reload` after Nginx configuration
changes. `npm run dev` starts frontend development manually; PM2 stays in production.

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

Successful GET API requests and mutating requests are info logs. Healthchecks,
static-file GETs, HEAD/OPTIONS, SSE connections/broadcasts, DB saves and job
completions remain debug logs; message send/receive events are info logs;
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

View CRM logs with `npm run logs`. This uses the compact Pino viewer: short time,
component, event, HTTP status/duration and a short request ID for warnings/errors.
It hides metadata and stacks in the terminal; the stored production JSON is unchanged.
Use `npm run logs:details` for complete fields and error stacks, or append
`-- --colorize` to force terminal colors. Both commands show the last 30 lines
and then follow new events. Older non-JSON log lines pass through unchanged.

## Frontend service and local access

The frontend remains bound to loopback and is exposed publicly through the
existing Cloudflare Tunnel. It requires `/usr/sbin/nginx` and
`/etc/nginx/mime.types`; no system Nginx configuration is modified. Runtime files
are in `.runtime/frontend-preview` (the original staging directory name).

Nginx preserves the public Host, HTTPS scheme and Cloudflare client IP. API paths
`/api`, `/uploads`, `/webhook` and `/webhooks` go to `127.0.0.1:5002`, without
response buffering for SSE or request buffering for uploads/webhook signatures.
The public origin and Secure session cookies stay the same after the cutover.

For internal troubleshooting, create an SSH tunnel from your computer:

```bash
ssh -N -L 5080:127.0.0.1:5080 adminyum@<server-ssh-address>
```

Open **http://localhost:5080** and sign in separately from the public domain.
This origin shares the live API/database; edits, uploads and message sends affect
real data. Meta Embedded Signup should use the configured public origin.

The original Cloudflare Tunnel configuration is backed up at
`.runtime/frontend-cutover/cloudflared.before.yml`. To return to combined serving,
first set `SERVE_FRONTEND` to `true` in `ecosystem.config.cjs` and apply it to `crm-backend`;
then restore that tunnel config to `~/.cloudflared/config.yml` and restart
`cloudflared`. Keep `dist` available for this fallback. The tunnel configuration
is shared with other domains, so restore only a still-current backup or change
only the CRM route if other routes have been updated in the meantime.
