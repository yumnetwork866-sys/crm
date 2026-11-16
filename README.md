# Yum CRM

| Dịch vụ PM2    | Port   |
| -------------- | ------ |
| `crm-frontend` | `5080` |
| `crm-backend`  | `5002` |

Cloudflare chuyển `/api`, `/uploads`, `/webhook`, `/webhooks` về backend; còn lại về frontend.
Cấu hình: [PM2](ecosystem.config.cjs) · [Ingress](deploy/crm-ingress.example.yml) · [Biến môi trường](.env.example).

## Cài đặt

Cần Node.js, PostgreSQL, Redis, PM2 và Nginx.

```bash
npm install
cp .env.example .env
```

Điền `.env`, cấu hình ingress, rồi chạy:

```bash
npm run db:migrate
npm run frontend:build
npm run frontend:check
pm2 startOrRestart ecosystem.config.cjs --update-env
pm2 save
```

## Phát triển và vận hành

| Thao tác                   | Lệnh                                                                      |
| -------------------------- | ------------------------------------------------------------------------- |
| Dev qua domain, port 5080  | `npm run dev`                                                             |
| Dev localhost, port 5174   | `npm run frontend:dev`                                                    |
| Build và cập nhật frontend | `npm run frontend:build`                                                  |
| Restart backend            | `pm2 restart crm-backend`                                                 |
| Cập nhật env backend       | `pm2 startOrRestart ecosystem.config.cjs --only crm-backend --update-env` |
| Kiểm tra và reload Nginx   | `npm run frontend:check && npm run frontend:reload`                       |
| Xem log                    | `npm run logs` hoặc `npm run logs:details`                                |
| Kiểm tra code              | `npm run check`                                                           |

Healthcheck: `/api/health`. Xác minh Meta: `/meta-verification`.

