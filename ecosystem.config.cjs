module.exports = {
  apps: [
    {
      name: 'crm',
      cwd: __dirname,
      script: '/usr/bin/bash',
      args: ['-c', 'npm run server'],
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
