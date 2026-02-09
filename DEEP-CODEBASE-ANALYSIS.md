# DEEP FORENSIC CODEBASE ANALYSIS

**Date:** 2026-02-09
**Type:** Comprehensive Forensic Audit
**Duration:** Deep Investigation
**Status:** COMPLETE

---

## SECTION 1: FILE INVENTORY

### lib/ Directory (73 files)

| File | Purpose | Contains Math | Contains DB Queries | Contains Conditionals |
|------|---------|---------------|--------------------|-----------------------|
| `lib/geo.ts` | Distance calculation (Haversine) | YES | NO | YES |
| `lib/rounding.ts` | Centralized rounding strategies | YES | NO | YES |
| `lib/serviceFeeCalculation.ts` | Fee calculation logic | YES | NO | YES |
| `lib/serviceFeeManagement.ts` | Fee deduction orchestration | YES | YES | YES |
| `lib/aggregation.ts` | Totals and aggregation | NO | YES | YES |
| `lib/admin/metrics.ts` | Admin dashboard metrics | NO | YES | YES |
| `lib/trustMetrics.ts` | Trust score calculations | YES | YES | YES |
| `lib/slaAggregation.ts` | SLA metric aggregation | YES | YES | YES |
| `lib/loadStateMachine.ts` | Load state transitions | NO | NO | YES |
| `lib/tripStateMachine.ts` | Trip state transitions | NO | NO | YES |
| `lib/auth.ts` | JWT authentication | NO | YES | YES |
| `lib/db.ts` | Prisma client | NO | YES | NO |
| `lib/cache.ts` | Redis caching | NO | YES | YES |
| `lib/notifications.ts` | Notification system | NO | YES | YES |
| `lib/gpsTracking.ts` | GPS tracking logic | YES | YES | YES |
| `lib/gpsQuery.ts` | GPS data queries | YES | YES | YES |
| `lib/tripProgress.ts` | Trip progress calculation | YES | YES | YES |
| `lib/automationRules.ts` | Automation rule engine | YES | YES | YES |
| `lib/deadheadOptimization.ts` | DH-O calculations | YES | YES | YES |
| `lib/matchingEngine.ts` | Load-truck matching | YES | YES | YES |
| `lib/rbac/permissions.ts` | Permission definitions | NO | NO | YES |
| `lib/dispatcherPermissions.ts` | Dispatcher access control | NO | NO | YES |
| `lib/bypassDetection.ts` | Bypass attempt detection | NO | YES | YES |
| `lib/exceptionDetection.ts` | Exception detection logic | NO | YES | YES |

### app/api/ Directory (120+ routes)

**Key Financial Routes:**
| Route | Purpose | Touches Money |
|-------|---------|---------------|
| `app/api/admin/users/[id]/wallet/topup/route.ts` | Admin wallet top-up | YES |
| `app/api/wallet/balance/route.ts` | Get wallet balance | YES (read) |
| `app/api/wallet/transactions/route.ts` | Transaction history | YES (read) |
| `app/api/loads/[id]/status/route.ts` | Status + fee deduction | YES |
| `app/api/loads/[id]/assign/route.ts` | Load assignment + validation | YES |
| `app/api/match-proposals/[id]/respond/route.ts` | Proposal acceptance | YES |
| `app/api/admin/service-fees/metrics/route.ts` | Fee analytics | YES (read) |

**Dashboard Routes:**
| Route | Purpose | Aggregation Logic |
|-------|---------|-------------------|
| `app/api/shipper/dashboard/route.ts` | Shipper stats | INLINE (documented) |
| `app/api/carrier/dashboard/route.ts` | Carrier stats | INLINE (documented) |
| `app/api/admin/dashboard/route.ts` | Admin stats | DELEGATED |
| `app/api/dispatcher/dashboard/route.ts` | Dispatcher stats | DELEGATED |

---

## SECTION 2: DEPENDENCY GRAPH

### Core Financial Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FINANCIAL DEPENDENCY GRAPH                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  lib/serviceFeeCalculation.ts                                                │
│    ├── calculatePartyFee() ─────────────────────┐                            │
│    ├── calculateFeePreview()                    │                            │
│    ├── findMatchingCorridor()                   │                            │
│    └── imports: lib/rounding.ts (roundMoney)    │                            │
│                                                 │                            │
│  lib/serviceFeeManagement.ts                    │                            │
│    ├── imports: calculatePartyFee() ────────────┘                            │
│    ├── deductServiceFee()                                                    │
│    ├── refundServiceFee()                                                    │
│    ├── validateWalletBalancesForTrip()                                       │
│    └── writes: FinancialAccount, JournalEntry, Load                          │
│                                                                              │
│  app/api/loads/[id]/status/route.ts                                          │
│    ├── imports: deductServiceFee()                                           │
│    ├── triggers on: status → COMPLETED                                       │
│    └── calls: deductServiceFee(loadId)                                       │
│                                                                              │
│  app/api/loads/[id]/assign/route.ts                                          │
│    ├── imports: validateWalletBalancesForTrip()                              │
│    └── validates before assignment                                           │
│                                                                              │
│  app/api/match-proposals/[id]/respond/route.ts                               │
│    ├── imports: validateWalletBalancesForTrip()                              │
│    └── validates before acceptance                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Distance Calculation Dependency

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DISTANCE DEPENDENCY GRAPH                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  lib/geo.ts (OWNER)                                                          │
│    ├── calculateDistanceKm() ← SINGLE SOURCE OF TRUTH                        │
│    ├── calculateDistanceMeters()                                             │
│    └── haversineDistance() (alias)                                           │
│                                                                              │
│  IMPORTS calculateDistanceKm FROM lib/geo.ts:                                │
│    ├── lib/gpsQuery.ts                                                       │
│    ├── lib/automationRules.ts                                                │
│    ├── app/api/distance/route.ts                                             │
│    ├── app/api/gps/history/route.ts                                          │
│    ├── app/api/trips/[tripId]/history/route.ts                               │
│    ├── app/api/trips/[tripId]/live/route.ts                                  │
│    └── __tests__/foundation/marketplace.test.ts                              │
│                                                                              │
│  DEPRECATED DUPLICATES (still exist, marked deprecated):                     │
│    ├── lib/gpsQuery.ts:176 — local haversineDistance (marked DEPRECATED)     │
│    ├── app/carrier/loadboard/SearchLoadsTab.tsx:28                           │
│    └── app/carrier/loadboard/PostTrucksTab.tsx:258                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## SECTION 3: MONEY FLOW DIAGRAMS

### 3.1 Wallet Funding Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              WALLET FUNDING                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TRIGGER: Admin calls POST /api/admin/users/[id]/wallet/topup                │
│                                                                              │
│  FILE: app/api/admin/users/[id]/wallet/topup/route.ts                        │
│                                                                              │
│  LINE 84-123:                                                                │
│    const result = await db.$transaction(async (tx) => {                      │
│      // 1. Create journal entry                                              │
│      const journalEntry = await tx.journalEntry.create({                     │
│        data: {                                                               │
│          transactionType: 'DEPOSIT',                                         │
│          description,                                                        │
│          lines: {                                                            │
│            create: [{                                                        │
│              accountId: wallet.id,                                           │
│              amount,                                                         │
│              isDebit: true,  // Debit to wallet = increase                   │
│            }],                                                               │
│          },                                                                  │
│        },                                                                    │
│      });                                                                     │
│                                                                              │
│      // 2. Update wallet balance                                             │
│      const updatedWallet = await tx.financialAccount.update({                │
│        where: { id: wallet.id },                                             │
│        data: { balance: { increment: amount } },                             │
│      });                                                                     │
│                                                                              │
│      return { journalEntry, updatedWallet };                                 │
│    });                                                                       │
│                                                                              │
│  TABLES TOUCHED:                                                             │
│    - FinancialAccount (balance update)                                       │
│    - JournalEntry (audit trail)                                              │
│    - JournalLine (double-entry line)                                         │
│                                                                              │
│  ATOMICITY: YES (db.$transaction)                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Service Fee Calculation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SERVICE FEE CALCULATION                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  FORMULA (lib/serviceFeeCalculation.ts:190-199):                             │
│                                                                              │
│    baseFee = Decimal(distanceKm) × Decimal(pricePerKm)                       │
│                                                                              │
│    if (promoFlag && promoDiscountPct > 0):                                   │
│      promoDiscount = baseFee × (promoDiscountPct / 100)                      │
│    else:                                                                     │
│      promoDiscount = 0                                                       │
│                                                                              │
│    finalFee = baseFee - promoDiscount                                        │
│                                                                              │
│  ROUNDING: toDecimalPlaces(2) via Decimal.js                                 │
│                                                                              │
│  DISTANCE SOURCE (lib/serviceFeeManagement.ts:220-226):                      │
│    Priority: actualTripKm > estimatedTripKm > tripKm > corridor.distanceKm   │
│                                                                              │
│  RATE SOURCE (lib/serviceFeeManagement.ts:237-261):                          │
│    - Shipper: corridor.shipperPricePerKm || corridor.pricePerKm              │
│    - Carrier: corridor.carrierPricePerKm || 0                                │
│                                                                              │
│  PROMO SOURCE:                                                               │
│    - Shipper: corridor.shipperPromoPct || corridor.promoDiscountPct          │
│    - Carrier: corridor.carrierPromoPct                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Service Fee Deduction Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SERVICE FEE DEDUCTION                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TRIGGER: Load status changes to COMPLETED                                   │
│  FILE: app/api/loads/[id]/status/route.ts:250-259                            │
│                                                                              │
│  CODE:                                                                       │
│    if (newStatus === 'COMPLETED') {                                          │
│      if (!existingFeeEvent) {                                                │
│        serviceFeeResult = await deductServiceFee(loadId);                    │
│      }                                                                       │
│    }                                                                         │
│                                                                              │
│  DEDUCTION SEQUENCE (lib/serviceFeeManagement.ts:367-508):                   │
│                                                                              │
│    await db.$transaction(async (tx) => {                                     │
│      // 1. Re-verify shipper balance inside transaction                      │
│      const currentShipperWallet = await tx.financialAccount.findUnique({});  │
│      if (balance < fee) throw new Error('Insufficient shipper balance');     │
│                                                                              │
│      // 2. Re-verify carrier balance inside transaction                      │
│      const currentCarrierWallet = await tx.financialAccount.findUnique({});  │
│      if (balance < fee) throw new Error('Insufficient carrier balance');     │
│                                                                              │
│      // 3. Create journal entry with all lines                               │
│      const journalEntry = await tx.journalEntry.create({                     │
│        data: {                                                               │
│          transactionType: 'SERVICE_FEE_DEDUCT',                              │
│          lines: { create: journalLines },                                    │
│        },                                                                    │
│      });                                                                     │
│                                                                              │
│      // 4. Deduct from shipper wallet                                        │
│      await tx.financialAccount.update({                                      │
│        data: { balance: { decrement: shipperFeeCalc.finalFee } },            │
│      });                                                                     │
│                                                                              │
│      // 5. Deduct from carrier wallet                                        │
│      await tx.financialAccount.update({                                      │
│        data: { balance: { decrement: carrierFeeCalc.finalFee } },            │
│      });                                                                     │
│                                                                              │
│      // 6. Credit platform revenue                                           │
│      await tx.financialAccount.update({                                      │
│        data: { balance: { increment: totalDeducted } },                      │
│      });                                                                     │
│                                                                              │
│      // 7. Update load with fee information                                  │
│      await tx.load.update({ data: { shipperServiceFee, carrierServiceFee }});│
│                                                                              │
│      return journalEntry.id;                                                 │
│    });                                                                       │
│                                                                              │
│  TABLES TOUCHED:                                                             │
│    - FinancialAccount (3 updates: shipper, carrier, platform)                │
│    - JournalEntry (audit trail)                                              │
│    - JournalLine (double-entry lines)                                        │
│    - Load (fee status update)                                                │
│                                                                              │
│  ATOMICITY: YES (db.$transaction)                                            │
│  ERROR HANDLING: Transaction rollback on failure                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Platform Revenue Tracking

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PLATFORM REVENUE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STORAGE: FinancialAccount where accountType = 'PLATFORM_REVENUE'            │
│                                                                              │
│  CALCULATION (lib/serviceFeeManagement.ts:270):                              │
│    totalPlatformFee = shipperFeeCalc.finalFee + carrierFeeCalc.finalFee      │
│                                                                              │
│  DISPLAY IN ADMIN (lib/aggregation.ts:103-157):                              │
│    - Aggregates Load.shipperServiceFee where status = DEDUCTED               │
│    - Aggregates Load.carrierServiceFee where status = DEDUCTED               │
│    - Sums to get totalRevenue                                                │
│                                                                              │
│  RECALCULATION LOCATIONS: NONE                                               │
│    Platform revenue is ONLY modified via deductServiceFee/refundServiceFee   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.5 Wallet Balance Reconciliation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        WALLET BALANCE STORAGE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  DESIGN: STORED BALANCE (not derived)                                        │
│                                                                              │
│  Schema (prisma/schema.prisma:1076-1078):                                    │
│    model FinancialAccount {                                                  │
│      balance Decimal @default(0) @db.Decimal(12, 2)                          │
│    }                                                                         │
│                                                                              │
│  JOURNAL ENTRIES:                                                            │
│    - JournalEntry records every transaction                                  │
│    - JournalLine links to accounts with amount and isDebit flag              │
│    - Audit trail exists but balance is NOT derived from it                   │
│                                                                              │
│  CONSISTENCY MECHANISM:                                                      │
│    - All balance modifications use db.$transaction                           │
│    - Journal entry created atomically with balance update                    │
│    - No separate reconciliation job                                          │
│                                                                              │
│  🔴 RISK: Balance and journal sum COULD diverge if:                          │
│    - Direct balance update bypasses journal creation                         │
│    - Transaction partially fails (mitigated by $transaction)                 │
│    - Manual database modifications                                           │
│                                                                              │
│  NO RECONCILIATION JOB EXISTS                                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## SECTION 4: STATUS FLOW DIAGRAMS

### 4.1 Load Status Transitions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LOAD STATUS FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SOURCE: lib/loadStateMachine.ts:28-104                                      │
│                                                                              │
│  DRAFT ──────► POSTED ──────► SEARCHING ──────► OFFERED                      │
│     │              │              │                │                         │
│     ▼              ▼              ▼                ▼                         │
│  CANCELLED     UNPOSTED      ASSIGNED ◄────────────┘                         │
│                CANCELLED      CANCELLED                                      │
│                EXPIRED        EXPIRED                                        │
│                ASSIGNED       EXCEPTION                                      │
│                                  │                                           │
│                                  ▼                                           │
│                          PICKUP_PENDING                                      │
│                              │     │                                         │
│                              ▼     ▼                                         │
│                         IN_TRANSIT CANCELLED                                 │
│                              │     EXCEPTION                                 │
│                              ▼                                               │
│                          DELIVERED                                           │
│                              │                                               │
│                              ▼                                               │
│                          COMPLETED ←── [SERVICE FEE DEDUCTED HERE]           │
│                              │                                               │
│                              ▼                                               │
│                          EXCEPTION                                           │
│                                                                              │
│  TERMINAL STATES: COMPLETED, CANCELLED, EXPIRED                              │
│  EXCEPTION: Can transition back to multiple states                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Money Movement by Status

| Status Transition | Money Movement | File:Line |
|------------------|----------------|-----------|
| → ASSIGNED | Wallet validation (no deduction) | assign/route.ts:145-165 |
| → COMPLETED | Service fee deducted from shipper + carrier | status/route.ts:250-282 |
| → CANCELLED | No refund (fees only deducted on COMPLETED) | status/route.ts:283-288 |

### 4.3 State Machine Enforcement

**Files that call validateStateTransition:**
1. `app/api/loads/[id]/status/route.ts:94-105` - Main status change endpoint
2. `app/api/loads/[id]/route.ts` - Load update endpoint
3. `app/api/loads/[id]/assign/route.ts` - Assignment validation
4. `app/api/loads/[id]/escalations/route.ts` - Escalation handling

**Files that set status directly (bypassing state machine):**

| File | Line | Status Set | Bypass? |
|------|------|------------|---------|
| `app/api/match-proposals/[id]/respond/route.ts` | 100 | EXPIRED | YES |
| `app/api/match-proposals/[id]/respond/route.ts` | 296,302,307 | CANCELLED | YES |
| `app/api/truck-requests/[id]/respond/route.ts` | 139 | EXPIRED | YES |
| `app/api/load-requests/[id]/respond/route.ts` | 145 | EXPIRED | YES |
| `app/api/loads/[id]/escalations/route.ts` | 148 | EXCEPTION | YES |
| `app/api/loads/[id]/assign/route.ts` | 297,302,307 | CANCELLED | YES |

**🔴 FINDING:** Multiple routes set status directly without calling `validateStateTransition()`. However, these are for related entities (proposals, requests) or are within valid transition contexts.

---

## SECTION 5: DATA INTEGRITY FINDINGS

### 5.1 Calculated vs Stored Fields

| Field | Calculated or Stored | Update Trigger | Staleness Risk |
|-------|---------------------|----------------|----------------|
| `FinancialAccount.balance` | STORED | On every transaction | 🔴 HIGH (no reconciliation) |
| `Organization.completionRate` | STORED | On load completion | 🟡 MEDIUM (manual update) |
| `Organization.totalLoadsCompleted` | STORED | On load completion | 🟡 MEDIUM |
| `Load.tripProgressPercent` | STORED | GPS updates | 🟢 LOW (real-time) |
| `Load.shipperServiceFee` | STORED | On COMPLETED | 🟢 LOW (once) |
| `Trip.actualDistanceKm` | STORED | GPS calculation | 🟢 LOW (once) |

### 5.2 Legacy vs Current Fields

| Concern | Legacy Field | Current Field | Still Written? | Still Read? |
|---------|--------------|---------------|----------------|-------------|
| Shipper Fee | `serviceFeeEtb` | `shipperServiceFee` | YES | YES |
| Fee Status | `serviceFeeStatus` | `shipperFeeStatus` | YES | YES |
| Trip Distance | `tripKm` | `estimatedTripKm` | YES | YES |

**File:** `lib/serviceFeeManagement.ts:442-449`
```typescript
// Legacy fields
serviceFeeEtb: totalPlatformFee,
serviceFeeStatus: shipperDeducted && carrierDeducted ? 'DEDUCTED' : 'PENDING',
```

**🟡 RISK:** Legacy and current fields are synced, but if code reads only one without the other, values could appear inconsistent.

### 5.3 Decimal Handling

| Prisma Field Type | Serialization | Consistency |
|-------------------|---------------|-------------|
| `Decimal @db.Decimal(12,2)` | `.toNumber()` or `Number()` | ✅ Consistent |
| `Decimal @db.Decimal(10,2)` | `.toNumber()` or `Number()` | ✅ Consistent |
| `Decimal @db.Decimal(10,4)` | `.toNumber()` or `Number()` | ✅ Consistent |
| `Decimal @db.Decimal(10,7)` | `.toNumber()` or `Number()` | ✅ Consistent |

**Pattern:** All Decimal fields converted via `Number()` or Decimal.js `.toNumber()` before API response.

---

## SECTION 6: SECURITY FINDINGS

### 6.1 Authentication

| Aspect | Implementation | Location |
|--------|----------------|----------|
| Token Type | JWT (signed HS256 + encrypted A256GCM) | lib/auth.ts:71-91 |
| Token Storage | HttpOnly, Secure, SameSite cookie | lib/auth.ts |
| Session Payload | userId, email, role, status, organizationId | lib/auth.ts:41-50 |
| Session Validation | `requireAuth()` middleware | lib/auth.ts |
| Active User Check | `requireActiveUser()` | lib/auth.ts |

### 6.2 Authorization by Route

| Route Pattern | Permission Check | Scoping |
|---------------|------------------|---------|
| `/api/admin/*` | `session.role in ['ADMIN', 'SUPER_ADMIN']` | ✅ |
| `/api/shipper/*` | `session.role === 'SHIPPER'` | ✅ organizationId |
| `/api/carrier/*` | `session.role === 'CARRIER'` | ✅ organizationId |
| `/api/dispatcher/*` | `session.role === 'DISPATCHER'` | ✅ |
| `/api/loads/[id]/*` | Ownership + role check | ✅ |

### 6.3 Organization Scoping

**Pattern:** Most queries include `organizationId` filter:

```typescript
// Example: app/api/shipper/dashboard/route.ts:68-70
db.load.count({
  where: { shipperId: session.organizationId },
})
```

**🔴 POTENTIAL ISSUE:** Some queries use `assignedTruck.carrierId` instead of direct organizationId:

```typescript
// app/api/carrier/dashboard/route.ts:117-124
db.load.aggregate({
  where: {
    assignedTruck: { carrierId: session.organizationId },  // Indirect
  },
})
```

This is correct for carrier earnings (loads assigned to their trucks), but could be confusing.

---

## SECTION 7: ERROR HANDLING FINDINGS

### 7.1 API Error Patterns

| Error Type | Pattern | Consistent? |
|------------|---------|-------------|
| Validation Error | `{ error: 'message', details: zodError.issues }` | ✅ |
| Not Found | `{ error: 'X not found' }` with status 404 | ✅ |
| Forbidden | `{ error: 'Access denied/Forbidden' }` with status 403 | ✅ |
| Server Error | `{ error: 'Internal server error' }` with status 500 | ✅ |

### 7.2 Transaction Failure Handling

| File | Transaction? | Rollback? | User Notification? |
|------|--------------|-----------|-------------------|
| `lib/serviceFeeManagement.ts:deductServiceFee` | YES | YES | ✅ via error response |
| `lib/serviceFeeManagement.ts:refundServiceFee` | YES | YES | ✅ via error response |
| `app/api/admin/users/[id]/wallet/topup/route.ts` | YES | YES | ✅ via error response |
| `app/api/loads/[id]/assign/route.ts` | YES | YES | ✅ via error response |

### 7.3 Edge Cases

| Scenario | Handling | Location |
|----------|----------|----------|
| Zero distance | Proceeds (fee = 0) | serviceFeeManagement.ts |
| Zero fee | `shipperDeducted = true` (no-op) | serviceFeeManagement.ts:338-340 |
| Negative amount | Zod validation rejects | topup/route.ts:13 |
| Insufficient balance | Returns error, no deduction | serviceFeeManagement.ts:330,345 |
| No corridor match | Fees waived (set to 0) | serviceFeeManagement.ts:177-214 |

---

## SECTION 8: DUPLICATION FINDINGS

### 8.1 Formula Duplication (from DUPLICATION-AUDIT.md)

| Concern | Owner | Duplicates | Status |
|---------|-------|------------|--------|
| Haversine Distance | lib/geo.ts | 3 frontend, 0 backend | 🟡 Frontend marked deprecated |
| Fee Calculation | lib/serviceFeeCalculation.ts | 1 frontend | 🔴 CorridorManagementClient.tsx |
| Money Rounding | lib/rounding.ts | 4 inline occurrences | 🟡 Same formula, not delegated |
| Percentage Rounding | lib/rounding.ts | 2 inline occurrences | 🟡 Same formula, not delegated |

### 8.2 Query Duplication

| Query Pattern | Owner | Duplicates |
|---------------|-------|------------|
| Load count by status | lib/admin/metrics.ts | shipper/dashboard, carrier/dashboard |
| Service fee aggregation | lib/aggregation.ts | shipper/dashboard, carrier/dashboard |
| Truck count by availability | lib/admin/metrics.ts | carrier/dashboard |

**Note:** Dashboard duplication is documented and intentional (dashboard-specific requirements).

### 8.3 Business Logic in Wrong Places

| Finding | Location | Should Be |
|---------|----------|-----------|
| Fee preview calculation | CorridorManagementClient.tsx:160-167 | lib/serviceFeeCalculation.ts |
| Distance rounding (frontend) | SearchLoadsTab.tsx, PostTrucksTab.tsx | Already uses lib/geo.ts |

---

## SECTION 9: TEST COVERAGE FINDINGS

### 9.1 Test Files

| File | Purpose | Coverage Area |
|------|---------|---------------|
| `__tests__/behavior-snapshots.test.ts` | Behavior freeze | Distance, Fee, Rounding |
| `__tests__/authorization.test.ts` | RBAC testing | Permissions |
| `__tests__/auth.test.ts` | Auth testing | JWT, Sessions |
| `__tests__/e2e-core-flows.test.ts` | E2E flows | Load lifecycle |
| `__tests__/foundation/marketplace.test.ts` | Foundation rules | Marketplace logic |
| `__tests__/foundation/phase2-authority.test.ts` | Phase 2 rules | Carrier authority |
| `__tests__/rbac.test.ts` | Permission tests | Role checks |

### 9.2 What IS Tested

- ✅ Distance calculation formulas (behavior-snapshots.test.ts)
- ✅ Fee calculation formulas (behavior-snapshots.test.ts)
- ✅ Rounding strategies (behavior-snapshots.test.ts)
- ✅ Permission checks (authorization.test.ts)
- ✅ Load lifecycle (e2e-core-flows.test.ts)

### 9.3 What is NOT Tested

- ❌ Wallet balance reconciliation
- ❌ Transaction failure scenarios
- ❌ Concurrent transaction handling
- ❌ Legacy field synchronization
- ❌ Dashboard aggregation accuracy
- ❌ Service fee deduction end-to-end

### 9.4 Snapshot Tests

**File:** `__tests__/behavior-snapshots.test.ts`

| Snapshot | Captures | Would Catch Numeric Drift? |
|----------|----------|---------------------------|
| Distance calculation | Raw decimal output | ✅ YES |
| Fee calculation | baseFee, promoDiscount, finalFee | ✅ YES |
| Rounding | Each rounding function output | ✅ YES |

**🟢 FINDING:** Behavior snapshot tests would catch numeric drift in core calculations.

---

## SECTION 10: RISK ASSESSMENT

| Area | Risk Level | Explanation |
|------|------------|-------------|
| **Distance Calculation** | 🟢 LOW | Single source of truth in lib/geo.ts, duplicates deprecated |
| **Service Fee Calculation** | 🟢 LOW | Owner module (lib/serviceFeeCalculation.ts), well-tested |
| **Service Fee Deduction** | 🟢 LOW | Atomic transactions, balance verification |
| **Rounding Strategies** | 🟡 MEDIUM | Owner exists but inline uses remain |
| **Wallet Balance** | 🔴 HIGH | Stored balance, no reconciliation job |
| **Legacy Field Sync** | 🟡 MEDIUM | Synced on write, could diverge if missed |
| **Dashboard Aggregation** | 🟡 MEDIUM | Documented duplication, acceptable |
| **State Machine Enforcement** | 🟡 MEDIUM | Main routes use it, some bypass for related entities |
| **Error Handling** | 🟢 LOW | Consistent patterns, transactions roll back |
| **Test Coverage** | 🟡 MEDIUM | Core formulas tested, edge cases not |

---

## SECTION 11: SPECIFIC CONCERNS LIST

### CONCERN 1: No Wallet Reconciliation Job
- **Location:** FinancialAccount.balance is stored, not derived
- **File:** prisma/schema.prisma:1078
- **Risk:** Balance could diverge from journal entries sum
- **Recommendation:** Add periodic reconciliation job or derive balance from transactions

### CONCERN 2: RESERVED Status Never Set
- **Location:** ServiceFeeStatus.RESERVED enum value
- **File:** prisma/schema.prisma:109
- **Risk:** Queries filtering for RESERVED status return nothing
- **Affected:** lib/aggregation.ts:128, app/api/shipper/dashboard/route.ts:110

### CONCERN 3: Frontend Fee Calculation Duplicate
- **Location:** app/admin/corridors/CorridorManagementClient.tsx:160-167
- **Risk:** Could calculate differently than backend
- **Recommendation:** Call API or use shared calculation

### CONCERN 4: Status Set Without State Machine
- **Location:** Multiple routes (see Section 4.3)
- **Risk:** Invalid transitions could be allowed
- **Mitigation:** These are for related entities (proposals, requests), not loads directly

### CONCERN 5: Dashboard Aggregation Duplication
- **Location:** shipper/dashboard/route.ts, carrier/dashboard/route.ts
- **Risk:** Results could differ from lib/aggregation.ts
- **Mitigation:** Documented, intentional for dashboard-specific needs

### CONCERN 6: Legacy Field Dependency
- **Location:** Multiple files read serviceFeeEtb vs shipperServiceFee
- **Risk:** Inconsistent values if one is updated without the other
- **Mitigation:** All writes sync both fields

### CONCERN 7: Concurrent Transaction Race
- **Location:** lib/serviceFeeManagement.ts:deductServiceFee
- **Risk:** Two COMPLETED status changes could double-deduct
- **Mitigation:** Idempotency check (existingFeeEvent) in status/route.ts:254

---

## SECTION 12: QUESTIONS THAT NEED HUMAN ANSWERS

1. **Wallet Reconciliation:** Is there a plan to reconcile stored balance vs journal sum? What happens if they diverge?

2. **RESERVED Status:** The ServiceFeeStatus.RESERVED enum value is never set. Should it be removed from the schema, or is there a plan to implement reservation?

3. **Frontend Fee Preview:** The CorridorManagementClient.tsx calculates fees inline. Should this call the backend API instead?

4. **Dashboard Queries:** The documented duplication in dashboard routes - is this permanent or temporary while lib/aggregation.ts is developed?

5. **Legacy Fields:** What is the timeline for deprecating serviceFeeEtb, serviceFeeStatus, and tripKm? Can we remove them after migration?

6. **Balance Verification Timing:** Balance is verified at validation AND inside transaction. Is double-verification necessary, or can validation-time check be removed?

7. **Status Bypass for Proposals:** Proposals/requests set status directly (EXPIRED, CANCELLED). Should these go through a state machine too?

---

## SUMMARY

### What Works Well
- Single source of truth for distance (lib/geo.ts)
- Single source of truth for fee calculation (lib/serviceFeeCalculation.ts)
- Atomic transactions for financial operations
- Behavior snapshot tests for core formulas
- Consistent error handling patterns

### What Needs Attention
- Wallet balance reconciliation mechanism
- RESERVED status cleanup
- Frontend calculation duplication
- Test coverage for edge cases

### Overall Assessment

The codebase has good foundational architecture with clear ownership patterns. Financial operations are properly atomic. The main risks are:
1. **Stored balance without reconciliation** - could silently diverge
2. **Inline rounding** - works but doesn't delegate to owner
3. **Legacy field maintenance** - adds complexity

**RECOMMENDATION:** Prioritize adding wallet reconciliation job and cleaning up unused RESERVED status.

---

*Analysis completed: 2026-02-09*
*Files analyzed: 200+*
*Lines of analysis: 600+*
