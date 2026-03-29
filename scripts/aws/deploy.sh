#!/bin/bash
# ============================================================================
# FreightET — Deployment Script
#
# Run from project root:
#   ./scripts/aws/deploy.sh
# ============================================================================

set -euo pipefail

APP_DIR="/var/www/freight"
LOG_FILE="/var/log/freight-deploy.log"

echo "=========================================" | tee -a "$LOG_FILE"
echo " FreightET — Deploying $(date)" | tee -a "$LOG_FILE"
echo "=========================================" | tee -a "$LOG_FILE"

cd "$APP_DIR"

# --- Load nvm ---
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# --- Pull latest code ---
echo "[1/6] Pulling latest code..." | tee -a "$LOG_FILE"
git pull origin main 2>&1 | tee -a "$LOG_FILE"

# --- Install dependencies ---
echo "[2/6] Installing dependencies..." | tee -a "$LOG_FILE"
npm ci --production 2>&1 | tee -a "$LOG_FILE"

# --- Generate Prisma client ---
echo "[3/6] Generating Prisma client..." | tee -a "$LOG_FILE"
npx prisma generate 2>&1 | tee -a "$LOG_FILE"

# --- Run database migrations ---
echo "[4/6] Running database migrations..." | tee -a "$LOG_FILE"
npx prisma migrate deploy 2>&1 | tee -a "$LOG_FILE"

# --- Build Next.js ---
echo "[5/6] Building application..." | tee -a "$LOG_FILE"
npm run build 2>&1 | tee -a "$LOG_FILE"

# --- Restart application ---
echo "[6/6] Restarting application..." | tee -a "$LOG_FILE"
if pm2 list | grep -q "freight-app"; then
  pm2 reload ecosystem.config.js --env production 2>&1 | tee -a "$LOG_FILE"
else
  pm2 start ecosystem.config.js --env production 2>&1 | tee -a "$LOG_FILE"
fi
pm2 save 2>&1 | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "Deploy complete! $(date)" | tee -a "$LOG_FILE"
echo "Check status: pm2 status" | tee -a "$LOG_FILE"
echo "Check logs:   pm2 logs freight-app" | tee -a "$LOG_FILE"
