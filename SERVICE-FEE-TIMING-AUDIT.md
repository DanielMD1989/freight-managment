# SERVICE FEE TIMING AUDIT

**Date:** 2026-02-08
**Type:** Read-Only Audit
**Status:** CRITICAL FINDING

---

## QUESTION 1: WHEN IS SERVICE FEE DEDUCTED?

### Answer: Only on status change to `COMPLETED`

**Trigger Location:** `app/api/loads/[id]/status/route.ts:250-259`

```javascript
if (newStatus === 'COMPLETED') {
  // Deduct service fees from both shipper and carrier on completion
  if (!existingFeeEvent) {
    serviceFeeResult = await deductServiceFee(loadId);
  }
}
```

**Code Path:**
```
POST /api/loads/:id/status { status: 'COMPLETED' }
    │
    └─► app/api/loads/[id]/status/route.ts:250
            │
            └─► deductServiceFee(loadId) @ lib/serviceFeeManagement.ts:98
```

**Also called from:** `lib/loadAutomation.ts:121` (automated load settlement)

---

## QUESTION 2: WHAT HAPPENS ON TRIP CANCELLED?

### Answer: `refundServiceFee()` is called, but it usually finds NOTHING to refund

**Trigger Location:** `app/api/loads/[id]/status/route.ts:282-291`

```javascript
} else if (newStatus === 'CANCELLED') {
  // Refund service fee to shipper on cancellation
  if (!existingRefundEvent) {
    serviceFeeResult = await refundServiceFee(loadId);
  }
}
```

**What refundServiceFee() actually does:**

```javascript
// lib/serviceFeeManagement.ts:559-582
const feeToRefund = load.shipperServiceFee
  ? new Decimal(load.shipperServiceFee)
  : load.serviceFeeEtb
    ? new Decimal(load.serviceFeeEtb)
    : new Decimal(0);

if (feeToRefund.isZero()) {
  // Mark as refunded even if zero
  await db.load.update({
    data: {
      shipperFeeStatus: 'REFUNDED',
      serviceFeeStatus: 'REFUNDED',
      serviceFeeRefundedAt: new Date(),
    },
  });

  return {
    success: true,
    serviceFee: new Decimal(0),
    error: 'No fee to refund',  // <-- THIS IS WHAT HAPPENS
  };
}
```

**Key Finding:** `shipperServiceFee` and `serviceFeeEtb` are only populated when `deductServiceFee()` is called (on COMPLETED). So if a trip is cancelled BEFORE completion, there is NOTHING to refund.

---

## QUESTION 3: IS THERE A RESERVATION SYSTEM?

### Answer: NO - The reservation system is DEPRECATED and does NOTHING

**reserveServiceFee() is called in two places:**
1. `app/api/loads/[id]/assign/route.ts:333` - On load assignment
2. `app/api/match-proposals/[id]/respond/route.ts:325` - On match proposal acceptance

**But the function does NOTHING:**

```javascript
// lib/serviceFeeManagement.ts:700-708
/**
 * @deprecated New flow deducts fees directly on completion
 */
export async function reserveServiceFee(loadId: string): Promise<ServiceFeeReserveResult> {
  // In the new flow, we don't reserve fees upfront
  // Fees are calculated and deducted when trip completes
  return {
    success: true,
    serviceFee: new Decimal(0),
    shipperBalance: new Decimal(0),
    error: 'Reserve flow deprecated - fees are deducted on completion',
  };
}
```

**The enum suggests a reservation flow was INTENDED:**

```prisma
enum ServiceFeeStatus {
  PENDING   // Not yet calculated/reserved
  RESERVED  // Held from wallet when trip starts  <-- NEVER USED
  DEDUCTED  // Moved to platform revenue on completion
  REFUNDED  // Returned to shipper on cancellation
  WAIVED    // Admin waived the fee
}
```

**But no code currently sets status to RESERVED.**

---

## QUESTION 4: ACTUAL MONEY FLOW TIMELINE

| Stage | Status | Wallet Movement | Fee Status |
|-------|--------|-----------------|------------|
| 1. Load POSTED | POSTED | None | PENDING |
| 2. Load ASSIGNED | ASSIGNED | **NONE** (reserveServiceFee is no-op) | PENDING |
| 3. Trip IN_TRANSIT | IN_TRANSIT | None | PENDING |
| 4. Trip DELIVERED | DELIVERED | None | PENDING |
| 5. Trip COMPLETED | COMPLETED | **SHIPPER & CARRIER DEBITED, PLATFORM CREDITED** | DEDUCTED |
| 6. Trip CANCELLED (before COMPLETED) | CANCELLED | **NONE** (nothing to refund) | REFUNDED (marked, not actual) |

### If cancelled BEFORE completion:
```
┌─────────────────────────────────────────────────────────────────┐
│ CANCELLATION BEFORE COMPLETION                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 1. refundServiceFee() is called                                 │
│ 2. Checks load.shipperServiceFee → NULL (never set)             │
│ 3. Checks load.serviceFeeEtb → NULL (never set)                 │
│ 4. feeToRefund = 0                                              │
│ 5. Returns: { success: true, error: 'No fee to refund' }        │
│ 6. Sets status to REFUNDED anyway                               │
│                                                                 │
│ ACTUAL MONEY MOVEMENT: NONE                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### If cancelled AFTER completion (impossible per state machine):
```
Valid transitions from COMPLETED: []  // None!
COMPLETED cannot transition to CANCELLED.
```

---

## QUESTION 5: DOES THE CURRENT LOGIC MAKE SENSE?

### Answer: PARTIALLY - There are logical gaps

**The intended flow (based on enum):**
1. ASSIGNED → Reserve fee (hold from shipper)
2. COMPLETED → Deduct fee (move hold to platform)
3. CANCELLED → Refund fee (return hold to shipper)

**The actual flow (based on code):**
1. ASSIGNED → Nothing happens (reserveServiceFee is no-op)
2. COMPLETED → Fee deducted directly from wallets
3. CANCELLED → Nothing to refund (no hold exists)

### Issues Found:

| Issue | Severity | Description |
|-------|----------|-------------|
| Dead code | MEDIUM | `reserveServiceFee()` is called but does nothing |
| Misleading status | LOW | Status set to 'REFUNDED' even when nothing was refunded |
| Enum mismatch | LOW | RESERVED status exists but is never set |
| Dashboard queries | MEDIUM | Queries filter for RESERVED status that never exists |

### Code calling reserveServiceFee (dead calls):
```
app/api/loads/[id]/assign/route.ts:333
app/api/match-proposals/[id]/respond/route.ts:325
```

### Code querying RESERVED status (will never match):
```
lib/aggregation.ts:128     - shipperFeeStatus: 'RESERVED'
lib/aggregation.ts:293     - shipperFeeStatus: 'RESERVED'
app/api/shipper/dashboard/route.ts:110 - shipperFeeStatus: 'RESERVED'
```

---

## ACTUAL CODE BEHAVIOR SUMMARY

### What the code ACTUALLY does:

```
POSTED → ASSIGNED → IN_TRANSIT → DELIVERED → COMPLETED → (terminal)
                                                 │
                                                 ▼
                                    deductServiceFee() called
                                    - Shipper wallet debited
                                    - Carrier wallet debited
                                    - Platform credited
                                    - Status = DEDUCTED

CANCELLED (at any stage before COMPLETED):
    │
    ▼
refundServiceFee() called
- Checks for fee amount
- Finds nothing (fee never set)
- Returns "No fee to refund"
- Status = REFUNDED (misleading)
```

### What the code was DESIGNED to do (but doesn't):

```
POSTED → ASSIGNED → IN_TRANSIT → DELIVERED → COMPLETED → (terminal)
              │                                  │
              ▼                                  ▼
    reserveServiceFee()             deductServiceFee()
    - Shipper wallet debited        - Move from RESERVED to DEDUCTED
    - Status = RESERVED             - Platform credited

CANCELLED (after ASSIGNED):
    │
    ▼
refundServiceFee()
- Finds RESERVED fee
- Credits shipper wallet
- Debits platform
- Status = REFUNDED
```

---

## RECOMMENDATIONS (Not applied - audit only)

1. **Remove dead code:** Delete `reserveServiceFee()` calls from assign/respond routes
2. **Fix status semantics:** Don't set REFUNDED if nothing was refunded
3. **Clean up enum:** Remove RESERVED if not implementing reservation flow
4. **Fix dashboard queries:** Remove queries for RESERVED status

---

## VERIFICATION

To confirm current behavior:

1. Check if any loads have `shipperFeeStatus = 'RESERVED'`:
   ```sql
   SELECT COUNT(*) FROM "Load" WHERE "shipperFeeStatus" = 'RESERVED';
   -- Expected: 0 (or only from old data before deprecation)
   ```

2. Check cancellation refunds:
   ```sql
   SELECT * FROM "JournalEntry" WHERE "transactionType" = 'SERVICE_FEE_REFUND';
   -- Expected: Only entries with non-zero amounts are from loads
   -- that were cancelled AFTER being COMPLETED (if any)
   ```

---

*Audit completed: 2026-02-08*
*OBSERVATION ONLY - NO FIXES APPLIED*
