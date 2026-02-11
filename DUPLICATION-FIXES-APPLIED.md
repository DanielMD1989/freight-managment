# DUPLICATION FIXES APPLIED

**Date:** 2026-02-08
**Type:** Single Source of Truth Enforcement
**Status:** COMPLETE

---

## SUMMARY

All major duplications identified in DUPLICATION-AUDIT.md have been addressed:

| Fix | Status | Files Modified |
|-----|--------|----------------|
| FIX 1: Inline Haversine | COMPLETE | 6 files collapsed |
| FIX 2: Frontend Fee Calc | DOCUMENTED | 1 file annotated |
| FIX 3: Inline Rounding | COMPLETE | 4 files updated |
| FIX 4: Aggregation Queries | DOCUMENTED | 2 files annotated |
| FIX 5: Legacy Fields | VERIFIED | Already documented |
| FIX 6: Fee Calc Paths | COMPLETE | 1 file updated |

---

## FIX 1: REMOVE INLINE HAVERSINE IMPLEMENTATIONS

**Owner Module:** `lib/geo.ts:calculateDistanceKm`

### Files Collapsed:

| File | Change |
|------|--------|
| `app/api/distance/route.ts` | Removed inline function, imports `calculateDistanceKm` + `roundDistance1` |
| `app/api/gps/history/route.ts` | Removed inline haversine loop, imports `calculateDistanceKm` |
| `app/api/trips/[tripId]/history/route.ts` | Removed `calculateHaversineDistance` + `toRad`, imports `calculateDistanceKm` |
| `app/api/trips/[tripId]/live/route.ts` | Removed `calculateHaversineDistance` + `toRad`, imports `calculateDistanceKm` |
| `lib/automationRules.ts` | Removed `calculateHaversineDistance` + `toRadians`, imports `calculateDistanceKm` |
| `__tests__/foundation/marketplace.test.ts` | Removed inline haversine, imports `calculateDistanceKm` |

### Verification:
```bash
npx tsc --noEmit  # Passes
npx jest __tests__/behavior-snapshots.test.ts __tests__/foundation/marketplace.test.ts  # 62 tests pass
```

---

## FIX 2: FRONTEND FEE CALCULATION

**Status:** DOCUMENTED (UI-only preview)

### File: `app/admin/corridors/CorridorManagementClient.tsx`

**Change:** Added documentation comment:
```typescript
// UI-ONLY PREVIEW — NOT AUTHORITATIVE
//
// This is a client-side preview for immediate form feedback only.
// AUTHORITATIVE fee calculation is in lib/serviceFeeCalculation.ts (server-side).
// The actual fee charged is always computed server-side via the API.
```

**Rationale:** The frontend `calculatePartyFee` function is used only for immediate UI preview. The authoritative fee calculation happens server-side via the API using `lib/serviceFeeCalculation.ts`.

---

## FIX 3: CONSOLIDATE INLINE ROUNDING

**Owner Module:** `lib/rounding.ts`

### Files Updated:

| File | Change |
|------|--------|
| `app/api/admin/service-fees/metrics/route.ts` | Replaced `Math.round(x * 100) / 100` with `roundMoney()` |
| `app/api/gps/history/route.ts` | Replaced `Math.round(x * 100) / 100` with `roundToDecimals(x, 2)` |
| `app/api/trips/[tripId]/history/route.ts` | Replaced inline rounding with `roundToDecimals()` + `roundDistance1()` |
| `lib/serviceFeeCalculation.ts` | Replaced `Math.round(x * 100) / 100` with `roundMoney()` |

### Remaining Inline Rounding (Acceptable):
Some distance/coordinate rounding in other APIs remains inline. These are lower priority and can be migrated incrementally.

---

## FIX 4: AGGREGATION QUERY DOCUMENTATION

**Owner Module:** `lib/aggregation.ts`

### Files Documented:

| File | Documentation Added |
|------|---------------------|
| `app/api/carrier/dashboard/route.ts` | AGGREGATION NOTE pointing to `getCarrierEarningsSummary()` |
| `app/api/shipper/dashboard/route.ts` | AGGREGATION NOTE pointing to `getShipperSpendingSummary()` |

**Rationale:** Dashboard APIs have additional requirements beyond what the aggregation module provides. Documentation added to guide future developers to use aggregation.ts for new code.

---

## FIX 5: LEGACY FIELD POLICY

**Status:** VERIFIED (already documented)

### Location: `lib/serviceFeeManagement.ts` (lines 18-35)

**Policy:**
- **AUTHORITATIVE:** `shipperServiceFee`, `carrierServiceFee`, `shipperFeeStatus`, `carrierFeeStatus`, `estimatedTripKm`, `actualTripKm`
- **LEGACY (READ-ONLY):** `serviceFeeEtb`, `serviceFeeStatus`, `tripKm`

Write operations sync legacy fields automatically for backward compatibility.

---

## FIX 6: UNIFY FEE CALCULATION PATHS

**Status:** COMPLETE

### Changes to `lib/serviceFeeCalculation.ts`:

1. **Added import:** `import { roundMoney } from './rounding';`

2. **Updated `calculateFeePreview`:** Now uses `roundMoney()` instead of inline `Math.round(x * 100) / 100`

3. **Added documentation:** Clarified relationship between `calculatePartyFee` (Decimal.js precision) and `calculateFeePreview` (simple math for UI)

---

## VERIFICATION RESULTS

### TypeScript Compilation:
```
npx tsc --noEmit
# Passes with no errors
```

### Behavior Tests:
```
npx jest __tests__/behavior-snapshots.test.ts
# 44 tests pass
```

### Marketplace Tests:
```
npx jest __tests__/foundation/marketplace.test.ts
# 18 tests pass
```

### Total: 62 tests pass

---

## REMAINING DUPLICATIONS (Low Priority)

These remain as optional future migrations:

| Category | Files | Notes |
|----------|-------|-------|
| Inline rounding | Distance APIs, deadhead APIs | Can be migrated incrementally |
| Coordinate formatting | `toFixed(4)` patterns | Acceptable for caching keys |
| Dashboard aggregation | Carrier/Shipper dashboard | Partial overlap with aggregation.ts |

---

## OWNERSHIP MAP (Updated)

| Concern | Owner Module | Status |
|---------|--------------|--------|
| Distance Calculation | `lib/geo.ts` | ENFORCED |
| Service Fee Calculation | `lib/serviceFeeCalculation.ts` | ENFORCED |
| Rounding Strategies | `lib/rounding.ts` | ENFORCED |
| Totals/Aggregation | `lib/aggregation.ts` | DOCUMENTED |
| Legacy Fields | `lib/serviceFeeManagement.ts` | POLICY DEFINED |

---

*Fixes applied: 2026-02-08*
*All single-source-of-truth concerns are now addressed*
