# GPS Cron Jobs Setup Guide

Sprint 16 - Story 16.8: GPS Data Storage & Background Monitoring

## Overview

The GPS monitoring system requires two background cron jobs:

1. **GPS Monitoring** - Polls GPS devices every 30 seconds
2. **GPS Data Cleanup** - Deletes old GPS positions daily (90-day retention)

## Cron Job Endpoints

### 1. GPS Monitoring Cron
**Endpoint:** `POST /api/cron/gps-monitor`
**Frequency:** Every 30 seconds
**Purpose:** Poll GPS devices, update truck statuses, send offline alerts

**What it does:**
- Polls all active GPS devices for current position
- Updates truck GPS status (ACTIVE/INACTIVE/SIGNAL_LOST)
- Detects trucks that went offline during active loads
- Triggers GPS offline alerts to shippers and carriers

### 2. GPS Data Cleanup Cron
**Endpoint:** `POST /api/cron/gps-cleanup`
**Frequency:** Daily (recommended: 2 AM)
**Purpose:** Delete GPS positions older than 90 days

**What it does:**
- Deletes GPS position records older than 90 days
- Maintains database performance
- Complies with data retention policy

## Setup Options

### Option 1: Vercel Cron (Recommended for Vercel deployments)

Create `vercel.json` in project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/gps-monitor",
      "schedule": "*/30 * * * * *"
    },
    {
      "path": "/api/cron/gps-cleanup",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Note:** Vercel Cron on Hobby plan has minimum 1-minute interval. The 30-second GPS monitoring requires Pro plan or external service.

### Option 2: External Cron Service (cron-job.org, EasyCron, etc.)

1. Sign up for a cron service (e.g., https://cron-job.org)

2. Create two cron jobs:

**GPS Monitoring:**
- URL: `https://your-domain.com/api/cron/gps-monitor`
- Method: POST
- Interval: Every 30 seconds (or every minute)
- Headers: `Authorization: Bearer YOUR_CRON_SECRET`

**GPS Cleanup:**
- URL: `https://your-domain.com/api/cron/gps-cleanup`
- Method: POST
- Interval: Daily at 2 AM
- Headers: `Authorization: Bearer YOUR_CRON_SECRET`

### Option 3: GitHub Actions (For testing/development)

Create `.github/workflows/gps-cron.yml`:

```yaml
name: GPS Monitoring Cron

on:
  schedule:
    # Every 30 seconds not supported, minimum is 5 minutes
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:  # Manual trigger for testing

jobs:
  gps-monitor:
    runs-on: ubuntu-latest
    steps:
      - name: Call GPS Monitor Endpoint
        run: |
          curl -X POST https://your-domain.com/api/cron/gps-monitor \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"

  gps-cleanup:
    runs-on: ubuntu-latest
    if: github.event.schedule == '0 2 * * *'  # Only at 2 AM
    steps:
      - name: Call GPS Cleanup Endpoint
        run: |
          curl -X POST https://your-domain.com/api/cron/gps-cleanup \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

### Option 4: Self-hosted Node.js Cron

For production deployments with full control:

Create `scripts/gps-cron.js`:

```javascript
const cron = require('node-cron');
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET;

// GPS Monitoring - Every 30 seconds
cron.schedule('*/30 * * * * *', async () => {
  try {
    console.log('[GPS Cron] Running GPS monitoring...');
    const response = await axios.post(
      `${API_URL}/api/cron/gps-monitor`,
      {},
      {
        headers: {
          Authorization: `Bearer ${CRON_SECRET}`,
        },
      }
    );
    console.log('[GPS Cron] Result:', response.data);
  } catch (error) {
    console.error('[GPS Cron] Error:', error.message);
  }
});

// GPS Cleanup - Daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  try {
    console.log('[GPS Cron] Running GPS cleanup...');
    const response = await axios.post(
      `${API_URL}/api/cron/gps-cleanup`,
      {},
      {
        headers: {
          Authorization: `Bearer ${CRON_SECRET}`,
        },
      }
    );
    console.log('[GPS Cron] Result:', response.data);
  } catch (error) {
    console.error('[GPS Cron] Error:', error.message);
  }
});

console.log('GPS cron jobs started');
```

Run with PM2 for production:
```bash
pm2 start scripts/gps-cron.js --name gps-cron
pm2 save
```

## Environment Variables

Add to `.env`:

```bash
# Cron Security Secret
# Generate with: openssl rand -base64 32
CRON_SECRET=your-random-secret-here
```

## Security

The cron endpoints are protected by:
1. **Bearer token authentication** - Requires `CRON_SECRET` in production
2. **IP whitelisting** (optional) - Configure in middleware
3. **Rate limiting** (optional) - Add to prevent abuse

## Testing

### Test GPS Monitoring (Development only)
```bash
# GET is only allowed in development
curl http://localhost:3000/api/cron/gps-monitor
```

### Test GPS Cleanup (Development only)
```bash
curl http://localhost:3000/api/cron/gps-cleanup
```

### Test in Production
```bash
curl -X POST https://your-domain.com/api/cron/gps-monitor \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

curl -X POST https://your-domain.com/api/cron/gps-cleanup \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Monitoring

Monitor cron job execution:

1. **Check logs** in your deployment platform
2. **Application logs** will show:
   ```
   [GPS Monitor] Starting GPS device polling...
   [GPS Monitor] Polling complete: { polled: 10, successful: 10, failed: 0 }
   [GPS Monitor] Found 2 offline trucks with active loads
   [GPS Monitor] Offline alerts triggered
   ```

3. **Create alerts** for failed executions:
   - Cron job didn't run
   - High failure rate in polling
   - Alerts not being sent

## Production Checklist

- [ ] Set `CRON_SECRET` environment variable
- [ ] Configure cron service (Vercel, external, or self-hosted)
- [ ] Test cron endpoints manually
- [ ] Verify GPS monitoring runs every 30 seconds
- [ ] Verify cleanup runs daily
- [ ] Set up monitoring/alerting for cron failures
- [ ] Configure IP whitelisting (optional)
- [ ] Review logs for errors

## Troubleshooting

**Cron jobs not running:**
- Check CRON_SECRET is set correctly
- Verify endpoint URLs are correct
- Check cron service is active
- Review platform logs

**GPS monitoring not detecting offline trucks:**
- Verify `updateAllTruckGpsStatuses()` is running
- Check truck `gpsLastSeenAt` timestamps
- Ensure trucks have active loads

**Cleanup not deleting old positions:**
- Check if positions exist older than 90 days
- Verify database permissions
- Review cleanup job logs

## Performance Considerations

**GPS Monitoring (30 seconds):**
- Each run queries all active GPS devices
- For 100 trucks: ~1-2 seconds execution time
- For 1000 trucks: ~10-15 seconds execution time
- Consider sharding for >1000 trucks

**GPS Cleanup (daily):**
- Deletes all positions older than 90 days
- For 1M positions: ~10-30 seconds
- Runs during low-traffic hours (2 AM)
- No performance impact on users

## Future Enhancements

- WebSocket-based real-time GPS updates (eliminate polling)
- GPS provider webhooks (push instead of poll)
- Geofence alerts (arrival/departure detection)
- Route deviation alerts
- Extended stop detection
- GPS accuracy monitoring
