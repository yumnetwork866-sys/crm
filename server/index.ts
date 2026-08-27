import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import authRoutes, { ensureAdminUser } from './routes/auth';
import customerRoutes from './routes/customers';
import orderRoutes from './routes/orders';
import productRoutes from './routes/products';
import userRoutes from './routes/users';
import campaignRoutes from './routes/campaigns';
import metaRoutes from './routes/metaRoutes';
import uploadRoutes from './routes/uploadRoutes';
import { startCampaignWorker } from './services/campaignWorker';
import http from 'http';
import path from 'path';
import fs from 'fs';

dotenv.config({ quiet: true });

const app = express();
const PORT = process.env.PORT || 5002;

// Ensure base upload directories exist & serve statically (Stage 2 Disk Storage)
const UPLOADS_DIR = path.resolve(process.cwd(), 'public/uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

// Trust all Reverse Proxies (Nginx / Cloudflare / PM2)
app.set('trust proxy', true);

// Request Logger for debugging Webhook and API hits
app.use((req, res, next) => {
  if (req.url.includes('webhook') || req.url.includes('meta')) {
    console.log(`[HTTP ${req.method}] ${req.url} - IP: ${req.ip}`);
  }
  next();
});

// 1. Body Parser & Security Middleware (Supports JSON, text/plain, and raw Meta payloads)
app.use(express.json({
  limit: '25mb',
  type: ['application/json', 'text/plain', '*/*'],
  verify: (req, res, buffer) => {
    // Meta signs the exact request bytes. Retain them only for signed requests so
    // the webhook middleware can verify the body before processing the payload.
    if (req.headers['x-hub-signature-256']) {
      (res as express.Response).locals.metaWebhookRawBody = buffer;
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

app.use(helmet({
  contentSecurityPolicy: false // Allow inline scripts for dev Vite proxy if served together
}));

// 2. CORS Security
const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173'];
if (process.env.APP_URL) {
  allowedOrigins.push(process.env.APP_URL);
}

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
}));

// 3. META WEBHOOK & META API ROUTES (Bypasses rate limiters for 100% reliable Facebook Meta delivery)
app.use('/webhook', metaRoutes);
app.use('/webhooks', metaRoutes);
app.use('/api/webhook', metaRoutes);
app.use('/api/webhooks', metaRoutes);
app.use('/api/meta', metaRoutes);

// 4. Rate Limiting for other API endpoints (Custom keyGenerator prevents proxy validation errors)
const customKeyGenerator = (req: express.Request) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || '127.0.0.1';
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: customKeyGenerator,
  message: { error: 'Quá nhiều yêu cầu từ IP này. Vui lòng thử lại sau 15 phút.' }
});
app.use('/api/', limiter);

// Strict rate limit for auth login endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  validate: false,
  keyGenerator: customKeyGenerator,
  message: { error: 'Số lần thử đăng nhập quá nhiều. Vui lòng thử lại sau 15 phút.' }
});
app.use('/api/auth/login', authLimiter);

// 5. Healthcheck Route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'YumNetwork CRM Backend API',
    timestamp: new Date().toISOString()
  });
});

// 6. Other API Route Handlers
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/upload', uploadRoutes);

const httpServer = http.createServer(app);

// 7. Serve Frontend (Vite Middleware in Development, Static Dist in Production)
async function setupFrontend() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const hmrClientPort = process.env.HMR_CLIENT_PORT
      ? Number(process.env.HMR_CLIENT_PORT)
      : undefined;

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server: httpServer,
          ...(hmrClientPort ? { clientPort: hmrClientPort } : {}),
        },
        allowedHosts: true,
      },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.get('*', async (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/uploads') || req.path.startsWith('/webhook') || req.path.startsWith('/webhooks')) {
        return next();
      }
      try {
        const fs = await import('fs/promises');
        const indexFile = path.resolve(process.cwd(), 'index.html');
        let template = await fs.readFile(indexFile, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));

    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/uploads') || req.path.startsWith('/webhook') || req.path.startsWith('/webhooks')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'), (err) => {
        if (err) {
          next(err);
        }
      });
    });
  }
}

await setupFrontend();

// 7. Global 404 & Error Handler (primarily for unmatched API endpoints)
app.use((req, res) => {
  res.status(404).json({ error: `Endpoint '${req.originalUrl}' không tồn tại.` });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Express Error:', err);
  res.status(500).json({
    error: 'Lỗi máy chủ nội bộ',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 8. Start Server with HMR support
httpServer.listen(PORT, async () => {
  console.log(`YumNetwork CRM Server đang chạy tại http://localhost:${PORT}`);
  console.log(`Vite HMR Hot Reload & API đã sẵn sàng.`);
  await ensureAdminUser();
  startCampaignWorker();
});
