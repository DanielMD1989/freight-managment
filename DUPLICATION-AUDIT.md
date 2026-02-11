# DUPLICATION & SOURCE-OF-TRUTH AUDIT

**Date:** 2026-02-07
**Type:** Read-Only Codebase Inspection
**Purpose:** Identify duplication and source-of-truth violations

---

## 1. LOGIC DUPLICATION TABLE

### Distance Calculation

| Concern | Files Involved | Layer | Exact Logic/Formula | Notes |
|---------|----------------|-------|---------------------|-------|
| Haversine Distance | `lib/geo.ts:43-56` | Backend (OWNER) | `R=6371; a=sin²(Δlat/2)+cos(lat1)×cos(lat2)×sin²(Δlon/2); c=2×atan2(√a,√(1-a)); R×c` | SOURCE OF TRUTH |
| Haversine Distance | `lib/gpsQuery.ts:181-189` | Backend | Delegates to `calculateDistanceKm()` | ✅ DELEGATED |
| Haversine Distance | `SearchLoadsTab.tsx:33-39` | Frontend | `Math.round(calculateDistanceKm(...))` | ✅ DELEGATED |
| Haversine Distance | `PostTrucksTab.tsx:263-269` | Frontend | `Math.round(calculateDistanceKm(...))` | ✅ DELEGATED |
| Haversine Distance | `app/api/distance/route.ts:29-50` | API | Inline: `R=6371`, full formula, `Math.round(×10)/10` | 🔴 DUPLICATE |
| Haversine Distance | `app/api/gps/history/route.ts:179-189` | API | Inline: `R=6371`, full formula in loop | 🔴 DUPLICATE |
| Haversine Distance | `app/api/trips/[tripId]/history/route.ts:206-220` | API | Inline: `R=6371`, full formula | 🔴 DUPLICATE |
| Haversine Distance | `app/api/trips/[tripId]/live/route.ts:199-213` | API | Inline: `R=6371`, full formula | 🔴 DUPLICATE |
| Haversine Distance | `lib/automationRules.ts:462-481` | Backend | Inline: `R=6371`, full formula | 🔴 DUPLICATE |

**🔴 FLAG: 5 duplicate inline implementations of haversine formula**

---

### Service Fee Calculation

| Concern | Files Involved | Layer | Exact Logic/Formula | Notes |
|---------|----------------|-------|---------------------|-------|
| Base Fee | `lib/serviceFeeCalculation.ts:189` | Backend (OWNER) | `baseFee = Decimal(distanceKm).mul(pricePerKm)` | SOURCE OF TRUTH |
| Promo Discount | `lib/serviceFeeCalculation.ts:194` | Backend (OWNER) | `discount = baseFee.mul(promoPct).div(100)` | SOURCE OF TRUTH |
| Final Fee | `lib/serviceFeeCalculation.ts:198` | Backend (OWNER) | `finalFee = baseFee.sub(discount)` | SOURCE OF TRUTH |
| Preview Fee | `lib/serviceFeeCalculation.ts:444-454` | Backend | `baseFee = distanceKm * pricePerKm; Math.round(×100)/100` | ALTERNATE (same result) |
| Inline Fee | `CorridorManagementClient.tsx:160-167` | Frontend | `baseFee = distance * price; discount = baseFee * (pct/100)` | 🔴 DUPLICATE |
| Test Fee | `scripts/test-service-fee-flow.ts:80-90` | Script | `baseFee = distanceKm * pricePerKm` | Test script (acceptable) |
| Test Fee | `scripts/e2e-test-business-logic.ts:105-110` | Script | `baseFee = Number(c.distanceKm) * Number(c.pricePerKm)` | Test script (acceptable) |

**🔴 FLAG: 1 inline frontend fee calculation duplicates backend logic**

---

### Rounding Strategies

| Concern | Files Involved | Layer | Exact Logic/Formula | Notes |
|---------|----------------|-------|---------------------|-------|
| Money (2 dec) | `lib/rounding.ts:40` | Backend (OWNER) | `Math.round(x * 100) / 100` | SOURCE OF TRUTH |
| Money (2 dec) | `lib/serviceFeeCalculation.ts:452-454` | Backend | `Math.round(x * 100) / 100` | 🟡 INLINE (same formula) |
| Money (2 dec) | `lib/tripProgress.ts:185,187` | Backend | `Math.round(x * 100) / 100` | 🟡 INLINE (same formula) |
| Money (2 dec) | `lib/gpsQuery.ts:165` | Backend | `Math.round(x * 100) / 100` | 🟡 INLINE (same formula) |
| Percentage (1 dec) | `lib/rounding.ts:68` | Backend (OWNER) | `Math.round(x * 10) / 10` | SOURCE OF TRUTH |
| Percentage (1 dec) | `lib/deadheadOptimization.ts:525-527` | Backend | `Math.round(x * 10) / 10` | 🟡 INLINE (same formula) |
| Distance (1 dec) | `app/api/distance/route.ts:49` | API | `Math.round(x * 10) / 10` | 🟡 INLINE |
| Distance (2 dec) | `app/api/gps/history/route.ts:205-207` | API | `Math.round(x * 100) / 100` | 🟡 INLINE |

**🟡 RISKY: 8+ inline rounding operations instead of delegating to lib/rounding.ts**

---

### Aggregation / Totals

| Concern | Files Involved | Layer | Exact Logic/Formula | Notes |
|---------|----------------|-------|---------------------|-------|
| Load Count by Status | `lib/admin/metrics.ts:132-162` | Backend (OWNER) | `db.load.groupBy({ by: ['status'], _count: true })` | SOURCE OF TRUTH |
| Load Count by Status | `app/api/shipper/dashboard/route.ts:111-114` | API | `db.load.groupBy({ by: ['status'], _count: true })` | 🔴 DUPLICATE |
| Load Count by Status | `app/api/admin/platform-metrics/route.ts:153-157` | API | `db.load.groupBy({ by: ['status'], _count: true })` | 🔴 DUPLICATE |
| Service Fee Sum | `lib/admin/metrics.ts:253-263` | Backend | `_sum: { serviceFeeEtb: true }` | Legacy field |
| Service Fee Sum | `lib/aggregation.ts:118-148` | Backend (OWNER) | `_sum: { shipperServiceFee, carrierServiceFee }` | Current fields |
| Service Fee Sum | `app/api/admin/platform-metrics/route.ts:91-92` | API | `_sum: { serviceFeeEtb: true }` | 🔴 DUPLICATE |
| Carrier Earnings | `lib/aggregation.ts:209-239` | Backend (OWNER) | `_sum: { actualDistanceKm, carrierServiceFee }` | SOURCE OF TRUTH |
| Carrier Earnings | `app/api/carrier/dashboard/route.ts:100-119` | API | `_sum: { actualDistanceKm, carrierServiceFee }` | 🔴 DUPLICATE |
| Shipper Spending | `lib/aggregation.ts:282-310` | Backend (OWNER) | `_sum: { shipperServiceFee }` | SOURCE OF TRUTH |
| Shipper Spending | `app/api/shipper/dashboard/route.ts:93-108` | API | `_sum: { shipperServiceFee }` | 🔴 DUPLICATE |

**🔴 FLAG: 6 aggregation operations duplicated in API routes instead of using lib/aggregation.ts**

---

### Status Derivation

| Concern | Files Involved | Layer | Exact Logic/Formula | Notes |
|---------|----------------|-------|---------------------|-------|
| Active Loads | `lib/admin/metrics.ts:97` | Backend (OWNER) | `['POSTED', 'SEARCHING', 'OFFERED']` | Constant array |
| Active Loads | Multiple API routes | API | Hardcoded status checks | 🟡 SCATTERED |
| Active Trips | `lib/admin/metrics.ts:108` | Backend (OWNER) | `['ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT']` | Constant array |
| Completed Status | Multiple files | All layers | `['DELIVERED', 'COMPLETED']` | 🟡 SCATTERED |

---

## 2. CONSTANTS DUPLICATION

| Constant | Files | Values | Identical? |
|----------|-------|--------|------------|
| Earth Radius (km) | `lib/geo.ts:43`, `lib/automationRules.ts:468`, `app/api/distance/route.ts:35`, `app/api/gps/history/route.ts:179`, `app/api/trips/[tripId]/history/route.ts:212`, `app/api/trips/[tripId]/live/route.ts:205` | 6371 | YES |
| Earth Radius (meters) | `lib/geo.ts:74` | 6371000 | YES (single location) |
| Money Precision | `lib/rounding.ts:40`, `lib/serviceFeeCalculation.ts:452` | 100 (2 decimals) | YES |
| Percentage Precision | `lib/rounding.ts:68`, `lib/deadheadOptimization.ts:525` | 10 (1 decimal) | YES |
| Coordinate Precision | `lib/rounding.ts:164`, `app/api/distance/dh/route.ts:41` | 4 decimals | YES |
| Grace Period (hours) | `lib/exceptionDetection.ts:44,88` | 2 | YES (duplicated in same file) |
| Stalled Threshold (km) | `lib/exceptionDetection.ts:247`, `lib/automationRules.ts:353` | 1 | YES |
| Nearby Match (km) | `lib/matchingEngine.ts:87,274` | 50 | YES |
| Medium Distance (km) | `lib/matchingEngine.ts:116,278` | 100 | YES |
| Max Distance (km) | `lib/matchingEngine.ts:80,121` | 200 | YES |
| Exact Match Score | `lib/matchingEngine.ts:949` | 85 | YES (single location) |
| Page Size | `ShipperWalletClient.tsx:98`, `CarrierWalletClient.tsx:94` | 10 | YES |
| Avg Speed (km/h) | `lib/googleRoutes.ts` (2 locations) | 50 | YES |
| pricePerKm | Per-corridor in database | Variable (2.5, 3.0, etc.) | N/A (per-route) |

---

## 3. FRONTEND VS BACKEND CONFLICTS

| Logic | Frontend File | Backend/DB File | Risk |
|-------|---------------|-----------------|------|
| Fee Calculation | `CorridorManagementClient.tsx:160-167` | `lib/serviceFeeCalculation.ts:189-198` | 🔴 HIGH - Different precision possible |
| Distance Display | `SearchLoadsTab.tsx:33-39` (integer) | `lib/geo.ts:43-56` (decimal) | 🟢 LOW - Intentional rounding for display |
| Distance Display | `PostTrucksTab.tsx:263-269` (integer) | `lib/geo.ts:43-56` (decimal) | 🟢 LOW - Intentional rounding for display |
| Status Filtering | Multiple React components | `lib/admin/metrics.ts:97-108` | 🟡 MEDIUM - Hardcoded status strings |

---

## 4. DATABASE LOGIC FINDINGS

### Raw SQL Queries

| File | Line | SQL Operation | Calculation | Duplicates App Logic? |
|------|------|---------------|-------------|----------------------|
| `lib/admin/metrics.ts` | 417-423 | `COUNT(*) GROUP BY DATE_TRUNC('day', "createdAt")` | Load counts per day | YES - mirrors getLoadMetrics() |
| `lib/admin/metrics.ts` | 424-433 | `SUM("serviceFeeEtb") GROUP BY DATE_TRUNC('day', ...)` | Revenue per day | YES - mirrors getRevenueMetrics() |
| `lib/admin/metrics.ts` | 435-445 | `COUNT(*) FILTER (WHERE status IN (...))` | Trip status counts | YES - mirrors getTripMetrics() |
| `app/api/exceptions/analytics/route.ts` | 140-148 | `COUNT(*) GROUP BY DATE(created_at)` | Exception trends | NO - unique time-series |

### Database Views / Triggers / Computed Columns

**NONE FOUND** - All calculations are application-level (Prisma ORM or raw SQL in routes)

### Prisma Aggregations (Not Database Functions)

| File | Operation | What's Aggregated |
|------|-----------|-------------------|
| `lib/aggregation.ts` | `_sum: { shipperServiceFee }` | Financial totals |
| `lib/admin/metrics.ts` | `groupBy + _count` | Load/trip/truck metrics |
| Multiple API routes | `aggregate + groupBy` | Dashboard statistics |

---

## 5. END-TO-END TRACE: "Service Fee for a Shipment"

### Trace: 100 km shipment at 2.5 ETB/km with 10% promo

```
INPUT
├── Load created with corridor: Addis Ababa → Dire Dawa
├── Distance: 100 km (from corridor.distanceKm)
├── Rate: 2.5 ETB/km (from corridor.shipperPricePerKm)
└── Promo: 10% discount (corridor.shipperPromoFlag=true, shipperPromoPct=10)

CALCULATION (lib/serviceFeeCalculation.ts:172-208)
├── File: lib/serviceFeeCalculation.ts
├── Function: calculatePartyFee()
├── Line 189: baseFee = Decimal(100).mul(Decimal(2.5)) = 250.00
├── Line 194: discount = Decimal(250).mul(10).div(100) = 25.00
├── Line 198: finalFee = Decimal(250).sub(25) = 225.00
└── Line 201-203: Rounded to 2 decimals via toDecimalPlaces(2)

ROUNDING (lib/serviceFeeCalculation.ts:201-203)
├── Uses: Decimal.js toDecimalPlaces(2).toNumber()
├── NOT delegated to lib/rounding.ts:roundMoney()
└── Same result (225.00), different implementation

STORAGE (lib/serviceFeeManagement.ts:435-445)
├── File: lib/serviceFeeManagement.ts
├── Function: deductServiceFee()
├── Line 438: shipperServiceFee = 225.00 (Decimal)
├── Line 439: shipperFeeStatus = 'DEDUCTED'
├── Line 441: serviceFeeEtb = 225.00 (legacy sync)
├── Line 442: serviceFeeStatus = 'DEDUCTED' (legacy sync)
└── Database: Prisma update to Load table

API RESPONSE (Various endpoints)
├── GET /api/loads/[id]: Returns shipperServiceFee as Decimal
├── GET /api/shipper/dashboard: Aggregates via _sum
├── Conversion: Number(load.shipperServiceFee) or .toFixed(2)
└── Line 266+ in status/route.ts: .toFixed(2) for display

UI DISPLAY
├── ShipperWalletClient.tsx: Formats via formatCurrency()
├── LoadDetailPage: Shows "Service Fee: 225.00 ETB"
└── Dashboard: Aggregated in totalSpent
```

### Files Involved in Trace

1. `lib/serviceFeeCalculation.ts:172-208` — Calculation
2. `lib/serviceFeeManagement.ts:98-460` — Orchestration & Storage
3. `prisma/schema.prisma:629-643` — Field definitions
4. `app/api/loads/[id]/status/route.ts:266+` — API formatting
5. `app/shipper/wallet/ShipperWalletClient.tsx` — UI display

### 🔴 TRUST BREAKS FOUND

1. **Rounding Implementation Divergence** (Line 201-203 vs lib/rounding.ts:40)
   - Fee calculation uses `Decimal.toDecimalPlaces(2)`
   - Rounding module uses `Math.round(x * 100) / 100`
   - Same result but different code paths = maintenance risk

2. **Preview vs Actual Calculation Paths** (Line 189 vs 444)
   - `calculatePartyFee()` uses Decimal.js
   - `calculateFeePreview()` uses inline multiplication
   - Both exist in same file with same formula

3. **Legacy Field Sync** (Lines 441-442)
   - serviceFeeEtb synced from shipperServiceFee
   - serviceFeeStatus synced from shipperFeeStatus
   - Two sources of "truth" in database

---

## 6. DIRECT ANSWERS

### 1. Where does truth live for each concern?

| Concern | Source of Truth | Location |
|---------|-----------------|----------|
| Distance Calculation | `lib/geo.ts:calculateDistanceKm` | Lines 37-56 |
| Service Fee Formula | `lib/serviceFeeCalculation.ts:calculatePartyFee` | Lines 172-208 |
| Rounding Strategies | `lib/rounding.ts` | All functions |
| Aggregation/Totals | `lib/aggregation.ts` | Re-exports + new functions |
| Admin Metrics | `lib/admin/metrics.ts` | All functions |
| SLA Metrics | `lib/slaAggregation.ts` | All functions |
| Load Status Constants | `lib/admin/metrics.ts:90-108` | Constant arrays |
| Legacy Field Policy | `lib/serviceFeeManagement.ts` header | Documentation |

### 2. Where is logic duplicated?

| Duplicated Logic | Locations | Count |
|------------------|-----------|-------|
| Haversine Formula | `lib/geo.ts`, `app/api/distance/route.ts`, `app/api/gps/history/route.ts`, `app/api/trips/[tripId]/history/route.ts`, `app/api/trips/[tripId]/live/route.ts`, `lib/automationRules.ts` | 6 |
| Money Rounding | `lib/rounding.ts`, `lib/serviceFeeCalculation.ts`, `lib/tripProgress.ts`, `lib/gpsQuery.ts` | 4 |
| Load Status Aggregation | `lib/admin/metrics.ts`, `app/api/shipper/dashboard`, `app/api/admin/platform-metrics` | 3 |
| Service Fee Aggregation | `lib/aggregation.ts`, `app/api/carrier/dashboard`, `app/api/shipper/dashboard`, `app/api/admin/platform-metrics` | 4 |
| Fee Calculation (inline) | `lib/serviceFeeCalculation.ts`, `CorridorManagementClient.tsx` | 2 |

### 3. Where is logic dangerously split across layers?

| Logic | Layers Split | Risk Level |
|-------|--------------|------------|
| Fee Calculation | Frontend (`CorridorManagementClient.tsx`) + Backend (`serviceFeeCalculation.ts`) | 🔴 HIGH |
| Status Constants | Frontend (hardcoded) + Backend (`metrics.ts`) | 🟡 MEDIUM |
| Aggregation | API routes + Centralized modules | 🟡 MEDIUM |
| Distance Rounding | Frontend (integer) + Backend (decimal) | 🟢 LOW (intentional) |

### 4. What would you NOT trust today?

| Item | Reason | Files |
|------|--------|-------|
| Inline Haversine in API routes | 5 duplicate implementations that could diverge | `distance/route.ts`, `gps/history/route.ts`, `trips/[tripId]/history/route.ts`, `trips/[tripId]/live/route.ts`, `automationRules.ts` |
| Frontend fee preview | Inline calculation not using centralized function | `CorridorManagementClient.tsx:160-167` |
| Dashboard aggregations | Same queries duplicated instead of imported | `carrier/dashboard/route.ts`, `shipper/dashboard/route.ts`, `admin/platform-metrics/route.ts` |
| Legacy vs Current fee fields | Both written, unclear which is authoritative at query time | `serviceFeeEtb` vs `shipperServiceFee` |
| Inline rounding in API routes | Scattered `Math.round()` calls not using `lib/rounding.ts` | 8+ API route files |

---

## SUMMARY STATISTICS

| Category | Source of Truth | Duplicates | Risky |
|----------|-----------------|------------|-------|
| Distance Calculation | 1 (lib/geo.ts) | 5 | 5 |
| Service Fee | 1 (lib/serviceFeeCalculation.ts) | 1 | 1 |
| Rounding | 1 (lib/rounding.ts) | 8+ | 8+ |
| Aggregation | 2 (lib/aggregation.ts, lib/admin/metrics.ts) | 6 | 4 |
| Status Derivation | 1 (lib/admin/metrics.ts) | Scattered | Many |
| **TOTAL** | **6 owners** | **20+** | **18+** |

---

*Audit completed: 2026-02-07*
*This is a read-only report. No modifications were made.*
*NO FIXES. NO OPINIONS. OBSERVATIONS ONLY.*
