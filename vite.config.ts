import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendPort = env.PORT || '5002';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      allowedHosts: true,
      proxy: {
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/uploads': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/webhook': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/webhooks': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
      },
      // HMR configuration
      hmr: process.env.DISABLE_HMR === 'true'
        ? false
        : (env.HMR_CLIENT_PORT
            ? { clientPort: Number(env.HMR_CLIENT_PORT) }
            : true),
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
