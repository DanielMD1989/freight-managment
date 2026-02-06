# Single Source of Truth Audit

**Date:** 2026-02-06

---

## Executive Summary

| Category | Issues Found | Severity | Action Required |
|----------|-------------|----------|-----------------|
| Database Queries | 3 major | HIGH | Refactor platform-metrics to use centralized lib |
| Enum Hardcoding | 4 types | MEDIUM-HIGH | Create missing enums, migrate hardcoded strings |
| Duplicate APIs | 2 pairs | MEDIUM | Remove deprecated endpoint, consolidate platform-metrics |
| Business Logic | 4 areas | HIGH | Consolidate fee calc, distance, role checks |
| UI Components | Scattered | LOW | Minor - org-specific data is acceptable |

---

## 1. DATABASE QUERIES - Same Data Calculated Differently

### 1.1 Active Trips Count

| File | Query/Calculation | Uses Centralized? | Issue |
|------|-------------------|-------------------|-------|
| `lib/admin/metrics.ts` | `db.trip.groupBy` for ASSIGNED+PICKUP_PENDING+IN_TRANSIT | N/A (IS the source) | - |
| `app/api/admin/analytics/route.ts` | `getTripMetrics().trips.active` | YES | Correct |
| `app/api/admin/dashboard/route.ts` | `getTripMetrics().trips.active` | YES | Correct |
| `app/api/admin/platform-metrics/route.ts` | `db.load.count({ status: IN ['IN_TRANSIT','PICKUP_PENDING','ASSIGNED'] })` | NO | **WRONG MODEL (Load vs Trip)** |

**Severity:** HIGH - Uses Load model instead of Trip model, will give different counts.

**Fix:** Refactor `platform-metrics` to use `getTripMetrics()` from centralized metrics.

---

### 1.2 Revenue/Platform Balance

| File | Query/Calculation | Uses Centralized? | Same Logic? |
|------|-------------------|-------------------|-------------|
| `lib/admin/metrics.ts` | `PLATFORM_REVENUE` account + `serviceFeeEtb` sum | N/A (IS the source) | - |
| `app/api/admin/analytics/route.ts` | `getRevenueMetrics()` | YES | Correct |
| `app/api/admin/dashboard/route.ts` | `getRevenueMetrics()` | YES | Correct |
| `app/api/admin/platform-metrics/route.ts` | Direct `db.load.aggregate({ _sum: serviceFeeEtb })` | NO | Same logic, different path |
| `app/api/admin/service-fees/metrics/route.ts` | Direct aggregation by status | NO | Specialized (acceptable) |

**Severity:** MEDIUM - Logic is same but bypasses centralized module.

---

### 1.3 User/Load/Truck Counts

| Metric | Centralized Location | Files Using It | Files Bypassing |
|--------|---------------------|----------------|-----------------|
| Total Users | `lib/admin/metrics.ts:getCountMetrics()` | analytics, dashboard | platform-metrics |
| Total Loads | `lib/admin/metrics.ts:getCountMetrics()` | analytics, dashboard | platform-metrics |
| Total Trucks | `lib/admin/metrics.ts:getTruckMetrics()` | analytics, dashboard | platform-metrics |
| Active Loads | `lib/admin/metrics.ts:getLoadMetrics()` | analytics, dashboard | platform-metrics |

**Severity:** MEDIUM - All calculate correctly but platform-metrics should use centralized functions.

---

## 2. ENUM VALUES - Hardcoded in Multiple Places

### 2.1 Load Statuses

| Status | Centralized? | Files with Hardcoded Strings |
|--------|-------------|------------------------------|
| All Load Statuses | `lib/loadStateMachine.ts` has `LoadStatus` enum | 86+ files with hardcoded comparisons |

**Examples of Hardcoding:**

```typescript
// app/api/loads/[id]/route.ts - Line 53
const updateLoadSchema = z.object({
  status: z.enum(["DRAFT", "POSTED", "UNPOSTED", "ASSIGNED", ...])  // HARDCODED
});

// components/StatusUpdateModal.tsx - Line 27
const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'POSTED', label: 'Posted' },
  // ... HARDCODED
];

// app/shipper/loads/LoadManagementClient.tsx
if (load.status === 'ASSIGNED') { ... }  // HARDCODED
```

**Severity:** MEDIUM - Works but maintenance burden; changes require updating 86+ files.

---

### 2.2 Trip Statuses

| Status | Centralized? | Issue |
|--------|-------------|-------|
| ASSIGNED, PICKUP_PENDING, IN_TRANSIT, DELIVERED, COMPLETED, CANCELLED | Prisma schema only | **NO TypeScript enum exists** |

**Severity:** HIGH - No `tripStateMachine.ts` equivalent exists. All trip status checks are hardcoded strings.

**Fix Needed:** Create `lib/tripStateMachine.ts` mirroring load state machine.

---

### 2.3 Verification Statuses

| Status | Centralized? | Issue |
|--------|-------------|-------|
| PENDING, APPROVED, REJECTED, EXPIRED | Prisma schema only | **NO TypeScript enum exists** |

**Severity:** MEDIUM - Used in fewer places than load/trip statuses.

**Fix Needed:** Create `lib/verificationConstants.ts` with enum.

---

### 2.4 User Roles

| Status | Centralized? | Usage |
|--------|-------------|-------|
| ADMIN, SUPER_ADMIN, SHIPPER, CARRIER, DISPATCHER | `lib/rbac/permissions.ts` has `Role` type | Properly centralized |

**Severity:** LOW - Roles are properly typed, but some UI components use string literals.

---

## 3. API ENDPOINTS - Duplicate Data

### 3.1 Admin Dashboard APIs

| Endpoint | Status | Data Returned | Uses Centralized Metrics |
|----------|--------|---------------|-------------------------|
| `/api/admin/dashboard` | **DEPRECATED** | Core metrics | YES |
| `/api/admin/analytics` | **PRIMARY** | Core + SLA + Charts | YES |
| `/api/admin/platform-metrics` | Active (SuperAdmin) | Core + Trust metrics | NO |

**Overlap Analysis:**

| Metric | dashboard | analytics | platform-metrics |
|--------|-----------|-----------|------------------|
| Total Users | ✓ | ✓ | ✓ (duplicate) |
| Total Loads | ✓ | ✓ | ✓ (duplicate) |
| Total Trucks | ✓ | ✓ | ✓ (duplicate) |
| Active Trips | ✓ | ✓ | ✓ (DIFFERENT calc) |
| Revenue | ✓ | ✓ | ✓ (duplicate) |
| SLA Metrics | - | ✓ | - |
| Trust Metrics | - | - | ✓ (unique) |

**Severity:** MEDIUM - Deprecated endpoint maintained for backwards compatibility.

**Fix:**
1. Remove `/api/admin/dashboard` after confirming no usage
2. Refactor `/api/admin/platform-metrics` to use centralized metrics

---

### 3.2 Role-Specific Dashboards

| Endpoint | Scoping | Uses Centralized? | Status |
|----------|---------|-------------------|--------|
| `/api/shipper/dashboard` | Organization-specific | NO (direct queries) | Acceptable |
| `/api/carrier/dashboard` | Organization-specific | NO (direct queries) | Acceptable |

**Severity:** LOW - These are legitimately different perspectives (org-filtered data).

---

## 4. BUSINESS LOGIC - Duplicated Calculations

### 4.1 Fee Calculations (3 duplicates)

| File | Function | Issue |
|------|----------|-------|
| `lib/serviceFeeCalculation.ts` | `calculatePartyFee()`, `calculateFeesFromCorridor()` | **Source of Truth** |
| `app/api/loads/[id]/service-fee/route.ts` | Inline calculation | Duplicates centralized logic |
| `app/api/admin/corridors/[id]/route.ts` | `calculatePartyFeePreview()` (defined TWICE) | Two duplicate functions in same file |
| `app/api/admin/corridors/route.ts` | `previewCorridorFee()` | Another duplicate |

**Severity:** HIGH - Fee calculation logic duplicated 4 times.

**Fix:** Import and use `lib/serviceFeeCalculation.ts` everywhere.

---

### 4.2 Distance Calculations - Haversine (5 duplicates)

| File | Function | Issue |
|------|----------|-------|
| `lib/geo.ts` | `calculateDistanceKm()` | **Source of Truth** |
| `app/api/distance/dh/route.ts` | `haversineDistance()` | Duplicate |
| `app/api/distance/road/route.ts` | `haversineDistance()` | Duplicate |
| `app/api/distance/batch/route.ts` | `haversineDistance()` | Duplicate |
| `app/api/gps/eta/route.ts` | `haversineDistance()` | Duplicate |
| `app/api/truck-postings/[id]/matching-loads/route.ts` | `haversineDistance()` | Duplicate |

**Severity:** HIGH - Same formula implemented 6 times.

**Fix:** Replace all with `import { calculateDistanceKm } from '@/lib/geo'`.

---

### 4.3 Role Check Pattern (40+ duplicates)

| Pattern | Occurrences | Issue |
|---------|-------------|-------|
| `const isShipper = session.role === 'SHIPPER' && ...` | 40+ | Same 4-line block repeated |
| `const isCarrier = session.role === 'CARRIER' && ...` | 40+ | Across 10+ files |
| `const isAdmin = session.role === 'ADMIN' \|\| session.role === 'SUPER_ADMIN'` | 40+ | No helper function |

**Files with Pattern:**
- `app/api/loads/[id]/status/route.ts`
- `app/api/trips/[tripId]/route.ts`
- `app/api/loads/[id]/escalations/route.ts` (duplicated TWICE in same file)
- `app/api/trips/[tripId]/history/route.ts`
- `app/api/trips/[tripId]/gps/route.ts`
- `app/api/trips/[tripId]/live/route.ts`
- `app/api/trips/[tripId]/cancel/route.ts`
- `app/api/loads/[id]/pod/route.ts`
- `app/api/escalations/[id]/route.ts`
- `app/api/disputes/[id]/route.ts`
- ... and 30+ more

**Severity:** CRITICAL - Highest duplication count.

**Fix:** Create helper in `lib/rbac/`:
```typescript
export function getAccessRoles(session: Session, entityOwnerId?: string, carrierOwnerId?: string) {
  return {
    isShipper: session.role === 'SHIPPER' && entityOwnerId === session.organizationId,
    isCarrier: session.role === 'CARRIER' && carrierOwnerId === session.organizationId,
    isDispatcher: session.role === 'DISPATCHER',
    isAdmin: session.role === 'ADMIN' || session.role === 'SUPER_ADMIN',
  };
}
```

---

### 4.4 Status Transition Validation

| File | Uses State Machine? | Issue |
|------|---------------------|-------|
| `lib/loadStateMachine.ts` | N/A (IS the source) | Proper implementation |
| `app/api/loads/[id]/status/route.ts` | YES | Correct |
| `app/api/trips/[tripId]/route.ts` | Partial (`validTransitions` map) | Uses own inline map |
| `app/api/truck-requests/[id]/respond/route.ts` | NO | Inline status checks |
| `app/api/match-proposals/[id]/respond/route.ts` | NO | Inline status checks |

**Severity:** MEDIUM - Load state machine exists but Trip doesn't have equivalent.

---

## 5. UI COMPONENTS - Data Fetching

| Component Type | Issue | Severity |
|----------------|-------|----------|
| Admin Dashboard | Calls single `/api/admin/analytics` | LOW - Correct |
| Shipper Dashboard | Calls `/api/shipper/dashboard` | LOW - Correct |
| Carrier Dashboard | Calls `/api/carrier/dashboard` | LOW - Correct |

**Severity:** LOW - UI components generally fetch from correct endpoints.

---

## Priority Action Items

### P0 - CRITICAL (Do First)

| Issue | Files Affected | Fix |
|-------|---------------|-----|
| Role check pattern duplicated 40+ times | 10+ API routes | Create `getAccessRoles()` helper |
| Active trips uses wrong model | platform-metrics | Change to use Trip model via centralized metrics |

### P1 - HIGH

| Issue | Files Affected | Fix |
|-------|---------------|-----|
| Haversine duplicated 5 times | 5 distance/GPS routes | Import from `lib/geo.ts` |
| Fee calculation duplicated 4 times | 3 API routes | Import from `lib/serviceFeeCalculation.ts` |
| No Trip state machine | All trip status checks | Create `lib/tripStateMachine.ts` |

### P2 - MEDIUM

| Issue | Files Affected | Fix |
|-------|---------------|-----|
| Load status hardcoded in 86+ files | Throughout codebase | Gradual migration to import from loadStateMachine |
| Platform-metrics bypasses centralized metrics | 1 file | Refactor to use `lib/admin/metrics.ts` |
| No verification status enum | ~10 files | Create `lib/verificationConstants.ts` |

### P3 - LOW

| Issue | Files Affected | Fix |
|-------|---------------|-----|
| Deprecated dashboard endpoint | 1 file | Remove after confirming no usage |
| Some UI role string literals | Various components | Low priority - works correctly |

---

## Recommended Refactoring Order

1. **Create `lib/rbac/accessHelpers.ts`** with `getAccessRoles()` function
2. **Refactor distance calculations** to use `lib/geo.ts`
3. **Refactor fee calculations** to use `lib/serviceFeeCalculation.ts`
4. **Create `lib/tripStateMachine.ts`** mirroring loadStateMachine
5. **Refactor `platform-metrics`** to use centralized metrics
6. **Create `lib/verificationConstants.ts`** with VerificationStatus enum
7. **Gradual migration** of hardcoded load status strings (lowest priority)

---

## Appendix: Files Requiring Changes

### Must Change (P0-P1)
- `app/api/admin/platform-metrics/route.ts`
- `app/api/distance/dh/route.ts`
- `app/api/distance/road/route.ts`
- `app/api/distance/batch/route.ts`
- `app/api/gps/eta/route.ts`
- `app/api/truck-postings/[id]/matching-loads/route.ts`
- `app/api/loads/[id]/service-fee/route.ts`
- `app/api/admin/corridors/route.ts`
- `app/api/admin/corridors/[id]/route.ts`

### Should Change (P2)
- All files with role check pattern (40+)
- All files with hardcoded load status comparisons (86+)

### New Files to Create
- `lib/tripStateMachine.ts`
- `lib/verificationConstants.ts`
- `lib/rbac/accessHelpers.ts`
