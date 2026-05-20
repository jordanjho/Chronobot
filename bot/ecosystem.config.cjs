module.exports = {
  apps: [
    {
      name: 'chronobot',
      script: 'npm',
      args: 'run start',
      cwd: __dirname,
      // Restart on crash, but not too aggressively
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      // Pass SIGINT and give the bot time to drain the BullMQ worker
      kill_timeout: 10000,
      // Environment
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
