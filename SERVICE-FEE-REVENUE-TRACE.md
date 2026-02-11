# SERVICE FEE & REVENUE FLOW TRACE

**Date:** 2026-02-08
**Type:** Read-Only Audit
**Status:** OBSERVATION ONLY

---

## SECTION 1: Fee Calculation Locations

| File | Function | Line | What It Calculates |
|------|----------|------|-------------------|
| `lib/serviceFeeCalculation.ts` | `calculatePartyFee` | 173 | Core fee for single party (shipper OR carrier) |
| `lib/serviceFeeCalculation.ts` | `calculateFeesFromCorridor` | 214 | Both shipper + carrier fees from corridor data |
| `lib/serviceFeeCalculation.ts` | `calculateFeePreview` | 441 | Simplified UI preview (same formula, simpler output) |
| `lib/serviceFeeCalculation.ts` | `calculateDualPartyFeePreview` | 470 | Both party previews for UI |
| `lib/serviceFeeCalculation.ts` | `calculateServiceFee` | 268 | Full calculation for a load (async, DB lookup) |
| `lib/serviceFeeCalculation.ts` | `calculateFeeFromCorridor` | 244 | DEPRECATED - legacy single-party |
| `lib/serviceFeeManagement.ts` | `deductServiceFee` | 247-268 | Calculates fees at deduction time |
| `app/admin/corridors/CorridorManagementClient.tsx` | `calculatePartyFee` | 157 | UI-ONLY preview (documented as non-authoritative) |

---

## SECTION 2: Fee Inputs

### Formula (from `lib/serviceFeeCalculation.ts:190-199`)

```javascript
baseFee = distanceKm × pricePerKm
promoDiscount = baseFee × (promoDiscountPct / 100)  // if promoFlag = true
finalFee = baseFee - promoDiscount
```

### Input Sources

| Input | Source Location | Field Name | Priority/Notes |
|-------|-----------------|------------|----------------|
| **Distance** | Load record | `actualTripKm` | Priority 1: GPS-tracked actual |
| | Load record | `estimatedTripKm` | Priority 2: Map-estimated |
| | Load record | `tripKm` | Priority 3: Legacy distance |
| | Corridor record | `distanceKm` | Priority 4: Fallback to corridor |
| **Shipper Rate** | Corridor | `shipperPricePerKm` | Primary (new) |
| | Corridor | `pricePerKm` | Fallback (legacy) |
| **Carrier Rate** | Corridor | `carrierPricePerKm` | Primary (new) |
| | (none) | 0 | Default if not set |
| **Shipper Promo Flag** | Corridor | `shipperPromoFlag` | Primary (new) |
| | Corridor | `promoFlag` | Fallback (legacy) |
| **Shipper Promo %** | Corridor | `shipperPromoPct` | Primary (new) |
| | Corridor | `promoDiscountPct` | Fallback (legacy) |
| **Carrier Promo Flag** | Corridor | `carrierPromoFlag` | No fallback |
| **Carrier Promo %** | Corridor | `carrierPromoPct` | No fallback |

### Distance Priority Code (`lib/serviceFeeManagement.ts:218-226`)

```javascript
const distanceKm = load.actualTripKm && Number(load.actualTripKm) > 0
  ? Number(load.actualTripKm)
  : load.estimatedTripKm && Number(load.estimatedTripKm) > 0
    ? Number(load.estimatedTripKm)
    : load.tripKm && Number(load.tripKm) > 0
      ? Number(load.tripKm)
      : Number(corridor.distanceKm);
```

---

## SECTION 3: Revenue Collection Flow

### Timeline of Money Movement

```
TRIGGER: Load status changes to COMPLETED
    │
    ├─► app/api/loads/[id]/status/route.ts:250-278
    │     newStatus === 'COMPLETED'
    │         └─► deductServiceFee(loadId)  // line 259
    │
    ▼
lib/serviceFeeManagement.ts:98 - deductServiceFee()
    │
    ├─► Load corridorId lookup (line 103-104)
    │     └─► Find matching corridor if not set (line 170-187)
    │
    ├─► Distance priority calculation (line 220-226)
    │
    ├─► Shipper fee calculation (line 247-252)
    │     └─► calculatePartyFee(distanceKm, shipperPricePerKm, promoFlag, promoPct)
    │
    ├─► Carrier fee calculation (line 263-268)
    │     └─► calculatePartyFee(distanceKm, carrierPricePerKm, promoFlag, promoPct)
    │
    ├─► Get wallets (line 275-301)
    │     ├─► SHIPPER_WALLET for shipperId
    │     ├─► CARRIER_WALLET for carrierId
    │     └─► PLATFORM_REVENUE account
    │
    ├─► Build journal lines (line 321-368)
    │     ├─► Shipper debit: { amount, isDebit: true, accountId: shipperWallet.id }
    │     ├─► Carrier debit: { amount, isDebit: true, accountId: carrierWallet.id }
    │     └─► Platform credit: { amount, isDebit: false, accountId: platformAccountId }
    │
    ├─► Create JournalEntry (line 373-400)
    │     └─► transactionType: 'SERVICE_FEE_DEDUCT'
    │
    ├─► Update wallet balances (line 402-433) *** NOT ATOMIC ***
    │     ├─► db.financialAccount.update({ balance: { decrement: shipperFee } })  // line 409
    │     ├─► db.financialAccount.update({ balance: { decrement: carrierFee } })  // line 418
    │     └─► db.financialAccount.update({ balance: { increment: totalDeducted } })  // line 427
    │
    └─► Update Load record with fees (line 436-453)
          ├─► shipperServiceFee, shipperFeeStatus: 'DEDUCTED'
          ├─► carrierServiceFee, carrierFeeStatus: 'DEDUCTED'
          └─► serviceFeeEtb, serviceFeeStatus (legacy)
```

### Exact File:Line References

| Action | File | Line |
|--------|------|------|
| Trigger (COMPLETED) | `app/api/loads/[id]/status/route.ts` | 250 |
| Call deductServiceFee | `app/api/loads/[id]/status/route.ts` | 259 |
| Debit shipper wallet | `lib/serviceFeeManagement.ts` | 409 |
| Debit carrier wallet | `lib/serviceFeeManagement.ts` | 418 |
| Credit platform revenue | `lib/serviceFeeManagement.ts` | 427 |
| Create JournalEntry | `lib/serviceFeeManagement.ts` | 373-400 |
| Update Load fees | `lib/serviceFeeManagement.ts` | 436-453 |

### Refund Flow (CANCELLED)

| Action | File | Line |
|--------|------|------|
| Trigger (CANCELLED) | `app/api/loads/[id]/status/route.ts` | 282-291 |
| Call refundServiceFee | `app/api/loads/[id]/status/route.ts` | 291 |
| Credit shipper wallet | `lib/serviceFeeManagement.ts` | 599 |
| Create JournalEntry | `lib/serviceFeeManagement.ts` | 560-577 |

---

## SECTION 4: Transaction Records Created

### JournalEntry Structure (`lib/serviceFeeManagement.ts:373-400`)

```javascript
const journalEntry = await db.journalEntry.create({
  data: {
    transactionType: 'SERVICE_FEE_DEDUCT',
    description: `Service fees for load ${loadId}: Shipper ${name} (${fee} ETB), Carrier ${name} (${fee} ETB)`,
    reference: loadId,
    loadId,
    metadata: {
      shipperFee: '123.45',
      carrierFee: '67.89',
      totalPlatformFee: '191.34',
      corridorId: 'xxx',
      distanceKm: 100,
      distanceSource: 'actualTripKm (GPS)',
      corridorDistanceKm: 95,
      shipperPricePerKm: 2.5,
      carrierPricePerKm: 1.5,
    },
    lines: {
      create: [
        { amount: 123.45, isDebit: true, accountId: 'shipper-wallet-id' },
        { amount: 67.89, isDebit: true, accountId: 'carrier-wallet-id' },
        { amount: 191.34, isDebit: false, accountId: 'platform-revenue-id' },
      ],
    },
  },
});
```

### Refund JournalEntry (`lib/serviceFeeManagement.ts:560-577`)

```javascript
transactionType: 'SERVICE_FEE_REFUND'
// Lines:
// - Platform: isDebit: true (debit from platform)
// - Shipper: isDebit: false (credit to shipper)
```

### LoadEvent Records (`app/api/loads/[id]/status/route.ts:262-276`)

```javascript
eventType: 'SERVICE_FEE_DEDUCTED' // or 'SERVICE_FEE_REFUNDED'
metadata: {
  shipperFee,
  carrierFee,
  totalPlatformFee,
  transactionId,
  details,
}
```

---

## SECTION 5: Direct Answers

### 1. Single source of truth for fee calculation?

**YES** - `lib/serviceFeeCalculation.ts`

- `calculatePartyFee()` is the core function (line 173)
- All other fee calculations delegate to this
- UI preview (`calculateFeePreview`) uses same formula
- Documented with ownership declaration (line 423-433)

### 2. Single source of truth for revenue collection?

**YES** - `lib/serviceFeeManagement.ts`

- `deductServiceFee()` is the only function that debits wallets and credits platform (line 98)
- Called from single location: `app/api/loads/[id]/status/route.ts:259`
- Refund handled by `refundServiceFee()` (line 487)

### 3. Trust Breaks Found?

| Issue | Severity | Location | Description |
|-------|----------|----------|-------------|
| **Non-Atomic Balance Updates** | HIGH | `serviceFeeManagement.ts:402-433` | Wallet balance updates use `Promise.all` AFTER journal entry creation. If one update fails, state is inconsistent. |
| **Service Fee Outside Main Transaction** | MEDIUM | `status/route.ts:244-248` | Comment explicitly states fee operations are outside transaction. Intentional but risky. |
| **No Debit/Credit Balance Check** | LOW | `serviceFeeManagement.ts:373-400` | Journal lines created without verifying sum(debits) = sum(credits) |
| **Reserved Fee Deprecated** | INFO | `serviceFeeManagement.ts:633` | `reserveServiceFee` is deprecated but still called from assign/respond routes |

### Balance Update Code (Potential Issue):

```javascript
// lib/serviceFeeManagement.ts:402-433
// Journal entry already created at this point

// These run in parallel, not in transaction:
await Promise.all([
  db.financialAccount.update({ balance: { decrement: shipperFee } }),  // Could fail
  db.financialAccount.update({ balance: { decrement: carrierFee } }),  // Could fail
  db.financialAccount.update({ balance: { increment: totalDeducted } }), // Could fail
]);
```

---

## SUMMARY DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                     FEE CALCULATION LAYER                        │
│                  lib/serviceFeeCalculation.ts                    │
│                                                                  │
│  calculatePartyFee(distance, rate, promoFlag, promoPct)         │
│        │                                                         │
│        ▼                                                         │
│  baseFee = distance × rate                                       │
│  discount = baseFee × (promoPct/100) if promoFlag               │
│  finalFee = baseFee - discount                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    REVENUE COLLECTION LAYER                      │
│                  lib/serviceFeeManagement.ts                     │
│                                                                  │
│  deductServiceFee(loadId)                                        │
│        │                                                         │
│        ├──► Lookup corridor + distance priority                  │
│        ├──► Calculate shipper + carrier fees                     │
│        ├──► Create JournalEntry with lines                       │
│        ├──► Debit SHIPPER_WALLET                                 │
│        ├──► Debit CARRIER_WALLET                                 │
│        └──► Credit PLATFORM_REVENUE                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       TRIGGER LAYER                              │
│               app/api/loads/[id]/status/route.ts                 │
│                                                                  │
│  POST /api/loads/:id/status { status: 'COMPLETED' }             │
│        │                                                         │
│        └──► deductServiceFee(loadId)                             │
│                                                                  │
│  POST /api/loads/:id/status { status: 'CANCELLED' }             │
│        │                                                         │
│        └──► refundServiceFee(loadId)                             │
└─────────────────────────────────────────────────────────────────┘
```

---

*Audit completed: 2026-02-08*
*OBSERVATION ONLY - NO FIXES APPLIED*
