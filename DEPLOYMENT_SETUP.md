# Deployment Setup Guide
**Freight Management Platform - Production Deployment Checklist**

**Last Updated:** 2026-01-03
**Platform Version:** Sprint 16 Complete (89% total completion)

---

## Overview

This document outlines the setup tasks required to complete Sprints 15 & 16 deployment. These tasks require user actions, API keys, or production environment configuration.

### Sprint 15 Setup Tasks (5 remaining)
- Google Maps API configuration
- API key security setup
- Documentation updates

### Sprint 16 Setup Tasks (4 remaining)
- Cron job automation
- Production monitoring
- Analytics dashboard setup (deferred)

---

## 🔑 Google Maps API Setup (Sprint 15)

### Task 1: Obtain Google Maps API Key

**Status:** ⚠️ USER ACTION REQUIRED
**Priority:** P1 (Required for Google Places Autocomplete)
**Estimated Time:** 15 minutes

**Steps:**

1. **Go to Google Cloud Console**
   ```
   https://console.cloud.google.com/
   ```

2. **Create a new project** (or select existing)
   - Project Name: "Freight Management Platform"
   - Organization: Your company
   - Location: Your country

3. **Enable required APIs**
   Navigate to: APIs & Services → Library

   Enable these APIs:
   - ✅ Places API
   - ✅ Maps JavaScript API
   - ✅ Geocoding API
   - ✅ Distance Matrix API (optional, for route calculation)

4. **Create API Credentials**
   - Go to: APIs & Services → Credentials
   - Click: "Create Credentials" → "API Key"
   - Copy the generated API key

5. **Add to Environment Variables**
   ```bash
   # Add to .env.local (development)
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here

   # Add to production environment
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
   ```

---

### Task 2: Configure Google Cloud Billing

**Status:** ⚠️ USER ACTION REQUIRED
**Priority:** P1 (Required for API usage beyond free tier)
**Estimated Time:** 10 minutes

**Steps:**

1. **Set up billing account**
   - Go to: Billing → Link a billing account
   - Add payment method (credit card)
   - Review Google Maps Platform pricing:
     ```
     Places API: $17 per 1,000 requests (first $200/month free)
     Maps JavaScript API: $7 per 1,000 map loads
     ```

2. **Set up budget alerts**
   - Go to: Billing → Budgets & alerts
   - Create budget: $50/month (recommended for small deployment)
   - Set alert threshold: 50%, 75%, 90%, 100%

3. **Enable quota monitoring**
   - Go to: APIs & Services → Quotas
   - Review quotas for Places API
   - Set up quota alerts if needed

**Cost Estimation:**
- Small deployment (<1,000 loads/month): ~$10-20/month
- Medium deployment (<10,000 loads/month): ~$50-100/month
- Large deployment (>10,000 loads/month): Custom pricing

---

### Task 3: Restrict API Key (Production Security)

**Status:** 🔒 DEPLOYMENT TASK
**Priority:** P0 (CRITICAL for production security)
**Estimated Time:** 10 minutes

**Steps:**

1. **Set Application Restrictions**
   - Go to: APIs & Services → Credentials → [Your API Key]
   - Application restrictions: **HTTP referrers (websites)**
   - Add referrers:
     ```
     https://your-domain.com/*
     https://www.your-domain.com/*
     http://localhost:3000/* (for development)
     ```

2. **Set API Restrictions**
   - Restrict key to these APIs only:
     - ✅ Places API
     - ✅ Maps JavaScript API
     - ✅ Geocoding API
   - This prevents unauthorized API usage

3. **Regenerate Key for Production**
   - Use separate API keys for development and production
   - Development key: Unrestricted (localhost only)
   - Production key: Restricted (domain-locked)

**Security Checklist:**
- [ ] API key restricted to production domain
- [ ] API key restricted to required APIs only
- [ ] Separate development and production keys
- [ ] API key NOT committed to version control
- [ ] Budget alerts configured
- [ ] Quota monitoring enabled

---

## ⏰ Cron Job Setup (Sprint 16)

### Task 4: GPS Position Cleanup Automation

**Status:** 🚀 DEPLOYMENT TASK
**Priority:** P2 (Important for database maintenance)
**Estimated Time:** 20 minutes

**Purpose:** Automatically delete GPS positions older than 90 days to prevent database bloat.

**Options:**

#### **Option A: Vercel Cron (Recommended for Vercel deployment)**

1. **Update `vercel.json`**
   ```json
   {
     "crons": [
       {
         "path": "/api/cron/cleanup-gps-positions",
         "schedule": "0 2 * * *"
       }
     ]
   }
   ```

2. **Verify cron is active**
   - Deploy to Vercel
   - Check: Vercel Dashboard → Project → Cron Jobs
   - Test: Manually trigger via dashboard

#### **Option B: GitHub Actions (For any hosting)**

1. **Create `.github/workflows/cleanup-gps.yml`**
   ```yaml
   name: GPS Position Cleanup
   on:
     schedule:
       - cron: '0 2 * * *'  # Run at 2 AM UTC daily
     workflow_dispatch:  # Allow manual trigger

   jobs:
     cleanup:
       runs-on: ubuntu-latest
       steps:
         - name: Trigger cleanup endpoint
           run: |
             curl -X POST https://your-domain.com/api/cron/cleanup-gps-positions \
               -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
   ```

2. **Add CRON_SECRET to GitHub Secrets**
   - Go to: Repository → Settings → Secrets → Actions
   - Add secret: `CRON_SECRET` (generate random 32-char string)

3. **Update API endpoint to verify secret**
   ```typescript
   // In /api/cron/cleanup-gps-positions/route.ts
   const authHeader = request.headers.get('authorization');
   if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }
   ```

#### **Option C: External Cron Service (For any hosting)**

**Services:**
- [Cron-job.org](https://cron-job.org) - Free
- [EasyCron](https://www.easycron.com) - Free tier available
- [Cronitor](https://cronitor.io) - Monitoring included

**Setup:**
1. Create account at service
2. Add cron job:
   - URL: `https://your-domain.com/api/cron/cleanup-gps-positions`
   - Schedule: `0 2 * * *` (2 AM daily)
   - Method: POST
   - Headers: `Authorization: Bearer YOUR_CRON_SECRET`

**Verification:**
```bash
# Test the endpoint manually
curl -X POST https://your-domain.com/api/cron/cleanup-gps-positions \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Expected response:
# { "success": true, "deletedCount": 1234, "olderThan": "2025-10-05T00:00:00.000Z" }
```

---

## 📊 Deferred Features (Phase 2)

### Sprint 15 Deferred Features

**Auto-calculate Trip Distance**
- **Status:** DEFERRED to Phase 2
- **Reason:** Requires Google Distance Matrix API integration
- **Impact:** LOW - Users can manually enter estimated KM
- **Effort:** 2-3 days
- **Implementation:** Use Google Distance Matrix API to calculate route distance

**Advanced Filter State Management**
- **Status:** DEFERRED to Phase 2
- **Reason:** Requires URL query parameter sync
- **Impact:** LOW - Basic filtering works
- **Effort:** 1-2 days
- **Implementation:** Add URL query string management for filter persistence

---

### Sprint 16 Deferred Features

**GPS Visualization/Mapping UI**
- **Status:** DEFERRED to Phase 3
- **Reason:** Complex UI requiring mapping library integration
- **Impact:** MEDIUM - GPS tracking works, but no visual map
- **Effort:** 5-7 days
- **Implementation:**
  - Integrate Mapbox or Google Maps
  - Display truck position on map
  - Show route with waypoints
  - Real-time position updates

**Admin Analytics Dashboards**
- **Status:** DEFERRED to Phase 2
- **Reason:** Requires data aggregation and charting
- **Impact:** LOW - Core admin tools functional
- **Effort:** 8-10 days
- **Implementation:**
  - Commission revenue charts (by month/year)
  - Total platform revenue display
  - User growth analytics
  - Load completion trends
  - Trust metrics visualization

**Cron Job Monitoring & Alerts**
- **Status:** DEFERRED to Phase 2
- **Reason:** Requires monitoring service integration
- **Impact:** LOW - Cron jobs run successfully
- **Effort:** 2-3 days
- **Implementation:**
  - Integrate Cronitor or Healthchecks.io
  - Send alerts on cron job failures
  - Track execution history
  - Monitor execution duration

---

## ✅ Production Readiness Checklist

### Environment Variables

**Required for Production:**
```bash
# Database
DATABASE_URL="postgresql://..."

# Authentication
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="generate-random-32-char-string"

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your-restricted-production-key"

# Email Service (choose one)
SENDGRID_API_KEY="your-sendgrid-key"  # OR
AWS_SES_ACCESS_KEY_ID="your-aws-key"  # OR
RESEND_API_KEY="your-resend-key"

# WebSocket (if using custom server)
NEXT_PUBLIC_WEBSOCKET_URL="https://your-domain.com"
NEXT_PUBLIC_APP_URL="https://your-domain.com"

# Cron Security
CRON_SECRET="generate-random-32-char-string"

# Optional: SMS Service
TWILIO_ACCOUNT_SID="..."
TWILIO_AUTH_TOKEN="..."
TWILIO_PHONE_NUMBER="..."
```

### Database Migrations

```bash
# Run all migrations
DATABASE_URL="..." npx prisma migrate deploy

# Generate Prisma client
DATABASE_URL="..." npx prisma generate

# Verify schema
DATABASE_URL="..." npx prisma db push
```

### Security Hardening

- [ ] All API keys restricted to production domain
- [ ] NEXTAUTH_SECRET is random and secure (32+ characters)
- [ ] DATABASE_URL uses SSL connection
- [ ] CRON_SECRET is random and secure
- [ ] Rate limiting enabled on all public endpoints
- [ ] CORS configured for production domain only
- [ ] CSP headers configured
- [ ] Environment variables NOT in version control

### Performance Optimization

- [ ] Database indexes created (already in schema)
- [ ] Next.js production build tested (`npm run build`)
- [ ] Images optimized and using Next.js Image component
- [ ] API response caching configured where appropriate
- [ ] Database connection pooling configured

### Monitoring & Logging

- [ ] Error tracking configured (Sentry recommended)
- [ ] Performance monitoring (Vercel Analytics or similar)
- [ ] Database query monitoring
- [ ] Cron job health checks
- [ ] WebSocket connection monitoring
- [ ] API endpoint uptime monitoring

---

## 📋 Deployment Steps

### 1. Pre-Deployment

```bash
# 1. Run tests
npm test

# 2. Build for production
npm run build

# 3. Verify build succeeds
npm run start

# 4. Run database migrations
DATABASE_URL="..." npx prisma migrate deploy
```

### 2. Deploy to Production

**Vercel (Recommended):**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables via Vercel Dashboard
```

**Other Platforms:**
- Configure environment variables in platform dashboard
- Set Node.js version to 18+
- Set build command: `npm run build`
- Set start command: `npm run start` or `node server.js` (for WebSocket)

### 3. Post-Deployment

- [ ] Verify homepage loads
- [ ] Test user registration
- [ ] Test load posting
- [ ] Test truck posting
- [ ] Test GPS tracking
- [ ] Test real-time notifications
- [ ] Test admin panel access
- [ ] Verify cron jobs running
- [ ] Check error logs

---

## 🆘 Troubleshooting

### Google Maps API Issues

**"This API key is not authorized to use this service"**
- Check API restrictions in Google Cloud Console
- Verify domain is in HTTP referrer list
- Ensure Places API is enabled

**"You have exceeded your daily request quota"**
- Check Google Cloud Console → Quotas
- Increase quota or upgrade billing plan
- Implement request caching

### Database Connection Issues

**"Can't reach database server"**
- Verify DATABASE_URL is correct
- Check database server is running
- Verify network connectivity
- Check database connection limits

### WebSocket Connection Issues

**"WebSocket connection failed"**
- Verify server.js is running (not next dev)
- Check NEXT_PUBLIC_WEBSOCKET_URL matches deployment URL
- Verify WebSocket port is not blocked by firewall

### Cron Job Not Running

**Check cron service status:**
```bash
# Verify endpoint is accessible
curl -X POST https://your-domain.com/api/cron/cleanup-gps-positions \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -v

# Check cron service logs (GitHub Actions, Vercel, etc.)
```

---

## 📞 Support Resources

- **Google Maps Platform Support:** https://developers.google.com/maps/support
- **Vercel Support:** https://vercel.com/support
- **Prisma Docs:** https://www.prisma.io/docs
- **Next.js Docs:** https://nextjs.org/docs

---

**Last Updated:** 2026-01-03
**Document Version:** 1.0
**Maintainer:** Platform Engineering Team
