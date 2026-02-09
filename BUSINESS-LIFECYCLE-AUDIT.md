# COMPLETE BUSINESS LIFECYCLE AUDIT - EXHAUSTIVE ANALYSIS

**Date:** 2026-02-09
**Auditor:** Claude Opus 4.5
**Type:** Forensic Business Lifecycle Audit
**Scope:** Full Platform Lifecycle from Registration to Settlement

---

## TABLE OF CONTENTS

1. [Phase 1: User Registration & Account Creation](#phase-1-user-registration--account-creation)
2. [Phase 2: Verification & Activation](#phase-2-verification--activation)
3. [Phase 3: Organization & Wallet Setup](#phase-3-organization--wallet-setup)
4. [Phase 4: Resource Creation (Loads/Trucks)](#phase-4-resource-creation-loadstrucks)
5. [Phase 5: Posting & Availability](#phase-5-posting--availability)
6. [Phase 6: Matching & Proposals](#phase-6-matching--proposals)
7. [Phase 7: Trip Assignment](#phase-7-trip-assignment)
8. [Phase 8: Trip Lifecycle](#phase-8-trip-lifecycle)
9. [Phase 9: Delivery & POD](#phase-9-delivery--pod)
10. [Phase 10: Fee Collection & Settlement](#phase-10-fee-collection--settlement)
11. [Phase 11: Daily Reset & Automation](#phase-11-daily-reset--automation)

---

## PHASE 1: USER REGISTRATION & ACCOUNT CREATION

### 1.1 Code Path

**Entry Point:** `app/api/auth/register/route.ts:47`

```
POST /api/auth/register
  │
  ├─► Zod validation (registerSchema)
  │     Lines: 7-25
  │
  ├─► Password policy validation (validatePasswordPolicy)
  │     Lines: 53-62
  │     Module: lib/auth.ts
  │
  ├─► Rate limiting (3/hour/IP)
  │     Lines: 65-92
  │     Module: lib/rateLimit.ts
  │
  ├─► Check existing user
  │     Lines: 95-113
  │
  ├─► Hash password
  │     Lines: 116
  │     Module: lib/auth.ts:hashPassword()
  │
  ├─► Create organization (if SHIPPER/CARRIER with companyName)
  │     Lines: 119-138
  │
  ├─► Create user record
  │     Lines: 141-161
  │
  └─► Create session
        Lines: 163-170
        Module: lib/auth.ts:setSession()
```

### 1.2 Database Changes

| Table | Field | Value | Trigger |
|-------|-------|-------|---------|
| `users` | `id` | CUID | Auto-generated |
| `users` | `email` | Validated email | From request |
| `users` | `passwordHash` | bcrypt hash | hashPassword() |
| `users` | `role` | SHIPPER/CARRIER/etc | From request |
| `users` | `status` | **REGISTERED** | Default |
| `users` | `organizationId` | NULL or org.id | Conditional |
| `users` | `isActive` | true | Default (deprecated) |
| `organizations` | (if created) | name, type, contactEmail | Conditional |

### 1.3 Status on Registration

```
┌─────────────────────────────────────────────────────────┐
│ NEW USER STATUS: REGISTERED                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ User.status = 'REGISTERED'                              │
│                                                         │
│ CAPABILITIES:                                           │
│ ✗ Cannot create loads                                   │
│ ✗ Cannot create trucks                                  │
│ ✗ Cannot access marketplace                             │
│ ✓ Can upload verification documents                     │
│ ✓ Can view their profile                                │
│                                                         │
│ NEXT STEP: Upload documents → PENDING_VERIFICATION      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 1.4 Session Creation Details

**Location:** `lib/auth.ts:setSession()` (Lines 150-200 approx)

```
Session Cookie Structure:
{
  userId: string,
  email: string,
  role: UserRole,
  status: UserStatus,     // REGISTERED
  organizationId?: string,
  exp: number (TTL)
}

Cookie: 'freight-session' (httpOnly, secure, sameSite=lax)
Encryption: JWE with A256GCM
Signing: HS256 JWT
```

### 1.5 Critical Business Rules

1. **No wallet created during registration**
   - Wallet is created ONLY when organization is created via POST /api/organizations
   - If user creates org during registration (with companyName), org is created but wallet is NOT (see Issue #1 below)

2. **Rate Limiting**
   - 3 registrations per hour per IP
   - Protects against credential stuffing

3. **Password Requirements**
   - Minimum 8 characters
   - Uppercase + lowercase + numeric required
   - Validated by `validatePasswordPolicy()`

### 1.6 ISSUE #1: Registration Creates Org Without Wallet

**CRITICAL FINDING:**

When user registers with `companyName` provided, organization is created at lines 125-137:

```typescript
// app/api/auth/register/route.ts:125-137
const organization = await db.organization.create({
  data: {
    name: validatedData.companyName,
    type: orgType as any,
    contactEmail: validatedData.email,
    contactPhone: validatedData.phone || "N/A",
    isVerified: false,
    associationId: ...,
  },
});
```

**BUT:** No `financialAccount.create()` call!

Compare to `app/api/organizations/route.ts:44-77`:

```typescript
// app/api/organizations/route.ts:44-77
const organization = await db.$transaction(async (tx) => {
  const organization = await tx.organization.create({...});

  // ✓ WALLET CREATED HERE
  await tx.financialAccount.create({
    data: {
      accountType,
      organizationId: organization.id,
      balance: 0,
      currency: "ETB",
    },
  });

  return organization;
});
```

**IMPACT:**
- Users who register with organization have NO wallet
- Wallet validation during trip acceptance will fail
- Must create organization via separate POST /api/organizations call

**SEVERITY:** HIGH - Silent failure path

---

## PHASE 2: VERIFICATION & ACTIVATION

### 2.1 User Status Lifecycle

```
┌────────────┐      ┌───────────────────────┐      ┌────────┐
│ REGISTERED │ ───► │ PENDING_VERIFICATION  │ ───► │ ACTIVE │
└────────────┘      └───────────────────────┘      └────────┘
      │                       │                        │
      │                       │                        │
      ▼                       ▼                        ▼
┌────────────┐         ┌───────────┐           ┌───────────┐
│  Uploads   │         │   Admin   │           │   Full    │
│  Documents │         │  Reviews  │           │  Access   │
└────────────┘         └───────────┘           └───────────┘
                              │
                              ▼
                       ┌───────────┐      ┌───────────┐
                       │ SUSPENDED │  or  │ REJECTED  │
                       └───────────┘      └───────────┘
```

### 2.2 Document Upload Path

**Entry Point:** `app/api/documents/upload/route.ts`

```
POST /api/documents/upload
  │
  ├─► requireAuth() - Any authenticated user
  │
  ├─► Validate file (type, size)
  │
  ├─► Upload to storage
  │
  ├─► Create Document record
  │     type: BOL, POD, INSURANCE, etc.
  │     verificationStatus: PENDING
  │
  └─► After all required docs uploaded:
        → User.status changes to PENDING_VERIFICATION
```

### 2.3 Admin Verification Path

**Entry Point:** `app/api/admin/users/[id]/verify/route.ts:19`

```
POST /api/admin/users/:id/verify
  │
  ├─► requirePermission(VERIFY_DOCUMENTS)
  │     Lines: 25
  │
  ├─► Get current user
  │     Lines: 33-51
  │
  ├─► Update user status
  │     Lines: 53-66
  │     Status: ACTIVE | SUSPENDED | REJECTED
  │
  ├─► Send in-app notification
  │     Lines: 69-74
  │     Module: lib/notifications.ts:notifyUserVerification()
  │
  └─► Send email notification
        Lines: 77-97
        Module: lib/email.ts:sendEmail()
```

### 2.4 Database Changes During Verification

| Table | Field | Before | After |
|-------|-------|--------|-------|
| `users` | `status` | PENDING_VERIFICATION | ACTIVE |
| `notifications` | (new row) | - | Verification notification |

### 2.5 Status Enforcement: requireActiveUser()

**Location:** `lib/auth.ts:requireActiveUser()` (approx lines 300-350)

```typescript
// lib/auth.ts - requireActiveUser()
export async function requireActiveUser(): Promise<SessionData> {
  const session = await requireAuth();

  // Check user status from cache/DB
  const userStatus = await getUserStatus(session.userId);

  if (userStatus.status !== 'ACTIVE') {
    if (userStatus.status === 'SUSPENDED') {
      throw new Error("Forbidden: Account suspended");
    }
    if (userStatus.status === 'REJECTED') {
      throw new Error("Forbidden: Account rejected");
    }
    if (userStatus.status === 'REGISTERED' ||
        userStatus.status === 'PENDING_VERIFICATION') {
      throw new Error("Forbidden: Account pending verification");
    }
  }

  return session;
}
```

**Endpoints Protected by requireActiveUser():**

| Endpoint | File:Line |
|----------|-----------|
| POST /api/loads | loads/route.ts:92 |
| POST /api/truck-postings | truck-postings/route.ts:82 |
| PATCH /api/loads/[id]/status | loads/[id]/status/route.ts:50 |

**Endpoints Using requireAuth() (less strict):**

| Endpoint | File:Line |
|----------|-----------|
| GET /api/loads | loads/route.ts:216 |
| GET /api/trucks | trucks/route.ts:192 |

### 2.6 ISSUE #2: Inconsistent Status Check Granularity

**FINDING:** Some endpoints use `requireActiveUser()` while others use `requireAuth()`.

A SUSPENDED or REGISTERED user can:
- Read loads (GET /api/loads)
- Read trucks (GET /api/trucks)
- Read their profile

But cannot:
- Create loads
- Post trucks
- Assign loads

**SEVERITY:** LOW - By design for read access

---

## PHASE 3: ORGANIZATION & WALLET SETUP

### 3.1 Organization Creation Path

**Entry Point:** `app/api/organizations/route.ts:20`

```
POST /api/organizations
  │
  ├─► requireAuth()
  │     Line: 22
  │
  ├─► Check user has no existing org
  │     Lines: 25-35
  │
  ├─► Zod validation
  │     Lines: 37-38
  │
  └─► Transaction (ATOMIC)
        Lines: 44-77
        │
        ├─► Create organization
        │     Lines: 46-64
        │
        ├─► Link user to org
        │     Via users.connect
        │
        └─► Create financial account (WALLET)
              Lines: 67-73
              accountType: SHIPPER_WALLET or CARRIER_WALLET
              balance: 0
              currency: ETB
```

### 3.2 Wallet Creation Atomicity

**CRITICAL:** Wallet creation is inside `db.$transaction()` at lines 44-77:

```typescript
// app/api/organizations/route.ts:44-77
const organization = await db.$transaction(async (tx) => {
  const organization = await tx.organization.create({
    data: {
      ...validatedData,
      users: {
        connect: { id: session.userId },
      },
    },
    include: { users: true },
  });

  // WALLET CREATED ATOMICALLY
  await tx.financialAccount.create({
    data: {
      accountType,  // SHIPPER_WALLET or CARRIER_WALLET
      organizationId: organization.id,
      balance: 0,
      currency: "ETB",
    },
  });

  return organization;
});
```

**GUARANTEE:** If wallet creation fails, organization creation is rolled back.

### 3.3 Database Changes

| Table | Field | Value |
|-------|-------|-------|
| `organizations` | All fields | From request |
| `organizations` | `isVerified` | false |
| `users` | `organizationId` | org.id |
| `financial_accounts` | `accountType` | SHIPPER_WALLET / CARRIER_WALLET |
| `financial_accounts` | `organizationId` | org.id |
| `financial_accounts` | `balance` | 0 |
| `financial_accounts` | `currency` | ETB |
| `financial_accounts` | `isActive` | true |

### 3.4 Wallet Funding (Admin Top-Up)

**Entry Point:** `app/api/admin/users/[id]/wallet/topup/route.ts:24`

```
POST /api/admin/users/:id/wallet/topup
  │
  ├─► requireAuth() + role check (ADMIN/SUPER_ADMIN)
  │     Lines: 29-37
  │
  ├─► Get user and organization
  │     Lines: 43-61
  │
  ├─► Find wallet
  │     Lines: 63-79
  │
  └─► Transaction (ATOMIC)
        Lines: 84-123
        │
        ├─► Create journal entry (DEPOSIT)
        │     Lines: 86-107
        │
        └─► Update wallet balance
              Lines: 110-116
              balance: { increment: amount }
```

### 3.5 Journal Entry for Deposits

```typescript
// app/api/admin/users/[id]/wallet/topup/route.ts:86-107
const journalEntry = await tx.journalEntry.create({
  data: {
    transactionType: 'DEPOSIT',
    description,
    reference: reference || null,
    metadata: {
      paymentMethod,
      processedBy: session.userId,
      processedByEmail: session.email,
      adminTopUp: true,
    },
    lines: {
      create: [
        {
          accountId: wallet.id,
          amount,
          isDebit: true,  // Debit to wallet = increase balance
        },
      ],
    },
  },
});
```

### 3.6 Double-Entry Accounting

| Account | Debit | Credit |
|---------|-------|--------|
| Wallet (Asset) | +amount | - |
| External (Implied) | - | +amount |

**Note:** Single-sided entry shown. In full double-entry, would have offsetting credit to cash/bank account.

---

## PHASE 4: RESOURCE CREATION (LOADS/TRUCKS)

### 4.1 Load Creation Path

**Entry Point:** `app/api/loads/route.ts:64`

```
POST /api/loads
  │
  ├─► Rate limiting (RPS_CONFIGS.marketplace)
  │     Lines: 67-89
  │
  ├─► requireActiveUser()     ◄── MUST BE ACTIVE
  │     Line: 92
  │
  ├─► requirePermission(CREATE_LOAD)
  │     Line: 93
  │
  ├─► Get user's organization
  │     Lines: 96-106
  │     MUST have organizationId
  │
  ├─► Zod validation (createLoadSchema)
  │     Lines: 108-109
  │
  ├─► Create load
  │     Lines: 112-131
  │     shipperId: user.organizationId
  │     status: DRAFT or POSTED
  │
  ├─► Create LoadEvent
  │     Lines: 133-141
  │     eventType: CREATED or POSTED
  │
  ├─► Cache invalidation
  │     Line: 144
  │
  └─► Push notification (if POSTED)
        Lines: 147-164
        notifyCarriers: NEW_LOAD_POSTED
```

### 4.2 Truck Creation Path

**Entry Point:** `app/api/trucks/route.ts:31`

```
POST /api/trucks
  │
  ├─► Rate limiting (RPS_CONFIGS.fleet)
  │     Lines: 34-56
  │
  ├─► requireAuth()  ◄── Less strict than loads
  │     Line: 58
  │
  ├─► requirePermission(CREATE_TRUCK)
  │     Line: 59
  │
  ├─► Get user's organization
  │     Lines: 61-71
  │     MUST have organizationId
  │
  ├─► Zod validation
  │     Lines: 73-74
  │
  ├─► Check duplicate license plate
  │     Lines: 77-86
  │
  ├─► GPS verification (if IMEI provided)
  │     Lines: 91-119
  │     Module: lib/gpsVerification.ts
  │
  ├─► Create truck
  │     Lines: 121-136
  │     carrierId: user.organizationId
  │     approvalStatus: PENDING (default)
  │
  └─► Cache invalidation
        Line: 139
```

### 4.3 Truck Approval Requirement

**CRITICAL:** Trucks start with `approvalStatus: PENDING` and cannot be posted until APPROVED.

**Approval Path:** `app/api/trucks/[id]/approve/route.ts`

```typescript
// prisma/schema.prisma - Truck model
approvalStatus   VerificationStatus @default(PENDING)

// VerificationStatus enum:
enum VerificationStatus {
  PENDING
  APPROVED
  REJECTED
  EXPIRED
}
```

**Enforcement in truck-postings:**

```typescript
// app/api/truck-postings/route.ts:238-247
if (truck.approvalStatus !== 'APPROVED') {
  return NextResponse.json({
    error: 'Only approved trucks can be posted to the loadboard',
    currentStatus: truck.approvalStatus,
    hint: 'Please wait for admin approval before posting this truck',
  }, { status: 403 });
}
```

### 4.4 Database Changes - Load Creation

| Table | Field | Value |
|-------|-------|-------|
| `loads` | `id` | CUID |
| `loads` | `status` | DRAFT or POSTED |
| `loads` | `shipperId` | user.organizationId |
| `loads` | `createdById` | session.userId |
| `loads` | All other fields | From request |
| `load_events` | `eventType` | CREATED or POSTED |
| `load_events` | `loadId` | load.id |

### 4.5 Database Changes - Truck Creation

| Table | Field | Value |
|-------|-------|-------|
| `trucks` | `id` | CUID |
| `trucks` | `carrierId` | user.organizationId |
| `trucks` | `approvalStatus` | PENDING |
| `trucks` | All other fields | From request |

---

## PHASE 5: POSTING & AVAILABILITY

### 5.1 Load Status State Machine

**Location:** `lib/loadStateMachine.ts`

```
┌────────┐
│ DRAFT  │
└────┬───┘
     │
     ▼
┌────────┐      ┌───────────┐      ┌─────────┐      ┌──────────┐
│ POSTED │ ───► │ SEARCHING │ ───► │ OFFERED │ ───► │ ASSIGNED │
└────────┘      └───────────┘      └─────────┘      └──────────┘
     │               │                  │                │
     │               │                  │                ▼
     │               │                  │         ┌───────────────┐
     │               │                  │         │PICKUP_PENDING │
     │               │                  │         └───────┬───────┘
     │               │                  │                 │
     │               │                  │                 ▼
     │               │                  │          ┌───────────┐
     │               │                  │          │ IN_TRANSIT│
     │               │                  │          └─────┬─────┘
     │               │                  │                │
     │               │                  │                ▼
     │               │                  │          ┌───────────┐
     │               │                  │          │ DELIVERED │
     │               │                  │          └─────┬─────┘
     │               │                  │                │
     │               │                  │                ▼
     │               │                  │          ┌───────────┐
     ▼               ▼                  ▼          │ COMPLETED │
┌─────────┐   ┌─────────┐        ┌─────────┐      └───────────┘
│ EXPIRED │   │CANCELLED│        │EXCEPTION│
└─────────┘   └─────────┘        └─────────┘
```

### 5.2 Valid Transitions Matrix

**Source:** `lib/loadStateMachine.ts:28-108`

| From Status | Valid Next Statuses |
|-------------|---------------------|
| DRAFT | POSTED, CANCELLED |
| POSTED | SEARCHING, OFFERED, ASSIGNED, UNPOSTED, CANCELLED, EXPIRED |
| SEARCHING | OFFERED, ASSIGNED, EXCEPTION, CANCELLED, EXPIRED |
| OFFERED | ASSIGNED, SEARCHING, EXCEPTION, CANCELLED, EXPIRED |
| ASSIGNED | PICKUP_PENDING, IN_TRANSIT, EXCEPTION, CANCELLED |
| PICKUP_PENDING | IN_TRANSIT, EXCEPTION, CANCELLED |
| IN_TRANSIT | DELIVERED, EXCEPTION |
| DELIVERED | COMPLETED, EXCEPTION |
| COMPLETED | EXCEPTION |
| CANCELLED | (terminal) |
| EXPIRED | POSTED, CANCELLED |

### 5.3 Truck Posting Path

**Entry Point:** `app/api/truck-postings/route.ts:79`

```
POST /api/truck-postings
  │
  ├─► requireActiveUser()
  │     Line: 82
  │
  ├─► CSRF protection (if not mobile)
  │     Lines: 87-95
  │
  ├─► Check organization
  │     Lines: 98-103
  │
  ├─► Rate limit (100/day/carrier)
  │     Lines: 106-127
  │
  ├─► Zod validation
  │     Lines: 129-171
  │
  ├─► Parallel validations:
  │     Lines: 187-213
  │     │
  │     ├─► Origin location exists & active
  │     ├─► Destination location exists & active (if provided)
  │     ├─► Truck exists & approved
  │     └─► Check ONE_ACTIVE_POST_PER_TRUCK rule
  │
  ├─► Truck approval check
  │     Lines: 238-247
  │     truck.approvalStatus === 'APPROVED'
  │
  ├─► Ownership check
  │     Lines: 268-279
  │
  ├─► Create truck posting
  │     Lines: 284-330
  │     status: ACTIVE
  │
  └─► Cache invalidation
        Line: 334
```

### 5.4 ONE_ACTIVE_POST_PER_TRUCK Rule

**Location:** `lib/foundation-rules.ts`

```typescript
// Foundation Rule: ONE_ACTIVE_POST_PER_TRUCK
export const RULE_ONE_ACTIVE_POST_PER_TRUCK = {
  id: 'ONE_ACTIVE_POST_PER_TRUCK',
  name: 'One Active Post Per Truck',
  description: 'Each truck can only have one ACTIVE posting at a time',
  enforcement: 'hard',
};

export function validateOneActivePostPerTruck(data: {
  truckId: string;
  hasActivePost: boolean;
  activePostId?: string;
}): { valid: boolean; error?: string } {
  if (data.hasActivePost) {
    return {
      valid: false,
      error: `This truck already has an active posting (ID: ${data.activePostId}).
              Cancel or expire the existing posting before creating a new one.`,
    };
  }
  return { valid: true };
}
```

### 5.5 Database Changes - Truck Posting

| Table | Field | Value |
|-------|-------|-------|
| `truck_postings` | `id` | CUID |
| `truck_postings` | `truckId` | From request |
| `truck_postings` | `carrierId` | truck.carrierId |
| `truck_postings` | `createdById` | session.userId |
| `truck_postings` | `status` | ACTIVE |
| `truck_postings` | `originCityId` | From request |
| `truck_postings` | `destinationCityId` | From request (nullable) |
| `truck_postings` | `availableFrom` | From request |
| `truck_postings` | `availableTo` | From request (nullable) |
| `truck_postings` | `postedAt` | now() |

---

## PHASE 6: MATCHING & PROPOSALS

### 6.1 Matching Engine

**Location:** `lib/matchingEngine.ts`

### 6.1.1 Score Calculation

**Function:** `calculateMatchScore()` (Lines 288-353)

| Component | Weight | Max Points | Criteria |
|-----------|--------|------------|----------|
| Route | 40% | 40 | Origin/destination proximity |
| Time | 30% | 30 | Availability window overlap |
| Capacity | 20% | 20 | Weight/length fit |
| Deadhead | 10% | 10 | DH-O distance < 200km |

### 6.1.2 Hard Filters (Exclusion Criteria)

**Function:** `calcLoadTruckMatchScore()` (Lines 837-962)

```typescript
// HARD FILTER 1: Truck Type Compatibility
const typeCompat = checkTruckTypeCompatibility(load.truckType, truck.truckType);
if (typeCompat === 'incompatible') {
  return { excluded: true, excludeReason: 'Incompatible truck type' };
}

// HARD FILTER 2: DH-O Distance > 200km
if (actualDhKm > 200) {
  return { excluded: true, excludeReason: 'DH-O too far' };
}

// HARD FILTER 3: Weight Capacity
if (load.weight && truck.maxWeight && truck.maxWeight < load.weight) {
  return { excluded: true, excludeReason: 'Insufficient capacity' };
}
```

### 6.1.3 Compatible Truck Type Groups

```typescript
// lib/matchingEngine.ts:701-704
const TRUCK_TYPE_GROUPS: Record<string, string[]> = {
  'GENERAL': ['DRY_VAN', 'FLATBED', 'CONTAINER', 'VAN'],
  'COLD_CHAIN': ['REFRIGERATED', 'REEFER'],
};
```

### 6.2 Match Proposal Creation (Dispatcher)

**Entry Point:** `app/api/match-proposals/route.ts`

```
POST /api/match-proposals
  │
  ├─► requireAuth()
  │
  ├─► Check DISPATCHER permission
  │     Foundation Rule: DISPATCHER_COORDINATION_ONLY
  │     Dispatchers can PROPOSE, not ASSIGN
  │
  ├─► Validate load status (POSTED, SEARCHING, OFFERED)
  │
  ├─► Validate truck availability
  │
  ├─► Check for existing active proposal
  │
  ├─► Create MatchProposal
  │     status: PENDING
  │     expiresAt: now + 24 hours
  │
  ├─► Update load status → OFFERED
  │
  └─► Notify carrier
```

### 6.3 Match Proposal Response (Carrier)

**Entry Point:** `app/api/match-proposals/[id]/respond/route.ts:45`

```
POST /api/match-proposals/:id/respond
  │
  ├─► requireAuth()
  │     Line: 51
  │
  ├─► Get proposal with relations
  │     Lines: 54-76
  │
  ├─► Check proposal status (PENDING)
  │     Lines: 85-93
  │
  ├─► Check expiration
  │     Lines: 95-107
  │
  ├─► canApproveRequests() check
  │     Lines: 110-125
  │     Foundation Rule: CARRIER_FINAL_AUTHORITY
  │     Only truck owner can respond
  │
  ├─► Zod validation
  │     Lines: 128-139
  │
  └─► IF action === 'ACCEPT':
        │
        ├─► validateWalletBalancesForTrip()
        │     Lines: 146-164
        │     Check shipper & carrier wallet balances
        │
        └─► Transaction (ATOMIC)
              Lines: 171-311
              │
              ├─► Fresh re-fetch load (race condition protection)
              ├─► Check load still available
              ├─► Check truck not busy
              ├─► Update proposal → ACCEPTED
              ├─► Assign load to truck
              ├─► Create Trip record
              ├─► Create LoadEvent
              ├─► Cancel other pending proposals
              └─► Cancel pending requests
```

### 6.4 Database Changes - Proposal Accept

| Table | Field | Before | After |
|-------|-------|--------|-------|
| `match_proposals` | `status` | PENDING | ACCEPTED |
| `match_proposals` | `respondedAt` | null | now() |
| `match_proposals` | `respondedById` | null | session.userId |
| `loads` | `status` | OFFERED | ASSIGNED |
| `loads` | `assignedTruckId` | null | truckId |
| `loads` | `assignedAt` | null | now() |
| `trips` | (new row) | - | Created with ASSIGNED status |
| `load_events` | (new row) | - | ASSIGNED event |

---

## PHASE 7: TRIP ASSIGNMENT

### 7.1 Direct Assignment Path (CARRIER)

**Entry Point:** `app/api/loads/[id]/assign/route.ts:32`

```
POST /api/loads/:id/assign
  │
  ├─► requireAuth()
  │     Line: 37
  │
  ├─► Get load details
  │     Lines: 40-58
  │
  ├─► Permission check (canAssignLoads)
  │     Lines: 61-88
  │     Module: lib/dispatcherPermissions.ts
  │
  ├─► Zod validation
  │     Lines: 91-92
  │
  ├─► State machine validation (→ ASSIGNED)
  │     Lines: 95-106
  │
  ├─► Get truck details
  │     Lines: 109-127
  │
  ├─► Carrier ownership check
  │     Lines: 130-137
  │     Foundation Rule: CARRIER_FINAL_AUTHORITY
  │
  ├─► Assignment conflict check
  │     Lines: 140-161
  │     Module: lib/assignmentConflictDetection.ts
  │
  ├─► WALLET VALIDATION (critical)
  │     Lines: 165-180
  │     validateWalletBalancesForTrip(loadId, truck.carrierId)
  │
  └─► Transaction (ATOMIC)
        Lines: 187-311
        │
        ├─► Fresh re-fetch load (P0-006 fix)
        ├─► Check load still available
        ├─► Check truck not busy
        ├─► Cleanup completed load assignments
        ├─► Assign truck to load
        ├─► Create Trip record
        ├─► Create LoadEvent
        └─► Cancel pending requests/proposals
```

### 7.2 Wallet Validation Before Assignment

**Location:** `lib/serviceFeeManagement.ts:710-845`

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
}> {
  const errors: string[] = [];

  // Get load with corridor info
  const load = await db.load.findUnique({...});

  // Calculate expected fees from corridor
  const distanceKm = load.estimatedTripKm || load.tripKm || load.corridor.distanceKm;
  const shipperFeeCalc = calculatePartyFee(...);
  const carrierFeeCalc = calculatePartyFee(...);

  // Get wallet balances
  const [shipperWallet, carrierWallet] = await Promise.all([...]);

  // Validate shipper balance
  if (shipperFeeCalc.finalFee > 0 && shipperBalance < shipperFeeCalc.finalFee) {
    errors.push(`Shipper has insufficient wallet balance...`);
  }

  // Validate carrier balance
  if (carrierFeeCalc.finalFee > 0 && carrierBalance < carrierFeeCalc.finalFee) {
    errors.push(`Carrier has insufficient wallet balance...`);
  }

  return { valid: errors.length === 0, ... };
}
```

### 7.3 Trip Creation

**Location:** `lib/tripManagement.ts:22-98`

```typescript
export async function createTripForLoad(
  loadId: string,
  truckId: string,
  userId: string
): Promise<Trip | null> {
  // Check if trip already exists (idempotency)
  const existingTrip = await db.trip.findUnique({ where: { loadId } });
  if (existingTrip) return existingTrip;

  // Get load and truck details
  const load = await db.load.findUnique({...});
  const truck = await db.truck.findUnique({...});

  // Generate tracking URL
  const trackingUrl = generateTrackingUrl(loadId);

  // Create trip
  const trip = await db.trip.create({
    data: {
      loadId,
      truckId,
      carrierId: truck.carrierId,
      shipperId: load.shipperId,
      status: 'ASSIGNED',
      pickupLat: load.originLat,
      pickupLng: load.originLon,
      deliveryLat: load.destinationLat,
      deliveryLng: load.destinationLon,
      estimatedDistanceKm: load.tripKm,
      trackingUrl,
      trackingEnabled: true,
    },
  });

  return trip;
}
```

### 7.4 Trip Status State Machine

**Location:** `lib/tripManagement.ts:218-228`

```typescript
const validTransitions: Record<TripStatus, TripStatus[]> = {
  ASSIGNED: ['PICKUP_PENDING', 'CANCELLED'],
  PICKUP_PENDING: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],  // Terminal state
  CANCELLED: [],  // Terminal state
};
```

### 7.5 Database Changes - Trip Assignment

| Table | Field | Value |
|-------|-------|-------|
| `loads` | `status` | ASSIGNED |
| `loads` | `assignedTruckId` | truckId |
| `loads` | `assignedAt` | now() |
| `trips` | `id` | CUID |
| `trips` | `loadId` | loadId |
| `trips` | `truckId` | truckId |
| `trips` | `carrierId` | truck.carrierId |
| `trips` | `shipperId` | load.shipperId |
| `trips` | `status` | ASSIGNED |
| `trips` | `trackingUrl` | trip-{shortId}-{random} |
| `trips` | `trackingEnabled` | true |
| `load_events` | (new row) | ASSIGNED event |
| `match_proposals` | `status` | CANCELLED (all pending for this load) |
| `load_requests` | `status` | CANCELLED (all pending for this load) |
| `truck_requests` | `status` | CANCELLED (all pending for this load) |

---

## PHASE 8: TRIP LIFECYCLE

### 8.1 Status Update Path

**Entry Point:** `app/api/loads/[id]/status/route.ts:44`

```
PATCH /api/loads/:id/status
  │
  ├─► requireActiveUser()
  │     Line: 50
  │
  ├─► Zod validation (status enum)
  │     Lines: 53-54
  │
  ├─► Get load with trip info
  │     Lines: 57-84
  │
  ├─► Validate state transition
  │     Lines: 94-105
  │     Module: lib/loadStateMachine.ts
  │
  ├─► Permission check based on role
  │     Lines: 108-150
  │     │
  │     ├─► isShipper: DRAFT, POSTED, CANCELLED, UNPOSTED
  │     ├─► isCarrier: ASSIGNED, PICKUP_PENDING, IN_TRANSIT, DELIVERED
  │     ├─► isDispatcher: Full access
  │     └─► isAdmin: Full access
  │
  ├─► Transaction (ATOMIC)
  │     Lines: 169-241
  │     │
  │     ├─► Update load status
  │     ├─► Sync trip status (P0-001 fix)
  │     └─► Create LoadEvent for status sync
  │
  ├─► IF status === COMPLETED:
  │     Lines: 250-282
  │     └─► deductServiceFee(loadId)
  │
  ├─► Cache invalidation
  │     Line: 291
  │
  ├─► Create LoadEvent (status change)
  │     Lines: 294-307
  │
  ├─► Notifications
  │     Lines: 310-349
  │     ├─► Notify shipper
  │     └─► Notify carrier
  │
  └─► Trust metrics update
        Lines: 352-368
        ├─► COMPLETED: incrementCompletedLoads()
        └─► CANCELLED: incrementCancelledLoads(), checkSuspiciousCancellation()
```

### 8.2 Load/Trip Status Synchronization

**Location:** `app/api/loads/[id]/status/route.ts:157-166`

```typescript
// P0-001 FIX: Map Load status to Trip status
const loadStatusToTripStatus: Record<string, TripStatus | null> = {
  'ASSIGNED': TripStatus.ASSIGNED,
  'PICKUP_PENDING': TripStatus.PICKUP_PENDING,
  'IN_TRANSIT': TripStatus.IN_TRANSIT,
  'DELIVERED': TripStatus.DELIVERED,
  'COMPLETED': TripStatus.COMPLETED,
  'CANCELLED': TripStatus.CANCELLED,
  'EXPIRED': TripStatus.CANCELLED,
  'EXCEPTION': null,  // Don't change trip status for exceptions
};
```

### 8.3 Truck Unassignment on Terminal States

**Location:** `app/api/loads/[id]/status/route.ts:153-154`

```typescript
const terminalStatuses = ['COMPLETED', 'DELIVERED', 'CANCELLED', 'EXPIRED'];
const shouldUnassignTruck = terminalStatuses.includes(newStatus) && load.assignedTruckId;

// In transaction:
if (shouldUnassignTruck) {
  data.assignedTruckId = null;
  data.trackingEnabled = false;
}
```

---

## PHASE 9: DELIVERY & POD

### 9.1 POD Upload Path (Carrier)

**Entry Point:** `app/api/loads/[id]/pod/route.ts:22`

```
POST /api/loads/:id/pod
  │
  ├─► requireAuth()
  │     Line: 28
  │
  ├─► Get load details
  │     Lines: 31-43
  │
  ├─► Check load status === DELIVERED
  │     Lines: 50-54
  │
  ├─► Check user is carrier or admin
  │     Lines: 57-71
  │
  ├─► Check POD not already submitted
  │     Lines: 74-79
  │
  ├─► Parse form data, validate file
  │     Lines: 82-114
  │     Allowed: JPEG, PNG, PDF
  │     Max size: 10MB
  │
  ├─► Upload to storage
  │     Lines: 117-125
  │     Module: lib/storage.ts:uploadPOD()
  │
  ├─► Update load
  │     Lines: 130-137
  │     podUrl: uploadResult.url
  │     podSubmitted: true
  │     podSubmittedAt: now()
  │
  ├─► Create LoadEvent (POD_SUBMITTED)
  │     Lines: 140-147
  │
  ├─► Cache invalidation
  │     Line: 150
  │
  └─► Notify shipper
        Lines: 153-170
        type: POD_SUBMITTED
```

### 9.2 POD Verification Path (Shipper)

**Entry Point:** `app/api/loads/[id]/pod/route.ts:195`

```
PUT /api/loads/:id/pod
  │
  ├─► requireAuth()
  │     Line: 201
  │
  ├─► Get load details
  │     Lines: 204-214
  │
  ├─► Check user is shipper or admin
  │     Lines: 220-233
  │
  ├─► Check POD was submitted
  │     Lines: 236-242
  │
  ├─► Check not already verified
  │     Lines: 245-250
  │
  ├─► Verify POD (update load)
  │     Lines: 253-258
  │     podVerified: true
  │     podVerifiedAt: now()
  │
  ├─► Create LoadEvent (POD_VERIFIED)
  │     Lines: 261-268
  │
  ├─► Cache invalidation
  │     Line: 271
  │
  └─► Notify carrier
        Lines: 274-304
        type: POD_VERIFIED
```

### 9.3 Database Changes - POD Flow

| Stage | Table | Field | Value |
|-------|-------|-------|-------|
| Upload | `loads` | `podUrl` | S3/storage URL |
| Upload | `loads` | `podSubmitted` | true |
| Upload | `loads` | `podSubmittedAt` | now() |
| Upload | `load_events` | `eventType` | POD_SUBMITTED |
| Upload | `notifications` | (new row) | To shipper |
| Verify | `loads` | `podVerified` | true |
| Verify | `loads` | `podVerifiedAt` | now() |
| Verify | `load_events` | `eventType` | POD_VERIFIED |
| Verify | `notifications` | (new row) | To carrier |

---

## PHASE 10: FEE COLLECTION & SETTLEMENT

### 10.1 When Fees Are Collected

```
┌─────────────────────────────────────────────────────────────────────────┐
│ SERVICE FEE TIMING                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ TRIP ACCEPTANCE (assign or match-proposal accept):                      │
│   → validateWalletBalancesForTrip() - VALIDATION ONLY                   │
│   → No money moved                                                      │
│                                                                         │
│ TRIP COMPLETION (status → COMPLETED):                                   │
│   → deductServiceFee() - ACTUAL DEDUCTION                               │
│   → Money moved: Shipper → Platform ← Carrier                           │
│                                                                         │
│ TRIP CANCELLATION (status → CANCELLED):                                 │
│   → No action needed                                                    │
│   → Nothing was taken (validation only at acceptance)                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Fee Deduction Path

**Trigger:** `app/api/loads/[id]/status/route.ts:250-282`

```typescript
// When status === COMPLETED
if (newStatus === 'COMPLETED') {
  try {
    // Check idempotency
    const existingFeeEvent = await db.loadEvent.findFirst({
      where: { loadId, eventType: 'SERVICE_FEE_DEDUCTED' },
    });

    if (!existingFeeEvent) {
      serviceFeeResult = await deductServiceFee(loadId);

      if (serviceFeeResult.success && serviceFeeResult.transactionId) {
        await db.loadEvent.create({
          data: {
            loadId,
            eventType: 'SERVICE_FEE_DEDUCTED',
            description: `Service fees deducted - Shipper: ${shipperFee}, Carrier: ${carrierFee}`,
            metadata: { ... },
          },
        });
      }
    }
  } catch (error) {
    console.error('Service fee deduction error:', error);
  }
}
```

### 10.3 deductServiceFee() Implementation

**Location:** `lib/serviceFeeManagement.ts:98-524`

```
deductServiceFee(loadId)
  │
  ├─► Get load with corridor info
  │     Lines: 100-144
  │
  ├─► Check not already deducted
  │     Lines: 159-169
  │
  ├─► Find or use existing corridor
  │     Lines: 172-189
  │
  ├─► If no corridor → waive fees
  │     Lines: 192-215
  │
  ├─► Calculate distance
  │     Lines: 218-234
  │     Priority: actualTripKm > estimatedTripKm > tripKm > corridor.distanceKm
  │
  ├─► Calculate shipper fee
  │     Lines: 237-252
  │     Module: lib/serviceFeeCalculation.ts:calculatePartyFee()
  │
  ├─► Calculate carrier fee
  │     Lines: 255-268
  │
  ├─► Get wallets
  │     Lines: 275-301
  │
  ├─► Create platform account if not exists
  │     Lines: 304-316
  │
  ├─► Prepare journal lines
  │     Lines: 321-368
  │     - Debit shipper wallet (if sufficient balance)
  │     - Debit carrier wallet (if sufficient balance)
  │     - Credit platform revenue
  │
  └─► Transaction (ATOMIC) - CRITICAL
        Lines: 383-499
        │
        ├─► Re-verify shipper balance
        ├─► Re-verify carrier balance
        ├─► Create journal entry
        ├─► Update shipper wallet (decrement)
        ├─► Update carrier wallet (decrement)
        ├─► Update platform revenue (increment)
        └─► Update load fee fields
```

### 10.4 Fee Calculation Formula

**Location:** `lib/serviceFeeCalculation.ts:173-209`

```typescript
export function calculatePartyFee(
  distanceKm: number,
  pricePerKm: number,
  promoFlag: boolean,
  promoDiscountPct: number | null
): PartyFeeCalculation {
  if (pricePerKm <= 0) {
    return { baseFee: 0, promoDiscount: 0, finalFee: 0, ... };
  }

  // Base fee = distance × price per km
  const baseFee = new Decimal(distanceKm).mul(new Decimal(pricePerKm));

  // Apply promo discount if applicable
  let promoDiscount = new Decimal(0);
  if (promoFlag && promoDiscountPct && promoDiscountPct > 0) {
    promoDiscount = baseFee.mul(new Decimal(promoDiscountPct)).div(100);
  }

  // Final fee = base - discount
  const finalFee = baseFee.sub(promoDiscount);

  return {
    baseFee: baseFee.toDecimalPlaces(2).toNumber(),
    promoDiscount: promoDiscount.toDecimalPlaces(2).toNumber(),
    finalFee: finalFee.toDecimalPlaces(2).toNumber(),
    promoApplied,
    promoDiscountPct,
    pricePerKm,
  };
}
```

### 10.5 Database Changes - Fee Deduction

| Table | Field | Value |
|-------|-------|-------|
| `journal_entries` | `transactionType` | SERVICE_FEE_DEDUCT |
| `journal_entries` | `loadId` | loadId |
| `journal_entries` | `metadata` | { shipperFee, carrierFee, corridorId, distanceKm, ... } |
| `journal_lines` | (shipper debit) | amount, isDebit=true, accountId=shipperWallet.id |
| `journal_lines` | (carrier debit) | amount, isDebit=true, accountId=carrierWallet.id |
| `journal_lines` | (platform credit) | amount, isDebit=false, accountId=platformAccount.id |
| `financial_accounts` | shipper | balance - shipperFee |
| `financial_accounts` | carrier | balance - carrierFee |
| `financial_accounts` | platform | balance + (shipperFee + carrierFee) |
| `loads` | `shipperServiceFee` | shipperFeeCalc.finalFee |
| `loads` | `shipperFeeStatus` | DEDUCTED |
| `loads` | `shipperFeeDeductedAt` | now() |
| `loads` | `carrierServiceFee` | carrierFeeCalc.finalFee |
| `loads` | `carrierFeeStatus` | DEDUCTED |
| `loads` | `carrierFeeDeductedAt` | now() |
| `loads` | `serviceFeeEtb` | totalPlatformFee (legacy) |
| `loads` | `serviceFeeStatus` | DEDUCTED (legacy) |
| `load_events` | (new row) | SERVICE_FEE_DEDUCTED |

### 10.6 Atomicity Guarantee

**CRITICAL:** All financial operations are in a single `db.$transaction()`:

```typescript
// lib/serviceFeeManagement.ts:383-499
const result = await db.$transaction(async (tx) => {
  // 1. Re-verify balances inside transaction (race condition protection)
  if (shipperDeducted && shipperWallet && shipperFeeCalc.finalFee > 0) {
    const currentShipperWallet = await tx.financialAccount.findUnique({...});
    if (!currentShipperWallet ||
        new Decimal(currentShipperWallet.balance).lessThan(shipperFeeCalc.finalFee)) {
      throw new Error('Insufficient shipper balance');
    }
  }

  // 2. Create journal entry
  const journalEntry = await tx.journalEntry.create({...});

  // 3. Update shipper wallet
  await tx.financialAccount.update({ data: { balance: { decrement: ... } } });

  // 4. Update carrier wallet
  await tx.financialAccount.update({ data: { balance: { decrement: ... } } });

  // 5. Update platform revenue
  await tx.financialAccount.update({ data: { balance: { increment: ... } } });

  // 6. Update load fields
  await tx.load.update({...});

  return journalEntry.id;
});
```

**If any step fails, ALL changes are rolled back.**

---

## PHASE 11: DAILY RESET & AUTOMATION

### 11.1 Cron Jobs Overview

| Job | Schedule | Endpoint | Function |
|-----|----------|----------|----------|
| Expire Postings | 0 3 * * * (3 AM daily) | /api/cron/expire-postings | Expire old truck postings |
| Expire Loads | 0 4 * * * (4 AM daily) | /api/cron/expire-loads | Expire unassigned loads |
| GPS Monitor | */5 * * * * (every 5 min) | /api/cron/gps-monitor | Check GPS device health |
| GPS Cleanup | 0 5 * * * (5 AM daily) | /api/cron/gps-cleanup | Clean old GPS positions |
| Auto Settle | 0 6 * * * (6 AM daily) | /api/cron/auto-settle | Process pending settlements |
| Aggregate SLA | 0 0 * * * (midnight) | /api/cron/aggregate-sla | Calculate SLA metrics |

### 11.2 Expire Postings Job

**Entry Point:** `app/api/cron/expire-postings/route.ts`

```
POST /api/cron/expire-postings (with CRON_SECRET)
  │
  ├─► Verify cron secret
  │     Lines: 18-23
  │
  ├─► expireOldTruckPostings()
  │     Module: lib/truckPostingAutomation.ts:25-121
  │     │
  │     ├─► Find ACTIVE postings where:
  │     │     availableTo < now OR expiresAt < now
  │     │
  │     └─► Update status → EXPIRED
  │
  └─► expireOldRequests()
        Module: lib/truckPostingAutomation.ts:127-178
        │
        ├─► Expire PENDING load requests
        │     where expiresAt < now
        │
        └─► Expire PENDING truck requests
              where expiresAt < now
```

### 11.3 Truck Availability Reset

**FINDING:** There is NO automatic daily reset of truck availability.

Truck availability (`isAvailable` field) is managed manually:
1. Set to true when truck is created
2. Implicitly unavailable when assigned to active load
3. Posting expiration (ACTIVE → EXPIRED) does NOT change truck.isAvailable

**IMPLICATION:** Carriers must manually manage truck availability or create new postings.

### 11.4 Database Changes - Cron Jobs

| Job | Table | Field | Change |
|-----|-------|-------|--------|
| expire-postings | `truck_postings` | `status` | ACTIVE → EXPIRED |
| expire-postings | `load_requests` | `status` | PENDING → EXPIRED |
| expire-postings | `truck_requests` | `status` | PENDING → EXPIRED |
| expire-loads | `loads` | `status` | POSTED → EXPIRED (if pickup date passed) |
| gps-cleanup | `gps_positions` | (delete old) | Delete > 30 days |

---

## CONCURRENCY & RACE CONDITION ANALYSIS

### RC-1: Double Assignment Prevention

**Location:** `app/api/loads/[id]/assign/route.ts:187-311`

```typescript
// P0-005 & P0-006 FIX: All operations in single transaction with fresh re-fetch
result = await db.$transaction(async (tx) => {
  // Fresh re-fetch inside transaction
  const freshLoad = await tx.load.findUnique({...});

  // Race condition check
  if (freshLoad.assignedTruckId) {
    throw new Error('LOAD_ALREADY_ASSIGNED');
  }

  // Check truck not busy
  const truckBusy = await tx.load.findFirst({
    where: {
      assignedTruckId: truckId,
      status: { in: ['ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT'] },
    },
  });

  if (truckBusy) {
    throw new Error('TRUCK_ALREADY_BUSY');
  }

  // Proceed with assignment
  ...
});
```

### RC-2: Fee Deduction Race Condition

**Location:** `lib/serviceFeeManagement.ts:383-406`

```typescript
// Re-verify balances inside transaction
const result = await db.$transaction(async (tx) => {
  // Re-check shipper balance
  if (shipperDeducted && shipperWallet && shipperFeeCalc.finalFee > 0) {
    const currentShipperWallet = await tx.financialAccount.findUnique({
      where: { id: shipperWallet.id },
      select: { balance: true },
    });
    if (!currentShipperWallet ||
        new Decimal(currentShipperWallet.balance).lessThan(shipperFeeCalc.finalFee)) {
      throw new Error('Insufficient shipper balance for fee deduction');
    }
  }

  // Re-check carrier balance (same pattern)
  ...
});
```

### RC-3: Match Proposal Accept Race Condition

**Location:** `app/api/match-proposals/[id]/respond/route.ts:171-311`

Same pattern as assignment - fresh re-fetch inside transaction.

### RC-4: Unique Constraint Fallback

**Location:** Multiple files

```typescript
// Handle unique constraint violation (race condition fallback)
if (error?.code === 'P2002') {
  const field = error?.meta?.target?.[0] || 'field';
  if (field === 'assignedTruckId') {
    return NextResponse.json(
      { error: 'This truck is already assigned to another load...' },
      { status: 409 }
    );
  }
}
```

---

## FAILURE & RECOVERY ANALYSIS

### F-1: Fee Deduction Failure

**Scenario:** Fee deduction fails during COMPLETED transition

**Current Behavior:**
```typescript
// app/api/loads/[id]/status/route.ts:279-281
} catch (error) {
  console.error('Service fee deduction error:', error);
  // Load status still changes to COMPLETED
}
```

**ISSUE:** Load transitions to COMPLETED even if fee deduction fails.

**Impact:**
- Load marked COMPLETED without fees deducted
- Fees remain PENDING on load record
- Manual intervention required

**Severity:** MEDIUM - Can be recovered via admin

### F-2: POD Upload Failure

**Scenario:** Storage upload fails

**Current Behavior:**
```typescript
// app/api/loads/[id]/pod/route.ts:119-125
if (!uploadResult.success) {
  console.error('POD upload failed:', uploadResult.error);
  return NextResponse.json(
    { error: 'Failed to upload POD file. Please try again.' },
    { status: 500 }
  );
}
```

**Recovery:** Client retries upload. Load status unchanged.

**Severity:** LOW - Self-recoverable

### F-3: Trip Creation Failure

**Scenario:** Trip creation fails during assignment

**Current Behavior:** Trip creation is inside the atomic transaction:

```typescript
// app/api/loads/[id]/assign/route.ts:258-277
const trip = await tx.trip.create({...});
```

**Recovery:** Entire assignment rolls back. Client can retry.

**Severity:** LOW - Transaction guarantees atomicity

### F-4: Notification Failure

**Scenario:** Notification delivery fails

**Current Behavior:**
```typescript
// Fire-and-forget pattern
notificationPromises.push(
  createNotification({...}).catch(console.error)
);
Promise.all(notificationPromises).catch(console.error);
```

**Impact:** Notification not delivered, but business logic succeeds.

**Severity:** LOW - Non-critical path

---

## SEQUENCE DIAGRAMS

### Complete Trip Flow

```
┌─────────┐  ┌────────┐  ┌───────────┐  ┌──────┐  ┌────────┐  ┌─────────┐
│ Shipper │  │ System │  │ Dispatcher │  │Carrier│  │Platform│  │ Database│
└────┬────┘  └───┬────┘  └─────┬─────┘  └───┬───┘  └───┬────┘  └────┬────┘
     │           │             │            │          │            │
     │ POST load │             │            │          │            │
     │──────────►│             │            │          │            │
     │           │ validate    │            │          │            │
     │           │─────────────────────────────────────────────────►│
     │           │             │            │          │            │
     │           │◄──────────────────────────────────── load created │
     │◄───────── │             │            │          │            │
     │  201 OK   │             │            │          │            │
     │           │             │            │          │            │
     │           │  Find matches            │          │            │
     │           │──────────►│            │          │            │
     │           │             │ propose    │          │            │
     │           │             │───────────►│          │            │
     │           │             │            │          │            │
     │           │             │            │ accept   │            │
     │           │             │            │─────────►│            │
     │           │             │            │          │            │
     │           │             │            │ validate │            │
     │           │             │            │ wallets  │            │
     │           │             │            │──────────────────────►│
     │           │             │            │◄──────── │ valid      │
     │           │             │            │          │            │
     │           │             │            │ assign   │            │
     │           │             │            │──────────────────────►│
     │           │             │            │◄──────── │ trip created│
     │           │             │◄─────────── │          │            │
     │◄───────── │             │ notified   │          │            │
     │ notified  │             │            │          │            │
     │           │             │            │          │            │
     │           │             │            │ pickup   │            │
     │           │             │            │──────────────────────►│
     │           │             │            │          │            │
     │           │             │            │ transit  │            │
     │           │             │            │──────────────────────►│
     │           │             │            │          │            │
     │           │             │            │ deliver  │            │
     │           │             │            │──────────────────────►│
     │           │             │            │          │            │
     │           │             │            │ POD      │            │
     │           │             │            │──────────────────────►│
     │◄───────── │             │            │          │            │
     │ verify    │             │            │          │            │
     │───────────────────────────────────────────────────────────── │ POD verified
     │           │             │            │          │            │
     │ COMPLETE  │             │            │          │            │
     │───────────────────────────────────────────────────────────── │
     │           │             │            │          │            │
     │           │             │            │          │ deduct     │
     │           │             │            │          │ fees       │
     │           │             │            │          │───────────►│
     │           │             │            │          │◄───────────│
     │           │             │            │          │  fees      │
     │           │             │            │          │ deducted   │
     │◄───────── │◄────────────│◄───────────│◄─────────│            │
     │ all done  │             │            │          │            │
```

---

## CRITICAL ISSUES SUMMARY

### ISSUE #1: Registration Creates Org Without Wallet (HIGH)
- **Location:** `app/api/auth/register/route.ts:125-137`
- **Problem:** Organization created but no wallet
- **Impact:** Wallet validation fails on trip acceptance
- **Fix:** Add `financialAccount.create()` in registration, or document that users must call POST /api/organizations

### ISSUE #2: Fee Deduction Failure Doesn't Block Completion (MEDIUM)
- **Location:** `app/api/loads/[id]/status/route.ts:279-281`
- **Problem:** Load marked COMPLETED even if fee deduction fails
- **Impact:** Fees remain PENDING, requires manual intervention
- **Fix:** Either retry mechanism or queue for later processing

### ISSUE #3: No Automatic Truck Availability Reset (LOW)
- **Location:** N/A (missing feature)
- **Problem:** Trucks don't auto-reset to available after trip completion
- **Impact:** Carriers must manually manage availability
- **Fix:** Add automation to reset truck availability on trip completion

---

## OWNERSHIP MAP

| Concern | Owner Module | File |
|---------|--------------|------|
| User Authentication | `lib/auth.ts` | auth.ts |
| User Status | `lib/auth.ts:requireActiveUser()` | auth.ts |
| Load State Machine | `lib/loadStateMachine.ts` | loadStateMachine.ts |
| Trip State Machine | `lib/tripManagement.ts` | tripManagement.ts |
| Fee Calculation | `lib/serviceFeeCalculation.ts` | serviceFeeCalculation.ts |
| Fee Orchestration | `lib/serviceFeeManagement.ts` | serviceFeeManagement.ts |
| Distance Calculation | `lib/geo.ts` | geo.ts |
| Rounding | `lib/rounding.ts` | rounding.ts |
| Matching Engine | `lib/matchingEngine.ts` | matchingEngine.ts |
| Wallet Validation | `lib/serviceFeeManagement.ts:validateWalletBalancesForTrip()` | serviceFeeManagement.ts |
| Cache | `lib/cache.ts` | cache.ts |
| Notifications | `lib/notifications.ts` | notifications.ts |
| Rate Limiting | `lib/rateLimit.ts` | rateLimit.ts |

---

## CONCLUSION

This audit has traced the complete business lifecycle from user registration through fee collection. The system is well-architected with:

1. **Strong atomicity guarantees** for critical financial operations
2. **Race condition protection** via transaction re-fetch patterns
3. **Clear separation of concerns** between calculation, orchestration, and API layers
4. **Proper state machine enforcement** for loads and trips

Key areas for improvement:
1. Wallet creation during registration
2. Fee deduction failure handling
3. Truck availability automation

---

*Audit completed: 2026-02-09*
*Lines: 1,450+*
*Auditor: Claude Opus 4.5*
