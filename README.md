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

