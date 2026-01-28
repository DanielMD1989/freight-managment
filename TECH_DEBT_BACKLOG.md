# TECH DEBT BACKLOG

**Project:** Freight Management Platform
**Date:** January 2026
**Status:** Production Ready - Tech Debt Documented

---

## SUMMARY

| Priority | Count | Blocks Production? |
|----------|-------|-------------------|
| Medium | 0 | No |
| Low | 0 | No |
| **Total** | **0** | **No** |

**Completed:** 15 (TD-001 to TD-015 - All items resolved)

---

## MEDIUM PRIORITY (Fix in Sprint 2-3)

### Transaction Safety (4 items)

| ID | File | Issue | Impact | Effort |
|----|------|-------|--------|--------|
| TD-001 | `app/api/dispatch/route.ts:150-189` | Multiple load.update + loadEvent.create not in transaction | Partial update on error | 1 hour |
| TD-002 | `app/api/trips/[tripId]/gps/route.ts:124-177` | GPS device, truck, trip, position updates not atomic | GPS data inconsistency on error | 2 hours |
| TD-003 | `app/api/gps/positions/route.ts:194-224` | POST: gpsPosition + gpsDevice + truck not atomic | GPS data inconsistency on error | 1 hour |
| TD-004 | `app/api/loads/[id]/escalations/route.ts:83-156` | Escalation + loadEvent + load.update not atomic | Escalation state inconsistency | 1 hour |

**Fix Pattern:**
```typescript
await db.$transaction(async (tx) => {
  // All updates inside here
});
```

---

### Cache Invalidation (5 items)

| ID | File | Issue | Impact | Effort |
|----|------|-------|--------|--------|
| TD-005 | `app/api/dispatch/route.ts` | Missing CacheInvalidation after assignment | Stale load list for ~30s | 15 min |
| TD-006 | `app/api/loads/[id]/escalations/route.ts` | Missing CacheInvalidation after EXCEPTION | Stale status for ~30s | 15 min |
| TD-007 | `app/api/loads/[id]/pod/route.ts` | Missing CacheInvalidation after POD | Stale POD status | 15 min |
| TD-008 | `app/api/trips/[tripId]/pod/route.ts` | Missing CacheInvalidation after POD | Stale POD status | 15 min |
| TD-009 | `app/api/loads/[id]/duplicate/route.ts` | Missing CacheInvalidation after create | New load not in list | 15 min |

**Fix Pattern:**
```typescript
// After mutation:
await CacheInvalidation.load(loadId, organizationId);
```

---

### Infrastructure Stubs (3 items)

| ID | File | Issue | Impact | Effort |
|----|------|-------|--------|--------|
| TD-010 | `lib/email.ts:167,172` | SendGrid/SES not implemented | Emails go to console only | 4 hours |
| TD-011 | `lib/bypassWarnings.ts:221` | SMS service not integrated | SMS not sent | 4 hours |
| TD-012 | `lib/errorHandler.ts:382` | Error tracking not integrated | No Sentry/Datadog alerts | 2 hours |

**Notes:**
- Console fallback works for development
- Production needs real email/SMS for notifications
- Error tracking critical for monitoring production issues

---

## LOW PRIORITY (Fix When Time Permits)

| ID | File | Issue | Status |
|----|------|-------|--------|
| TD-013 | `mobile/` (10 files) | Unused imports | ✅ Done - Removed unused imports |
| TD-014 | `lib/db.ts` | Measure pool acquire time | ✅ Done - Added timedConnect() method |
| TD-015 | `lib/security.ts` | Store audit in database | ✅ Done - Stores in SecurityEvent table |

---

## SPRINT PLANNING RECOMMENDATION

**All tech debt items have been resolved in Sprint 1!**

### Completed in Sprint 1
- [x] TD-001 to TD-004: Transaction safety (wrapped in db.$transaction)
- [x] TD-005 to TD-009: Cache invalidation (added CacheInvalidation calls)
- [x] TD-010: Email service (SendGrid/SES providers implemented)
- [x] TD-011: SMS service (Twilio provider implemented)
- [x] TD-012: Error tracking (Sentry integration added)
- [x] TD-013: Unused imports cleanup (10 mobile files cleaned)
- [x] TD-014: DB pool metrics (timedConnect with acquire time measurement)
- [x] TD-015: Audit trail persistence (stores in SecurityEvent table)

---

## QUICK FIX REFERENCE

### Adding Transaction
```typescript
// Before
const load = await db.load.update({ ... });
const event = await db.loadEvent.create({ ... });

// After
const result = await db.$transaction(async (tx) => {
  const load = await tx.load.update({ ... });
  const event = await tx.loadEvent.create({ ... });
  return { load, event };
});
```

### Adding Cache Invalidation
```typescript
// After any mutation:
await CacheInvalidation.load(loadId, organizationId);
await CacheInvalidation.truck(truckId, organizationId);
await CacheInvalidation.trip(tripId);
```

### Adding SendGrid
```typescript
// lib/email.ts
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendEmail(to, subject, html) {
  await sgMail.send({ to, from: 'noreply@yourapp.com', subject, html });
}
```

### Adding Sentry
```typescript
// lib/errorHandler.ts
import * as Sentry from '@sentry/nextjs';
Sentry.init({ dsn: process.env.SENTRY_DSN });

// In error handler:
Sentry.captureException(error);
```

---

## TRACKING

| ID | Status | Assigned | Sprint | Completed |
|----|--------|----------|--------|-----------|
| TD-001 | ✅ Done | Claude | Sprint 1 | 2026-01-28 |
| TD-002 | ✅ Done | Claude | Sprint 1 | 2026-01-28 |
| TD-003 | ✅ Done | Claude | Sprint 1 | 2026-01-28 |
| TD-004 | ✅ Done | Claude | Sprint 1 | 2026-01-28 |
| TD-005 | ✅ Done | Claude | Sprint 1 | 2026-01-28 |
| TD-006 | ✅ Done | Claude | Sprint 1 | 2026-01-28 |
| TD-007 | ✅ Done | Claude | Sprint 1 | 2026-01-28 |
| TD-008 | ✅ Done | Claude | Sprint 1 | 2026-01-28 |
| TD-009 | ✅ Done | Claude | Sprint 1 | 2026-01-28 |
| TD-010 | ✅ Done | Claude | Sprint 1 | 2026-01-28 |
| TD-011 | ✅ Done | Claude | Sprint 1 | 2026-01-28 |
| TD-012 | ✅ Done | Claude | Sprint 1 | 2026-01-28 |
| TD-013 | ✅ Done | Claude | Sprint 1 | 2026-01-28 |
| TD-014 | ✅ Done | Claude | Sprint 1 | 2026-01-28 |
| TD-015 | ✅ Done | Claude | Sprint 1 | 2026-01-28 |

---

## DEFINITION OF DONE

For each tech debt item:
- [ ] Code changed
- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] Tested manually
- [ ] PR reviewed
- [ ] Merged to main
- [ ] Status updated in this document
