import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import express from 'express';
import { defineConfig, loadEnv, type ProxyOptions } from 'vite';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const backendPort = env.PORT || '5002';
  const publicHost = env.FRONTEND_DEV_HOST;
  const backendProxy: ProxyOptions = {
    target: env.FRONTEND_API_TARGET || `http://127.0.0.1:${backendPort}`,
    changeOrigin: false,
    timeout: 0,
    proxyTimeout: 0,
    configure(proxy) {
      proxy.on('proxyReq', (upstream, req) => {
        // The public dev server receives requests directly from cloudflared.
        const clientIp = req.headers['cf-connecting-ip'];
        if (typeof clientIp === 'string') upstream.setHeader('X-Forwarded-For', clientIp);
      });
    },
  };

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'previous-frontend-assets',
        apply: 'serve',
        configureServer(server) {
          // Keep built chunks for existing tabs without proxying back to this port.
          const assets = express();
          assets.disable('x-powered-by');
          for (const directory of ['frontend-dist', 'frontend-previous', 'dist']) {
            assets.use(express.static(
              path.resolve(__dirname, directory, 'assets'),
              { index: false, immutable: true, maxAge: '1y' },
            ));
          }
          server.middlewares.use('/assets', assets);
        },
      },
    ],
    optimizeDeps: { entries: ['index.html'] },
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },
    server: {
      host: '127.0.0.1',
      port: Number(env.FRONTEND_DEV_PORT || '5174'),
      strictPort: true,
      allowedHosts: publicHost ? [publicHost] : [],
      fs: {
        deny: [
          '.env', '.env.*', '*.{crt,pem}', '**/.git/**',
          '**/.aws/**', '**/.codex/**', '**/.agents/**',
          '**/server/**', '**/prisma/**', '**/.runtime/**',
        ],
      },
      proxy: {
        '^/(api|uploads|webhooks?)(/|$)': backendProxy,
      },
      hmr: env.DISABLE_HMR === 'true' ? false : publicHost ? {
        protocol: 'wss',
        host: publicHost,
        clientPort: 443,
        path: '/__vite_hmr',
      } : env.HMR_CLIENT_PORT ? { clientPort: Number(env.HMR_CLIENT_PORT) } : true,
      watch: env.DISABLE_HMR === 'true' ? null : {
        ignored: ['**/.runtime/**', '**/frontend-dist/**', '**/frontend-previous/**', '**/dist/**'],
      },
    },
  };
});
