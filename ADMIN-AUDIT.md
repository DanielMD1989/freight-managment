# Admin Panel Comprehensive Audit

**Date:** 2026-02-06
**Purpose:** Document all admin panel issues before fixing

---

## 1. Admin Roles & Permissions

### Role Hierarchy

| Role | Level | Description |
|------|-------|-------------|
| SUPER_ADMIN | 1 | Full platform access, can manage ADMIN users |
| ADMIN | 2 | Platform operations, cannot manage ADMIN/SUPER_ADMIN |
| DISPATCHER | 3 | Coordination only, read-heavy access |
| CARRIER | 4 | Truck posting and load execution |
| SHIPPER | 5 | Load management only |

### Current Admin Accounts

**Created via scripts/create-admin-user.ts:**
```
email: admin@freight.com
role: ADMIN
org: Platform Administration
```

### Permission Matrix (from lib/rbac/permissions.ts)

| Permission | ADMIN | SUPER_ADMIN |
|------------|-------|-------------|
| CREATE_ADMIN | ✗ | ✓ |
| DELETE_ADMIN | ✗ | ✓ |
| ASSIGN_ROLES | ✗ | ✓ |
| CREATE_OPERATIONAL_USERS | ✓ | ✓ |
| ACTIVATE_DEACTIVATE_USERS | ✓ | ✓ |
| MANAGE_WALLET | ✓ | ✓ |
| VIEW_ALL_ACCOUNTS | ✓ | ✓ |
| VERIFY_ORGANIZATIONS | ✓ | ✓ |
| VERIFY_DOCUMENTS | ✓ | ✓ |
| VIEW_ANALYTICS | ✓ | ✓ |
| VIEW_AUDIT_LOGS | ✓ | ✓ |
| CONFIGURE_SERVICE_FEES | ✓ | ✓ |

**Assessment:** Role hierarchy is properly designed. ADMIN cannot escalate to SUPER_ADMIN.

---

## 2. Code Duplication Audit

### All Admin API Endpoints

| Endpoint | Purpose | File |
|----------|---------|------|
| `/api/admin/dashboard` | Basic stats | `app/api/admin/dashboard/route.ts` |
| `/api/admin/platform-metrics` | Comprehensive metrics | `app/api/admin/platform-metrics/route.ts` |
| `/api/admin/analytics` | Time-period analytics | `app/api/admin/analytics/route.ts` |
| `/api/admin/service-fees/metrics` | Service fee breakdown | `app/api/admin/service-fees/metrics/route.ts` |
| `/api/admin/users` | User management | `app/api/admin/users/route.ts` |
| `/api/admin/users/[id]` | Individual user | `app/api/admin/users/[id]/route.ts` |
| `/api/admin/organizations` | Org list (created recently) | `app/api/admin/organizations/route.ts` |
| `/api/admin/organizations/[id]/verify` | Verify org | `app/api/admin/organizations/[id]/verify/route.ts` |
| `/api/admin/documents` | Document queue | `app/api/admin/documents/route.ts` |
| `/api/admin/corridors` | Corridor management | `app/api/admin/corridors/route.ts` |
| `/api/admin/settlements` | Settlement list | `app/api/admin/settlements/route.ts` |
| `/api/admin/settlements/[id]/approve` | Approve settlement | `app/api/admin/settlements/[id]/approve/route.ts` |
| `/api/admin/audit-logs` | Audit logs | `app/api/admin/audit-logs/route.ts` |
| `/api/admin/settings` | System settings | `app/api/admin/settings/route.ts` |
| `/api/admin/bypass-warnings` | Bypass detection | `app/api/admin/bypass-warnings/route.ts` |

### Metrics Duplication Map

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         METRIC: Total Users                               │
├──────────────────────────────────────────────────────────────────────────┤
│ /api/admin/dashboard        │ db.user.count()                            │
│ /api/admin/platform-metrics │ db.user.count()                            │
│ DUPLICATE: YES              │ Same query, two endpoints                  │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                         METRIC: Total Loads                               │
├──────────────────────────────────────────────────────────────────────────┤
│ /api/admin/dashboard        │ db.load.count()                            │
│ /api/admin/platform-metrics │ db.load.count()                            │
│ /api/admin/analytics        │ db.load.count()                            │
│ /api/shipper/dashboard      │ db.load.count({where: shipperId})          │
│ /api/map                    │ db.load.count({where: ...})                │
│ DUPLICATE: YES              │ 5 places calculate load counts             │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                      METRIC: Active Trips / Active Loads                  │
├──────────────────────────────────────────────────────────────────────────┤
│ /api/admin/dashboard        │ Trip.count(status IN [ASSIGNED,            │
│                             │   PICKUP_PENDING, IN_TRANSIT])             │
│ /api/admin/analytics        │ Load.count(status = IN_TRANSIT)            │
│ CONFLICT: YES               │ Different models, different status sets!   │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                      METRIC: Platform Revenue                             │
├──────────────────────────────────────────────────────────────────────────┤
│ /api/admin/dashboard        │ FinancialAccount.PLATFORM_REVENUE.balance  │
│ /api/admin/analytics        │ FinancialAccount.PLATFORM_REVENUE.balance  │
│ /api/admin/platform-metrics │ Load.serviceFeeEtb sum (LEGACY FIELD!)     │
│ CONFLICT: YES               │ Two different data sources for "revenue"   │
└──────────────────────────────────────────────────────────────────────────┘
```

### Recommended Consolidation

1. **Create `lib/adminMetrics.ts`** - Single source of truth for all admin metrics
2. **Remove `/api/admin/platform-metrics`** - Merge into `/api/admin/analytics`
3. **Remove `/api/admin/dashboard`** - Use analytics endpoint with `period=realtime`

---

## 3. Broken Functionality Audit

### A. Organizations View - PARTIALLY WORKING

**Location:** `app/admin/organizations/page.tsx`

**Issue:** Page calls wrong API endpoint

```typescript
// Line 66 - WRONG
const response = await fetch(`${baseUrl}/api/organizations?${params}`, ...);

// SHOULD BE
const response = await fetch(`${baseUrl}/api/admin/organizations?${params}`, ...);
```

**Root Cause:** Page was created before `/api/admin/organizations` endpoint existed. When we created the endpoint, the page wasn't updated to use it.

**Impact:**
- Page works but uses generic organizations API
- Admin-specific fields (userCount, loadCount, truckCount) not available
- Filtering may not work as expected

**Fix Required:** Update line 66 to call `/api/admin/organizations`

---

### B. Users Edit - FUNCTIONAL

**Location:** `app/admin/users/page.tsx` → `UserManagementClient`

**Status:** Working correctly

**Data Flow:**
1. Page loads users from `/api/admin/users`
2. Edit modal calls `PATCH /api/admin/users/[id]`
3. Can update: phone, status, isActive

**No issues found.**

---

### C. Verification Tab - FUNCTIONAL BUT CONFUSING

**Location:** `app/admin/verification/page.tsx`

**API:** `/api/admin/documents?status=PENDING&entityType=all`

**Filters:**
- status: PENDING, APPROVED, REJECTED, EXPIRED (VerificationStatus enum)
- entityType: company, truck, all

**Status:** Filtering works correctly

**Potential Confusion:**
- Tab shows "Documents" but users might expect "Organizations" or "Trucks"
- The three options (approved/rejected/pending) are for DOCUMENT verification, not entity verification
- Organization verification is separate (`/api/admin/organizations/[id]/verify`)

**No code fix needed** - but UX could be clearer.

---

## 4. Wallet Architecture Review

### Current Admin Pages

| Page | Purpose | API |
|------|---------|-----|
| `/admin/wallets` | All wallets view | Uses AdminWalletsClient |
| `/admin/settlement` | Settlement management | `/api/admin/settlements` |
| `/admin/settlement/review` | Pending settlements | `/api/admin/settlements?status=PENDING` |
| `/admin/settlement/automation-rules` | Auto-settlement rules | `/api/admin/settlement-automation` |

### Wallet Types (FinancialAccount)

| accountType | Purpose | Who Has It |
|-------------|---------|------------|
| SHIPPER_WALLET | Shipper escrow/balance | Each Shipper org |
| CARRIER_WALLET | Carrier earnings | Each Carrier org |
| PLATFORM_REVENUE | Platform's collected fees | Platform (1 account) |

### Issues Identified

1. **"All Wallets" Tab Redundancy**
   - Shows list of all SHIPPER_WALLET and CARRIER_WALLET accounts
   - Each wallet belongs to an organization
   - Better accessed from Organization or User detail page

2. **Admin Has No Wallet**
   - Platform admin organization doesn't need a wallet
   - PLATFORM_REVENUE account is separate from admin's "wallet"
   - Wallet tab in sidebar may confuse admins

3. **Scattered Financial Data**
   - Settlement in one place
   - Wallets in another
   - Platform revenue in analytics
   - No unified "Finance" section

### Wallet Redesign Proposal

**Current Structure:**
```
Admin Sidebar
├── Wallets (All Wallets)
├── Settlement
│   ├── Review
│   └── Automation Rules
├── Service Fees
└── Platform Metrics
```

**Proposed Structure:**
```
Admin Sidebar
├── Finance (consolidated)
│   ├── Platform Revenue (PLATFORM_REVENUE account)
│   ├── Service Fees (collected, pending, refunded)
│   ├── Settlements (pending approvals)
│   └── Automation Rules
├── Organizations
│   └── [Org Detail Page] → Wallet info here
└── Users
    └── [User Detail Page] → Org wallet link here
```

**Benefits:**
- Remove "All Wallets" tab - access wallets from org detail
- Consolidate financial pages under "Finance"
- Admin doesn't see irrelevant "wallet" navigation
- Clearer mental model

---

## 5. Platform Revenue vs Service Fee Duplication

### Current State

**Platform Revenue (`/admin/platform-metrics`):**
- Source: `FinancialAccount.balance` where `accountType = PLATFORM_REVENUE`
- Shows: Total accumulated platform revenue
- This is the running balance - money available to platform

**Service Fees (`/admin/service-fees`):**
- Source: `Load.serviceFeeEtb` grouped by status (LEGACY FIELD!)
- Also: `Load.shipperServiceFee` and `Load.carrierServiceFee` (NEW FIELDS)
- Shows: Fee breakdown by corridor, status, period

### Data Model Analysis

```
Load table:
  serviceFeeEtb         Decimal? (LEGACY - being phased out)
  shipperServiceFee     Decimal? (NEW - shipper's fee)
  carrierServiceFee     Decimal? (NEW - carrier's fee)
  serviceFeeStatus      ServiceFeeStatus? (PENDING, RESERVED, DEDUCTED, REFUNDED)
  shipperFeeStatus      String?
  carrierFeeStatus      String?
```

### Issue: Legacy Field Usage

**`/api/admin/service-fees/metrics/route.ts`:**
```typescript
// Line 86 - Uses LEGACY field
_sum: { serviceFeeEtb: true }
```

**`/api/admin/platform-metrics/route.ts`:**
```typescript
// Line 86 - Also uses LEGACY field
db.load.aggregate({
  _sum: { serviceFeeEtb: true }
})
```

**Problem:** New loads may have `serviceFeeEtb = null` if using new fee structure.

### Revenue/Fee Merge Proposal

**Keep Separate But Fix:**

1. **Platform Revenue** - Show `PLATFORM_REVENUE` account balance
   - This is "cash in hand"
   - Used for: How much money does platform have?

2. **Service Fee Analytics** - Use NEW fee fields
   - `shipperServiceFee` + `carrierServiceFee`
   - Grouped by: period, corridor, status
   - Used for: Revenue trends, corridor performance

**Consolidate Under "Finance" Section:**
```
/admin/finance
├── Overview (dashboard)
│   ├── Platform Balance: $X (from PLATFORM_REVENUE)
│   ├── Pending Settlements: $Y
│   └── This Month Revenue: $Z (from fee sum)
├── Revenue Analytics (charts)
├── Settlements (approve/deny)
└── Fee Configuration
```

---

## 6. Single Source of Truth Violations

### Metrics Calculated in Multiple Places

| Metric | Files | Consistent? |
|--------|-------|-------------|
| Total Users | dashboard, platform-metrics | ✓ Yes |
| Total Loads | dashboard, platform-metrics, analytics, map | ✓ Yes |
| Total Trucks | dashboard, platform-metrics | ✓ Yes |
| Active Trips | dashboard (Trip model), analytics (Load model) | **✗ NO** |
| Platform Revenue | dashboard (account), platform-metrics (fee sum) | **✗ NO** |
| Total Revenue | analytics, service-fees | **✗ NO** |

### Active Trips Inconsistency

**`/api/admin/dashboard/route.ts`:**
```typescript
db.trip.count({
  where: { status: { in: ["ASSIGNED", "PICKUP_PENDING", "IN_TRANSIT"] } }
})
// Returns: Count of Trip records in active states
```

**`/api/admin/analytics/route.ts`:**
```typescript
db.load.count({
  where: { status: "IN_TRANSIT" }
})
// Returns: Count of Load records in IN_TRANSIT only
```

**Problem:** Different numbers will be displayed depending on which API is called.

### Revenue Inconsistency

**Source 1: Account Balance**
```typescript
db.financialAccount.findFirst({
  where: { accountType: "PLATFORM_REVENUE" },
  select: { balance: true }
})
// Returns: Running balance (includes deposits minus withdrawals)
```

**Source 2: Fee Aggregation**
```typescript
db.load.aggregate({
  where: { serviceFeeStatus: "DEDUCTED" },
  _sum: { serviceFeeEtb: true }
})
// Returns: Sum of all deducted fees (historical total)
```

**Problem:** These can differ due to:
- Manual adjustments to platform account
- Refunds processed outside fee system
- Initial seed balance

---

## 7. All Admin Pages Inventory

| Page | Path | Status |
|------|------|--------|
| Dashboard | `/admin` | Working |
| Analytics | `/admin/analytics` | Working |
| Platform Metrics | `/admin/platform-metrics` | Working (uses legacy field) |
| Service Fees | `/admin/service-fees` | Working (uses legacy field) |
| Users | `/admin/users` | Working |
| Organizations | `/admin/organizations` | **WRONG API** |
| Loads | `/admin/loads` | Working |
| Trucks | `/admin/trucks` | Working |
| Trucks Pending | `/admin/trucks/pending` | Working |
| Trips | `/admin/trips` | Working |
| Wallets | `/admin/wallets` | Working (questionable UX) |
| Settlement | `/admin/settlement` | Working |
| Settlement Review | `/admin/settlement/review` | Working |
| Automation Rules | `/admin/settlement/automation-rules` | Working |
| Corridors | `/admin/corridors` | Working |
| Verification | `/admin/verification` | Working |
| Bypass Review | `/admin/bypass-review` | Working |
| Map | `/admin/map` | Working |
| GPS | `/admin/gps` | Working |
| Audit Logs | `/admin/audit-logs` | Working |
| Settings | `/admin/settings` | Working |
| Security | `/admin/security` | Working |
| Health | `/admin/health` | Working |
| Feature Flags | `/admin/feature-flags` | Working |

---

## 8. Recommended Fixes (Prioritized)

### Priority 1: CRITICAL (Data Accuracy)

1. **Fix Active Trips Calculation**
   - Align dashboard and analytics to use same model/status set
   - Recommendation: Use Trip model with statuses [ASSIGNED, PICKUP_PENDING, IN_TRANSIT]

2. **Fix Legacy Field Usage**
   - Update `/api/admin/service-fees/metrics` to use `shipperServiceFee + carrierServiceFee`
   - Update `/api/admin/platform-metrics` similarly
   - Add fallback: `serviceFeeEtb || (shipperServiceFee + carrierServiceFee)`

3. **Fix Organizations Page API Call**
   - Change line 66 in `app/admin/organizations/page.tsx`
   - From: `/api/organizations`
   - To: `/api/admin/organizations`

### Priority 2: HIGH (Code Quality)

4. **Create Centralized Metrics Library**
   - New file: `lib/adminMetrics.ts`
   - Export functions: `getTotalUsers()`, `getTotalLoads()`, `getActiveTrips()`, etc.
   - All admin endpoints import from here

5. **Consolidate Admin Dashboard Endpoints**
   - Merge `/api/admin/dashboard` into `/api/admin/analytics`
   - Add `period=realtime` option to analytics
   - Remove duplicate endpoint

### Priority 3: MEDIUM (UX Improvements)

6. **Restructure Finance Section**
   - Create `/admin/finance` consolidated page
   - Move wallets access to organization detail
   - Group: revenue, settlements, fees under Finance

7. **Clarify Verification Tab**
   - Add subtitle: "Document Verification Queue"
   - Link to Organization Verification separately

### Priority 4: LOW (Nice to Have)

8. **Add Admin Metrics Cache**
   - Cache expensive counts for 60 seconds
   - Reduce database load on admin dashboard

9. **Add Health Checks to Verification**
   - Show "Last sync" time for metrics
   - Alert if calculations are stale

---

## Summary

| Category | Issues Found |
|----------|-------------|
| API Duplication | 3 endpoints calculating same metrics |
| Data Inconsistency | 2 metrics with conflicting calculations |
| Wrong API Calls | 1 page calling wrong endpoint |
| Legacy Field Usage | 2 endpoints using deprecated fields |
| UX Confusion | 2 areas with unclear navigation |

**Immediate Actions Required:**
1. Fix organizations page API call
2. Align active trips calculation
3. Update legacy field usage

**Medium-term Actions:**
4. Create centralized metrics library
5. Consolidate finance section
