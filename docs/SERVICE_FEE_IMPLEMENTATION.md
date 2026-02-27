# Service Fee Implementation Plan

## Executive Summary

This document outlines the implementation of KM-based service pricing for the freight marketplace. The goal is to charge service fees per kilometer per corridor without affecting existing freight pricing or commission logic.

---

## User Stories

### US-1: Shipper - GPS & Documentation Visibility ✅

**As a Shipper**, I want GPS tracking with trip progress percentage and POD visibility, so I can monitor my cargo in real time.

**Acceptance Criteria:**

- [x] Real-time GPS tracking on map (EXISTS)
- [x] Geofence alerts for pickup/delivery arrival (EXISTS)
- [x] Trip progress percentage display (`GET /api/loads/[id]/progress`)
- [x] POD upload notification (EXISTS)
- [ ] Trip timeline with events (FRONTEND - future work)

**Implementation:** Backend complete. `lib/tripProgress.ts` calculates progress from GPS. API returns progress %, remaining KM, estimated arrival.

---

### US-2: Carrier - Return-Load Notifications ✅

**As a Truck Owner**, I want return-load notifications when my trip is 80%+ complete or I enter the destination geofence, so I can maximize efficiency and reduce empty miles.

**Acceptance Criteria:**

- [x] Notification at 80% trip progress (`TRIP_PROGRESS_80` notification type)
- [x] Notification when entering destination geofence (EXISTS - TRUCK_AT_DELIVERY)
- [x] List of matching loads in destination region (`GET /api/return-loads`)
- [x] Priority ranking: shipper reliability, recency (`lib/returnLoadNotifications.ts`)

**Implementation:** Complete. `checkAndNotifyReturnLoads()` triggers at 80% or geofence entry. Matches POSTED loads by region.

---

### US-3: Admin - Corridor Pricing Management ✅

**As an Admin**, I want to define corridor distances, directions, and per-KM pricing, so service fees can be calculated automatically.

**Acceptance Criteria:**

- [x] CRUD for corridors (origin region, destination region, distance_km, price_per_km)
- [x] Direction support (ONE_WAY, ROUND_TRIP, BIDIRECTIONAL)
- [x] Promo flag with discount percentage
- [x] Fee calculator preview

**Implementation:** Complete. Admin UI at `/admin/corridors`. APIs at `/api/admin/corridors`.

---

### US-4: Platform - Service Fee Collection via Wallet ✅

**As a Platform**, I want to charge service fees per KM via wallet credit, so users pay for tracking and documentation separately from freight payments.

**Acceptance Criteria:**

- [x] Service fee = corridor.distance_km × corridor.price_per_km
- [x] Fee reserved from shipper wallet at trip ASSIGNED
- [x] Fee deducted (moved to platform) at trip COMPLETED
- [x] Fee refunded to shipper wallet on CANCELLED
- [x] Replaces old commission logic (per user clarification)

**Implementation:** Complete. `lib/serviceFeeManagement.ts` handles reserve/deduct/refund. Integrated into load lifecycle.

---

## Schema Changes (Additive Only)

### New Model: Corridor

```prisma
model Corridor {
  id                String            @id @default(cuid())
  name              String            // "Addis Ababa - Dire Dawa"
  originRegion      String            // Ethiopian region name
  destinationRegion String            // Ethiopian region name
  distanceKm        Decimal           @db.Decimal(10, 2)
  pricePerKm        Decimal           @db.Decimal(10, 4) // ETB per km for service fee
  direction         CorridorDirection @default(ONE_WAY)
  promoFlag         Boolean           @default(false)
  promoDiscountPct  Decimal?          @db.Decimal(5, 2) // e.g., 10.00 for 10%
  isActive          Boolean           @default(true)

  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  createdById       String?
  createdBy         User?             @relation("CorridorCreatedBy", fields: [createdById], references: [id])

  loads             Load[]            @relation("LoadCorridor")

  @@unique([originRegion, destinationRegion, direction])
  @@index([isActive])
  @@index([originRegion])
  @@index([destinationRegion])
}

enum CorridorDirection {
  ONE_WAY
  ROUND_TRIP
  BIDIRECTIONAL
}
```

### New Enum: ServiceFeeStatus

```prisma
enum ServiceFeeStatus {
  PENDING     // Not yet calculated/reserved
  RESERVED    // Held from wallet when trip starts
  DEDUCTED    // Moved to platform revenue on completion
  REFUNDED    // Returned to shipper on cancellation
  WAIVED      // Admin waived the fee
}
```

### Extend Load Model

```prisma
model Load {
  // ... existing fields ...

  // Corridor & Service Fee (NEW)
  corridorId            String?
  corridor              Corridor?         @relation("LoadCorridor", fields: [corridorId], references: [id])
  serviceFeeEtb         Decimal?          @db.Decimal(10, 2)
  serviceFeeStatus      ServiceFeeStatus  @default(PENDING)
  serviceFeeReservedAt  DateTime?
  serviceFeeDeductedAt  DateTime?
  serviceFeeRefundedAt  DateTime?

  // Trip Progress (NEW)
  tripProgressPercent   Int?              @default(0) // 0-100
  remainingDistanceKm   Decimal?          @db.Decimal(10, 2)
  lastProgressUpdateAt  DateTime?
  enteredDestGeofence   Boolean           @default(false)
  enteredDestGeofenceAt DateTime?
}
```

### Extend NotificationType (in /lib/notifications.ts)

```typescript
export const NotificationType = {
  // ... existing types ...

  // Return Load Notifications (NEW)
  RETURN_LOAD_AVAILABLE: "RETURN_LOAD_AVAILABLE",
  RETURN_LOAD_MATCHED: "RETURN_LOAD_MATCHED",
  TRIP_PROGRESS_80: "TRIP_PROGRESS_80",

  // Service Fee Notifications (NEW)
  SERVICE_FEE_RESERVED: "SERVICE_FEE_RESERVED",
  SERVICE_FEE_DEDUCTED: "SERVICE_FEE_DEDUCTED",
  SERVICE_FEE_REFUNDED: "SERVICE_FEE_REFUNDED",
} as const;
```

### Extend TransactionType Enum

```prisma
enum TransactionType {
  // ... existing types ...
  SERVICE_FEE_RESERVE   // Reserve service fee from shipper
  SERVICE_FEE_DEDUCT    // Deduct to platform on completion
  SERVICE_FEE_REFUND    // Refund to shipper on cancellation
}
```

---

## Implementation Tasks

### Task 1: Corridor Pricing Schema & Admin

**Priority:** High | **Effort:** 4 hours

1. Add Corridor model to schema
2. Add ServiceFeeStatus enum
3. Extend Load model with new fields
4. Create migration
5. Build admin CRUD API: `/api/admin/corridors`
6. Build admin UI: `/app/admin/corridors/page.tsx`

### Task 2: Service Fee Calculation Logic

**Priority:** High | **Effort:** 3 hours

Create `/lib/serviceFeeCalculation.ts`:

```typescript
export async function calculateServiceFee(loadId: string): Promise<{
  corridorId: string;
  corridorName: string;
  distanceKm: number;
  pricePerKm: number;
  baseFee: number;
  promoDiscount: number;
  finalFee: number;
}>;

export async function findMatchingCorridor(
  originRegion: string,
  destinationRegion: string
): Promise<Corridor | null>;
```

### Task 3: Service Fee Wallet Integration

**Priority:** High | **Effort:** 4 hours

Create `/lib/serviceFeeManagement.ts`:

```typescript
// Reserve fee when load status -> ASSIGNED
export async function reserveServiceFee(loadId: string): Promise<void>;

// Deduct fee when load status -> COMPLETED
export async function deductServiceFee(loadId: string): Promise<void>;

// Refund fee when load status -> CANCELLED
export async function refundServiceFee(loadId: string): Promise<void>;
```

Uses existing `FinancialAccount` and `JournalEntry` infrastructure.

### Task 4: Trip Progress Calculation

**Priority:** Medium | **Effort:** 3 hours

Extend `/lib/gpsTracking.ts`:

```typescript
export async function calculateTripProgress(loadId: string): Promise<{
  progressPercent: number;
  remainingKm: number;
  estimatedArrival: Date | null;
}>;

export async function updateTripProgress(loadId: string): Promise<void>;
// Called by GPS update webhook or cron job
```

### Task 5: Return-Load Notification System

**Priority:** Medium | **Effort:** 4 hours

Create `/lib/returnLoadNotifications.ts`:

```typescript
export async function checkReturnLoadOpportunity(loadId: string): Promise<void>;
// Triggered when:
// - Trip progress >= 80%
// - Truck enters destination geofence

export async function findReturnLoads(
  currentRegion: string,
  carrierId: string
): Promise<Load[]>;
// Returns POSTED loads with pickup in currentRegion
// Sorted by: corridor match, GPS status, priority

export async function notifyCarrierOfReturnLoads(
  carrierId: string,
  loads: Load[]
): Promise<void>;
```

### Task 6: API Endpoints

**Priority:** High | **Effort:** 3 hours

| Endpoint                       | Method             | Description               |
| ------------------------------ | ------------------ | ------------------------- |
| `/api/admin/corridors`         | GET, POST          | List/create corridors     |
| `/api/admin/corridors/[id]`    | GET, PATCH, DELETE | Manage corridor           |
| `/api/corridors/match`         | POST               | Find corridor for route   |
| `/api/corridors/calculate-fee` | POST               | Calculate service fee     |
| `/api/loads/[id]/service-fee`  | GET                | Get service fee status    |
| `/api/loads/[id]/progress`     | GET                | Get trip progress         |
| `/api/return-loads`            | GET                | Get matching return loads |

### Task 7: Frontend Updates

**Priority:** Medium | **Effort:** 6 hours

1. Admin corridor management page
2. Service fee display on load details
3. Trip progress indicator on tracking page
4. Return load notification badge/panel
5. Wallet service fee transaction history

---

## Trip Lifecycle with Service Fees

```
DRAFT
  ↓ (load posted)
POSTED
  ↓ (truck assigned)
ASSIGNED
  ├── Calculate service fee from corridor
  ├── Reserve fee from shipper wallet
  └── Set serviceFeeStatus = RESERVED
  ↓ (pickup started)
PICKUP_PENDING
  ↓ (in transit)
IN_TRANSIT
  ├── GPS updates trip progress
  ├── At 80%: trigger return-load notification
  └── At geofence: trigger arrival notification
  ↓ (delivered)
DELIVERED
  ↓ (POD uploaded)
[podSubmitted = true]
  ↓ (POD verified)
[podVerified = true]
  ↓ (settlement)
COMPLETED
  ├── Deduct service fee to platform
  ├── Set serviceFeeStatus = DEDUCTED
  └── Process freight settlement (existing)

--- OR ---

CANCELLED (from any state)
  ├── If serviceFeeStatus = RESERVED:
  │   ├── Refund service fee to shipper
  │   └── Set serviceFeeStatus = REFUNDED
  └── If serviceFeeStatus = PENDING: no action
```

---

## Service Fee Calculation Formula

```
serviceFee = corridor.distanceKm × corridor.pricePerKm

If corridor.promoFlag = true:
  discount = serviceFee × (corridor.promoDiscountPct / 100)
  finalFee = serviceFee - discount
Else:
  finalFee = serviceFee
```

Example:

- Corridor: Addis Ababa → Dire Dawa
- Distance: 453 km
- Price per KM: 2.50 ETB
- Base fee: 453 × 2.50 = 1,132.50 ETB
- Promo (10% off): 1,132.50 × 0.90 = 1,019.25 ETB

---

## Files to Create

```
lib/
├── serviceFeeCalculation.ts    # Fee calculation logic
├── serviceFeeManagement.ts     # Reserve/deduct/refund
└── returnLoadNotifications.ts  # Return load matching

app/api/
├── admin/corridors/
│   ├── route.ts               # GET, POST
│   └── [id]/route.ts          # GET, PATCH, DELETE
├── corridors/
│   ├── match/route.ts         # POST - find corridor
│   └── calculate-fee/route.ts # POST - calculate fee
├── loads/[id]/
│   ├── service-fee/route.ts   # GET - fee status
│   └── progress/route.ts      # GET - trip progress
└── return-loads/route.ts      # GET - matching loads

app/admin/
└── corridors/
    └── page.tsx               # Admin UI
```

---

## Dependencies

```
Task 1 (Schema)
    ↓
Task 2 (Calculation) ← Task 3 (Wallet Integration)
    ↓                        ↓
Task 4 (GPS Progress) → Task 5 (Return Loads)
    ↓
Task 6 (APIs)
    ↓
Task 7 (Frontend)
```

---

## Implementation Progress

### Completed (Tasks 1-6)

**Schema & Enums:**

- [x] Corridor model added to Prisma schema
- [x] ServiceFeeStatus enum (PENDING, RESERVED, DEDUCTED, REFUNDED, WAIVED)
- [x] CorridorDirection enum (ONE_WAY, ROUND_TRIP, BIDIRECTIONAL)
- [x] TransactionType extended with SERVICE*FEE*\* types
- [x] Load model extended with service fee and trip progress fields
- [x] NotificationType extended with return load and service fee types

**Admin APIs & UI:**

- [x] Admin CRUD API: `/api/admin/corridors`
- [x] Admin UI: `/app/admin/corridors/page.tsx`
- [x] Corridor management with fee preview calculator

**Service Fee Libraries:**

- [x] `/lib/serviceFeeCalculation.ts` - Fee calculation, corridor matching
- [x] `/lib/serviceFeeManagement.ts` - Wallet integration
  - reserveServiceFee() - Reserve from shipper wallet on ASSIGNED
  - deductServiceFee() - Deduct to platform on COMPLETED
  - refundServiceFee() - Refund to shipper on CANCELLED

**GPS & Trip Progress:**

- [x] `/lib/tripProgress.ts` - Trip progress tracking
  - calculateTripProgress() - % completion from GPS
  - updateTripProgress() - Update load progress fields
  - updateAllActiveLoadProgress() - Batch update for cron

**Return Load Notifications:**

- [x] `/lib/returnLoadNotifications.ts` - Return load matching
  - findReturnLoads() - Match loads by destination region
  - notifyCarrierOfReturnLoads() - Send notifications
  - Triggers at 80% progress or destination geofence entry

**Public APIs:**

- [x] POST `/api/corridors/match` - Find corridor for route
- [x] POST `/api/corridors/calculate-fee` - Calculate fee for load
- [x] GET `/api/return-loads` - Get return load suggestions
- [x] GET `/api/loads/[id]/service-fee` - Get load service fee status
- [x] GET `/api/loads/[id]/progress` - Get load trip progress

### Completed (Task 7)

**Load Lifecycle Integration:**

- [x] `reserveServiceFee()` called on load assignment (`/api/loads/[id]/assign`)
- [x] `reserveServiceFee()` called on match proposal acceptance (`/api/match-proposals/[id]/respond`)
- [x] `deductServiceFee()` called on status change to COMPLETED (`/api/loads/[id]/status`)
- [x] `refundServiceFee()` called on status change to CANCELLED (`/api/loads/[id]/status`)
- [x] `deductServiceFee()` integrated with auto-settlement (`lib/loadAutomation.ts`)
- [x] LoadEvent records created for all service fee transactions
- [x] Service fee info returned in API responses

**Files Modified:**

- `app/api/loads/[id]/assign/route.ts` - Added service fee reserve on assignment
- `app/api/match-proposals/[id]/respond/route.ts` - Added service fee reserve on proposal acceptance
- `app/api/loads/[id]/status/route.ts` - Added service fee deduct/refund on status change
- `lib/loadAutomation.ts` - Updated auto-settlement to use service fees instead of commission

### Completed (Frontend)

- [x] Frontend service fee display on load details page (`/dashboard/loads/[id]`)
- [x] Admin dashboard for service fee metrics (`/admin/service-fees`)

### Files Added (Frontend):

- `app/admin/service-fees/page.tsx` - Admin dashboard with metrics
- `app/api/admin/service-fees/metrics/route.ts` - Metrics aggregation API

### Frontend Features:

- Load details page shows service fee with corridor info and breakdown
- Color-coded status badges (DEDUCTED/RESERVED/REFUNDED/WAIVED/PENDING)
- Fee timeline showing reservation, deduction, or refund dates
- Admin dashboard with:
  - Total fees collected, reserved, and refunded
  - Fee status distribution
  - Top corridors by revenue
  - Recent service fee transactions table

---

## Testing Checklist

Backend integration complete. Test the following flows:

- [ ] Create corridor via admin (`/admin/corridors`)
- [ ] Calculate service fee for load (`POST /api/corridors/calculate-fee`)
- [ ] Reserve fee on load assignment (`POST /api/loads/[id]/assign`)
- [ ] Reserve fee on proposal acceptance (`POST /api/match-proposals/[id]/respond`)
- [ ] Track trip progress updates (`GET /api/loads/[id]/progress`)
- [ ] Trigger return-load notification at 80% progress
- [ ] Deduct fee on load completion (`PATCH /api/loads/[id]/status` → COMPLETED)
- [ ] Refund fee on load cancellation (`PATCH /api/loads/[id]/status` → CANCELLED)
- [ ] Verify wallet balance changes via `/api/financial/wallet`
- [ ] Check journal entries created with correct transaction types
