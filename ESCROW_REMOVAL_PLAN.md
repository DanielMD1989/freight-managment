# Escrow System Removal Plan

**Date:** 2026-02-01
**Reason:** Price negotiation happens OFF PLATFORM. Platform only charges corridor-based service fees.

---

## Current State: 26 Files Reference Escrow

### Files by Action

| File | What it does | Action |
|------|--------------|--------|
| **lib/escrowManagement.ts** (590 lines) | Core escrow logic: hold, release, refund | **DELETE FILE** |
| **app/api/escrow/[loadId]/route.ts** | GET escrow status | **DELETE FILE** |
| **app/api/escrow/[loadId]/hold/route.ts** | Manual escrow hold | **DELETE FILE** |
| **app/api/escrow/[loadId]/release/route.ts** | Manual escrow release | **DELETE FILE** |
| **app/api/escrow/[loadId]/refund/route.ts** | Manual escrow refund | **DELETE FILE** |
| **app/api/loads/[id]/assign/route.ts** | Calls holdFundsInEscrow on assign | **REMOVE LINES** |
| **app/api/loads/[id]/pod/route.ts** | Calls releaseFundsFromEscrow on POD verify | **REMOVE LINES** |
| **app/api/loads/[id]/settle/route.ts** | Checks escrowFunded, calls release | **REMOVE LINES** |
| **app/api/loads/[id]/duplicate/route.ts** | Copies escrowFunded field | **REMOVE LINES** |
| **app/api/trips/[tripId]/cancel/route.ts** | Calls refundEscrowFunds | **REMOVE LINES** |
| **app/api/trips/[tripId]/confirm/route.ts** | Calls releaseFundsFromEscrow | **REMOVE LINES** |
| **app/api/dispatch/route.ts** | Direct escrow balance check + funding | **REMOVE LINES** |
| **app/api/admin/settlements/route.ts** | Uses MANAGE_ESCROW permission | **KEEP** (permission still valid for settlements) |
| **app/api/admin/settlements/[id]/approve/route.ts** | Uses MANAGE_ESCROW permission | **KEEP** (permission still valid) |
| **app/api/admin/settlement-automation/route.ts** | References escrow | **REMOVE LINES** |
| **app/api/admin/dashboard/route.ts** | Fetches escrow balance | **REMOVE LINES** |
| **app/api/admin/analytics/route.ts** | Escrow analytics | **REMOVE LINES** |
| **app/admin/page.tsx** | Displays escrow balance stat | **REMOVE LINES** |
| **app/admin/analytics/AdminAnalyticsClient.tsx** | Escrow charts/stats | **REMOVE LINES** |
| **app/admin/service-fees/page.tsx** | References escrow | **REMOVE LINES** |
| **app/dashboard/admin/financials/page.tsx** | Escrow account display | **REMOVE LINES** |
| **app/shipper/matches/TruckMatchesClient.tsx** | Escrow balance check UI | **REMOVE LINES** |
| **app/page.tsx** | Landing page escrow mention | **REMOVE LINES** |
| **types/domain.ts** | escrowFunded, escrowAmount types | **REMOVE LINES** |
| **lib/rbac/permissions.ts** | MANAGE_ESCROW permission | **KEEP** (rename to MANAGE_SETTLEMENTS) |
| **scripts/seed-test-data.ts** | Seeds escrow data | **REMOVE LINES** |
| **prisma/schema.prisma** | escrowFunded, escrowAmount, ESCROW account type, ESCROW_FUND/RELEASE transaction types | **MODIFY** |

---

## Dependency Analysis

### Does trip creation require escrow?
**NO** - Trip creation in `load-requests/respond`, `truck-requests/respond`, `match-proposals/respond` does NOT use escrow (confirmed: no escrow references found).

### Does POD verification trigger escrow release?
**YES** - But this can be removed. POD verification should only trigger service fee deduction.

### Does settlement use escrow?
**YES** - `settle/route.ts` checks `escrowFunded` and calls `releaseFundsFromEscrow`. After removal, settlement becomes simpler: just mark as settled + deduct service fees.

### Will removing escrow break critical flows?
**NO** - All escrow operations are:
1. Optional (wrapped in try/catch, "fire-and-forget")
2. Independent (assignment succeeds even if escrow fails)
3. Self-contained (no downstream dependencies)

---

## Schema Changes Required

### prisma/schema.prisma

**REMOVE from Load model:**
```prisma
escrowFunded Boolean  @default(false)
escrowAmount Decimal?
```

**REMOVE from FinancialAccountType enum:**
```prisma
ESCROW  // Remove this value
```

**REMOVE from JournalTransactionType enum:**
```prisma
ESCROW_FUND     // Remove
ESCROW_RELEASE  // Remove
```

**KEEP:**
- `REFUND` transaction type (still useful for service fee refunds)
- `settlementStatus` field (still needed)
- `settledAt` field (still needed)

---

## New Simplified Flow

### Before (With Escrow):
```
1. Request approved → Trip created
2. Escrow holds shipper's freight price
3. Carrier delivers + uploads POD
4. Shipper verifies POD
5. Escrow releases to carrier
6. Service fees deducted from both wallets
7. Done
```

### After (Without Escrow):
```
1. Request approved → Trip created
2. Carrier delivers + uploads POD
3. Shipper verifies POD
4. Trip marked COMPLETED
5. Service fees deducted from both wallets (Corridor-based)
6. Done
```

**Key difference:** Platform never handles freight payment. Shipper pays carrier directly (off-platform). Platform only collects service fees.

---

## Files to DELETE (5 files)

```
lib/escrowManagement.ts
app/api/escrow/[loadId]/route.ts
app/api/escrow/[loadId]/hold/route.ts
app/api/escrow/[loadId]/release/route.ts
app/api/escrow/[loadId]/refund/route.ts
```

---

## Files to MODIFY (21 files)

### 1. app/api/loads/[id]/assign/route.ts
**Remove:**
- Import: `import { holdFundsInEscrow, refundEscrowFunds } from '@/lib/escrowManagement'`
- Lines 325-355: Escrow hold logic block
- Lines 402-411: `escrow` in response
- Lines 558-587: Escrow refund on unassignment
- Lines 632-636: `refund` in unassign response

### 2. app/api/loads/[id]/pod/route.ts
**Remove:**
- Import: `import { releaseFundsFromEscrow } from '@/lib/escrowManagement'`
- Lines 307-363: Entire escrow release block
- Lines 374-381: `escrowRelease` in response
- Update success message to remove escrow mention

### 3. app/api/loads/[id]/settle/route.ts
**Remove:**
- Import: `import { releaseFundsFromEscrow } from '@/lib/escrowManagement'`
- Lines 162-166: escrowFunded check
- Lines 170-217: Escrow release path
- Simplify: Just mark as settled + deduct service fees

### 4. app/api/loads/[id]/duplicate/route.ts
**Remove:**
- `escrowFunded: false` and `escrowAmount: null` from duplicate data

### 5. app/api/trips/[tripId]/cancel/route.ts
**Remove:**
- Import: `import { refundEscrowFunds } from '@/lib/escrowManagement'`
- Lines 47-48: `escrowFunded`, `escrowAmount` in select
- Lines 190-231: Entire escrow refund block
- Lines 238-239: `escrowRefunded` in response

### 6. app/api/trips/[tripId]/confirm/route.ts
**Remove:**
- Import: `import { releaseFundsFromEscrow } from '@/lib/escrowManagement'`
- Line 48: `escrowFunded` in select
- Lines 176-210: Entire escrow release block
- Lines 223-231: `escrowRelease` in response

### 7. app/api/dispatch/route.ts
**Remove:**
- Lines 102-116: Balance check for escrow
- Lines 179-180: `escrowFunded: true, escrowAmount`
- Lines 198-205: Escrow funding transaction

### 8. app/api/admin/dashboard/route.ts
**Remove:**
- ESCROW account balance fetch
- `escrowBalance` from response

### 9. app/api/admin/analytics/route.ts
**Remove:**
- Escrow-related analytics

### 10. app/api/admin/settlement-automation/route.ts
**Remove:**
- Escrow references

### 11. app/admin/page.tsx
**Remove:**
- `escrowBalance` stat card
- `escrowBalance` from stats fetch

### 12. app/admin/analytics/AdminAnalyticsClient.tsx
**Remove:**
- Escrow-related charts/displays

### 13. app/admin/service-fees/page.tsx
**Remove:**
- Escrow references

### 14. app/dashboard/admin/financials/page.tsx
**Remove:**
- ESCROW account display

### 15. app/shipper/matches/TruckMatchesClient.tsx
**Remove:**
- Escrow balance check/display

### 16. app/page.tsx
**Remove:**
- Any escrow marketing text

### 17. types/domain.ts
**Remove:**
```typescript
// Escrow & Settlement
escrowFunded: boolean;
escrowAmount?: number | null;
```

### 18. lib/rbac/permissions.ts
**Rename:**
- `MANAGE_ESCROW` → `MANAGE_SETTLEMENTS` (or keep as-is since it's used for settlements)

### 19. scripts/seed-test-data.ts
**Remove:**
- Escrow-related seed data

### 20. prisma/schema.prisma
**Remove:**
- `escrowFunded` field from Load
- `escrowAmount` field from Load
- `ESCROW` from FinancialAccountType
- `ESCROW_FUND` from JournalTransactionType
- `ESCROW_RELEASE` from JournalTransactionType

### 21. Migration file (new)
**Create:**
- Migration to remove escrow fields
- Migrate existing ESCROW accounts (transfer balances if any)
- Handle existing ESCROW_FUND/RELEASE journal entries (keep for history)

---

## Migration Strategy

### Step 1: Check for active escrow
```sql
SELECT COUNT(*) FROM "Load" WHERE "escrowFunded" = true AND "status" NOT IN ('COMPLETED', 'CANCELLED');
SELECT balance FROM "FinancialAccount" WHERE "accountType" = 'ESCROW';
```

### Step 2: If active escrow exists
- Release all pending escrow to carriers
- OR refund to shippers if loads not completed

### Step 3: Schema migration
```sql
-- Remove fields
ALTER TABLE "Load" DROP COLUMN "escrowFunded";
ALTER TABLE "Load" DROP COLUMN "escrowAmount";

-- Keep ESCROW account type for historical data
-- Keep ESCROW_FUND/RELEASE transaction types for audit trail
```

---

## Summary

| Category | Count |
|----------|-------|
| Files to DELETE | 5 |
| Files to MODIFY | 21 |
| Schema fields to remove | 2 (escrowFunded, escrowAmount) |
| Enum values to keep (history) | 3 (ESCROW, ESCROW_FUND, ESCROW_RELEASE) |

**Estimated effort:** Medium
**Risk:** Low (escrow is independent, optional, and non-blocking)
**Breaking changes:** None for API consumers (escrow fields become null/missing)

---

## Ready for Implementation?

When approved, I will:
1. Delete the 5 escrow files
2. Modify the 21 files to remove escrow logic
3. Update schema (keeping enum values for historical data)
4. Create migration for field removal
5. Update types

**Proceed?**
