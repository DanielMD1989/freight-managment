# SERVICE FEE CLEANUP

**Date:** 2026-02-09
**Type:** Code Cleanup
**Status:** COMPLETED

---

## SUMMARY

Cleaned up dead service fee code following the audit in SERVICE-FEE-TIMING-AUDIT.md. The key findings were:
- `reserveServiceFee()` was a NO-OP (deprecated)
- `refundServiceFee()` on CANCELLED found nothing to refund
- RESERVED enum status was never set

## BUSINESS LOGIC (Implemented)

```
1. Trip Acceptance: Validate BOTH shipper AND carrier wallet balances (no deduction)
2. Trip Completion: Deduct fees from BOTH wallets
3. Trip Cancellation: No refund needed (nothing was taken)
```

---

## CHANGES MADE

### FIX 1: Replaced `reserveServiceFee()` with Wallet Validation

**New Function Added:** `lib/serviceFeeManagement.ts`

```typescript
export async function validateWalletBalancesForTrip(
  loadId: string,
  carrierId: string
): Promise<{
  valid: boolean;
  shipperFee: number;
  carrierFee: number;
  shipperBalance: number;
  carrierBalance: number;
  errors: string[];
}>
```

**What it does:**
- Calculates expected fees from corridor configuration
- Checks shipper wallet has sufficient balance for shipper fee
- Checks carrier wallet has sufficient balance for carrier fee
- Returns validation result with specific error messages
- Does NOT deduct any money (validation only)

### FIX 2: Updated Load Assignment Route

**File:** `app/api/loads/[id]/assign/route.ts`

**Changes:**
1. Changed import: `reserveServiceFee` → `validateWalletBalancesForTrip`
2. Added wallet validation before assignment:
```typescript
const walletValidation = await validateWalletBalancesForTrip(loadId, truck.carrierId);
if (!walletValidation.valid) {
  return NextResponse.json({
    error: 'Insufficient wallet balance for trip service fees',
    details: walletValidation.errors,
    fees: {
      shipperFee: walletValidation.shipperFee,
      carrierFee: walletValidation.carrierFee,
      shipperBalance: walletValidation.shipperBalance,
      carrierBalance: walletValidation.carrierBalance,
    },
  }, { status: 400 });
}
```
3. Removed dead `reserveServiceFee()` call
4. Updated response to show validation info instead of fee reservation

### FIX 3: Updated Match Proposal Response Route

**File:** `app/api/match-proposals/[id]/respond/route.ts`

**Changes:**
1. Changed import: `reserveServiceFee` → `validateWalletBalancesForTrip`
2. Added wallet validation before acceptance (same pattern as assign route)
3. Removed dead `reserveServiceFee()` call
4. Updated response to show validation info

### FIX 4: Removed Refund Logic on Cancellation

**File:** `app/api/loads/[id]/status/route.ts`

**Changes:**
1. Removed unused `refundServiceFee` import
2. Removed the `refundServiceFee()` call on CANCELLED status
3. Added explanatory comment:
```typescript
// SERVICE FEE NOTE: No refund needed on CANCELLED.
// Fees are only deducted on COMPLETED, so if we reach CANCELLED,
// no money was ever taken from wallets. The current flow is:
// - Trip acceptance: Validate wallet balances (no deduction)
// - Trip completion: Deduct fees from both wallets
// - Trip cancellation: No action needed (nothing was taken)
```

---

## SERVICE FEE FLOW (After Cleanup)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ TRIP ACCEPTANCE (assign or match-proposal accept)                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ 1. validateWalletBalancesForTrip(loadId, carrierId)                     │
│    - Calculate expected fees from corridor                              │
│    - Check shipper wallet >= shipperFee                                 │
│    - Check carrier wallet >= carrierFee                                 │
│                                                                         │
│ 2. If validation fails → Return 400 with fee details                    │
│ 3. If validation passes → Proceed with assignment                       │
│                                                                         │
│ MONEY MOVEMENT: NONE                                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ TRIP COMPLETION (status → COMPLETED)                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ 1. deductServiceFee(loadId)                                             │
│    - Calculate fees from corridor                                       │
│    - Debit shipper wallet                                               │
│    - Debit carrier wallet                                               │
│    - Credit platform revenue                                            │
│    - Create journal entries                                             │
│                                                                         │
│ MONEY MOVEMENT: Shipper → Platform ← Carrier                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ TRIP CANCELLATION (status → CANCELLED)                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ Nothing happens.                                                        │
│                                                                         │
│ Since fees are only deducted on COMPLETED, and COMPLETED cannot         │
│ transition to CANCELLED, there is never any money to refund.            │
│                                                                         │
│ MONEY MOVEMENT: NONE                                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## DEPRECATED CODE (Still Exists But Not Used)

### `reserveServiceFee()` in `lib/serviceFeeManagement.ts`

```typescript
/**
 * @deprecated New flow deducts fees directly on completion
 */
export async function reserveServiceFee(loadId: string): Promise<ServiceFeeReserveResult> {
  console.warn('DEPRECATED: reserveServiceFee called but does nothing. Use validateWalletBalancesForTrip instead.');
  return {
    success: true,
    serviceFee: new Decimal(0),
    shipperBalance: new Decimal(0),
    error: 'Reserve flow deprecated - fees are deducted on completion',
  };
}
```

**Reason for keeping:** May still be called by other parts of the codebase. Logs a warning to identify remaining callers.

### `refundServiceFee()` in `lib/serviceFeeManagement.ts`

This function still exists but is no longer called from the status route. It may still be useful for admin operations or edge cases where a completed trip needs a refund.

### `RESERVED` Enum Value in Prisma Schema

```prisma
enum ServiceFeeStatus {
  PENDING   // Not yet calculated/reserved
  RESERVED  // Held from wallet when trip starts  <-- NEVER SET
  DEDUCTED  // Moved to platform revenue on completion
  REFUNDED  // Returned to shipper on cancellation
  WAIVED    // Admin waived the fee
}
```

**Recommendation:** Consider removing `RESERVED` in a future migration if not needed.

---

## VERIFICATION

### TypeScript Compilation
```bash
npx tsc --noEmit
# Exit code: 0 (no errors)
```

### Files Modified
1. `lib/serviceFeeManagement.ts` - Added `validateWalletBalancesForTrip()`
2. `app/api/loads/[id]/assign/route.ts` - Use validation instead of reservation
3. `app/api/match-proposals/[id]/respond/route.ts` - Use validation instead of reservation
4. `app/api/loads/[id]/status/route.ts` - Removed refund on cancel

---

## REMAINING CLEANUP (Future Work)

| Item | Priority | Description |
|------|----------|-------------|
| Remove RESERVED enum | LOW | Remove from Prisma schema if confirmed unused |
| Remove dashboard queries for RESERVED | LOW | `lib/aggregation.ts`, `app/api/shipper/dashboard/route.ts` |
| Remove `reserveServiceFee()` function | LOW | After confirming no callers remain |

---

*Cleanup completed: 2026-02-09*
