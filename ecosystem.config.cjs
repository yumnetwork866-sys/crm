module.exports = {
  apps: [
    {
      name: 'crm-backend',
      cwd: __dirname,
      script: '/usr/bin/bash',
      args: ['-c', 'npm run server'],
      watch: false,
      env: {
        NODE_ENV: 'production',
        SERVE_FRONTEND: 'false',
      },
    },
    {
      name: 'crm-frontend',
      cwd: __dirname,
      script: 'scripts/frontend-preview.mjs',
      interpreter: 'node',
      watch: false,
      kill_timeout: 5000,
      min_uptime: 10000,
      max_restarts: 3,
      restart_delay: 1000,
      env: { NODE_ENV: 'production' },
    },
  ],
};
