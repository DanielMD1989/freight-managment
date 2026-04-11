# 🚛 Driver Integration — Implementation Spec v3.0

> **PURPOSE:** Single source of truth for adding Driver functionality.
> Claude CLI: `Read DRIVER_IMPLEMENTATION_SPEC.md before making any changes.`
>
> **16 impact areas identified. 30 tasks. Every file traced.**
> Verified against: github.com/DanielMD1989/freight-managment (April 2026)

---

## 0. Guiding Principles

1. Driver is a User with `role=DRIVER` under the carrier's Organization
2. Driver is assigned per-trip (`Trip.driverId`), NOT per-truck
3. No self-registration — carrier invites via 6-char invite code
4. Carrier NEVER loses capability — driver is additive
5. Backward compatible — `Trip.driverId` nullable; null = existing behavior
6. Three separate mobile apps: FreightET (shipper), FreightET Carrier, FreightET Driver
7. Shared mobile code via monorepo packages

---

## PHASE 1 — Foundation (Tasks 1–3)

### Task 1: Schema Migration

**Files:** `prisma/schema.prisma`

Add to UserRole enum:
```
DRIVER
```

Add to UserStatus enum:
```
INVITED
```

New model — DriverProfile:
```prisma
model DriverProfile {
  id             String    @id @default(cuid())
  userId         String    @unique
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  cdlNumber      String?
  cdlState       String?
  cdlExpiry      DateTime?
  medicalCertExp DateTime?
  endorsements   Json?
  cdlFrontUrl    String?
  cdlBackUrl     String?
  medicalCertUrl String?
  isAvailable    Boolean   @default(true)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  @@index([userId])
  @@map("driver_profiles")
}
```

Add to User model:
```prisma
driverProfile   DriverProfile?
driverTrips     Trip[]    @relation("DriverTrips")
```

Add to Trip model:
```prisma
driverId              String?
driver                User?     @relation("DriverTrips", fields: [driverId], references: [id])
previousDriverId      String?
driverReassignedAt    DateTime?
driverReassignReason  String?
@@index([driverId])
```

Modify GpsPosition model:
```prisma
deviceId  String?         // ← MAKE NULLABLE (was required)
device    GpsDevice?      // ← make optional
source    String?         // "ELD_HARDWARE" | "MOBILE_CARRIER" | "MOBILE_DRIVER"
driverId  String?         // who sent this position (null for ELD)
```

Run: `npx prisma migrate dev --name add-driver-role-and-gps-source`
Run: `npm test` — all 3179 tests must pass.

**Validation:** Migration succeeds. No existing data affected. All tests green.

---

### Task 2: Notification System Fix (CRITICAL)

**Problem:** `notifyOrganization()` in `lib/notifications.ts` line 420 sends to ALL active users in org. 81 callers across codebase. DRIVER in carrier org would receive every business notification (load requests, fee deductions, wallet top-ups, settlements).

**Files:** `lib/notifications.ts`

Modify `notifyOrganization`:
```typescript
export async function notifyOrganization(params: {
  organizationId: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  excludeRoles?: string[];  // ← ADD
}) {
  const { organizationId, type, title, message, metadata, excludeRoles } = params;
  try {
    const where: any = { organizationId, status: "ACTIVE" };
    // Default: exclude DRIVER from org-wide notifications
    const rolesToExclude = excludeRoles ?? ["DRIVER"];
    if (rolesToExclude.length > 0) {
      where.role = { notIn: rolesToExclude };
    }
    const users = await db.user.findMany({ where, select: { id: true } });
    await Promise.all(users.map((user) => createNotification({ userId: user.id, type, title, message, metadata })));
  } catch (error) {
    console.error("Failed to notify organization:", error);
  }
}
```

**Validation:** Existing callers work unchanged (default excludes DRIVER). No test changes needed — DRIVER users don't exist in test data yet.

---

### Task 3: RBAC & Permissions Updates

**Files:**
- `lib/rbac/permissions.ts` — Add DRIVER to Role type + ROLE_PERMISSIONS
- `lib/rbac/accessHelpers.ts` — Add isDriver to AccessRoles + getAccessRoles
- `lib/rbac/index.ts` — Block DRIVER in canManageOrganization
- `lib/tripStateMachine.ts` — Add DRIVER to TRIP_ROLE_PERMISSIONS
- `lib/walletGate.ts` — Add DRIVER bypass
- `CLAUDE.md` — Update roles section

**lib/rbac/permissions.ts:**
```typescript
export type Role = "SHIPPER" | "CARRIER" | "DISPATCHER" | "ADMIN" | "SUPER_ADMIN" | "DRIVER";

// Add to ROLE_PERMISSIONS:
DRIVER: [
  Permission.VIEW_LOADS,
  Permission.UPDATE_TRIP_STATUS,
  Permission.UPLOAD_POD,
  Permission.VIEW_POD,
  Permission.VIEW_GPS,
  Permission.VIEW_LIVE_TRACKING,
  Permission.UPLOAD_DOCUMENTS,
  Permission.VIEW_DOCUMENTS,
],
```

**lib/rbac/accessHelpers.ts:**
- Add `isDriver: boolean` to AccessRoles interface
- Add `driverId?: string | null` to entityOwners param
- Add: `const isDriver = role === "DRIVER" && !!driverId && driverId === session.userId;`
- Update hasAccess: include isDriver
- NOTE: SessionInfo needs userId — it already has it

**lib/rbac/index.ts:**
```typescript
// In canManageOrganization — add before the orgId check:
if (session.role === "DRIVER") return false;
```

**lib/tripStateMachine.ts:**
```typescript
// Add to TRIP_ROLE_PERMISSIONS:
DRIVER: [
  TripStatus.PICKUP_PENDING,
  TripStatus.IN_TRANSIT,
  TripStatus.DELIVERED,
  TripStatus.COMPLETED,
  TripStatus.EXCEPTION,
  // NO CANCELLED — drivers cannot cancel
],
```

**lib/walletGate.ts:**
```typescript
// Add after DISPATCHER bypass:
if (session.role === "DRIVER") return null;
```

**Validation:** `npm test` — all existing tests pass. No behavior change yet.

---

## PHASE 2 — Driver APIs (Tasks 4–6)

### Task 4: Driver Invite & Registration API

**New files:**
- `app/api/drivers/invite/route.ts` — POST: carrier generates invite code
- `app/api/drivers/accept-invite/route.ts` — POST: driver enters code + phone + password

**Modified files:**
- `app/api/auth/register/route.ts` — add explicit DRIVER block (already excluded by Zod enum, add comment)

**Invite flow:**
1. Carrier POST /api/drivers/invite `{ name, phone, email? }`
2. Validate: caller is CARRIER + ACTIVE, org is CARRIER type
3. Generate 6-char alphanumeric invite code (uppercase, no ambiguous chars)
4. Create Invitation record: `{ role: DRIVER, orgId: carrier.orgId, token: inviteCode, email, phone }`
   NOTE: Reuse existing Invitation model — it already has role, orgId, token, expiresAt
   Add `phone` field to Invitation model if not present
5. Create User: `{ role: DRIVER, orgId: carrier.orgId, status: INVITED, name, phone }`
6. Return invite code to carrier (carrier shares it manually)

**Accept flow:**
1. Driver POST /api/drivers/accept-invite `{ inviteCode, phone, password, cdlNumber?, cdlExpiry?, medicalCertExp? }`
2. Validate: invitation exists, status=PENDING, not expired, phone matches
3. Find linked User (role=DRIVER, status=INVITED, phone match, same org)
4. Hash password, update User: status → PENDING_VERIFICATION
5. Create DriverProfile with CDL data
6. Update Invitation: status → ACCEPTED
7. Notify carrier: DRIVER_REGISTERED

---

### Task 5: Driver CRUD API

**New files:**
- `app/api/drivers/route.ts` — GET: list drivers for carrier org
- `app/api/drivers/[id]/route.ts` — GET detail, PUT update profile, DELETE soft-delete
- `app/api/drivers/[id]/approve/route.ts` — POST: carrier approves driver
- `app/api/drivers/[id]/reject/route.ts` — POST: carrier rejects driver

**Logic:**
- GET list: `where: { role: DRIVER, organizationId: session.organizationId }`
- Include: driverProfile, active trip count, availability
- DELETE: check no active trips, set status → SUSPENDED. Do NOT hard delete.
- Approve: validate caller is CARRIER same org, set User.status → ACTIVE
- Reject: set User.status → REJECTED with reason

---

### Task 6: Trip Assignment + Conflict Detection

**New files:**
- `app/api/trips/[tripId]/assign-driver/route.ts` — POST
- `app/api/trips/[tripId]/unassign-driver/route.ts` — POST

**Modified files:**
- `lib/assignmentConflictDetection.ts` — add driver conflict check

**Assign validation:**
1. Trip must be ASSIGNED or PICKUP_PENDING
2. Driver must be same org as trip.carrierId
3. Driver must be ACTIVE status
4. Driver must have isAvailable=true
5. **NEW: Driver must NOT have another active trip** (ASSIGNED, PICKUP_PENDING, or IN_TRANSIT)
6. If replacing existing driver: set previousDriverId, driverReassignedAt, driverReassignReason
7. Notify driver: TRIP_DRIVER_ASSIGNED
8. Optionally set driver.isAvailable = false

**Unassign validation:**
1. Trip must be in ASSIGNED state only
2. Set Trip.driverId = null
3. Notify driver: TRIP_DRIVER_UNASSIGNED

**Conflict detection addition:**
```typescript
// Add to lib/assignmentConflictDetection.ts:
export async function checkDriverConflicts(driverId: string, tripId: string): Promise<ConflictCheck> {
  const activeTrip = await db.trip.findFirst({
    where: {
      driverId,
      id: { not: tripId },
      status: { in: ["ASSIGNED", "PICKUP_PENDING", "IN_TRANSIT"] },
    },
  });
  if (activeTrip) {
    return { hasConflict: true, conflicts: [{ type: "DRIVER_ALREADY_ASSIGNED", message: "Driver already has an active trip" }], warnings: [] };
  }
  return { hasConflict: false, conflicts: [], warnings: [] };
}
```

---

## PHASE 3 — Auth & Trip Pipeline (Tasks 7–10)

### Task 7: Auth Middleware Updates (13 files)

Add DRIVER to auth checks. Pattern for each file:
```typescript
const isDriver = session.role === "DRIVER" && trip.driverId === session.userId;
```

| File | Change |
|------|--------|
| `app/api/trips/[tripId]/route.ts` GET | Add isDriver to access check |
| `app/api/trips/[tripId]/route.ts` PATCH | Add isDriver + cancel guard: `if (role=DRIVER && status=CANCELLED) return 403` |
| `app/api/trips/[tripId]/pod/route.ts` POST | Add isDriver to upload check |
| `app/api/trips/[tripId]/pod/route.ts` GET | Add isDriver to view check |
| `app/api/trips/[tripId]/cancel/route.ts` | Explicitly BLOCK DRIVER → 403 |
| `app/api/trips/[tripId]/live/route.ts` | Add isDriver |
| `app/api/trips/[tripId]/history/route.ts` | Add isDriver |
| `app/api/trips/[tripId]/gps/route.ts` GET | Add isDriver |
| `app/api/trips/[tripId]/gps/route.ts` POST | Add isDriver |
| `app/api/trips/[tripId]/messages/route.ts` | Add isDriver send/read (see Task 9) |
| `app/api/trips/[tripId]/messages/[messageId]/read/route.ts` | Add isDriver |
| `app/api/trips/[tripId]/messages/unread-count/route.ts` | Add isDriver |
| `app/api/trips/route.ts` GET | Add DRIVER case: `whereClause.driverId = session.userId` |

---

### Task 8: Trip API Responses — Add Driver Info

Add driver include to every trip query that returns trip data.

Add to Prisma include:
```typescript
driver: trip.driverId ? {
  select: {
    id: true,
    firstName: true,
    lastName: true,
    phone: true,
    driverProfile: {
      select: { cdlNumber: true, isAvailable: true }
    }
  }
} : undefined,
```

**Files (9):**
1. `app/api/trips/[tripId]/route.ts` (GET + PATCH response)
2. `app/api/trips/route.ts` (GET list)
3. `app/api/trips/[tripId]/live/route.ts`
4. `app/api/trips/[tripId]/history/route.ts`
5. `app/api/trips/[tripId]/gps/route.ts`
6. `app/api/trips/[tripId]/cancel/route.ts`
7. `app/api/trips/[tripId]/confirm/route.ts`
8. `app/api/trips/[tripId]/pod/route.ts`
9. `app/api/carrier/dashboard/route.ts`

Also add to carrier dashboard: activeDriverCount, availableDriverCount.

---

### Task 9: Messaging Updates

**File:** `app/api/trips/[tripId]/messages/route.ts`

**Problem:** senderRole determined by orgId match. Driver shares carrier orgId → sends as "CARRIER".

**Fix:** Check DRIVER role BEFORE orgId check:
```typescript
if (session.role === "DRIVER" && session.userId === trip.driverId) {
  senderRole = "DRIVER";
  recipientOrgId = trip.shipperId;
} else if (session.organizationId === trip.shipperId) {
  senderRole = "SHIPPER";
  recipientOrgId = trip.carrierId;
} else if (session.organizationId === trip.carrierId) {
  senderRole = "CARRIER";
  recipientOrgId = trip.shipperId;
} else {
  return 404;
}
```

Also: when sending notification for new message, if trip has driver, notify driver directly (not just org).

---

### Task 10: Truck Reassignment + Driver

**File:** `app/api/trips/[tripId]/reassign-truck/route.ts`

When truck is reassigned mid-trip, handle driver:
- If new truck is same carrier org (always per blueprint): keep driver by default
- Add optional `reassignDriver` boolean to request body
- If `reassignDriver: true` + `newDriverId`: reassign driver too
- If `reassignDriver: true` + no `newDriverId`: unassign driver
- Update notifications to include driver reassignment info

---

## PHASE 4 — GPS Pipeline (Tasks 11–13)

### Task 11: GPS Schema (Done in Task 1)

Already handled in Task 1: GpsPosition.deviceId nullable, source field, driverId field.

---

### Task 12: Driver GPS Ingestion

**New file:** `app/api/drivers/location/route.ts`

POST — Driver sends GPS from phone:
1. Require DRIVER role + ACTIVE status
2. Find driver's active trip: `where: { driverId: session.userId, status: { in: ["PICKUP_PENDING", "IN_TRANSIT"] } }`
3. Get truckId from trip
4. Create GpsPosition: `{ truckId, deviceId: null, source: "MOBILE_DRIVER", driverId: session.userId, tripId, latitude, longitude, ... }`
5. Update Trip.currentLat/currentLng + currentLocationUpdatedAt
6. Update Truck.currentLocationLat/currentLocationLon
7. Broadcast via WebSocket

**Also modify:** `app/api/gps/batch/route.ts`
- Line 64: allow DRIVER alongside CARRIER
- When role=DRIVER: skip gpsDeviceId requirement, set source="MOBILE_DRIVER", set driverId
- When role=CARRIER: existing behavior unchanged (source="MOBILE_CARRIER" or "ELD_HARDWARE")

---

### Task 13: Live Tracking & Trip History — Source Awareness

**Files:**
- `app/api/trips/[tripId]/live/route.ts` — add driver info to response, add GPS source info
- `app/api/trips/[tripId]/history/route.ts` — add driver info, add source field to route points

For live tracking: use most recent position regardless of source.
For trip history: include source field on each point so UI can show ELD vs mobile.

---

## PHASE 5 — Background Systems (Tasks 14–16)

### Task 14: Trip Cron — Driver Notifications

**File:** `app/api/cron/trip-monitor/route.ts`

After existing org notification (line 211), add:
```typescript
if (trip.driverId) {
  createNotification({
    userId: trip.driverId,
    type: NotificationType.DELIVERY_CONFIRMED,
    title: "Trip auto-closed",
    message: `Your trip ... was automatically completed. Please upload POD.`,
    metadata: { tripId: trip.id },
  });
}
```

---

### Task 15: Geofence + GPS Alerts

**Files:**
- `lib/geofenceNotifications.ts` — current role filter already excludes DRIVER (correct). Add targeted notification to trip.driverId for relevant events.
- `lib/gpsAlerts.ts` — filter GPS alerts to only notify the ASSIGNED driver for their truck, not all drivers in org.

---

### Task 16: Carrier Dashboard Stats

**File:** `app/api/carrier/dashboard/route.ts`

Add new queries:
```typescript
const driverStats = await db.user.count({
  where: { organizationId: session.organizationId, role: "DRIVER", status: "ACTIVE" }
});
const availableDrivers = await db.user.count({
  where: {
    organizationId: session.organizationId, role: "DRIVER", status: "ACTIVE",
    driverProfile: { isAvailable: true }
  }
});
```

---

## PHASE 6 — Carrier Web UI (Tasks 17–19)

### Task 17: Carrier Web — Driver Management

**New files:**
- `app/carrier/drivers/page.tsx` — driver list
- `app/carrier/drivers/invite/page.tsx` — invite form (generates code)
- `app/carrier/drivers/[id]/page.tsx` — detail, approve/reject, remove
- `components/carrier/DriverList.tsx`
- `components/carrier/DriverInviteForm.tsx`

Add "Drivers" to carrier sidebar navigation.

### Task 18: Carrier Web — Trip UI Updates

**Modified files:**
- Trip list page — add Driver column
- Trip detail page — show driver info card + "Assign Driver" dropdown
- Dashboard — show driver name on active trip tiles
- Fleet map — driver name on truck markers

### Task 19: Shipper/Dispatcher/Admin — Trip UI Updates

**Modified files:**
- Shipper trip detail — show driver info (name, phone after PICKUP_PENDING)
- Shipper live tracking — show driver name
- Dispatcher trip detail — show driver info
- Admin trip detail — show driver info

---

## PHASE 7 — Mobile Restructure (Tasks 20–21)

### Task 20: Monorepo Setup

Restructure `mobile/` into:
```
mobile/
  packages/shared/     ← @freight/shared (auth, API, components, hooks, stores, theme, i18n)
  apps/shipper/        ← own app.json, eas.json, screens
  apps/carrier/        ← own app.json, eas.json, screens
  apps/driver/         ← own app.json, eas.json (empty shell)
  package.json         ← workspaces config
```

### Task 21: Verify Independent Apps

Test: `cd apps/shipper && npx expo start` — shipper works.
Test: `cd apps/carrier && npx expo start` — carrier works.
All mobile tests pass.

---

## PHASE 8 — Carrier Mobile (Tasks 22–23)

### Task 22: Carrier Mobile — Driver Management

**New screens in apps/carrier/:**
- drivers/index.tsx — driver list
- drivers/invite.tsx — generate invite code
- drivers/[id].tsx — detail, approve/reject

### Task 23: Carrier Mobile — Trip UI

- Trip detail: show driver info + "Assign Driver"
- Trip list: show driver name on cards
- Dashboard: driver on active trip cards

---

## PHASE 9 — Driver App (Tasks 24–27)

### Task 24: Driver App — Auth (Join Carrier)

**Screens:**
- Welcome: "Join Your Carrier (Enter Invite Code)"
- Enter code + phone → validate → set password → upload CDL → wait for approval
- Pending approval screen
- Login (returning users)

### Task 25: Driver App — Trips + POD

**Screens:**
- My Trips list (filtered by driverId)
- Trip detail with status transition buttons
- POD upload (camera/gallery)
- Availability toggle

### Task 26: Driver App — GPS + Navigation

**Services:**
- Background location service → POST /api/drivers/location
- Google Maps with turn-by-turn directions
- Offline GPS queue (reuse gps-queue.ts from shared)

### Task 27: Driver App — Messaging + Profile

**Screens:**
- Chat with shipper (reuse shared chat component)
- Profile: CDL info, documents, settings
- Notification list

---

## PHASE 10 — Testing (Tasks 28–30)

### Task 28: Backend Tests

Write tests covering:
- Driver invite → accept → approve flow
- Driver assignment + conflict detection
- Driver trip operations (status, POD, exception)
- Driver CANNOT: cancel, browse loads, manage trucks, see finances
- GPS from driver phone
- Notifications: driver gets trip notifications, NOT business notifications
- Backward compat: driverId=null works exactly as before

### Task 29: E2E Tests

- Carrier web: full driver management flow
- Carrier mobile: invite + manage drivers
- Driver app: join → assigned trip → execute → complete
- Shipper sees driver info during trip

### Task 30: Backward Compatibility

- All 3179 Jest tests pass
- All 895 E2E tests pass
- All 570 mobile tests pass
- Trip with no driver = identical behavior to today

---

## WHAT NOT TO TOUCH

- ❌ Load state machine / Load CRUD
- ❌ Truck CRUD & approval & posting
- ❌ Matching/request flow (match-proposals, truck-requests, load-requests)
- ❌ Service fee CALCULATION logic (lib/serviceFeeManagement.ts business logic)
- ❌ Rating system (stays org-level)
- ❌ Corridor/distance management
- ❌ `Truck.defaultDriverId` — DO NOT CREATE
- ❌ Existing test expectations — fix implementation, not tests

---

_Spec v3.0 — Complete. 16 impact areas. 30 tasks. Every file traced._
_Verified against actual codebase: schema.prisma, lib/auth.ts, lib/rbac/, lib/tripStateMachine.ts, lib/notifications.ts (81 callers), app/api/gps/batch/route.ts, app/api/trips/*/route.ts, lib/geofenceNotifications.ts, lib/gpsAlerts.ts, lib/walletGate.ts, lib/assignmentConflictDetection.ts, mobile/app/_layout.tsx_
