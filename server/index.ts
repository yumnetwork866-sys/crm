import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import authRoutes from './routes/auth';
import customerRoutes from './routes/customers';
import orderRoutes from './routes/orders';
import productRoutes from './routes/products';
import userRoutes from './routes/users';
import campaignRoutes from './routes/campaigns';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 1. Security Middleware - Helmet HTTP Headers
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

// 3. Rate Limiting (Prevent Brute-force & DDoS)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Quá nhiều yêu cầu từ IP này. Vui lòng thử lại sau 15 phút.' }
});
app.use('/api/', limiter);

// Strict rate limit for auth login endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 attempts per 15 minutes
  message: { error: 'Số lần thử đăng nhập quá nhiều. Vui lòng thử lại sau 15 phút.' }
});
app.use('/api/auth/login', authLimiter);

// 4. Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 5. Healthcheck Route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'VietCRM Backend API',
    timestamp: new Date().toISOString()
  });
});

// 6. API Route Handlers
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/campaigns', campaignRoutes);

// 7. Global 404 & Error Handler
app.use((req, res) => {
  res.status(404).json({ error: `Endpoint '${req.originalUrl}' không tồn tại.` });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('🔥 Unhandled Express Error:', err);
  res.status(500).json({
    error: 'Lỗi máy chủ nội bộ',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 8. Start Server
app.listen(PORT, () => {
  console.log(`🚀 VietCRM Backend Server đang chạy tại http://localhost:${PORT}`);
  console.log(`🔒 Bảo mật: Helmet, Rate Limiter, CORS & JWT Enabled.`);
});
