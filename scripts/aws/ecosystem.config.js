/**
 * PM2 Ecosystem Configuration — FreightET
 *
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 reload ecosystem.config.js --env production
 */

module.exports = {
  apps: [
    {
      name: "freight-app",
      script: "npm",
      args: "start",
      cwd: "/var/www/freight",
      instances: 1, // t3.micro: 2 vCPU but 1GB RAM — single instance safer
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "800M",

      // Logs
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "/var/log/freight-app-error.log",
      out_file: "/var/log/freight-app-out.log",
      merge_logs: true,
      log_type: "json",

      // Graceful shutdown
      kill_timeout: 10000,
      listen_timeout: 10000,

      // Environment
      env: {
        NODE_ENV: "development",
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
