# FreightET — AWS Deployment Guide

## Architecture

```
                    ┌─────────────┐
    Users ──────────│  CloudFront │ (optional CDN)
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Nginx     │ :80/:443
                    │  (SSL/gzip) │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Next.js    │ :3000
                    │  (PM2)      │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──────┐ ┌──▼──┐  ┌──────▼──────┐
       │  RDS Postgres│ │ S3  │  │ ElastiCache │
       │  (database)  │ │(docs)│  │  (Redis)    │
       └─────────────┘ └─────┘  └─────────────┘
```

## Prerequisites

- AWS account with admin access
- Domain name (e.g., freightethiopia.com)
- SSH key pair for EC2

---

## Step 1: Create RDS PostgreSQL Instance

1. Go to **AWS Console > RDS > Create Database**
2. Settings:
   - Engine: PostgreSQL 15
   - Template: Free Tier (or Production)
   - Instance: db.t3.micro (dev) or db.t3.medium (prod)
   - DB name: `freight_db`
   - Master username: `freight_admin`
   - Master password: (generate and save)
   - VPC: Default VPC
   - Public access: No (EC2 in same VPC)
   - Security group: Allow port 5432 from EC2 security group
3. Save the endpoint: `freight-db.xxxxxxxxxxxx.us-east-1.rds.amazonaws.com`

## Step 2: Create S3 Bucket

1. Go to **S3 > Create Bucket**
2. Bucket name: `freight-documents-prod`
3. Region: Same as EC2
4. Block public access: ON (documents served via signed URLs)
5. Create IAM user with S3 access:
   - Policy: `AmazonS3FullAccess` (or custom policy for this bucket only)
   - Save Access Key ID and Secret

## Step 3: Launch EC2 Instance

1. Go to **EC2 > Launch Instance**
2. Settings:
   - Name: `freight-web`
   - AMI: Amazon Linux 2023
   - Instance type: t3.small (2 vCPU, 2GB RAM) recommended
   - Key pair: Select or create
   - Security group:
     - SSH (22) from your IP
     - HTTP (80) from anywhere
     - HTTPS (443) from anywhere
     - Custom TCP (3000) from VPC CIDR (internal only)
   - Storage: 20GB gp3
3. Elastic IP: Allocate and associate

## Step 4: Configure EC2

```bash
# SSH into instance
ssh -i your-key.pem ec2-user@<elastic-ip>

# Run setup script
git clone https://github.com/DanielMD1989/freight-managment.git /var/www/freight
cd /var/www/freight
chmod +x scripts/aws/ec2-setup.sh
sudo ./scripts/aws/ec2-setup.sh
```

## Step 5: Configure Environment

```bash
cd /var/www/freight
cp .env.production.example .env.local
nano .env.local
# Fill in:
#   DATABASE_URL (from Step 1)
#   JWT_SECRET (generate: openssl rand -base64 64)
#   JWT_ENCRYPTION_KEY (generate: openssl rand -base64 32)
#   CRON_SECRET (generate: openssl rand -hex 32)
#   AWS_S3_* (from Step 2)
#   NEXT_PUBLIC_APP_URL (your domain)
```

## Step 6: Deploy

```bash
./scripts/aws/deploy.sh
```

Verify: `curl http://localhost:3000/api/health`

## Step 7: Configure Nginx

```bash
sudo cp scripts/aws/nginx.conf /etc/nginx/conf.d/freight.conf
# Edit server_name:
sudo nano /etc/nginx/conf.d/freight.conf
# Change: server_name your-domain.com;
sudo nginx -t
sudo systemctl reload nginx
```

## Step 8: SSL Certificate

Point your domain's DNS A record to the Elastic IP, then:

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
# Follow prompts, select redirect HTTP to HTTPS
```

Auto-renewal is configured by default: `sudo certbot renew --dry-run`

## Step 9: Set Up Cron Jobs

```bash
# Add cron jobs for platform maintenance
crontab -e

# Add these lines:
# GPS monitoring every 30 seconds
* * * * * curl -s -X POST http://localhost:3000/api/cron/gps-monitor -H "Authorization: Bearer YOUR_CRON_SECRET" > /dev/null
* * * * * sleep 30 && curl -s -X POST http://localhost:3000/api/cron/gps-monitor -H "Authorization: Bearer YOUR_CRON_SECRET" > /dev/null

# Insurance monitoring daily at midnight
0 0 * * * curl -s -X POST http://localhost:3000/api/cron/insurance-monitor -H "Authorization: Bearer YOUR_CRON_SECRET" > /dev/null

# Trip monitoring every 5 minutes
*/5 * * * * curl -s -X POST http://localhost:3000/api/cron/trip-monitor -H "Authorization: Bearer YOUR_CRON_SECRET" > /dev/null

# Load expiration daily
0 1 * * * curl -s -X POST http://localhost:3000/api/cron/expire-loads -H "Authorization: Bearer YOUR_CRON_SECRET" > /dev/null

# Posting expiration daily
0 2 * * * curl -s -X POST http://localhost:3000/api/cron/expire-postings -H "Authorization: Bearer YOUR_CRON_SECRET" > /dev/null
```

## Step 10: GitHub Actions (CI/CD)

Add these secrets in GitHub repo settings (Settings > Secrets > Actions):

| Secret        | Value                      |
| ------------- | -------------------------- |
| `EC2_HOST`    | Your Elastic IP            |
| `EC2_USER`    | `ec2-user`                 |
| `EC2_SSH_KEY` | Contents of your .pem file |

Pushes to `main` will auto-deploy via `.github/workflows/deploy.yml`.

---

## Mobile App Deployment

### Development Build

```bash
cd mobile
npx eas build --platform ios --profile development
npx eas build --platform android --profile development
```

### Production Build

```bash
npx eas build --platform ios --profile production
npx eas build --platform android --profile production
```

### App Store Submission

```bash
npx eas submit --platform ios --profile production
npx eas submit --platform android --profile production
```

---

## Monitoring

| Tool       | Command                                  |
| ---------- | ---------------------------------------- |
| App status | `pm2 status`                             |
| App logs   | `pm2 logs freight-app --lines 100`       |
| Nginx logs | `sudo tail -f /var/log/nginx/access.log` |
| Deploy log | `tail -f /var/log/freight-deploy.log`    |
| DB connect | `psql $DATABASE_URL`                     |

## Troubleshooting

| Issue                       | Fix                                                         |
| --------------------------- | ----------------------------------------------------------- |
| 502 Bad Gateway             | `pm2 restart freight-app && sudo systemctl restart nginx`   |
| Database connection refused | Check RDS security group allows EC2                         |
| SSL expired                 | `sudo certbot renew`                                        |
| Disk full                   | `pm2 flush && sudo journalctl --vacuum-time=7d`             |
| High memory                 | `pm2 restart freight-app` (max_memory_restart handles this) |
| Deploy fails                | Check `/var/log/freight-deploy.log`                         |

## Cost Estimate (Monthly)

| Service    | Spec                        | Cost           |
| ---------- | --------------------------- | -------------- |
| EC2        | t3.small (2 vCPU, 2GB)      | ~$15           |
| RDS        | db.t3.micro (free tier 1yr) | $0-$15         |
| S3         | <1GB documents              | ~$1            |
| Elastic IP | 1 static IP                 | ~$4            |
| **Total**  |                             | **~$20-35/mo** |
