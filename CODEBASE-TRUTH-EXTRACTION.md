# CODEBASE TRUTH EXTRACTION

**Date:** 2026-02-06
**Type:** Read-Only System Audit
**Scope:** Single Source of Truth Analysis

---

## 1. INVENTORY — WHERE EACH CONCERN IS IMPLEMENTED

### A. DISTANCE CALCULATION

| File | Layer | Notes |
|------|-------|-------|
| `lib/geo.ts:25` | Backend | `calculateDistanceKm()` — primary Haversine implementation |
| `lib/geo.ts:80` | Backend | `haversineDistance` — alias to calculateDistanceKm |
| `lib/gpsQuery.ts:176` | Backend | `haversineDistance()` — duplicate inline implementation |
| `app/carrier/loadboard/PostTrucksTab.tsx:258` | Frontend | `haversineDistance()` — duplicate inline implementation |
| `app/carrier/loadboard/SearchLoadsTab.tsx:28` | Frontend | `haversineDistance()` — duplicate inline implementation |
| `app/api/truck-postings/[id]/matching-loads/route.ts:19` | Backend | Wrapper calling `calculateDistanceKm` with rounding |
| `app/api/distance/batch/route.ts:49` | Backend | Alias to `calculateDistanceKm` |
| `app/api/distance/road/route.ts:28` | Backend | Alias to `calculateDistanceKm` |
| `app/api/distance/dh/route.ts:27` | Backend | Alias to `calculateDistanceKm` |
| `app/api/gps/eta/route.ts:28` | Backend | Alias to `calculateDistanceKm` |

**🔴 DUPLICATED SOURCE OF TRUTH**
- `lib/gpsQuery.ts:176` — full duplicate implementation
- `app/carrier/loadboard/PostTrucksTab.tsx:258` — full duplicate implementation
- `app/carrier/loadboard/SearchLoadsTab.tsx:28` — full duplicate implementation

---

### B. PRICING / SERVICE FEE CALCULATION

| File | Layer | Notes |
|------|-------|-------|
| `lib/serviceFeeCalculation.ts:426` | Backend | `calculateFeePreview()` — baseFee = distanceKm × pricePerKm |
| `lib/serviceFeeCalculation.ts:454` | Backend | `calculateDualPartyFeePreview()` — calls calculateFeePreview twice |
| `lib/serviceFeeManagement.ts:80` | Backend | `deductServiceFee()` — actual fee deduction with distance priority logic |
| `lib/serviceFeeManagement.ts:200-209` | Backend | Distance source priority: actualTripKm > estimatedTripKm > tripKm > corridor.distanceKm |
| `app/api/admin/corridors/route.ts` | Backend | Uses `calculateDualPartyFeePreview` for preview |
| `app/api/admin/corridors/[id]/route.ts` | Backend | Uses `calculateDualPartyFeePreview` for preview |
| `app/api/loads/[id]/service-fee/route.ts` | Backend | Uses `calculateFeePreview` for preview |

**🟢 Acceptable** — Fee calculation consolidated to lib/serviceFeeCalculation.ts and lib/serviceFeeManagement.ts

---

### C. TOTALS / AGGREGATION

| File | Layer | Notes |
|------|-------|-------|
| `app/api/shipper/dashboard/route.ts` | Backend | `_sum.shipperServiceFee` |
| `app/api/carrier/dashboard/route.ts` | Backend | `_sum`, `_count` for trip stats |
| `app/api/admin/analytics/route.ts` | Backend | `aggregate`, `count` for platform stats |
| `app/api/admin/platform-metrics/route.ts` | Backend | `count` for active trips |
| `app/api/dispatcher/dashboard/route.ts` | Backend | `count` for load/trip stats |
| `lib/admin/metrics.ts:244` | Backend | `serviceFees._sum.serviceFeeEtb` |
| `lib/admin/metrics.ts:428` | Backend | Raw SQL: `SUM(serviceFeeEtb)` |
| 38 additional API files | Backend | Various `_sum`, `aggregate`, `count` operations |

**🟡 Risky** — Aggregation logic spread across 40+ files with no centralized aggregation functions

---

### D. ROUNDING

| File | Layer | Notes |
|------|-------|-------|
| `lib/serviceFeeCalculation.ts:444-446` | Backend | `Math.round(x * 100) / 100` — rounds to 2 decimals |
| `lib/serviceFeeManagement.ts:358,362-364` | Backend | `.toFixed(2)` — string formatting |
| `lib/loadAutomation.ts:153,164` | Backend | `.toFixed(2)` — notification messages |
| `lib/trustMetrics.ts:44,75,107,190` | Backend | `Math.round(x * 100) / 100` |
| `lib/slaAggregation.ts:218,219,294,295,334,412,418,425` | Backend | `Math.round(x * 10) / 10` — 1 decimal |
| `lib/bypassDetection.ts:87` | Backend | `Math.round(x * 100) / 100` |
| `lib/matchingEngine.ts:166,339,778,941` | Backend | `Math.round()` — integer |
| `lib/tripProgress.ts:153,172,174` | Backend | `Math.round()`, `Math.round(x * 100) / 100` |
| `lib/gpsQuery.ts:164` | Backend | `Math.round(x * 100) / 100` |

**🟡 Risky** — Mixed rounding strategies (0, 1, or 2 decimal places) with no central rounding policy

---

### E. PERSISTENCE (WHERE VALUES ARE STORED)

| Table.Column | Type | Notes |
|--------------|------|-------|
| `Load.tripKm` | Decimal | Legacy trip distance |
| `Load.estimatedTripKm` | UNCLEAR | Not in grep results for schema |
| `Load.actualTripKm` | UNCLEAR | Not in grep results for schema |
| `Load.serviceFeeEtb` | Decimal(10,2) | Legacy shipper service fee |
| `Load.serviceFeeStatus` | ServiceFeeStatus | PENDING/RESERVED/DEDUCTED/WAIVED/REFUNDED |
| `Load.shipperServiceFee` | UNCLEAR | Referenced in code but not found in schema grep |
| `Load.carrierServiceFee` | UNCLEAR | Referenced in code but not found in schema grep |
| `Corridor.distanceKm` | Decimal(10,2) | Corridor distance |
| `Corridor.pricePerKm` | Decimal(10,4) | Legacy rate |
| `Corridor.shipperPricePerKm` | Decimal(10,4) | Shipper-specific rate |
| `RouteMatrix.distanceKm` | Decimal(10,2) | Cached route distance |

---

## 2. TRACE: "Service fee for a 100 km shipment"

### Timeline (Chronological)

1. **Distance source**
   - `lib/serviceFeeManagement.ts:200-209`
   - Priority: `actualTripKm` > `estimatedTripKm` > `tripKm` > `corridor.distanceKm`

2. **Fee calculation**
   - `lib/serviceFeeManagement.ts:218-250` (UNCLEAR — not fully read)
   - Calls internal fee calculation using corridor's `pricePerKm` or `shipperPricePerKm`

3. **Rounding**
   - `lib/serviceFeeCalculation.ts:444-446`: `Math.round(baseFee * 100) / 100`

4. **Storage**
   - `Load.shipperServiceFee` — Decimal
   - `Load.carrierServiceFee` — Decimal
   - `Load.serviceFeeEtb` — Decimal(10,2) (legacy)
   - `Load.shipperFeeStatus` / `Load.carrierFeeStatus` — enum

5. **Return/Display**
   - API: `app/api/loads/[id]/service-fee/route.ts`
   - Dashboard: `app/api/shipper/dashboard/route.ts` sums `shipperServiceFee`

### Trust Breaks Identified

**🔴 TRUST BREAK — RECOMPUTATION**
- Distance is recomputed in `lib/tripProgress.ts:69-76` using same priority logic
- Distance is recomputed in `lib/returnLoadNotifications.ts:111-112`
- No single stored "canonical distance" is used universally

---

## 3. BEHAVIOR SNAPSHOTS

**BEHAVIOR SNAPSHOT — NOT EXPECTED BEHAVIOR**

Cannot observe actual shipment data without database query execution.

From code analysis:
- `Load.serviceFeeEtb` stores the legacy fee value
- `Load.shipperFeeStatus` stores PENDING → RESERVED → DEDUCTED progression
- Fee is computed at deduction time, not at load creation time

**UNCLEAR:**
- Whether `shipperServiceFee` is pre-computed and stored, or computed at deduction
- Whether actual stored values match calculations

---

## 4. RISK CLASSIFICATION

| Finding | Classification |
|---------|----------------|
| Distance calculation in lib/geo.ts | 🟢 Acceptable — single source exists |
| Distance calculation duplicates (3 files) | 🔴 Foundation-breaking — multiple implementations |
| Fee preview calculation | 🟢 Acceptable — consolidated |
| Fee deduction logic | 🟢 Acceptable — single location |
| Distance priority logic | 🟡 Risky — duplicated in 3+ locations |
| Rounding strategies | 🟡 Risky — inconsistent (0/1/2 decimals) |
| Aggregation logic | 🟡 Risky — spread across 40+ files |
| Stored fee fields | 🟡 Risky — legacy + new fields coexist |

---

## 5. DIRECT ANSWERS

### 1. Where does money get calculated today?

- `lib/serviceFeeManagement.ts:80` — `deductServiceFee()` function
- `lib/serviceFeeCalculation.ts:426` — `calculateFeePreview()` for previews
- Formula: `distanceKm × pricePerKm - (promoDiscount)`

### 2. Is there more than one source of truth?

**YES.**

- Distance calculation: 3 duplicate inline implementations exist
- Distance priority logic: Duplicated in serviceFeeManagement.ts, tripProgress.ts, returnLoadNotifications.ts
- Fee storage: Both legacy (`serviceFeeEtb`) and new (`shipperServiceFee`, `carrierServiceFee`) fields

### 3. Where does business logic fragment?

- `lib/gpsQuery.ts:176` — inline haversine duplicate
- `app/carrier/loadboard/PostTrucksTab.tsx:258` — inline haversine duplicate
- `app/carrier/loadboard/SearchLoadsTab.tsx:28` — inline haversine duplicate
- `lib/tripProgress.ts:69-76` — distance priority logic duplicate
- `lib/returnLoadNotifications.ts:111-112` — distance source logic duplicate

### 4. What would you NOT trust right now?

1. Frontend distance calculations (PostTrucksTab, SearchLoadsTab) — may diverge from backend
2. GPS query distance calculations (gpsQuery.ts) — separate implementation
3. Rounding consistency — mixed strategies across files
4. Legacy vs new fee fields — unclear which is authoritative
5. Distance value consistency — computed at multiple points with same priority logic

---

*Audit completed: 2026-02-06*
*Auditor: Read-Only System Observer*
