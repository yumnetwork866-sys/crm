| PM2 | Port |
| --- | --- |
| `crm-frontend` | `5080` |
| `crm-backend` | `5002` |

Cloudflare: `/api`, `/uploads`, `/webhook`, `/webhooks` → backend; còn lại → frontend.
Cấu hình: [PM2](ecosystem.config.cjs) · [Ingress](deploy/crm-ingress.example.yml) · [Môi trường](.env.example).

## Dev

```bash
npm run dev
```

```bash
pm2 start crm-frontend
```

Dev localhost `:5174`: `npm run frontend:dev`.
## Deploy

| Thao tác | Lệnh |
| --- | --- |
| Build frontend | `npm run frontend:build` |
| Restart backend | `pm2 restart crm-backend` |
| Cập nhật env backend | `pm2 startOrRestart ecosystem.config.cjs --only crm-backend --update-env` |
| Reload Nginx | `npm run frontend:check && npm run frontend:reload` |

## Cài đặt

Cần Node.js, PostgreSQL, Redis, PM2, Nginx.

```bash
npm install
cp .env.example .env
```

Điền `.env`, cấu hình ingress, rồi:

```bash
npm run db:migrate
npm run frontend:build
npm run frontend:check
pm2 startOrRestart ecosystem.config.cjs --update-env
pm2 save
```

## Log và kiểm tra

```bash
npm run logs
npm run logs:details
npm run check
```

Healthcheck: `/api/health`. Kết nối Meta: `/meta-verification`.
