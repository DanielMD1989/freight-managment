# Freight Management Platform - Deployment Guide

## Prerequisites

- Node.js 20+ (LTS)
- PostgreSQL 14+
- Redis 7+ (optional but recommended)
- Docker & Docker Compose (for containerized deployment)
- AWS account (for production)

---

## Environment Configuration

### Required Environment Variables

Create `.env.local` for development or configure in production environment:

```bash
# ============================================================================
# CORE CONFIGURATION
# ============================================================================
NODE_ENV="production"                    # development | production | test
NEXT_PUBLIC_APP_URL="https://app.freightplatform.com"

# ============================================================================
# DATABASE (Required)
# ============================================================================
DATABASE_URL="postgresql://user:password@host:5432/freight_db?schema=public"
DB_POOL_MIN="10"
DB_POOL_MAX="100"

# ============================================================================
# AUTHENTICATION (Required)
# ============================================================================
JWT_SECRET="<generate: openssl rand -base64 32>"
JWT_ENCRYPTION_KEY="<generate: openssl rand -base64 32>"
JWT_EXPIRES_IN="7d"
JWT_ENABLE_ENCRYPTION="true"
NEXTAUTH_URL="https://app.freightplatform.com"
NEXTAUTH_SECRET="<generate: openssl rand -base64 32>"

# ============================================================================
# REDIS (Recommended for production)
# ============================================================================
REDIS_ENABLED="true"
REDIS_URL="redis://user:password@host:6379/0"
# OR individual settings:
# REDIS_HOST="localhost"
# REDIS_PORT="6379"
# REDIS_PASSWORD=""

# ============================================================================
# STORAGE (Required)
# ============================================================================
STORAGE_PROVIDER="s3"                    # local | s3 | cloudinary
AWS_REGION="eu-west-1"
AWS_ACCESS_KEY_ID="<your-key>"
AWS_SECRET_ACCESS_KEY="<your-secret>"
AWS_S3_BUCKET="freight-platform-uploads"
CDN_ENABLED="true"
CDN_DOMAIN="cdn.freightplatform.com"

# ============================================================================
# EMAIL (Required)
# ============================================================================
EMAIL_PROVIDER="sendgrid"                # console | smtp | sendgrid | ses | resend
EMAIL_FROM="noreply@freightplatform.com"
EMAIL_FROM_NAME="Freight Management Platform"
SENDGRID_API_KEY="<your-key>"

# ============================================================================
# SMS (Required for MFA)
# ============================================================================
AFROMESSAGE_API_KEY="<your-key>"
AFROMESSAGE_SENDER_NAME="FreightMgt"

# ============================================================================
# PAYMENT (Required)
# ============================================================================
CHAPA_SECRET_KEY="<your-key>"
CHAPA_PUBLIC_KEY="<your-key>"
CHAPA_WEBHOOK_SECRET="<your-secret>"

# ============================================================================
# MAPS (Required)
# ============================================================================
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="<your-key>"
GOOGLE_ROUTES_API_KEY="<your-key>"

# ============================================================================
# MONITORING (Recommended)
# ============================================================================
NEXT_PUBLIC_SENTRY_DSN="<your-dsn>"
SENTRY_DSN="<your-dsn>"
SENTRY_ORG="your-org"
SENTRY_PROJECT="freight-platform"
SENTRY_AUTH_TOKEN="<your-token>"

# ============================================================================
# LOGGING
# ============================================================================
LOG_LEVEL="info"                         # debug | info | warn | error
LOG_FORMAT="json"                        # json | pretty
```

### Generate Secrets

```bash
# Generate JWT secret (32 bytes)
openssl rand -base64 32

# Generate encryption key (32 bytes)
openssl rand -base64 32

# Generate NextAuth secret
openssl rand -base64 32
```

---

## Local Development

### Quick Start

```bash
# 1. Clone repository
git clone https://github.com/your-org/freight-management.git
cd freight-management

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env.local
# Edit .env.local with your values

# 4. Setup database
npx prisma generate
npx prisma db push
npx prisma db seed

# 5. Start development server
npm run dev
```

### Development with Docker Compose

```bash
# Start PostgreSQL and Redis
docker-compose -f docker-compose.dev.yml up -d

# Run migrations
npx prisma db push

# Start development server
npm run dev
```

**docker-compose.dev.yml:**
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: freight
      POSTGRES_PASSWORD: freight123
      POSTGRES_DB: freight_db
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

---

## Production Deployment

### Option 1: Docker Deployment

#### Build Docker Image

```dockerfile
# Dockerfile
FROM node:20-alpine AS base

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
```

#### Docker Compose Production

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:16
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

#### Deploy

```bash
# Build and start
docker-compose -f docker-compose.prod.yml up -d --build

# Run migrations
docker-compose exec app npx prisma migrate deploy

# Check status
docker-compose ps
docker-compose logs -f app
```

### Option 2: AWS Deployment

#### Infrastructure (Terraform)

```hcl
# terraform/main.tf

# VPC
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  name   = "freight-platform-vpc"
  cidr   = "10.0.0.0/16"

  azs             = ["eu-west-1a", "eu-west-1b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]

  enable_nat_gateway = true
}

# RDS PostgreSQL
module "rds" {
  source = "terraform-aws-modules/rds/aws"

  identifier = "freight-platform-db"
  engine     = "postgres"
  engine_version = "16"
  instance_class = "db.r6g.large"

  allocated_storage = 100
  storage_encrypted = true

  db_name  = "freight_db"
  username = "freight_admin"

  multi_az               = true
  db_subnet_group_name   = module.vpc.database_subnet_group_name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = 7
  deletion_protection     = true
}

# ElastiCache Redis
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "freight-platform-cache"
  engine               = "redis"
  node_type            = "cache.r6g.large"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379

  security_group_ids = [aws_security_group.redis.id]
  subnet_group_name  = aws_elasticache_subnet_group.main.name
}

# ECS Fargate Cluster
resource "aws_ecs_cluster" "main" {
  name = "freight-platform"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# S3 Bucket
resource "aws_s3_bucket" "uploads" {
  bucket = "freight-platform-uploads"
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "cdn" {
  origin {
    domain_name = aws_s3_bucket.uploads.bucket_regional_domain_name
    origin_id   = "S3-uploads"
  }

  enabled = true

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-uploads"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
```

#### ECS Task Definition

```json
{
  "family": "freight-platform",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [
    {
      "name": "app",
      "image": "your-ecr-repo/freight-platform:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3000"}
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:freight/database"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:freight/jwt"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/freight-platform",
          "awslogs-region": "eu-west-1",
          "awslogs-stream-prefix": "app"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/api/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3
      }
    }
  ]
}
```

### Option 3: Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
# or via CLI:
vercel env add DATABASE_URL production
vercel env add JWT_SECRET production
# ... etc
```

**Note:** For Vercel, use external PostgreSQL (e.g., Neon, Supabase) and Redis (e.g., Upstash).

---

## Database Setup

### Initial Setup

```bash
# Generate Prisma client
npx prisma generate

# Apply migrations
npx prisma migrate deploy

# Seed database
npx prisma db seed
```

### Migrations

```bash
# Create new migration
npx prisma migrate dev --name add_new_feature

# Apply migrations (production)
npx prisma migrate deploy

# Reset database (development only!)
npx prisma migrate reset
```

### Backups

```bash
# Manual backup
pg_dump -h host -U user -d freight_db > backup_$(date +%Y%m%d).sql

# Restore
psql -h host -U user -d freight_db < backup.sql
```

For AWS RDS, enable automated backups in the console.

---

## Production Checklist

### Security

- [ ] All secrets stored in environment variables or AWS Secrets Manager
- [ ] JWT secrets are unique, random, 32+ bytes
- [ ] Database password is strong and unique
- [ ] HTTPS enforced everywhere
- [ ] CORS configured for production domains only
- [ ] Rate limiting enabled
- [ ] Brute force protection active

### Database

- [ ] PostgreSQL 14+ with encryption at rest
- [ ] Connection pooling configured (PgBouncer recommended)
- [ ] Automated backups enabled
- [ ] Read replicas for high traffic (optional)
- [ ] Monitoring and alerts configured

### Performance

- [ ] Redis caching enabled
- [ ] CDN configured for static assets
- [ ] Image optimization enabled
- [ ] Gzip compression enabled
- [ ] Database indexes verified

### Monitoring

- [ ] Sentry configured for error tracking
- [ ] Health check endpoints working
- [ ] Logging configured (JSON format)
- [ ] Alerts configured for critical errors
- [ ] Uptime monitoring enabled

### Operations

- [ ] CI/CD pipeline configured
- [ ] Database migration process documented
- [ ] Rollback procedure documented
- [ ] Incident response plan in place
- [ ] On-call schedule defined

---

## Health Check

Test health endpoint:

```bash
curl https://app.freightplatform.com/api/health
```

Expected response:

```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "timestamp": "2026-02-13T10:00:00.000Z"
}
```

---

## Scaling

### Horizontal Scaling

- **Application:** Add more container instances (ECS, K8s)
- **Database:** Use read replicas for read-heavy workloads
- **Cache:** Use Redis Cluster for distributed caching
- **Queue:** BullMQ scales with Redis Cluster

### Vertical Scaling

| Component | Development | Production | High Traffic |
|-----------|-------------|------------|--------------|
| App | 1 CPU, 1GB | 2 CPU, 4GB | 4 CPU, 8GB |
| Database | db.t3.micro | db.r6g.large | db.r6g.xlarge |
| Redis | cache.t3.micro | cache.r6g.large | cache.r6g.xlarge |

---

## Troubleshooting

### Common Issues

**1. Database Connection Errors**
```bash
# Check connection string
npx prisma db pull

# Verify network connectivity
nc -zv <db-host> 5432
```

**2. Redis Connection Errors**
```bash
# Test Redis connection
redis-cli -h <host> -p 6379 -a <password> ping
```

**3. Memory Issues**
```bash
# Check memory usage
docker stats

# Increase Node.js memory
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

**4. SSL/TLS Issues**
```bash
# Verify certificate
openssl s_client -connect app.freightplatform.com:443
```

### Logs

```bash
# Docker logs
docker-compose logs -f app

# AWS CloudWatch
aws logs tail /ecs/freight-platform --follow

# Vercel logs
vercel logs --follow
```

---

## Support

- **Documentation:** https://docs.freightplatform.com
- **Status Page:** https://status.freightplatform.com
- **Support Email:** support@freightplatform.com
- **Emergency:** +251-XXX-XXXX
