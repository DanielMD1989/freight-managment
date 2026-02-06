# Shipper, Carrier & Dispatcher Panel Audit

**Date:** 2026-02-06
**Scope:** Complete audit of all non-admin user panels

---

## Executive Summary

| Panel | Total Pages | Issues Found | Critical | High | Medium | Low |
|-------|-------------|--------------|----------|------|--------|-----|
| Shipper | 14 | 2 | 1 | 0 | 1 | 0 |
| Carrier | 14 | 6 | 0 | 2 | 2 | 2 |
| Dispatcher | 7 | 5 | 2 | 1 | 1 | 1 |
| **Total** | **35** | **13** | **3** | **3** | **4** | **3** |

### Fixed Issues (2026-02-06)
- **C1** Shipper Dashboard: Query verified correct - uses `shipperFeeStatus` field
- **C2** Dispatcher Dashboard: All `/carrier/loads/` links fixed to `/dispatcher/loads/`
- **C3** Dispatcher Dashboard: Trucks table View link fixed to `/dispatcher/trucks/`
- **H1** Carrier GPS: Added auto-refresh with 30-second polling
- **H2** Carrier Wallet: Added "Load More" for full transaction history
- **H3** FindMatchesModal: Verified correct - API returns `carrier` at top level

---

## Page-by-Page Status

### SHIPPER PANEL

| Page | Route | API Endpoint | Status | Issues |
|------|-------|--------------|--------|--------|
| Dashboard | `/shipper/dashboard` | `/api/shipper/dashboard` | **FAIL** | Service fee field mismatch - may show $0 for Total Spent |
| Main Entry | `/shipper` | N/A (redirects) | PASS | - |
| Loadboard | `/shipper/loadboard` | Multiple | PASS | - |
| My Loads | `/shipper/loads` | `/api/loads?myLoads=true` | PASS | - |
| Load Detail | `/shipper/loads/[id]` | Direct DB | PASS | - |
| Create Load | `/shipper/loads/create` | `POST /api/loads` | PASS | - |
| Requests | `/shipper/requests` | Direct DB | PASS | - |
| Request Detail | `/shipper/requests/[id]` | Direct DB | PASS | - |
| Trips | `/shipper/trips` | `/api/loads?status=...` | PASS | - |
| Trip Detail | `/shipper/trips/[id]` | Direct DB | PASS | - |
| Live Map | `/shipper/map` | `/api/map/trips?role=shipper` | PASS | - |
| Wallet | `/shipper/wallet` | Direct DB (journal entries) | PASS | - |
| Documents | `/shipper/documents` | `/api/documents` | PASS | - |
| Team | `/shipper/team` | Direct DB | PASS | - |
| Settings | `/shipper/settings` | Direct DB | PASS | - |

### CARRIER PANEL

| Page | Route | API Endpoint | Status | Issues |
|------|-------|--------------|--------|--------|
| Dashboard | `/carrier/dashboard` | `/api/carrier/dashboard` | PASS | - |
| Main Entry | `/carrier` | N/A (redirects) | PASS | - |
| Loadboard - Post Trucks | `/carrier/loadboard?tab=POST_TRUCKS` | `/api/truck-postings` | PASS | - |
| Loadboard - Search Loads | `/carrier/loadboard?tab=SEARCH_LOADS` | `/api/loads?status=POSTED` | PASS | - |
| Truck List | `/carrier/trucks` | `/api/trucks?myTrucks=true` | PASS | - |
| Truck Detail | `/carrier/trucks/[id]` | `/api/trucks/{id}` | PASS | - |
| Add Truck | `/carrier/trucks/add` | `POST /api/trucks` | PASS | - |
| Active Trips | `/carrier/trips` | `/api/trips?status=...` | PASS | - |
| Trip History | `/carrier/trip-history` | `/api/trips?status=DELIVERED,COMPLETED` | PASS | - |
| GPS Tracking | `/carrier/gps` | Direct DB | **WARN** | No auto-refresh, status becomes stale |
| Map | `/carrier/map` | `/api/map/vehicles`, WebSocket | PASS | - |
| Requests | `/carrier/requests` | Direct DB | PASS | - |
| Wallet | `/carrier/wallet` | Direct DB | **WARN** | Transaction history limited to 50, no pagination |
| Documents | `/carrier/documents` | `/api/documents` | PASS | - |
| Team | `/carrier/team` | Direct DB | PASS | - |
| Settings | `/carrier/settings` | Direct DB | PASS | - |

### DISPATCHER PANEL

| Page | Route | API Endpoint | Status | Issues |
|------|-------|--------------|--------|--------|
| Dashboard | `/dispatcher/dashboard` | `/api/dispatcher/dashboard` | **FAIL** | Links point to `/carrier/loads/` instead of `/dispatcher/loads/` |
| All Loads | `/dispatcher/loads` | `/api/loads` | PASS | - |
| All Trucks | `/dispatcher/trucks` | `/api/truck-postings` | PASS | - |
| Proposals | `/dispatcher/proposals` | Direct DB | **WARN** | Bypasses API layer |
| Active Trips | `/dispatcher/trips` | `/api/trips` | PASS | - |
| Escalations | `/dispatcher/escalations` | `/api/escalations` | PASS | - |
| Map | `/dispatcher/map` | `/api/map/*`, WebSocket | PASS | - |

---

## Detailed Issues

### CRITICAL ISSUES (3)

#### C1. Shipper Dashboard Service Fee Field Mismatch - ✅ VERIFIED OK
**Panel:** Shipper
**File:** `app/api/shipper/dashboard/route.ts` (lines 92-108)
**Status:** VERIFIED - Code is correct, uses proper `shipperFeeStatus` and `shipperServiceFee` fields

The query correctly uses the shipper-specific fields defined in the schema:
- `shipperFeeStatus` (ServiceFeeStatus enum)
- `shipperServiceFee` (Decimal)

This is separate from the legacy `serviceFeeStatus` field which is for general service fee tracking.

---

#### C2. Dispatcher Dashboard Broken Navigation Links - ✅ FIXED
**Panel:** Dispatcher
**File:** `app/dispatcher/dashboard/DispatcherDashboardClient.tsx` (lines 483, 546, 838)
**Status:** FIXED - All links updated to `/dispatcher/loads/`

**Also fixed in:**
- `app/dispatcher/loads/LoadsClient.tsx` (line 311)
- `app/dispatcher/escalations/EscalationsClient.tsx` (line 354)
- `app/dispatcher/trips/TripsClient.tsx` (line 354)

---

#### C3. Dispatcher Dashboard Trucks Table Wrong Link - ✅ FIXED
**Panel:** Dispatcher
**File:** `app/dispatcher/dashboard/DispatcherDashboardClient.tsx` (line 1003)
**Status:** FIXED - View button now links to `/dispatcher/trucks/${posting.truck?.id || posting.id}`

**Also fixed in:**
- `app/dispatcher/trucks/TrucksClient.tsx` (line 329)

---

### HIGH ISSUES (3)

#### H1. Carrier GPS Page No Auto-Refresh - ✅ FIXED
**Panel:** Carrier
**Files:**
- `app/carrier/gps/page.tsx` (updated to use client component)
- `app/carrier/gps/GPSTrackingClient.tsx` (new client component)
- `app/api/carrier/gps/route.ts` (new API endpoint)

**Status:** FIXED - Added:
- Auto-refresh every 30 seconds (toggleable)
- Manual refresh button
- Last updated timestamp
- Visual indicator for auto-refresh status

---

#### H2. Carrier Wallet Transaction History No Pagination - ✅ FIXED
**Panel:** Carrier
**File:** `app/carrier/wallet/CarrierWalletClient.tsx`
**Status:** FIXED - Added:
- "Load More Transactions" button
- Uses `/api/wallet/transactions` API with offset pagination
- Shows "(more available)" indicator when more transactions exist

---

#### H3. Dispatcher FindMatchesModal Data Structure Mismatch - ✅ VERIFIED OK
**Panel:** Dispatcher
**File:** `components/dispatcher/FindMatchesModal.tsx` (lines 135, 277)
**Status:** VERIFIED - Code is correct

The API at `/api/loads/[id]/matching-trucks` spreads the full truck posting data which includes:
- `carrier` at top level (from TruckPosting.carrier relation)
- `truck` nested object

So `match.carrier?.name` at line 277 is correct and works as expected.

---

### MEDIUM ISSUES (4)

#### M1. Shipper Wallet vs Dashboard Financial Data Mismatch
**Panel:** Shipper
**Files:** `app/shipper/dashboard/page.tsx`, `app/shipper/wallet/page.tsx`
**Impact:** Dashboard and wallet may show different numbers

**Problem:**
- Wallet uses journal entries (accurate)
- Dashboard sums load records directly (may miss adjustments)

---

#### M2. Dispatcher Proposals Page Bypasses API
**Panel:** Dispatcher
**File:** `app/dispatcher/proposals/page.tsx`
**Impact:** No middleware/validation/logging for proposal retrieval

**Problem:** Uses direct database queries instead of API endpoint.

**Fix:** Create `/api/dispatcher/proposals` endpoint for consistency.

---

#### M3. Carrier No Carrier-Specific API Routes
**Panel:** Carrier
**Impact:** Carrier-specific filtering happens in generic routes

**Problem:** Only one carrier-specific API (`/api/carrier/dashboard`). Most operations use generic routes.

**Recommendation:** Consider creating:
- `/api/carrier/trucks`
- `/api/carrier/trips`
- `/api/carrier/postings`

---

#### M4. API Response Format Inconsistency
**Panel:** All
**Impact:** Frontend must handle different response structures

**Examples:**
- `/api/loads` → `{ loads: [...], pagination: {...} }`
- `/api/truck-postings` → `{ postings: [...], total: number }`
- `/api/escalations` → `{ escalations: [...], total: number, stats: {...} }`

---

### LOW ISSUES (3)

#### L1. Carrier Documents Page Cross-Module Import
**Panel:** Carrier
**File:** `app/carrier/documents/page.tsx`
**Impact:** Minor - creates cross-module dependency

**Note:** Imports `DocumentManagementClient` from shipper module. This is acceptable (DRY) but noted.

---

#### L2. Error Handling Inconsistency
**Panel:** Carrier
**Impact:** Inconsistent user experience on errors

**Examples:**
- Dashboard: Returns null gracefully
- Loadboard: Shows error messages
- GPS: Logs to console only

---

#### L3. Status Badge Style Inconsistency
**Panel:** Carrier
**Impact:** Minor UX inconsistency

Different pages use different badge styles for same statuses.

---

## Sidebar/Navigation Audit

### Shipper Sidebar
| Section | Item | Route | Status |
|---------|------|-------|--------|
| Main | Dashboard | `/shipper/dashboard` | ✓ |
| Main | Map | `/shipper/map` | ✓ |
| Marketplace | Loadboard | `/shipper/loadboard` | ✓ |
| Marketplace | Requests | `/shipper/requests` | ✓ |
| Shipments | My Loads | `/shipper/loads` | ✓ |
| Shipments | Trips | `/shipper/trips` | ✓ |
| Business | Wallet | `/shipper/wallet` | ✓ |
| Business | Documents | `/shipper/documents` | ✓ |
| Business | Team | `/shipper/team` | ✓ |

**Issues:** None - All links working

### Carrier Sidebar
| Section | Item | Route | Status |
|---------|------|-------|--------|
| Main | Dashboard | `/carrier/dashboard` | ✓ |
| Main | Map | `/carrier/map` | ✓ |
| Marketplace | Loadboard | `/carrier/loadboard` | ✓ |
| Marketplace | Requests | `/carrier/requests` | ✓ |
| Operations | My Trucks | `/carrier/trucks` | ✓ |
| Operations | Trips | `/carrier/trips` | ✓ |
| Operations | GPS Tracking | `/carrier/gps` | ✓ |
| Business | Wallet | `/carrier/wallet` | ✓ |
| Business | Documents | `/carrier/documents` | ✓ |

**Issues:** None - All links working

### Dispatcher Sidebar
| Section | Item | Route | Status |
|---------|------|-------|--------|
| Main | Dashboard | `/dispatcher` | ✓ |
| Main | Map | `/dispatcher/map` | ✓ |
| Operations | All Loads | `/dispatcher/loads` | ✓ |
| Operations | All Trucks | `/dispatcher/trucks` | ✓ |
| Operations | Proposals | `/dispatcher/proposals` | ✓ |
| Monitoring | Active Trips | `/dispatcher/trips` | ✓ |
| Monitoring | Escalations | `/dispatcher/escalations` | ✓ |

**Issues:** None - All links working

---

## Wallet Functionality

### Shipper Wallet
| Feature | Status | Notes |
|---------|--------|-------|
| Balance Display | ✓ | Current + Available |
| Pending Amount | ✓ | Reserved for active trips |
| Transaction History | ✓ | 50 records, with filtering |
| Total Deposited | ✓ | From journal entries |
| Total Spent | ✓ | From journal entries |
| Deposit Button | ⚠️ | Present but non-functional |

### Carrier Wallet
| Feature | Status | Notes |
|---------|--------|-------|
| Balance Display | ✓ | Shows earnings balance |
| Transaction History | ⚠️ | Limited to 50, no pagination |
| Total Earnings | ✓ | From journal credits |
| Total Withdrawals | ✓ | From journal debits |
| Pending Trips | ✓ | Shows pending earnings |

---

## API Consistency Check

### Field Name Mismatches
| API | Field | Expected | Actual | Status |
|-----|-------|----------|--------|--------|
| Shipper Dashboard | serviceFeeStatus | `shipperFeeStatus` | `serviceFeeStatus` (legacy) | **MISMATCH** |
| Carrier Dashboard | - | - | - | OK |
| Dispatcher Dashboard | - | - | - | OK |

### Decimal Serialization
All panels properly convert Prisma Decimals to Numbers using `Number()` wrapper.

---

## Single Source of Truth Status

| Pattern | Shipper | Carrier | Dispatcher | Notes |
|---------|---------|---------|------------|-------|
| Distance Calc | Uses `lib/geo.ts` | Uses Haversine inline | Uses `/api/routes/distance` | ⚠️ Carrier has inline duplicate |
| Fee Calc | Uses `lib/serviceFeeCalculation.ts` | N/A | N/A | ✓ |
| Role Checks | Session-based | Session-based | Session-based | ✓ Consistent |
| Status Enums | Hardcoded strings | Hardcoded strings | Hardcoded strings | ⚠️ Should use enums |

---

## Prioritized Fix List

### Priority 1: Critical (Fix Immediately)

1. **Fix Dispatcher Dashboard Navigation Links**
   - File: `app/dispatcher/dashboard/DispatcherDashboardClient.tsx`
   - Lines: 483, 546, 1003
   - Change `/carrier/loads/` to `/dispatcher/loads/`
   - Change `/carrier/loadboard` to `/dispatcher/trucks/`

2. **Verify Shipper Dashboard Service Fee Query**
   - File: `app/api/shipper/dashboard/route.ts`
   - Test with actual data to confirm "Total Spent" shows correctly
   - May need to query both `shipperFeeStatus` and legacy `serviceFeeStatus`

### Priority 2: High (Fix This Sprint)

3. **Add Carrier GPS Page Auto-Refresh**
   - File: `app/carrier/gps/page.tsx`
   - Implement WebSocket or polling for real-time updates

4. **Add Carrier Wallet Transaction Pagination**
   - File: `app/carrier/wallet/page.tsx`
   - Add pagination or infinite scroll

5. **Fix Dispatcher FindMatchesModal Data Access**
   - File: `components/dispatcher/FindMatchesModal.tsx`
   - Verify carrier data path: `match.truck.carrier.name`

### Priority 3: Medium (Fix Next Sprint)

6. **Create Dispatcher Proposals API**
   - Create `/api/dispatcher/proposals/route.ts`
   - Replace direct DB queries in proposals page

7. **Standardize API Response Format**
   - All list endpoints should use: `{ data: [...], pagination: {...} }`

8. **Align Shipper Dashboard with Wallet Calculations**
   - Use journal entries for both dashboard and wallet financial data

### Priority 4: Low (Backlog)

9. **Carrier Haversine Distance Consolidation**
   - File: `app/carrier/loadboard/SearchLoadsTab.tsx`
   - Import from `lib/geo.ts` instead of inline calculation

10. **Standardize Error Handling**
    - Create shared error component
    - Use consistently across all panels

11. **Standardize Status Badges**
    - Create shared StatusBadge component
    - Use across all panels

---

## Authentication & Authorization Summary

| Panel | Auth Check | Role Check | Redirect on Fail |
|-------|------------|------------|------------------|
| Shipper | ✓ `requireAuth()` | ✓ `role === 'SHIPPER'` | `/login` or `/unauthorized` |
| Carrier | ✓ `requireAuth()` | ✓ `role === 'CARRIER'` | `/login` or `/unauthorized` |
| Dispatcher | ✓ `requireAuth()` | ✓ `role === 'DISPATCHER'` | `/login` or `/unauthorized` |

All panels properly enforce authentication and authorization.

---

## Test Coverage Recommendations

1. **Shipper Panel**
   - Test load creation flow end-to-end
   - Verify wallet balance matches transaction history
   - Test dashboard stats against database

2. **Carrier Panel**
   - Test truck posting and matching flow
   - Verify trip status transitions
   - Test GPS tracking updates

3. **Dispatcher Panel**
   - Test match proposal creation
   - Verify escalation workflow
   - Test dashboard navigation links

---

*Audit completed: 2026-02-06*
