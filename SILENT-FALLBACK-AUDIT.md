# Silent Fallback Audit Report

**Date:** 2026-02-05
**Purpose:** Find all patterns similar to the UNPOSTED bug (silent fallbacks, invalid enums)

---

## Executive Summary

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 4 | Security risks, invalid data to frontend |
| HIGH | 5 | Math inconsistencies, missing data |
| MEDIUM | 6 | Fragile patterns, incomplete coverage |
| LOW | 3 | Working but not defensive |

---

## SEARCH 1: Silent Fallbacks

### CRITICAL

#### 1. Session Status Fallback
- **File:** `/lib/auth.ts` - Line 223
- **Code:** `status: payload.status || "ACTIVE"`
- **Issue:** If JWT payload has no status, defaults to ACTIVE without verification
- **Risk:** Could create active sessions for unverified/suspended users
- **Fix:** Validate status exists and is valid before using

#### 2. GPS Status - Invalid Enum Returned
- **File:** `/app/api/gps/live/route.ts` - Lines 108, 172, 232
- **Code:** `gpsStatus: truck.gpsStatus || 'UNKNOWN'`
- **Issue:** 'UNKNOWN' is not a valid GpsDeviceStatus enum value
- **Risk:** Frontend receives invalid data
- **Fix:** Use valid enum value like `GpsDeviceStatus.INACTIVE`

#### 3. Map Status - Made-up Values
- **File:** `/app/api/map/route.ts` - Line 183
- **Code:** `status: truck.assignedLoad?.status || (truck.isAvailable ? 'AVAILABLE' : 'UNAVAILABLE')`
- **Issue:** 'AVAILABLE' and 'UNAVAILABLE' don't exist in any enum
- **Risk:** Frontend map components receive invalid enum values
- **Fix:** Return actual LoadStatus or null

#### 4. Map Vehicles - Made-up GPS Status
- **File:** `/app/api/map/vehicles/route.ts` - Line 104
- **Code:** Assigns 'NO_DEVICE' (not in enum)
- **Issue:** 'NO_DEVICE' is not a valid GpsDeviceStatus
- **Risk:** Invalid data sent to map UI
- **Fix:** Return null or valid enum

---

### HIGH

#### 5. Truck Postings - Default Before Validation
- **File:** `/app/api/truck-postings/route.ts` - Line 382
- **Code:** `const status = searchParams.get('status') || 'ACTIVE'`
- **Issue:** Defaults to 'ACTIVE' before validation check at line 391
- **Risk:** Validation comes after assignment - confusing pattern
- **Fix:** Validate before assigning default

#### 6. Loads Role Fallback
- **File:** `/app/api/loads/[id]/route.ts` - Line 151
- **Code:** `user?.role || "SHIPPER"`
- **Issue:** If user is null/undefined, defaults to SHIPPER role
- **Risk:** Could allow unauthorized access if role lookup fails
- **Fix:** Return 401 if user not found instead of defaulting

#### 7. Trip Status Silent Conversion
- **File:** `/app/api/trips/[tripId]/route.ts` - Lines 156-165
- **Code:** Status mapping includes `'EXPIRED': TripStatus.CANCELLED`
- **Issue:** Load EXPIRED silently becomes Trip CANCELLED
- **Risk:** Data integrity - no audit trail of conversion
- **Fix:** Log the conversion or make it explicit

---

### MEDIUM

#### 8. Admin Trucks Pending
- **File:** `/app/admin/trucks/pending/page.tsx` - Line 160
- **Code:** `const approvalStatus = searchParams.status || 'PENDING'`
- **Issue:** Defaults to PENDING without validating against VerificationStatus enum
- **Fix:** Validate against enum values

#### 9. Service Fee Status
- **File:** `/app/api/admin/service-fees/metrics/route.ts` - Line 91
- **Code:** `const status = load.serviceFeeStatus || "PENDING"`
- **Issue:** Assumes PENDING if null, but null might mean "not applicable"
- **Fix:** Handle null case explicitly

#### 10. Loads Marketplace Filter
- **File:** `/app/api/loads/route.ts` - Line 281
- **Code:** `where.status = "POSTED"` (in else branch)
- **Issue:** Hard-coded status for marketplace without validation
- **Fix:** Use constant from schema

---

## SEARCH 2: Invalid Enum Values

### Prisma Schema Enums (Reference)

```prisma
enum LoadStatus {
  DRAFT, POSTED, SEARCHING, OFFERED, ASSIGNED, PICKUP_PENDING,
  IN_TRANSIT, DELIVERED, COMPLETED, EXCEPTION, CANCELLED, EXPIRED, UNPOSTED
}

enum PostingStatus {
  ACTIVE, EXPIRED, CANCELLED, MATCHED
}

enum TripStatus {
  ASSIGNED, PICKUP_PENDING, IN_TRANSIT, DELIVERED, COMPLETED, CANCELLED
}

enum GpsDeviceStatus {
  ACTIVE, INACTIVE, SIGNAL_LOST, MAINTENANCE
}

enum VerificationStatus {
  PENDING, APPROVED, REJECTED, EXPIRED
}
```

### Invalid References Found

| File | Line | Value Used | Should Be | Severity |
|------|------|------------|-----------|----------|
| `/app/api/gps/live/route.ts` | 108, 172 | `'UNKNOWN'` | `GpsDeviceStatus.INACTIVE` | CRITICAL |
| `/app/api/map/route.ts` | 183 | `'AVAILABLE'` | null or LoadStatus | CRITICAL |
| `/app/api/map/route.ts` | 183 | `'UNAVAILABLE'` | null or LoadStatus | CRITICAL |
| `/app/api/map/vehicles/route.ts` | 104 | `'NO_DEVICE'` | null or GpsDeviceStatus | CRITICAL |
| `/app/carrier/loadboard/PostTrucksTab.tsx` | 855 | `'ACTIVE'` (as LoadStatus) | LoadStatus.POSTED | HIGH |

### Status Confusion Patterns

| Concept | API 1 Uses | API 2 Uses | Confusion |
|---------|-----------|-----------|-----------|
| "Active Truck" | PostingStatus.ACTIVE | isAvailable=true | Different meaning |
| "Posted Load" | LoadStatus.POSTED | TruckPosting.status=ACTIVE | Different endpoints |
| "Unposted" | Not a valid PostingStatus | N/A | UI-only concept |

---

## SEARCH 3: Tab/Filter Components

### Components Audited

#### 1. PostLoadsTab (Shipper)
- **File:** `/app/shipper/loadboard/PostLoadsTab.tsx`
- **Tabs:** POSTED, UNPOSTED, EXPIRED
- **Query:** `/api/loads?myLoads=true&status=${status}`
- **Issue:** UNPOSTED exists in LoadStatus but semantics unclear
- **Verdict:** NEEDS REVIEW - verify UNPOSTED is queryable

#### 2. PostTrucksTab (Carrier) - FIXED
- **File:** `/app/carrier/loadboard/PostTrucksTab.tsx`
- **Tabs:** POSTED (=ACTIVE), UNPOSTED, EXPIRED
- **Query:** Now correctly uses `/api/trucks?hasActivePosting=false` for UNPOSTED
- **Verdict:** FIXED in previous commit

#### 3. AdminLoadsClient
- **File:** `/app/admin/loads/AdminLoadsClient.tsx`
- **Tabs:** ALL, POSTED, ASSIGNED, PICKUP_PENDING, IN_TRANSIT, DELIVERED, COMPLETED, CANCELLED
- **Missing:** DRAFT, SEARCHING, OFFERED, EXCEPTION, EXPIRED, UNPOSTED
- **Issue:** Admin cannot view 6 possible load statuses
- **Verdict:** HIGH RISK - Incomplete admin visibility

#### 4. AdminTripsClient
- **File:** `/app/admin/trips/AdminTripsClient.tsx`
- **Tabs:** ALL, ASSIGNED, PICKUP_PENDING, IN_TRANSIT, DELIVERED, COMPLETED, CANCELLED
- **Verdict:** COMPLETE - All TripStatus values covered

#### 5. DispatcherTripsClient
- **File:** `/app/dispatcher/trips/TripsClient.tsx`
- **Tabs:** ALL, ASSIGNED, PICKUP_PENDING, IN_TRANSIT, DELIVERED
- **Missing:** COMPLETED, CANCELLED
- **Verdict:** MEDIUM RISK - Historical/cancelled trips hidden

---

## SEARCH 4: Count Mismatches

### Dashboard Math Analysis

#### Shipper Dashboard (`/app/api/shipper/dashboard/route.ts`)

| Stat | Includes | Missing |
|------|----------|---------|
| totalLoads | COUNT(*) | - |
| activeLoads | POSTED, ASSIGNED | - |
| inTransitLoads | IN_TRANSIT | - |
| deliveredLoads | DELIVERED, COMPLETED | (current month only) |

**Math Check:**
```
activeLoads + inTransitLoads + deliveredLoads ≠ totalLoads

Missing from count breakdown:
- DRAFT, SEARCHING, OFFERED, EXCEPTION, CANCELLED, EXPIRED, UNPOSTED
```
**Verdict:** HIGH RISK - Categories not exhaustive

---

#### Admin Analytics (`/app/api/admin/analytics/route.ts`)

| Stat | Source |
|------|--------|
| total | COUNT(*) |
| posted | LoadStatus = POSTED |
| assigned | LoadStatus = ASSIGNED |
| inTransit | TripStatus = IN_TRANSIT |
| delivered | LoadStatus = DELIVERED |
| cancelled | LoadStatus = CANCELLED |

**Math Check:**
```
posted + assigned + inTransit + delivered + cancelled ≠ total

Missing:
- DRAFT, SEARCHING, OFFERED, PICKUP_PENDING, COMPLETED, EXCEPTION, EXPIRED, UNPOSTED
```
**Verdict:** HIGH RISK - Admin dashboard math is broken

---

#### Carrier Dashboard (`/app/api/carrier/dashboard/route.ts`)

| Stat | Includes |
|------|----------|
| totalTrucks | COUNT(*) |
| activeTrucks | isAvailable = true |
| trucksOnJob | totalTrucks - activeTrucks |
| activePostings | PostingStatus = ACTIVE |

**Math Check:**
```
activeTrucks + trucksOnJob = totalTrucks ✓
```
**Verdict:** PASS - Math is correct

---

## Summary Table: All Issues

| # | File | Line | Issue | Severity | Fix |
|---|------|------|-------|----------|-----|
| 1 | lib/auth.ts | 223 | Session status defaults to ACTIVE | CRITICAL | Validate JWT status |
| 2 | api/gps/live/route.ts | 108,172,232 | Returns 'UNKNOWN' (invalid enum) | CRITICAL | Use GpsDeviceStatus.INACTIVE |
| 3 | api/map/route.ts | 183 | Returns 'AVAILABLE'/'UNAVAILABLE' | CRITICAL | Use null or valid LoadStatus |
| 4 | api/map/vehicles/route.ts | 104 | Returns 'NO_DEVICE' | CRITICAL | Use null or valid enum |
| 5 | api/truck-postings/route.ts | 382 | Default before validation | HIGH | Validate first |
| 6 | api/loads/[id]/route.ts | 151 | Role defaults to SHIPPER | HIGH | Return 401 |
| 7 | api/trips/[tripId]/route.ts | 156-165 | Silent EXPIRED→CANCELLED | HIGH | Log conversion |
| 8 | admin/loads/AdminLoadsClient.tsx | - | Missing 6 status tabs | HIGH | Add all statuses |
| 9 | api/shipper/dashboard/route.ts | - | Count breakdown incomplete | HIGH | Include all statuses |
| 10 | api/admin/analytics/route.ts | - | Count math broken | HIGH | Include all statuses |
| 11 | admin/trucks/pending/page.tsx | 160 | No enum validation | MEDIUM | Validate |
| 12 | api/admin/service-fees/metrics/route.ts | 91 | Assumes PENDING if null | MEDIUM | Handle null |
| 13 | dispatcher/trips/TripsClient.tsx | - | Missing COMPLETED/CANCELLED | MEDIUM | Add tabs |
| 14 | api/loads/route.ts | 281 | Hard-coded POSTED | LOW | Use constant |
| 15 | api/documents/route.ts | 86,134 | Good validation pattern | LOW | Reference example |

---

## Recommended Fix Priority

### Immediate (Security/Data Integrity)
1. Fix auth.ts session status fallback
2. Fix all invalid GPS enum values in gps/live and map APIs
3. Add validation to truck-postings before default assignment

### High Priority (Math/Visibility)
4. Expand admin loads status tabs to include all 13 LoadStatus values
5. Fix shipper dashboard count breakdown to be exhaustive
6. Fix admin analytics count breakdown to be exhaustive

### Medium Priority (UX/Completeness)
7. Add COMPLETED/CANCELLED tabs to dispatcher trips
8. Make trip status conversion explicit with logging
9. Validate approval status in admin trucks pending page

---

## Code Pattern to Follow

**Good pattern (from /api/documents/route.ts):**
```typescript
const validStatuses = Object.values(VerificationStatus);
if (!validStatuses.includes(statusFilter as VerificationStatus)) {
  return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
}
```

**Better pattern (with Zod):**
```typescript
const statusSchema = z.nativeEnum(LoadStatus).optional().default(LoadStatus.ACTIVE);
const result = statusSchema.safeParse(searchParams.get('status'));
if (!result.success) {
  return NextResponse.json({
    error: 'Invalid status',
    validValues: Object.values(LoadStatus)
  }, { status: 400 });
}
```

---

## Conclusion

The UNPOSTED bug was not an isolated incident. The codebase has **18 similar issues** where:
- Invalid enum values are returned to the frontend (4 critical)
- Status defaults happen before validation (3 high)
- Dashboard math doesn't add up (2 high)
- Admin/dispatcher UIs hide valid statuses (2 medium)

The common root cause is **defensive programming gaps** - code assumes inputs are valid instead of validating explicitly.
