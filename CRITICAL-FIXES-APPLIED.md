# CRITICAL FIXES APPLIED

**Date:** 2026-02-09
**Source:** BUSINESS-LIFECYCLE-AUDIT.md
**Status:** ✅ ALL FIXES APPLIED

---

## ISSUE #1 (HIGH): Create Wallet on Registration

### Problem
When a user registers with a company name, an organization is created but NO wallet (financial account) is created. This causes wallet validation to fail when the user tries to accept trips.

### File Changed
`app/api/auth/register/route.ts`

### Lines Changed
Lines 118-161 (expanded to 118-172)

### Before
```typescript
// Create organization for shippers and carriers with company name
if ((validatedData.role === "SHIPPER" || validatedData.role === "CARRIER") && validatedData.companyName) {
  const orgType = getOrganizationType(validatedData.role, validatedData.carrierType);

  const organization = await db.organization.create({
    data: {
      name: validatedData.companyName,
      type: orgType as any,
      contactEmail: validatedData.email,
      contactPhone: validatedData.phone || "N/A",
      isVerified: false,
      associationId: validatedData.carrierType === "CARRIER_INDIVIDUAL" ? validatedData.associationId || null : null,
    },
  });

  organizationId = organization.id;
}
```

### After
```typescript
// CRITICAL FIX (ISSUE #1): Create organization AND wallet atomically in a transaction
// This ensures that every organization has a wallet from the start
if ((validatedData.role === "SHIPPER" || validatedData.role === "CARRIER") && validatedData.companyName) {
  const orgType = getOrganizationType(validatedData.role, validatedData.carrierType);

  // Determine wallet type based on organization type
  const walletType = orgType === "SHIPPER" ? "SHIPPER_WALLET" : "CARRIER_WALLET";

  const { organization } = await db.$transaction(async (tx) => {
    // 1. Create organization
    const organization = await tx.organization.create({
      data: {
        name: validatedData.companyName!,
        type: orgType as any,
        contactEmail: validatedData.email,
        contactPhone: validatedData.phone || "N/A",
        isVerified: false,
        associationId: validatedData.carrierType === "CARRIER_INDIVIDUAL"
          ? validatedData.associationId || null
          : null,
      },
    });

    // 2. Create wallet atomically with organization
    await tx.financialAccount.create({
      data: {
        organizationId: organization.id,
        accountType: walletType as any,
        balance: 0,
        currency: "ETB",
        isActive: true,
      },
    });

    return { organization };
  });

  organizationId = organization.id;
}
```

### Fix for Existing Organizations
A script was created to fix existing organizations without wallets:

```bash
npx ts-node scripts/fix-missing-wallets.ts
```

**Script location:** `scripts/fix-missing-wallets.ts`

---

## ISSUE #2 (MEDIUM): Block COMPLETED if Fee Deduction Fails

### Problem
If `deductServiceFee()` fails, the trip status still changes to COMPLETED. This causes the platform to lose revenue because fees are never collected.

### File Changed
`app/api/loads/[id]/status/route.ts`

### Lines Changed
Lines 168-203 (new code inserted before transaction)

### Before
```typescript
// Status update transaction happens first
const { updatedLoad, tripUpdated } = await db.$transaction(async (tx) => {
  // ... update status to COMPLETED
});

// Fee deduction happens AFTER (in try-catch that swallows errors)
if (newStatus === 'COMPLETED') {
  try {
    serviceFeeResult = await deductServiceFee(loadId);
    // ... log event
  } catch (error) {
    console.error('Service fee deduction error:', error);
    // Status is already COMPLETED - fees lost!
  }
}
```

### After
```typescript
// CRITICAL FIX (ISSUE #2): If transitioning to COMPLETED, deduct fees FIRST
// If fee deduction fails, block the status change
let serviceFeeResult: any = null;
if (newStatus === 'COMPLETED') {
  // Check if fee already deducted (idempotency)
  const existingFeeEvent = await db.loadEvent.findFirst({
    where: { loadId, eventType: 'SERVICE_FEE_DEDUCTED' },
  });

  if (!existingFeeEvent) {
    try {
      serviceFeeResult = await deductServiceFee(loadId);

      if (!serviceFeeResult.success) {
        // Fee deduction failed - block completion
        return NextResponse.json(
          {
            error: 'Cannot complete trip: fee deduction failed',
            details: serviceFeeResult.error || 'Unknown fee deduction error',
            feeDetails: {
              shipperFee: serviceFeeResult.shipperFee?.toFixed(2),
              carrierFee: serviceFeeResult.carrierFee?.toFixed(2),
            },
          },
          { status: 400 }
        );
      }
    } catch (feeError: any) {
      // Exception during fee deduction - block completion
      console.error('Service fee deduction exception:', feeError);
      return NextResponse.json(
        {
          error: 'Cannot complete trip: fee deduction failed',
          details: feeError.message || 'Fee deduction exception',
        },
        { status: 400 }
      );
    }
  }
}

// ONLY NOW proceed with status update (after fees are successfully deducted)
const { updatedLoad, tripUpdated } = await db.$transaction(async (tx) => {
  // ... update status to COMPLETED
});
```

### Behavior Change
| Scenario | Before | After |
|----------|--------|-------|
| Fee deduction succeeds | Status → COMPLETED | Status → COMPLETED |
| Fee deduction fails | Status → COMPLETED (fees lost!) | Returns 400 error, stays in DELIVERED |
| Insufficient balance | Status → COMPLETED (fees lost!) | Returns 400 error, stays in DELIVERED |

---

## ISSUE #3 (LOW): Auto-Reset Truck Availability After Trip Completion

### Problem
After a trip ends (COMPLETED or CANCELLED), the truck stays unavailable. Carriers must manually reset truck availability.

### File Changed
`app/api/loads/[id]/status/route.ts`

### Lines Changed
Lines 313-367 (new code added after fee event logging)

### Code Added
```typescript
// CRITICAL FIX (ISSUE #3): Auto-reset truck availability after trip completion or cancellation
// When trip ends (COMPLETED or CANCELLED), make the truck available again
if ((newStatus === 'COMPLETED' || newStatus === 'CANCELLED') && load.trip?.id) {
  try {
    // Get the truck that was assigned to this trip
    const trip = await db.trip.findUnique({
      where: { id: load.trip.id },
      select: { truckId: true },
    });

    if (trip?.truckId) {
      // Reset truck availability
      await db.truck.update({
        where: { id: trip.truckId },
        data: {
          isAvailable: true,
          updatedAt: new Date(),
        },
      });

      // Also update any MATCHED postings for this truck to EXPIRED/completed
      await db.truckPosting.updateMany({
        where: {
          truckId: trip.truckId,
          status: 'MATCHED',
        },
        data: {
          status: 'EXPIRED',
          updatedAt: new Date(),
        },
      });

      // Log the truck availability reset
      await db.loadEvent.create({
        data: {
          loadId,
          eventType: 'TRUCK_AVAILABILITY_RESET',
          description: `Truck availability reset to available after trip ${newStatus.toLowerCase()}`,
          userId: session.userId,
          metadata: {
            truckId: trip.truckId,
            tripId: load.trip.id,
            reason: newStatus === 'COMPLETED' ? 'trip_completed' : 'trip_cancelled',
          },
        },
      });
    }
  } catch (truckError) {
    // Non-blocking: Log error but don't fail the status update
    console.error('Failed to reset truck availability:', truckError);
  }
}
```

### Behavior Change
| Status Transition | Before | After |
|-------------------|--------|-------|
| → COMPLETED | Truck stays unavailable | Truck.isAvailable = true |
| → CANCELLED | Truck stays unavailable | Truck.isAvailable = true |
| Matched posting | Status unchanged | Status → EXPIRED |

---

## VERIFICATION STEPS

### 1. Verify Wallet Creation on Registration

```bash
# Register a new shipper via API
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-shipper@example.com",
    "password": "Test1234!",
    "firstName": "Test",
    "lastName": "Shipper",
    "role": "SHIPPER",
    "companyName": "Test Shipping Co"
  }'

# Check database for wallet
npx prisma studio
# Navigate to FinancialAccount table
# Verify SHIPPER_WALLET exists with balance 0
```

### 2. Verify Fee Deduction Blocking

```bash
# Create a trip with a shipper that has insufficient balance
# Try to complete the trip
curl -X PATCH http://localhost:3000/api/loads/{loadId}/status \
  -H "Content-Type: application/json" \
  -H "Cookie: freight-session=..." \
  -d '{"status": "COMPLETED"}'

# Expected: 400 error with message "Cannot complete trip: fee deduction failed"
```

### 3. Verify Truck Availability Reset

```bash
# Complete a trip successfully
curl -X PATCH http://localhost:3000/api/loads/{loadId}/status \
  -H "Content-Type: application/json" \
  -H "Cookie: freight-session=..." \
  -d '{"status": "COMPLETED"}'

# Check database
npx prisma studio
# Verify Truck.isAvailable = true
# Verify TruckPosting.status = 'EXPIRED' (if was MATCHED)
```

### 4. Fix Existing Organizations Without Wallets

```bash
npx ts-node scripts/fix-missing-wallets.ts
```

---

## FILES MODIFIED

| File | Change Type |
|------|-------------|
| `app/api/auth/register/route.ts` | Modified (Issue #1) |
| `app/api/loads/[id]/status/route.ts` | Modified (Issues #2, #3) |
| `scripts/fix-missing-wallets.ts` | Created (Issue #1 cleanup) |
| `CRITICAL-FIXES-APPLIED.md` | Created (documentation) |

---

## TYPESCRIPT VERIFICATION

```bash
npx tsc --noEmit
# Exit code: 0 (no errors)
```

---

## SUMMARY

| Issue | Severity | Status | Impact |
|-------|----------|--------|--------|
| #1: Wallet on registration | HIGH | ✅ FIXED | All new orgs get wallets |
| #2: Block COMPLETED on fee failure | MEDIUM | ✅ FIXED | No more lost revenue |
| #3: Auto-reset truck availability | LOW | ✅ FIXED | Trucks available after trips |

---

*Fixes applied: 2026-02-09*
*Verified by: TypeScript compilation (exit 0)*
