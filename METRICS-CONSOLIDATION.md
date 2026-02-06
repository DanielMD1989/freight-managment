# Admin Metrics Consolidation

**Date:** 2026-02-06

---

## Summary

Consolidated admin metrics to use a single endpoint: `/api/admin/analytics`

---

## Before: Multiple Endpoints

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `/api/admin/dashboard` | Basic dashboard stats | **DEPRECATED** |
| `/api/admin/analytics` | Comprehensive analytics | **PRIMARY** |

Both endpoints used `lib/admin/metrics.ts` for calculations (single source of truth for logic), but the dashboard page was calling `/api/admin/dashboard` instead of the more comprehensive analytics endpoint.

---

## After: Single Endpoint

### Primary Endpoint: `/api/admin/analytics`

The admin dashboard page now calls `/api/admin/analytics?period=week` as the single source of truth.

**Response Structure:**
```typescript
{
  period: 'day' | 'week' | 'month' | 'year',
  dateRange: { start: Date, end: Date },

  summary: {
    revenue: {
      platformBalance: number,
      serviceFeeCollected: number,
      pendingWithdrawals: number,  // Added
      transactionsInPeriod: number,
      transactionVolume: number,
    },
    trucks: {
      total: number,
      approved: number,
      pending: number,
      available: number,
      unavailable: number,
      newInPeriod: number,
    },
    loads: {
      total: number,
      active: number,
      inProgress: number,
      delivered: number,
      completed: number,
      cancelled: number,
      byStatus: { [status: string]: number },
      newInPeriod: number,
    },
    trips: {
      total: number,
      active: number,
      completed: number,
      cancelled: number,
      byStatus: { [status: string]: number },
    },
    users: {
      total: number,
      newInPeriod: number,
    },
    organizations: {
      total: number,
    },
    disputes: {
      open: number,
      resolvedInPeriod: number,
    },
  },

  charts: {
    loadsOverTime: [...],
    revenueOverTime: [...],
    tripsOverTime: [...],
    loadsByStatus: [{ status, count }],
    slaTrends: [...],
  },

  sla: {
    period: string,
    dateRange: { start, end },
    pickup: { total, onTime, late, rate, avgDelayHours },
    delivery: { total, onTime, late, rate, avgDelayHours },
    cancellation: { total, cancelled, rate },
    exceptions: { total, resolved, open, avgMTTR, ... },
  },
}
```

---

## Changes Made

### 1. Updated Admin Dashboard Page

**File:** `app/admin/page.tsx`

Changed from:
```typescript
const response = await fetch(`${baseUrl}/api/admin/dashboard`, ...)
```

To:
```typescript
const response = await fetch(`${baseUrl}/api/admin/analytics?period=week`, ...)

// Map analytics response to dashboard stats format
return {
  totalUsers: data.summary.users.total,
  totalOrganizations: data.summary.organizations.total,
  // ... etc
};
```

### 2. Added pendingWithdrawals to Analytics

**File:** `app/api/admin/analytics/route.ts`

Added `pendingWithdrawals` to the revenue section:
```typescript
revenue: {
  platformBalance: revenue.platformBalance,
  serviceFeeCollected: revenue.serviceFeeCollected,
  pendingWithdrawals: revenue.pendingWithdrawals,  // Added
  transactionsInPeriod: transactionsInPeriod._count || 0,
}
```

### 3. Deprecated Dashboard Endpoint

**File:** `app/api/admin/dashboard/route.ts`

Added deprecation notice:
```typescript
/**
 * @deprecated Use /api/admin/analytics instead.
 * This endpoint is maintained for backwards compatibility only.
 */
```

---

## Architecture

```
                    ┌─────────────────────────┐
                    │  lib/admin/metrics.ts   │
                    │  (Single Source of      │
                    │   Truth for Logic)      │
                    └───────────┬─────────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
        ┌───────────▼───────────┐   ┌───────▼───────────┐
        │ /api/admin/analytics  │   │ /api/admin/dashboard│
        │    (PRIMARY)          │   │   (DEPRECATED)     │
        └───────────┬───────────┘   └────────────────────┘
                    │
        ┌───────────▼───────────┐
        │  Admin Dashboard Page │
        │   /admin/page.tsx     │
        └───────────────────────┘
```

---

## Files Changed

| File | Change |
|------|--------|
| `app/admin/page.tsx` | Updated to use `/api/admin/analytics` |
| `app/api/admin/analytics/route.ts` | Added `pendingWithdrawals` to response |
| `app/api/admin/dashboard/route.ts` | Added deprecation notice |

---

## Benefits

1. **Single Source of Truth**: One endpoint for all admin metrics
2. **Richer Data**: Analytics includes SLA, charts, period filtering
3. **Consistency**: Dashboard and Analytics page use same data source
4. **Maintainability**: Changes only needed in one place

---

## Verification

1. **Admin Dashboard Loads**
   - Navigate to `/admin`
   - Should display all stats (users, orgs, loads, trucks, revenue, etc.)

2. **Single API Call**
   - Open Network tab in DevTools
   - Refresh `/admin`
   - Should see call to `/api/admin/analytics?period=week`
   - Should NOT see call to `/api/admin/dashboard`

3. **Analytics Page Works**
   - Navigate to `/admin/analytics`
   - Should display same data with charts and period filtering
