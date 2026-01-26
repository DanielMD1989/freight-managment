# Endpoint Rate Limiting Matrix

**Date:** 2026-01-23
**Status:** IMPLEMENTATION PLAN
**Total Endpoints:** 169
**Currently Protected:** 13 (7.7%)
**Target:** 100%

---

## Executive Summary

This document provides a comprehensive matrix of all API endpoints with their required rate limiting configurations. The current coverage is critically low at 7.7%, leaving the system vulnerable to abuse and DoS attacks.

---

## Rate Limit Tiers

| Tier | Name | RPS | Burst | Per-User/Hour | Description |
|------|------|-----|-------|---------------|-------------|
| T1 | Auth | 10 | 5 | 5/15min | Authentication endpoints |
| T2 | Strict | 20 | 10 | 100/hour | Sensitive operations |
| T3 | Standard | 50 | 20 | 500/hour | Normal API operations |
| T4 | Elevated | 100 | 30 | 1000/hour | Read-heavy endpoints |
| T5 | High | 100 | 50 | 2000/hour | Health checks, GPS |
| T6 | Admin | 10 | 5 | 50/hour | Admin-only endpoints |

---

## Complete Endpoint Matrix

### 1. AUTHENTICATION (/api/auth/*) - T1

| Endpoint | Method | Current | Required | Priority |
|----------|--------|---------|----------|----------|
| `/api/auth/login` | POST | HAS (5/15min) | 5/15min | - |
| `/api/auth/register` | POST | HAS (5/15min) | 5/15min | - |
| `/api/auth/forgot-password` | POST | HAS (3/hour) | 3/hour | - |
| `/api/auth/reset-password` | POST | NONE | 5/hour | P1 |
| `/api/auth/verify-mfa` | POST | NONE | 10/15min | P1 |
| `/api/auth/logout` | POST | NONE | 50/hour | P2 |
| `/api/auth/me` | GET | NONE | 100/hour | P2 |

**Implementation Notes:**
- Reset password and MFA verification are critical security endpoints
- Must have strict limits to prevent brute force attacks

---

### 2. GPS & TRACKING (/api/gps/*) - T5

| Endpoint | Method | Current | Required | Priority |
|----------|--------|---------|----------|----------|
| `/api/gps/position` | POST | NONE | 12/hour/truck | P1 |
| `/api/gps/batch` | POST | NONE | 6/hour/truck | P1 |
| `/api/gps/positions` | POST | HAS (12/hour) | 12/hour/truck | - |
| `/api/gps/positions` | GET | NONE | 100/hour | P2 |
| `/api/gps/live` | GET | NONE | 200/hour | P2 |
| `/api/gps/history` | GET | NONE | 50/hour | P2 |
| `/api/gps/eta` | GET | NONE | 100/hour | P2 |
| `/api/gps/devices` | GET | NONE | 100/hour | P3 |
| `/api/gps/devices` | POST | NONE | 20/hour | P2 |
| `/api/gps/devices/[id]` | GET | NONE | 100/hour | P3 |
| `/api/gps/devices/[id]/verify` | POST | NONE | 10/hour | P2 |

**Implementation Notes:**
- GPS endpoints are high-volume, need per-truck rate limiting
- Batch endpoint should have lower limit since it handles multiple updates

---

### 3. LOADS/MARKETPLACE (/api/loads/*) - T3

| Endpoint | Method | Current | Required | Priority |
|----------|--------|---------|----------|----------|
| `/api/loads` | GET | HAS (50 RPS) | 50 RPS | - |
| `/api/loads` | POST | HAS (50 RPS) | 100/day/org | P1 |
| `/api/loads/[id]` | GET | HAS (50 RPS) | 50 RPS | - |
| `/api/loads/[id]` | PATCH | HAS (50 RPS) | 200/hour | - |
| `/api/loads/[id]` | DELETE | NONE | 50/hour | P2 |
| `/api/loads/[id]/tracking` | GET | NONE | 200/hour | P3 |
| `/api/loads/[id]/status` | PATCH | NONE | 100/hour | P2 |
| `/api/loads/[id]/assign` | POST | NONE | 100/hour | P2 |
| `/api/loads/[id]/settle` | POST | NONE | 50/hour | P1 |
| `/api/loads/[id]/progress` | GET | NONE | 200/hour | P3 |
| `/api/loads/[id]/live-position` | GET | NONE | 200/hour | P3 |
| `/api/loads/[id]/matching-trucks` | GET | NONE | 30/min | P1 |
| `/api/loads/[id]/next-loads` | GET | NONE | 30/min | P2 |
| `/api/loads/[id]/escalations` | GET | NONE | 100/hour | P3 |
| `/api/loads/[id]/escalations` | POST | NONE | 20/hour | P2 |
| `/api/loads/[id]/duplicate` | POST | NONE | 50/hour | P2 |
| `/api/loads/[id]/check-exceptions` | POST | NONE | 50/hour | P3 |
| `/api/loads/[id]/service-fee` | GET | NONE | 100/hour | P3 |
| `/api/loads/[id]/reference-pricing` | GET | NONE | 100/hour | P3 |
| `/api/loads/[id]/report-bypass` | POST | NONE | 10/hour | P1 |
| `/api/loads/[id]/gps-history` | GET | NONE | 50/hour | P3 |
| `/api/loads/[id]/documents` | GET | NONE | 100/hour | P3 |
| `/api/loads/[id]/documents` | POST | NONE | 20/hour | P2 |
| `/api/loads/[id]/documents/[docId]/download` | GET | NONE | 100/hour | P3 |
| `/api/loads/[id]/pod` | GET | NONE | 100/hour | P3 |
| `/api/return-loads` | POST | NONE | 50/hour | P2 |

**Implementation Notes:**
- Matching trucks is expensive query, needs strict limit
- Settle endpoint handles financial operations, needs audit logging

---

### 4. TRUCKS/FLEET (/api/trucks/*) - T3

| Endpoint | Method | Current | Required | Priority |
|----------|--------|---------|----------|----------|
| `/api/trucks` | GET | HAS (50 RPS) | 50 RPS | - |
| `/api/trucks` | POST | HAS (50 RPS) | 100/day/org | P1 |
| `/api/trucks/[id]` | GET | HAS (50 RPS) | 50 RPS | - |
| `/api/trucks/[id]` | PATCH | HAS (50 RPS) | 200/hour | - |
| `/api/trucks/[id]` | DELETE | HAS (50 RPS) | 50/hour | - |
| `/api/trucks/[id]/approve` | POST | NONE | 100/hour | P2 |
| `/api/trucks/[id]/position` | GET | NONE | 200/hour | P3 |
| `/api/trucks/[id]/history` | GET | NONE | 50/hour | P2 |
| `/api/trucks/[id]/location` | GET | NONE | 200/hour | P3 |
| `/api/trucks/[id]/nearby-loads` | GET | NONE | 30/min | P1 |
| `/api/truck-postings` | GET | NONE | 50 RPS | P2 |
| `/api/truck-postings` | POST | HAS (100/day) | 100/day | - |
| `/api/truck-postings/[id]` | GET | NONE | 50 RPS | P2 |
| `/api/truck-postings/[id]` | PATCH | NONE | 200/hour | P2 |
| `/api/truck-postings/[id]/duplicate` | POST | NONE | 50/hour | P2 |
| `/api/truck-postings/[id]/matching-loads` | GET | NONE | 30/min | P1 |
| `/api/truck-requests` | POST | NONE | 50/hour | P2 |

**Implementation Notes:**
- Nearby loads is expensive geospatial query
- Matching loads needs same limit as matching trucks

---

### 5. TRIPS (/api/trips/*) - T3

| Endpoint | Method | Current | Required | Priority |
|----------|--------|---------|----------|----------|
| `/api/trips` | GET | NONE | 50 RPS | P2 |
| `/api/trips` | POST | NONE | 100/hour | P2 |
| `/api/trips/[tripId]` | GET | NONE | 50 RPS | P2 |
| `/api/trips/[tripId]` | PATCH | NONE | 200/hour | P2 |
| `/api/trips/[tripId]/gps` | POST | HAS (12/hour) | 12/hour/truck | - |
| `/api/trips/[tripId]/history` | GET | NONE | 50/hour | P3 |
| `/api/trips/[tripId]/live` | GET | NONE | 200/hour | P3 |
| `/api/trips/[tripId]/cancel` | POST | NONE | 50/hour | P2 |
| `/api/trips/[tripId]/confirm` | POST | NONE | 100/hour | P2 |
| `/api/trips/[tripId]/pod` | POST | NONE | 20/hour | P2 |

---

### 6. NOTIFICATIONS (/api/notifications/*) - T4

| Endpoint | Method | Current | Required | Priority |
|----------|--------|---------|----------|----------|
| `/api/notifications` | GET | NONE | 60/min | P2 |
| `/api/notifications/[id]/read` | POST | NONE | 200/hour | P3 |
| `/api/notifications/mark-all-read` | POST | NONE | 30/hour | P3 |

---

### 7. DOCUMENTS & UPLOADS - T2

| Endpoint | Method | Current | Required | Priority |
|----------|--------|---------|----------|----------|
| `/api/documents` | GET | NONE | 100/hour | P3 |
| `/api/documents/[id]` | GET | NONE | 100/hour | P3 |
| `/api/documents` | POST | NONE | 20/hour | P2 |
| `/api/documents/upload` | POST | HAS (10/hour) | 10/hour | - |
| `/api/uploads/[...path]` | GET | HAS (100/hour) | 100/hour | - |

---

### 8. ADMIN (/api/admin/*) - T6

| Endpoint | Method | Current | Required | Priority |
|----------|--------|---------|----------|----------|
| `/api/admin/dashboard` | GET | NONE | 30/hour | P2 |
| `/api/admin/analytics` | GET | NONE | 20/hour | P1 |
| `/api/admin/platform-metrics` | GET | NONE | 30/hour | P2 |
| `/api/admin/audit-logs` | GET | NONE | 50/hour | P1 |
| `/api/admin/audit-logs/stats` | GET | NONE | 50/hour | P2 |
| `/api/admin/settlements` | GET | NONE | 50/hour | P2 |
| `/api/admin/settlements/[id]/approve` | POST | NONE | 50/hour | P1 |
| `/api/admin/users` | GET | NONE | 50/hour | P2 |
| `/api/admin/users/[id]` | GET | NONE | 100/hour | P3 |
| `/api/admin/users/[id]` | PATCH | NONE | 50/hour | P2 |
| `/api/admin/users/[id]/verify` | POST | NONE | 50/hour | P2 |
| `/api/admin/verification/queue` | GET | NONE | 50/hour | P2 |
| `/api/admin/verification/[id]` | GET | NONE | 100/hour | P3 |
| `/api/admin/verification/[id]` | PATCH | NONE | 50/hour | P2 |
| `/api/admin/bypass-warnings` | POST | NONE | 20/hour | P1 |
| `/api/admin/bypass-warnings/organizations` | GET | NONE | 50/hour | P2 |
| `/api/admin/bypass-warnings/organizations` | POST | NONE | 20/hour | P1 |
| `/api/admin/documents` | GET | NONE | 50/hour | P2 |
| `/api/admin/documents` | POST | NONE | 20/hour | P2 |
| `/api/admin/activate-test-users` | POST | NONE | 10/hour | P1 |
| `/api/admin/commission-rates` | POST | NONE | 20/hour | P1 |
| `/api/admin/corridors` | GET | NONE | 50/hour | P3 |
| `/api/admin/corridors` | POST | NONE | 20/hour | P2 |
| `/api/admin/corridors/[id]` | GET | NONE | 100/hour | P3 |
| `/api/admin/corridors/[id]` | PATCH | NONE | 50/hour | P2 |
| `/api/admin/organizations/[id]/verify` | POST | NONE | 50/hour | P2 |
| `/api/admin/settings` | POST | NONE | 20/hour | P1 |
| `/api/admin/settlement-automation` | POST | NONE | 10/hour | P1 |
| `/api/admin/service-fees/metrics` | GET | NONE | 30/hour | P2 |

**Implementation Notes:**
- Admin endpoints should have very low limits
- Analytics endpoints are expensive, need strict limits
- Audit logs can be large, limit to prevent export abuse

---

### 9. ORGANIZATIONS (/api/organizations/*) - T2

| Endpoint | Method | Current | Required | Priority |
|----------|--------|---------|----------|----------|
| `/api/organizations` | GET | NONE | 100/hour | P3 |
| `/api/organizations` | POST | NONE | 5/hour | P1 |
| `/api/organizations/me` | GET | NONE | 200/hour | P3 |
| `/api/organizations/[id]` | GET | NONE | 100/hour | P3 |
| `/api/organizations/[id]` | PATCH | NONE | 50/hour | P2 |
| `/api/organizations/members/[id]` | PATCH | NONE | 50/hour | P2 |
| `/api/organizations/invitations` | GET | NONE | 100/hour | P3 |
| `/api/organizations/invitations` | POST | NONE | 20/hour | P2 |
| `/api/organizations/invitations/[id]` | PATCH | NONE | 50/hour | P2 |

**Implementation Notes:**
- Organization creation is sensitive, needs very low limit

---

### 10. USER PROFILE (/api/user/*) - T2

| Endpoint | Method | Current | Required | Priority |
|----------|--------|---------|----------|----------|
| `/api/user/profile` | GET | NONE | 200/hour | P3 |
| `/api/user/profile` | PATCH | NONE | 50/hour | P2 |
| `/api/user/change-password` | POST | NONE | 5/hour | P1 |
| `/api/user/mfa/enable` | POST | HAS (3/hour) | 3/hour | - |
| `/api/user/mfa/disable` | POST | NONE | 3/hour | P1 |
| `/api/user/mfa/verify` | POST | NONE | 10/hour | P1 |
| `/api/user/mfa/recovery-codes` | GET | NONE | 5/hour | P1 |
| `/api/user/notification-preferences` | GET | NONE | 100/hour | P3 |
| `/api/user/notification-preferences` | PATCH | NONE | 50/hour | P2 |
| `/api/user/sessions` | GET | NONE | 50/hour | P2 |
| `/api/user/sessions/[id]` | GET | NONE | 100/hour | P3 |
| `/api/user/sessions/[id]` | DELETE | NONE | 50/hour | P2 |
| `/api/user/sessions/revoke-all` | POST | NONE | 5/hour | P1 |
| `/api/user/security-events` | GET | NONE | 50/hour | P2 |

**Implementation Notes:**
- Password and MFA endpoints are security-critical
- Session management endpoints need protection against abuse

---

### 11. FINANCIAL (/api/wallet/*, /api/financial/*) - T2

| Endpoint | Method | Current | Required | Priority |
|----------|--------|---------|----------|----------|
| `/api/wallet/balance` | GET | NONE | 100/hour | P2 |
| `/api/wallet/transactions` | GET | NONE | 50/hour | P2 |
| `/api/financial/wallet` | GET | NONE | 100/hour | P2 |
| `/api/financial/withdraw` | POST | NONE | 10/hour | P1 |

**Implementation Notes:**
- Withdrawal endpoint is highly sensitive
- Transaction history can be large, limit to prevent export abuse

---

### 12. ESCROW (/api/escrow/*) - T2

| Endpoint | Method | Current | Required | Priority |
|----------|--------|---------|----------|----------|
| `/api/escrow/[loadId]` | GET | NONE | 100/hour | P2 |
| `/api/escrow/[loadId]/hold` | POST | NONE | 50/hour | P1 |
| `/api/escrow/[loadId]/release` | POST | NONE | 50/hour | P1 |
| `/api/escrow/[loadId]/refund` | POST | NONE | 20/hour | P1 |

**Implementation Notes:**
- All escrow operations are financial, need strict limits and audit logging

---

### 13. DISPUTES & EXCEPTIONS - T3

| Endpoint | Method | Current | Required | Priority |
|----------|--------|---------|----------|----------|
| `/api/disputes` | GET | NONE | 100/hour | P3 |
| `/api/disputes` | POST | NONE | 20/hour | P2 |
| `/api/disputes/[id]` | GET | NONE | 100/hour | P3 |
| `/api/disputes/[id]` | PATCH | NONE | 50/hour | P2 |
| `/api/exceptions/monitor` | GET | NONE | 50/hour | P2 |
| `/api/exceptions/analytics` | GET | NONE | 30/hour | P2 |
| `/api/escalations` | GET | NONE | 100/hour | P3 |
| `/api/escalations` | POST | NONE | 20/hour | P2 |
| `/api/escalations/[id]` | GET | NONE | 100/hour | P3 |
| `/api/escalations/[id]` | PATCH | NONE | 50/hour | P2 |

---

### 14. AUTOMATION (/api/automation/*) - T3

| Endpoint | Method | Current | Required | Priority |
|----------|--------|---------|----------|----------|
| `/api/automation/rules` | GET | NONE | 100/hour | P3 |
| `/api/automation/rules` | POST | NONE | 20/hour | P2 |
| `/api/automation/rules/[id]` | GET | NONE | 100/hour | P3 |
| `/api/automation/rules/[id]` | PATCH | NONE | 50/hour | P2 |
| `/api/automation/rules/[id]/execute` | POST | NONE | 10/hour | P1 |
| `/api/automation/executions` | GET | NONE | 100/hour | P3 |
| `/api/automation/monitor` | GET | NONE | 50/hour | P2 |

---

### 15. DISTANCE & ROUTING - T3

| Endpoint | Method | Current | Required | Priority |
|----------|--------|---------|----------|----------|
| `/api/distance` | GET | NONE | 100/hour | P2 |
| `/api/distance/road` | GET | NONE | 100/hour | P2 |
| `/api/distance/batch` | POST | NONE | 50/hour | P1 |
| `/api/distance/dh` | GET | NONE | 100/hour | P2 |
| `/api/corridors/match` | POST | NONE | 30/hour | P1 |
| `/api/corridors/calculate-fee` | POST | NONE | 100/hour | P2 |
| `/api/routes/distance` | GET | NONE | 100/hour | P2 |
| `/api/deadhead/analyze` | POST | NONE | 20/hour | P1 |

**Implementation Notes:**
- Distance calculations may hit external APIs, need rate limiting
- Deadhead analysis is expensive computation

---

### 16. DASHBOARDS & ANALYTICS - T3

| Endpoint | Method | Current | Required | Priority |
|----------|--------|---------|----------|----------|
| `/api/shipper/dashboard` | GET | NONE | 30/hour | P2 |
| `/api/shipper/analytics` | GET | NONE | 20/hour | P2 |
| `/api/carrier/dashboard` | GET | NONE | 30/hour | P2 |
| `/api/carrier/analytics` | GET | NONE | 20/hour | P2 |
| `/api/map` | GET | NONE | 100/hour | P3 |
| `/api/map/trips` | GET | NONE | 100/hour | P3 |
| `/api/map/loads` | GET | NONE | 100/hour | P3 |
| `/api/map/vehicles` | GET | NONE | 100/hour | P3 |

---

### 17. SYSTEM & UTILITIES - T4/T5

| Endpoint | Method | Current | Required | Priority |
|----------|--------|---------|----------|----------|
| `/api/health` | GET | HAS (100 RPS) | 100 RPS | - |
| `/api/config` | GET | NONE | 100/hour | P3 |
| `/api/csrf-token` | GET | NONE | 200/hour | P3 |
| `/api/audit-logs/dispatcher` | GET | NONE | 50/hour | P2 |
| `/api/associations` | GET | NONE | 100/hour | P3 |
| `/api/locations` | GET | NONE | 100/hour | P3 |
| `/api/locations` | POST | NONE | 50/hour | P2 |
| `/api/locations/[id]` | GET | NONE | 100/hour | P3 |
| `/api/locations/[id]` | PATCH | NONE | 50/hour | P2 |
| `/api/tracking/[trackingId]` | GET | NONE | 200/hour | P3 |
| `/api/saved-searches` | GET | NONE | 100/hour | P3 |
| `/api/saved-searches` | POST | NONE | 50/hour | P2 |
| `/api/saved-searches/[id]` | GET | NONE | 100/hour | P3 |
| `/api/saved-searches/[id]` | PATCH | NONE | 50/hour | P2 |
| `/api/feature-flags` | GET | NONE | 200/hour | P3 |
| `/api/feature-flags/[key]` | GET | NONE | 200/hour | P3 |
| `/api/queues` | GET | NONE | 50/hour | P2 |
| `/api/queues/[queue]` | GET | NONE | 50/hour | P2 |
| `/api/monitoring` | GET | NONE | 50/hour | P2 |
| `/api/support/report` | POST | NONE | 10/hour | P2 |

---

### 18. LOAD & TRUCK REQUESTS - T3

| Endpoint | Method | Current | Required | Priority |
|----------|--------|---------|----------|----------|
| `/api/load-requests` | GET | NONE | 100/hour | P3 |
| `/api/load-requests` | POST | NONE | 50/hour | P2 |
| `/api/load-requests/[id]/respond` | POST | NONE | 100/hour | P2 |
| `/api/truck-requests` | GET | NONE | 100/hour | P3 |
| `/api/truck-requests/[id]` | GET | NONE | 100/hour | P3 |
| `/api/truck-requests/[id]` | PATCH | NONE | 50/hour | P2 |
| `/api/truck-requests/[id]/respond` | POST | NONE | 100/hour | P2 |
| `/api/truck-requests/[id]/cancel` | POST | NONE | 50/hour | P2 |

---

### 19. MATCH PROPOSALS - T3

| Endpoint | Method | Current | Required | Priority |
|----------|--------|---------|----------|----------|
| `/api/match-proposals` | GET | NONE | 100/hour | P3 |
| `/api/match-proposals` | POST | NONE | 50/hour | P2 |
| `/api/match-proposals/[id]/respond` | POST | NONE | 100/hour | P2 |

---

### 20. CRON ENDPOINTS - Special

| Endpoint | Method | Current | Required | Priority |
|----------|--------|---------|----------|----------|
| `/api/cron/auto-settle` | GET | NONE | IP whitelist | P1 |
| `/api/cron/expire-loads` | GET | NONE | IP whitelist | P1 |
| `/api/cron/expire-postings` | GET | NONE | IP whitelist | P1 |
| `/api/cron/gps-cleanup` | GET | NONE | IP whitelist | P1 |
| `/api/cron/gps-monitor` | GET | NONE | IP whitelist | P1 |

**Implementation Notes:**
- Cron endpoints should be protected by IP whitelist (Vercel, AWS Lambda IPs)
- Should not be publicly accessible

---

## WebSocket Events Rate Limiting

| Event | Current | Required | Priority |
|-------|---------|----------|----------|
| `authenticate` | NONE | 5/min/IP | P1 |
| `subscribe-trip` | NONE | 30/min | P2 |
| `subscribe-fleet` | NONE | 10/min | P2 |
| `subscribe-all-gps` | NONE | 5/min | P1 |
| `ping` | NONE | 60/min | P3 |

---

## Implementation Priority Summary

| Priority | Count | Description |
|----------|-------|-------------|
| P1 | 38 | Critical - Security/Financial endpoints |
| P2 | 78 | High - State-changing operations |
| P3 | 40 | Medium - Read operations |
| Done | 13 | Already implemented |
| **Total** | **169** | |

---

## Implementation Plan

### Week 1 (P1 - Critical)

**Day 1-2: Auth & Security**
- `/api/auth/reset-password`
- `/api/auth/verify-mfa`
- `/api/user/change-password`
- `/api/user/mfa/disable`
- `/api/user/mfa/verify`
- `/api/user/mfa/recovery-codes`
- `/api/user/sessions/revoke-all`

**Day 3-4: Financial**
- `/api/financial/withdraw`
- `/api/escrow/[loadId]/hold`
- `/api/escrow/[loadId]/release`
- `/api/escrow/[loadId]/refund`
- `/api/loads/[id]/settle`
- `/api/admin/settlements/[id]/approve`

**Day 5-7: Expensive Operations**
- `/api/loads/[id]/matching-trucks`
- `/api/trucks/[id]/nearby-loads`
- `/api/truck-postings/[id]/matching-loads`
- `/api/deadhead/analyze`
- `/api/distance/batch`
- `/api/corridors/match`
- GPS position endpoints

### Week 2 (P2 - High)

**Day 1-3: Admin Endpoints**
- All `/api/admin/*` state-changing endpoints
- Admin analytics with strict limits

**Day 4-5: User & Organization**
- All `/api/user/*` state-changing endpoints
- All `/api/organizations/*` state-changing endpoints

**Day 6-7: Loads & Trips**
- Remaining `/api/loads/*` endpoints
- All `/api/trips/*` endpoints

### Week 3 (P3 - Medium)

- All remaining read-only endpoints
- WebSocket event throttling
- Cron endpoint IP whitelisting

---

## Rate Limit Helper Code

```typescript
// lib/rateLimit.ts - Add these configurations

// P1: Security-critical operations
export const RATE_LIMIT_SECURITY: RateLimitConfig = {
  name: 'security',
  limit: 5,
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'Too many security-sensitive requests. Please wait.',
};

// P1: Financial operations
export const RATE_LIMIT_FINANCIAL: RateLimitConfig = {
  name: 'financial',
  limit: 10,
  windowMs: 60 * 60 * 1000,
  message: 'Financial operation rate limit exceeded.',
};

// P1: Expensive queries
export const RATE_LIMIT_EXPENSIVE_QUERY: RateLimitConfig = {
  name: 'expensive_query',
  limit: 30,
  windowMs: 60 * 1000, // 1 minute
  message: 'Query rate limit exceeded. Please slow down.',
};

// P2: Standard write operations
export const RATE_LIMIT_WRITE: RateLimitConfig = {
  name: 'write',
  limit: 50,
  windowMs: 60 * 60 * 1000,
  message: 'Write operation rate limit exceeded.',
};

// P3: Read operations
export const RATE_LIMIT_READ: RateLimitConfig = {
  name: 'read',
  limit: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Read rate limit exceeded.',
};

// Admin operations
export const RATE_LIMIT_ADMIN: RateLimitConfig = {
  name: 'admin',
  limit: 50,
  windowMs: 60 * 60 * 1000,
  message: 'Admin rate limit exceeded.',
};
```

---

## Monitoring & Alerts

### Metrics to Track

1. **Rate Limit Hits** - Count of 429 responses per endpoint
2. **Near-Limit Warnings** - Requests at 80%+ of limit
3. **Blocked IPs** - IPs hitting limits repeatedly
4. **Abuse Patterns** - Unusual request patterns

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| 429 responses/min | 100 | 500 |
| Single IP 429s/hour | 10 | 50 |
| Financial endpoint hits | 5 | 20 |
| Auth endpoint failures | 10 | 30 |

---

## Conclusion

Implementing comprehensive rate limiting across all 169 endpoints is critical for:

1. **Security** - Prevent brute force and credential stuffing
2. **Availability** - Protect against DoS attacks
3. **Cost Control** - Limit expensive API calls
4. **Fair Usage** - Ensure all users have access

**Current Coverage:** 7.7% (13/169)
**Target Coverage:** 100% (169/169)
**Estimated Implementation Time:** 3 weeks

---

**Report Generated:** 2026-01-23
**Version:** 1.0
