# ATOMICITY FIX — Service Fee Balance Updates

**Date:** 2026-02-08
**Type:** Critical Financial Integrity Fix
**Severity:** HIGH
**Status:** COMPLETE

---

## THE PROBLEM

In `lib/serviceFeeManagement.ts`, balance updates were performed OUTSIDE the transaction that created the journal entry. This created a race condition where:

1. Journal entry created successfully ✓
2. Shipper wallet update could fail ✗
3. Carrier wallet update could succeed ✓
4. Platform revenue update could succeed ✓

**Result:** Inconsistent financial state where the accounting journal doesn't match actual wallet balances.

### Before (Non-Atomic):

```javascript
// lib/serviceFeeManagement.ts - BEFORE FIX

// Step 1: Create journal entry (lines 373-400)
const journalEntry = await db.journalEntry.create({ ... });
transactionId = journalEntry.id;

// Step 2: Update balances separately with Promise.all (lines 402-432)
// NOT IN SAME TRANSACTION!
const balanceUpdates = [];
balanceUpdates.push(db.financialAccount.update({ balance: { decrement: ... } }));
balanceUpdates.push(db.financialAccount.update({ balance: { decrement: ... } }));
balanceUpdates.push(db.financialAccount.update({ balance: { increment: ... } }));
await Promise.all(balanceUpdates);  // <-- COULD PARTIALLY FAIL

// Step 3: Update load (line 436-453)
await db.load.update({ ... });  // <-- COULD FAIL AFTER BALANCES UPDATED
```

---

## THE FIX

Wrapped ALL financial operations in a single Prisma `$transaction`:

### After (Atomic):

```javascript
// lib/serviceFeeManagement.ts - AFTER FIX

const result = await db.$transaction(async (tx) => {
  // Re-verify balances inside transaction (prevents race conditions)
  if (shipperDeducted && shipperWallet && shipperFeeCalc.finalFee > 0) {
    const currentShipperWallet = await tx.financialAccount.findUnique({
      where: { id: shipperWallet.id },
      select: { balance: true },
    });
    if (!currentShipperWallet ||
        new Decimal(currentShipperWallet.balance).lessThan(shipperFeeCalc.finalFee)) {
      throw new Error(`Insufficient shipper balance for fee deduction`);
    }
  }

  // 1. Create journal entry with all lines
  const journalEntry = await tx.journalEntry.create({ ... });

  // 2. Update shipper wallet balance (atomic with journal)
  if (shipperDeducted && shipperWallet && shipperFeeCalc.finalFee > 0) {
    await tx.financialAccount.update({
      where: { id: shipperWallet.id },
      data: { balance: { decrement: shipperFeeCalc.finalFee } },
    });
  }

  // 3. Update carrier wallet balance (atomic with journal)
  if (carrierDeducted && carrierWallet && carrierFeeCalc.finalFee > 0) {
    await tx.financialAccount.update({
      where: { id: carrierWallet.id },
      data: { balance: { decrement: carrierFeeCalc.finalFee } },
    });
  }

  // 4. Credit platform revenue (atomic with journal)
  if (totalDeducted > 0) {
    await tx.financialAccount.update({
      where: { id: platformAccountId },
      data: { balance: { increment: totalDeducted } },
    });
  }

  // 5. Update load with fee information (atomic with journal)
  await tx.load.update({ ... });

  return journalEntry.id;
});

transactionId = result;
```

---

## FUNCTIONS FIXED

### 1. `deductServiceFee()` (lines 370-495)

| Operation | Before | After |
|-----------|--------|-------|
| Journal entry creation | Separate | In $transaction |
| Shipper wallet debit | Promise.all | In $transaction |
| Carrier wallet debit | Promise.all | In $transaction |
| Platform revenue credit | Promise.all | In $transaction |
| Load fee update | Separate | In $transaction |
| Balance verification | Before transaction | Inside transaction (double-check) |

### 2. `refundServiceFee()` (lines 610-693)

| Operation | Before | After |
|-----------|--------|-------|
| Journal entry creation | Separate | In $transaction |
| Platform revenue debit | Promise.all | In $transaction |
| Shipper wallet credit | Promise.all | In $transaction |
| Load status update | Separate | In $transaction |
| Balance verification | None | Added inside transaction |

---

## ADDITIONAL IMPROVEMENTS

### 1. Balance Verification Inside Transaction

Added balance re-verification INSIDE the transaction to prevent race conditions:

```javascript
// Re-verify shipper balance inside transaction
if (shipperDeducted && shipperWallet && shipperFeeCalc.finalFee > 0) {
  const currentShipperWallet = await tx.financialAccount.findUnique({
    where: { id: shipperWallet.id },
    select: { balance: true },
  });
  if (!currentShipperWallet ||
      new Decimal(currentShipperWallet.balance).lessThan(shipperFeeCalc.finalFee)) {
    throw new Error(`Insufficient shipper balance for fee deduction`);
  }
}
```

**Why:** Between the initial balance check and the actual deduction, another process could have modified the balance. Checking inside the transaction ensures we have the latest balance under transaction isolation.

### 2. reserveServiceFee Deprecation

The `reserveServiceFee()` function is properly deprecated:

```javascript
/**
 * @deprecated New flow deducts fees directly on completion
 */
export async function reserveServiceFee(loadId: string): Promise<ServiceFeeReserveResult> {
  return {
    success: true,
    serviceFee: new Decimal(0),
    shipperBalance: new Decimal(0),
    error: 'Reserve flow deprecated - fees are deducted on completion',
  };
}
```

**Status:** Function is a no-op stub that returns immediately. Callers receive a clear deprecation message.

---

## SERVICE FEE TIMING (Documented)

The service fee operations are intentionally processed AFTER the main status update transaction:

```javascript
// app/api/loads/[id]/status/route.ts:244-248
// NOTE: Service fee operations are intentionally outside the main transaction because:
// 1. They may call external payment services (cannot be rolled back)
// 2. Status change should succeed even if fee processing fails
// 3. deductServiceFee/refundServiceFee have internal idempotency checks
```

**Rationale:**
- Status changes are business-critical and must succeed
- Fee processing is secondary and can be retried
- Idempotency checks prevent double-charging/double-refunding

---

## VERIFICATION

### TypeScript Compilation
```bash
npx tsc --noEmit
# Passes with no errors
```

### Behavior Tests
```bash
npx jest __tests__/behavior-snapshots.test.ts
# 44 tests pass
```

---

## BEFORE/AFTER COMPARISON

### deductServiceFee - Key Changes

**BEFORE (lines 370-433):**
```javascript
// Journal entry - NOT IN TRANSACTION
const journalEntry = await db.journalEntry.create({ ... });

// Balance updates - SEPARATE, NON-ATOMIC
await Promise.all([
  db.financialAccount.update({ balance: { decrement: shipperFee } }),
  db.financialAccount.update({ balance: { decrement: carrierFee } }),
  db.financialAccount.update({ balance: { increment: totalDeducted } }),
]);

// Load update - SEPARATE
await db.load.update({ ... });
```

**AFTER (lines 370-495):**
```javascript
const result = await db.$transaction(async (tx) => {
  // Balance verification
  // Journal entry
  // Shipper wallet update
  // Carrier wallet update
  // Platform revenue update
  // Load update
  // ALL ATOMIC - ALL SUCCEED OR ALL FAIL
  return journalEntry.id;
});
```

---

## TRUST STATUS

| Concern | Before | After |
|---------|--------|-------|
| Financial atomicity | BROKEN | FIXED |
| Race condition prevention | NONE | ADDED |
| Balance verification | OUTSIDE TX | INSIDE TX |
| Journal/Balance consistency | AT RISK | GUARANTEED |

---

*Fix applied: 2026-02-08*
*All balance updates are now atomic with journal entries*
