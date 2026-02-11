# CODEBASE TRUTH AUDIT — RISK CLASSIFICATION

**Date:** 2026-02-07
**Type:** Behavior Freeze Audit
**Status:** PHASE 3 - Foundation Finalization COMPLETE

---

## OWNERSHIP MAP

| Concern | Owner Module | Status |
|---------|--------------|--------|
| Distance Calculation | `lib/geo.ts` | DECLARED |
| Service Fee Calculation | `lib/serviceFeeCalculation.ts` | DECLARED |
| Rounding Strategies | `lib/rounding.ts` | DECLARED (2026-02-07) |
| Totals/Aggregation | `lib/aggregation.ts` | DECLARED (2026-02-07) |
| Admin Metrics | `lib/admin/metrics.ts` | DELEGATED (via aggregation.ts) |
| SLA Aggregation | `lib/slaAggregation.ts` | DELEGATED (via aggregation.ts) |
| Trust Metrics | `lib/trustMetrics.ts` | DELEGATED (rounding via rounding.ts) |

---

## RISK CLASSIFICATION

### Distance Calculation

| Location | Status | Classification |
|----------|--------|----------------|
| `lib/geo.ts:calculateDistanceKm` | OWNER | 🟢 Acceptable |
| `lib/geo.ts:haversineDistance` | Alias | 🟢 Acceptable |
| `lib/gpsQuery.ts:haversineDistance` | COLLAPSED (2026-02-06) | 🟢 Acceptable |
| `app/carrier/loadboard/SearchLoadsTab.tsx:haversineDistance` | COLLAPSED (2026-02-06) | 🟢 Acceptable |
| `app/carrier/loadboard/PostTrucksTab.tsx:haversineDistance` | COLLAPSED (2026-02-06) | 🟢 Acceptable |

**Notes:**
- All duplicates now delegate to `lib/geo.ts:calculateDistanceKm`
- Frontend wrappers preserve `Math.round()` for integer return behavior
- Backend callers get raw decimal (unchanged behavior)

---

### Service Fee Calculation

| Location | Status | Classification |
|----------|--------|----------------|
| `lib/serviceFeeCalculation.ts:calculateFeePreview` | OWNER | 🟢 Acceptable |
| `lib/serviceFeeCalculation.ts:calculateDualPartyFeePreview` | OWNER | 🟢 Acceptable |
| `lib/serviceFeeManagement.ts:deductServiceFee` | Orchestrator | 🟢 Acceptable |

**Notes:**
- Fee calculation consolidated to single module
- Rounding: delegates to `lib/rounding.ts:roundMoney()`
- No duplicates found
- Legacy field policy documented in module header

---

### Rounding Strategies

| Location | Method | Decimal Places | Classification |
|----------|--------|----------------|----------------|
| `lib/rounding.ts:roundMoney` | `Math.round(x * 100) / 100` | 2 | 🟢 OWNER |
| `lib/rounding.ts:roundPercentage` | `Math.round(x * 10) / 10` | 1 | 🟢 OWNER |
| `lib/rounding.ts:roundPercentage2` | `Math.round(x * 100) / 100` | 2 | 🟢 OWNER |
| `lib/rounding.ts:roundDistance` | `Math.round(x)` | 0 | 🟢 OWNER |
| `lib/rounding.ts:roundDistance1` | `Math.round(x * 10) / 10` | 1 | 🟢 OWNER |
| `lib/rounding.ts:roundCoordinate` | `.toFixed(4)` | 4 | 🟢 OWNER |
| `lib/rounding.ts:roundCoordinate6` | `.toFixed(6)` | 6 | 🟢 OWNER |
| `lib/geo.ts` | None | Raw decimal | 🟢 Acceptable |
| `lib/serviceFeeCalculation.ts` | `roundMoney()` | 2 | 🟢 DELEGATED |
| `lib/slaAggregation.ts` | `roundPercentage()` | 1 | 🟢 DELEGATED (2026-02-07) |
| `lib/trustMetrics.ts` | `roundPercentage2()` | 2 | 🟢 DELEGATED (2026-02-07) |
| Frontend loadboard | `Math.round(R * c)` | 0 (integer) | 🟢 Acceptable (documented) |

**Notes:**
- Centralized rounding module created: `lib/rounding.ts`
- ALL rounding now delegates to owner module
- Documentation table in rounding.ts explains each strategy
- Frontend integer rounding is intentional and documented

---

### Aggregation Logic

| Location | Status | Classification |
|----------|--------|----------------|
| `lib/aggregation.ts` | OWNER | 🟢 Acceptable |
| `lib/admin/metrics.ts` | DELEGATED | 🟢 Acceptable |
| `lib/slaAggregation.ts` | DELEGATED | 🟢 Acceptable |
| Dashboard APIs | Can IMPORT from aggregation.ts | 🟡 Optional migration |

**Notes:**
- Centralized aggregation module created: `lib/aggregation.ts`
- Re-exports functions from `lib/admin/metrics.ts` and `lib/slaAggregation.ts`
- New aggregation functions use `roundMoney()` and `roundPercentage()`
- Dashboard APIs can optionally migrate but not required

---

### Distance Priority Logic

| Location | Priority | Classification |
|----------|----------|----------------|
| `lib/serviceFeeManagement.ts:200-209` | actualTripKm > estimatedTripKm > tripKm > corridor.distanceKm | 🟢 Acceptable (fee calculation) |
| `lib/tripProgress.ts:69-83` | corridor.distanceKm > estimatedTripKm > tripKm | 🟢 DOCUMENTED (progress) |
| `lib/returnLoadNotifications.ts:107-121` | corridor.distanceKm > estimatedTripKm > tripKm | 🟢 DOCUMENTED (matching) |

**RESOLVED (2026-02-07):** Distance priority differences are INTENTIONAL.

**Fee Calculation (serviceFeeManagement.ts):**
- Uses actual GPS distance when available for accurate billing
- Priority: actualTripKm > estimatedTripKm > tripKm > corridor.distanceKm

**Progress/Matching (tripProgress.ts, returnLoadNotifications.ts):**
- Uses PLANNED distance as reference for consistent measurement
- GPS actual distance grows during trip and would cause incorrect percentage
- For matching, loads haven't been assigned yet, so no GPS data exists
- Priority: corridor.distanceKm > estimatedTripKm > tripKm

---

### Data Storage Fields

| Field | Classification | Notes |
|-------|----------------|-------|
| `Load.serviceFeeEtb` | 🟡 LEGACY (READ-ONLY) | Synced from shipperServiceFee |
| `Load.shipperServiceFee` | 🟢 AUTHORITATIVE | Current shipper fee |
| `Load.carrierServiceFee` | 🟢 AUTHORITATIVE | Current carrier fee |
| `Load.shipperFeeStatus` | 🟢 AUTHORITATIVE | Current shipper status |
| `Load.carrierFeeStatus` | 🟢 AUTHORITATIVE | Current carrier status |
| `Load.serviceFeeStatus` | 🟡 LEGACY (READ-ONLY) | Synced from shipperFeeStatus |
| `Load.tripKm` | 🟡 LEGACY | Legacy distance - use estimatedTripKm |
| `Load.estimatedTripKm` | 🟢 AUTHORITATIVE | Map-estimated distance |
| `Load.actualTripKm` | 🟢 AUTHORITATIVE | GPS-computed actual distance |

**Legacy Field Policy (documented in serviceFeeManagement.ts):**
- Legacy fields are READ-ONLY for backward compatibility
- New code MUST use AUTHORITATIVE fields
- Write operations sync legacy fields automatically

---

## SNAPSHOT TEST LOCATIONS

| File | Purpose |
|------|---------|
| `__tests__/behavior-snapshots.test.ts` | Distance, fee, and rounding snapshots (44 tests) |
| `snapshots/behavior-data-snapshot.json` | Frozen example shipment data |

**Tests Added (2026-02-07):**
- Rounding module tests: roundMoney, roundPercentage, roundDistance, roundCoordinate
- Generic rounding tests: roundToDecimals, round()

---

## DEPRECATED CODE MARKERS

The following files have been marked with `DEPRECATED — READ-ONLY` comments:

1. `lib/gpsQuery.ts:167-179` — haversineDistance function
2. `app/carrier/loadboard/SearchLoadsTab.tsx:25-41` — haversineDistance function
3. `app/carrier/loadboard/PostTrucksTab.tsx:255-271` — haversineDistance function

---

## MODULES CREATED/MODIFIED

### lib/rounding.ts (NEW - 2026-02-07)
- **Purpose:** Centralized rounding strategies OWNER
- **Exports:** roundMoney, roundPercentage, roundPercentage2, roundDistance, roundDistance1, roundCoordinate, roundCoordinate6, roundToDecimals, round
- **Behavior Freeze Date:** 2026-02-07

### lib/aggregation.ts (NEW - 2026-02-07)
- **Purpose:** Centralized aggregation/totals OWNER
- **Exports:** Re-exports from admin/metrics.ts, slaAggregation.ts, plus new financial aggregation functions
- **Key Functions:** getFinancialSummary, getCarrierEarningsSummary, getShipperSpendingSummary, getLoadSummary
- **Behavior Freeze Date:** 2026-02-07

### lib/slaAggregation.ts (MODIFIED - 2026-02-07)
- **Change:** Rounding delegated to `lib/rounding.ts:roundPercentage()`
- **Behavior Change:** None (same formula, same decimal places)

### lib/trustMetrics.ts (MODIFIED - 2026-02-07)
- **Change:** Rounding delegated to `lib/rounding.ts:roundPercentage2()`
- **Behavior Change:** None (same formula, same decimal places)

### lib/tripProgress.ts (MODIFIED - 2026-02-07)
- **Change:** Distance priority difference documented with rationale
- **Behavior Change:** None (documentation only)

### lib/returnLoadNotifications.ts (MODIFIED - 2026-02-07)
- **Change:** Distance priority difference documented with rationale
- **Behavior Change:** None (documentation only)

### lib/serviceFeeManagement.ts (MODIFIED - 2026-02-07)
- **Change:** Legacy field policy documented in module header
- **Behavior Change:** None (documentation only)

---

## REFACTORING LOG

### 2026-02-06 (STEP 1 - Collapse Duplicates)
| Action | Files Modified | Behavior Change |
|--------|----------------|-----------------|
| Collapse distance duplicates | lib/gpsQuery.ts, SearchLoadsTab.tsx, PostTrucksTab.tsx | None - delegates to owner |
| Add distance priority comments | lib/tripProgress.ts, lib/returnLoadNotifications.ts | None - flagged for review |

### 2026-02-07 (STEP 2 - Foundation Completion)
| Action | Files Created/Modified | Behavior Change |
|--------|------------------------|-----------------|
| Create rounding module | lib/rounding.ts (NEW) | None - captures existing patterns |
| Create aggregation module | lib/aggregation.ts (NEW) | None - re-exports existing functions |
| Add rounding tests | __tests__/behavior-snapshots.test.ts | None - new test coverage |
| Update audit document | CODEBASE-TRUTH-AUDIT.md | Documentation only |

### 2026-02-07 (PHASE 3 - Foundation Finalization)
| Action | Files Modified | Behavior Change |
|--------|----------------|-----------------|
| Delegate SLA rounding | lib/slaAggregation.ts | None - same formula |
| Delegate trust metrics rounding | lib/trustMetrics.ts | None - same formula |
| Document distance priority rationale | lib/tripProgress.ts, lib/returnLoadNotifications.ts | None - documentation only |
| Document legacy field policy | lib/serviceFeeManagement.ts | None - documentation only |
| Update audit document | CODEBASE-TRUTH-AUDIT.md | Documentation only |

---

## SUMMARY

| Category | 🟢 Acceptable | 🟡 Optional/Legacy | 🔴 Foundation-breaking |
|----------|---------------|-------------------|------------------------|
| Distance Calculation | 5 | 0 | 0 |
| Service Fee | 3 | 0 | 0 |
| Rounding | 12 | 0 | 0 |
| Aggregation | 3 | 1 | 0 |
| Distance Priority | 3 | 0 | 0 |
| Data Fields | 5 | 4 | 0 |
| **TOTAL** | **31** | **5** | **0** |

**Progress:**
- 🔴 **Foundation-breaking: 0** (all issues resolved)
- 🟢 **Acceptable: 31** (up from 26)
- 🟡 **Optional/Legacy: 5** (legacy fields maintained for compatibility)
- All rounding now delegates to `lib/rounding.ts`
- Distance priority differences documented with rationale
- Legacy field policy documented

---

## SYSTEM STATUS: TRUSTABLE

All single-source-of-truth concerns are now resolved:

1. **Distance Calculation** — `lib/geo.ts` is the owner
2. **Service Fee Calculation** — `lib/serviceFeeCalculation.ts` is the owner
3. **Rounding Strategies** — `lib/rounding.ts` is the owner (all modules delegate)
4. **Totals/Aggregation** — `lib/aggregation.ts` is the owner
5. **Distance Priority** — Intentional difference documented (fee vs progress/matching)
6. **Legacy Fields** — Policy defined (READ-ONLY, synced for compatibility)

---

*Audit completed: 2026-02-07*
*PHASE 3 (Foundation Finalization) COMPLETE*
*System is now trustable with single-source-of-truth per concern*
