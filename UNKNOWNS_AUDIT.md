# Unknowns Audit Report

**Generated:** 2026-02-01
**Purpose:** Detailed verification of 5 specific implementation questions

---

## 1. ESCROW - What Amount is Held?

### Question
Is it the freight price or the service fee that goes into escrow?

### Answer: **FREIGHT PRICE (Total Fare)**

### Code Evidence

**File:** `lib/escrowManagement.ts` (lines 82-88)
```typescript
// Get total fare (use totalFareEtb if available, otherwise fall back to rate)
const totalFare = load.totalFareEtb
  ? new Decimal(load.totalFareEtb)
  : new Decimal(load.rate);

// Escrow amount = just the fare (service fees are handled separately)
const escrowAmount = totalFare;
```

### Flow Summary
| Event | Amount | Source → Destination |
|-------|--------|---------------------|
| Load Assigned | `totalFareEtb` (or `rate`) | Shipper Wallet → ESCROW |
| POD Verified | Full escrow amount | ESCROW → Carrier Wallet |
| Trip Completed | Service fees (corridor-based) | Shipper Wallet → PLATFORM_REVENUE |
| Trip Completed | Service fees (corridor-based) | Carrier Wallet → PLATFORM_REVENUE |

### Key Points
- Escrow holds the **full freight price** (what the shipper pays the carrier)
- Service fees are deducted **separately** at completion, not from escrow
- Comment on line 87: "Escrow amount = just the fare (service fees are handled separately)"
- On release (line 313-314): "Carrier payout = full fare (service fees are handled separately)"

### Is This Correct?
**YES** - This is the correct design pattern:
1. Shipper funds are protected in escrow during transit
2. Carrier receives full fare upon verified delivery
3. Platform service fees are deducted from both wallets at completion
4. Clean separation of concerns between payment guarantee and platform fees

### Recommendation: **KEEP**

---

## 2. BYPASS DETECTION - What is This?

### Question
What does `lib/bypassDetection.ts` do and is it actively used?

### Answer: **Anti-Platform Bypass Detection System**

### Purpose
Detects when shippers or carriers attempt to circumvent the platform by:
1. Viewing contact information then cancelling loads
2. Establishing direct off-platform deals

### Code Evidence

**File:** `lib/bypassDetection.ts`

**Detection Rules (lines 93-140):**
```typescript
// Rule 1 & 2: >50% cancellation after contact view AND 3+ suspicious cancellations
if (cancellationAfterViewRate > 50 && organization.suspiciousCancellationCount >= 3) {
  return true;
}

// Rule 3: High overall cancellation rate (>70%)
if (organization.cancellationRate && Number(organization.cancellationRate) > 70) {
  return true;
}

// Rule 4: Multiple bypass reports (3+)
if (organization.bypassAttemptCount >= 3) {
  return true;
}
```

### Active Usage - YES

**File:** `app/api/loads/[id]/status/route.ts` (line 400)
```typescript
await checkSuspiciousCancellation(loadId).catch(console.error);
```

**File:** `app/api/loads/[id]/route.ts` (line 455)
```typescript
await checkSuspiciousCancellation(id);
```

**File:** `app/api/loads/[id]/report-bypass/route.ts` (lines 36)
```typescript
await recordBypassReport(loadId, session.userId, validatedData.reason);
```

### Functions Available
| Function | Purpose |
|----------|---------|
| `trackContactView()` | Records when user views contact info |
| `checkSuspiciousCancellation()` | Flags cancellations within 48hrs of contact view |
| `recordBypassReport()` | Allows carriers to report off-platform dealing |
| `detectSuspiciousPattern()` | Evaluates org for bypass behavior |
| `flagUserForReview()` | Marks org for admin review |
| `getPlatformBenefits()` | Returns list of reasons to stay on-platform |

### Is This Correct?
**YES** - Well-designed anti-bypass system that:
- Tracks suspicious behavior patterns
- Sends graduated warnings (1st offense → multiple offenses → flagging)
- Allows peer reporting
- Flags for manual review rather than auto-banning

### Recommendation: **KEEP**

---

## 3. FEE STATUS FLOW - Is This Real?

### Question
Show the actual status transitions for service fees.

### Answer: **YES - Fully Implemented**

### Schema Definition

**File:** `prisma/schema.prisma`
```prisma
enum ServiceFeeStatus {
  PENDING    // Fee calculated but not yet deducted
  RESERVED   // (Not currently used in new flow)
  DEDUCTED   // Fee successfully deducted from wallet
  REFUNDED   // Fee returned on cancellation
  WAIVED     // Admin override - fee not charged
}
```

### Code Evidence

**File:** `lib/serviceFeeManagement.ts`

**Initial State (implicit):** `PENDING` when load is created

**Deduction (lines 424-428):**
```typescript
shipperFeeStatus: shipperDeducted ? 'DEDUCTED' : 'PENDING',
// ...
carrierFeeStatus: carrierDeducted ? 'DEDUCTED' : 'PENDING',
```

**Refund (line 507, 593):**
```typescript
shipperFeeStatus: 'REFUNDED',
```

**Waiver (lines 178-179):**
```typescript
shipperFeeStatus: 'WAIVED',
carrierFeeStatus: 'WAIVED',
```

### Actual Status Flow
```
                    ┌─────────────────────────────────────┐
                    │            PENDING                   │
                    │   (Fee calculated, not deducted)     │
                    └────────────────┬────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
              ▼                      ▼                      ▼
      ┌───────────────┐    ┌─────────────────┐    ┌─────────────────┐
      │   DEDUCTED    │    │    REFUNDED     │    │     WAIVED      │
      │  (Completed)  │    │  (Cancelled)    │    │  (Admin)        │
      └───────────────┘    └─────────────────┘    └─────────────────┘
```

### Is This Correct?
**YES** - Status flow is properly implemented:
- `PENDING` → `DEDUCTED` on successful completion
- `PENDING` → `REFUNDED` on cancellation
- `PENDING` → `WAIVED` on admin override
- Note: `RESERVED` exists in enum but not used (new flow doesn't pre-reserve fees)

### Recommendation: **KEEP** (Consider removing unused `RESERVED` status)

---

## 4. NAMING INCONSISTENCIES - Field Name Variants

### Question
Find all field name variants for service fees and pricing.

### Evidence

**File:** `prisma/schema.prisma` (lines 640-646, 1784-1790)

### Load Table Fields
| Field | Type | Purpose | Status |
|-------|------|---------|--------|
| `serviceFeeEtb` | Decimal(10,2) | Shipper service fee | **LEGACY** |
| `shipperServiceFee` | Decimal(10,2) | Shipper service fee amount | **CURRENT** |
| `carrierServiceFee` | Decimal(10,2) | Carrier service fee amount | **CURRENT** |

**Schema comments:**
```prisma
serviceFeeEtb        Decimal?  // Shipper service fee (legacy field)
shipperServiceFee    Decimal?  // Shipper service fee amount
carrierServiceFee    Decimal?  // Carrier service fee amount
```

### Corridor Table Fields
| Field | Type | Purpose | Status |
|-------|------|---------|--------|
| `pricePerKm` | Decimal(10,4) | ETB per km for shipper | **LEGACY** |
| `shipperPricePerKm` | Decimal(10,4) | ETB per km for shipper | **CURRENT** |
| `carrierPricePerKm` | Decimal(10,4) | ETB per km for carrier | **CURRENT** |

**Schema comments:**
```prisma
pricePerKm        Decimal  // ETB per km for shipper service fee (legacy, use shipperPricePerKm)
shipperPricePerKm Decimal? // ETB per km for shipper (if null, use pricePerKm)
carrierPricePerKm Decimal? // ETB per km for carrier service fee
```

### Also Found: Rate vs TotalFare
| Field | Status |
|-------|--------|
| `rate` | Legacy - gross fare |
| `totalFareEtb` | Current - total fare |

### Is This Problematic?
**PARTIALLY** - Legacy fields are maintained for backward compatibility:
- Code correctly falls back: `shipperPricePerKm ?? pricePerKm`
- Comments clearly mark fields as "legacy"
- No data inconsistency - just naming evolution

### Recommendation: **FIX (Low Priority)**
Consider a migration to:
1. Populate `shipperPricePerKm` from `pricePerKm` where null
2. Populate `shipperServiceFee` from `serviceFeeEtb` where null
3. Eventually deprecate legacy fields

---

## 5. DEAD PAGES - Are They Used?

### Question
Confirm `/dashboard/*`, `/driver/*`, `/ops/*` are unused.

### Evidence

### /dashboard/* (21 pages)
**Location:** `app/dashboard/`

**Files Found:**
- `page.tsx` - Main dashboard
- `layout.tsx` - Dashboard layout
- `loads/`, `trucks/`, `wallet/`, `gps/`, `dispatch/`, `documents/`
- `admin/users/`, `admin/organizations/`, `admin/financials/`, `admin/verification/`
- `organization/setup/`

**Usage Check:** Internal links within `/dashboard/` pages reference each other
```tsx
// app/dashboard/trucks/page.tsx:153
href={`/dashboard/trucks/${truck.id}`}

// app/dashboard/loads/page.tsx:106
href="/dashboard/loads/new"
```

**External References:**
- `lib/email.ts:607` - Email templates link to `/dashboard`
- `app/unauthorized/page.tsx:57` - Redirects to `/dashboard`

**Status:** **PARTIALLY DEAD** - Self-contained legacy portal, not in main navigation but still referenced in emails and redirects

### /driver/* (1 page)
**Location:** `app/driver/page.tsx`

**Purpose:** Mobile-first driver dashboard for viewing assigned loads

**Access Control (lines 188-189):**
```typescript
if (!session || (session.role !== 'DRIVER' && session.role !== 'ADMIN')) {
  redirect('/unauthorized');
}
```

**Problem:** `DRIVER` role is not in the `UserRole` enum:
```prisma
enum UserRole {
  SHIPPER
  CARRIER
  DISPATCHER
  ADMIN
  SUPER_ADMIN
}
```

**Status:** **DEAD** - References non-existent `DRIVER` role

### /ops/* (1 page)
**Location:** `app/ops/page.tsx`

**Purpose:** Platform Operations Dashboard for SUPER_ADMIN/ADMIN

**Access Control (lines 355-360):**
```typescript
if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')) {
  redirect('/unauthorized');
}
```

**Features:**
- Stats overview (active loads, trucks, pending docs, GPS coverage)
- Quick actions to admin pages
- Dispatch board with active loads
- Links to admin tools

**Navigation:** Not in any sidebar navigation

**Status:** **ORPHANED BUT FUNCTIONAL** - Works for admins, just not discoverable

### Summary Table
| Path | Pages | Status | In Navigation | Recommendation |
|------|-------|--------|---------------|----------------|
| `/dashboard/*` | 21 | Legacy Portal | NO | **CONSOLIDATE OR DELETE** |
| `/driver/*` | 1 | Broken (DRIVER role) | NO | **DELETE** |
| `/ops/*` | 1 | Works (admin only) | NO | **KEEP OR MERGE INTO /admin** |

### Recommendations

**1. `/dashboard/*` - CONSOLIDATE**
- These appear to be a legacy pre-role-split dashboard
- Modern portals are `/shipper/*`, `/carrier/*`, `/admin/*`
- Options:
  - A) Delete if unused
  - B) Redirect `/dashboard` to role-appropriate portal

**2. `/driver/*` - DELETE**
- References non-existent `DRIVER` role
- Drivers are likely handled via carrier organization structure
- Page will never load successfully for any user

**3. `/ops/*` - KEEP OR MERGE**
- Functional admin operations dashboard
- Could be valuable quick-access page for admins
- Options:
  - A) Add to admin navigation sidebar
  - B) Merge features into `/admin` dashboard

---

## Summary

| Item | Status | Action |
|------|--------|--------|
| 1. Escrow Amount | Correct (full fare) | **KEEP** |
| 2. Bypass Detection | Active & well-designed | **KEEP** |
| 3. Fee Status Flow | Fully implemented | **KEEP** |
| 4. Naming Inconsistencies | Legacy compatibility | **FIX (Low Priority)** |
| 5a. /dashboard/* | Legacy portal | **CONSOLIDATE/DELETE** |
| 5b. /driver/* | Broken (invalid role) | **DELETE** |
| 5c. /ops/* | Orphaned but functional | **KEEP/MERGE** |

---

*Audit completed 2026-02-01*
