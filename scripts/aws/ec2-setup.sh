#!/bin/bash
# ============================================================================
# FreightET — EC2 Instance Setup (Amazon Linux 2023)
#
# Run once on a fresh EC2 instance:
#   chmod +x scripts/aws/ec2-setup.sh && sudo ./scripts/aws/ec2-setup.sh
# ============================================================================

set -euo pipefail

echo "========================================="
echo " FreightET — EC2 Setup"
echo "========================================="

# --- System updates ---
echo "[1/8] Updating system packages..."
dnf update -y
dnf install -y git gcc-c++ make openssl-devel

# --- Node.js 20 via nvm ---
echo "[2/8] Installing Node.js 20..."
if ! command -v node &>/dev/null; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  nvm install 20
  nvm use 20
  nvm alias default 20
fi
echo "Node: $(node -v), npm: $(npm -v)"

# --- PM2 (process manager) ---
echo "[3/8] Installing PM2..."
npm install -g pm2
pm2 startup systemd -u ec2-user --hp /home/ec2-user

# --- Nginx ---
echo "[4/8] Installing Nginx..."
dnf install -y nginx
systemctl enable nginx
systemctl start nginx

# --- Certbot (SSL) ---
echo "[5/8] Installing Certbot..."
dnf install -y certbot python3-certbot-nginx

# --- PostgreSQL client (for migrations) ---
echo "[6/8] Installing PostgreSQL client..."
dnf install -y postgresql15

# --- Application directory ---
echo "[7/8] Setting up application directory..."
mkdir -p /var/www/freight
chown -R ec2-user:ec2-user /var/www/freight

# --- Firewall ---
echo "[8/8] Configuring firewall..."
# EC2 uses Security Groups — these are just local iptables rules as backup
if command -v firewall-cmd &>/dev/null; then
  firewall-cmd --permanent --add-service=http
  firewall-cmd --permanent --add-service=https
  firewall-cmd --permanent --add-port=3000/tcp
  firewall-cmd --reload
fi

echo ""
echo "========================================="
echo " Setup complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Clone repo:   cd /var/www/freight && git clone <repo-url> ."
echo "  2. Copy env:     cp .env.production.example .env.local"
echo "  3. Edit env:     nano .env.local  (set DATABASE_URL, secrets, etc.)"
echo "  4. Deploy:       ./scripts/aws/deploy.sh"
echo "  5. Nginx:        sudo cp scripts/aws/nginx.conf /etc/nginx/conf.d/freight.conf"
echo "  6. SSL:          sudo certbot --nginx -d your-domain.com"
echo ""
