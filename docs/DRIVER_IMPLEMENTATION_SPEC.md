# 🚛 Driver Integration — Implementation Spec v5.0

> **PURPOSE:** Single source of truth for adding Driver functionality.
> Claude CLI: `Read docs/DRIVER_IMPLEMENTATION_SPEC.md before making any changes.`
>
> **Verified against:** github.com/DanielMD1989/freight-managment (April 2026)
> **34 security gaps found across 202 API routes. 5 tasks done. 23 remaining.**
> **Deep dive: 10 rounds of analysis. Result stable across final 2 rounds.**

---

## 0. Guiding Principles

1. Driver is a User with `role=DRIVER` under the carrier's Organization (same organizationId)
2. Driver is assigned per-trip (`Trip.driverId`), NOT per-truck
3. No self-registration — carrier invites via 6-char invite code
4. Carrier NEVER loses capability — driver is additive
5. Backward compatible — `Trip.driverId` nullable; null = existing behavior
6. Three separate mobile apps via monorepo: FreightET (shipper), FreightET Carrier, FreightET Driver
7. Shared mobile code via workspace packages

**CRITICAL ARCHITECTURE NOTE:** DRIVER shares the carrier's `organizationId`. This means any API route that checks `organizationId === carrierId` WITHOUT also checking `role === "CARRIER"` will let DRIVER through. This is the root cause of 23 of the 34 gaps found below.

---

## COMPLETED TASKS

### Task 1: Schema Migration ✅

**Commit:** 9a8b08f + d4e1fb0
**Files:** prisma/schema.prisma, lib/rbac/permissions.ts

- Added DRIVER to UserRole enum
- Added INVITED to UserStatus enum
- Created DriverProfile model (14 fields)
- Added Trip.driverId + driver relation + previousDriverId + driverReassignedAt + driverReassignReason + @@index([driverId])
- Made GpsPosition.deviceId nullable (String?), device optional (GpsDevice?)
- Added GpsPosition.source String? and GpsPosition.driverId String?
- Added DRIVER to Role type union + DRIVER: [] placeholder in ROLE_PERMISSIONS

### Task 2: Notification System Fix ✅

**Commit:** 839e097
**Files:** lib/notifications.ts

- notifyOrganization now accepts excludeRoles?: UserRole[], defaults to [DRIVER]
- All 81 existing callers automatically exclude DRIVER
- Callers can pass excludeRoles: [] to include drivers when needed

### Task 3: RBAC & Permissions ✅

**Commit:** ec7badb
**Files:** lib/rbac/permissions.ts, lib/rbac/accessHelpers.ts, lib/rbac/index.ts, lib/tripStateMachine.ts, lib/walletGate.ts, CLAUDE.md

- DRIVER gets 8 permissions: VIEW_LOADS, UPDATE_TRIP_STATUS, UPLOAD_POD, VIEW_POD, VIEW_GPS, VIEW_LIVE_TRACKING, UPLOAD_DOCUMENTS, VIEW_DOCUMENTS
- isDriver added to getAccessRoles (matches on driverId === userId)
- canManageOrganization blocks DRIVER
- TRIP_ROLE_PERMISSIONS: DRIVER gets PICKUP_PENDING, IN_TRANSIT, DELIVERED, COMPLETED, EXCEPTION (NO CANCELLED)
- Wallet gate bypasses DRIVER

### Task 4: Auth Wiring ✅

**Commit:** 324d78a
**Files:** 7 trip route files

- app/api/trips/[tripId]/route.ts (GET: isDriver via getAccessRoles | PATCH: isDriver + cancel guard 403)
- app/api/trips/[tripId]/pod/route.ts (POST + GET: isDriver added)
- app/api/trips/[tripId]/cancel/route.ts (explicit DRIVER block 403)
- app/api/trips/[tripId]/live/route.ts (isDriver added)
- app/api/trips/[tripId]/history/route.ts (isDriver added)
- app/api/trips/[tripId]/gps/route.ts (GET + POST: isDriver added)
- app/api/trips/route.ts (GET: case DRIVER: whereClause.driverId = session.userId)

### Task 5: Trip API Responses ✅

**Commit:** f51a424
**Files:** 8 files, 10 queries

- All trip endpoints include driver info: { id, firstName, lastName, phone, driverProfile: { cdlNumber, isAvailable } }
- Applied to: trip detail, trip list, live tracking, history, gps, cancel, confirm, pod

---

## SECURITY GAP ANALYSIS (34 gaps)

### Root Cause

DRIVER shares carrier's `organizationId`. Routes that check `orgId === carrierId` without `role === "CARRIER"` grant DRIVER full carrier access.

### Already Protected (by completed Tasks 1-5)

- 81 notifyOrganization() callers — excludes DRIVER ✅
- canManageOrganization — blocks DRIVER ✅
- 7 trip route auth checks — isDriver added ✅
- 10 trip response queries — driver info included ✅
- walletGate — DRIVER bypass ✅
- Trip cancel — explicit 403 ✅

### Verified SAFE (23 routes — role guards block DRIVER)

disputes/route.ts, disputes/[id]/route.ts, escalations/[id]/route.ts, load-requests/[id]/confirm, load-requests/[id]/respond, load-requests/[id]/route, loads/[id]/documents, loads/[id]/documents/download, loads/[id]/escalations, loads/[id]/pod, loads/[id]/service-fee, loads/[id]/settle, loads/[id]/status, trucks/[id]/location, trucks/[id]/nearby-loads, truck-requests/[id]/route, truck-requests/[id]/cancel, truck-postings/[id] PATCH, trucks/[id] PATCH (requirePermission EDIT_TRUCKS), financial/wallet (requirePermission VIEW_WALLET), financial/withdraw (requirePermission WITHDRAW_FUNDS), carrier/dashboard (role !== CARRIER), wallet/deposit POST (role guard).

### CRITICAL — 14 security holes

| #   | File                                                   | Line(s)          | Problem                                                                                                                                                 |
| --- | ------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | app/api/wallet/balance/route.ts                        | 22-43            | NO role check. orgId query. DRIVER sees carrier wallet balance.                                                                                         |
| 2   | app/api/wallet/transactions/route.ts                   | 25-36            | NO role check. orgId query. DRIVER sees all financial transactions.                                                                                     |
| 3   | app/api/wallet/deposit/route.ts GET                    | 177-195          | POST has role guard, GET does not. DRIVER sees deposit history.                                                                                         |
| 4   | app/api/organizations/members/[id]/route.ts DELETE     | 47-83            | NO role check. DRIVER can REMOVE any org member including carrier owner.                                                                                |
| 5   | app/api/trucks/route.ts GET                            | 312-340          | DRIVER falls through all role checks (no DRIVER case). No WHERE filter. Sees ALL trucks in entire system.                                               |
| 6   | app/api/match-proposals/route.ts GET                   | 372-383          | DRIVER falls through CARRIER/DISPATCHER/SHIPPER switch. No WHERE filter. Sees ALL match proposals in system.                                            |
| 7   | app/api/trips/[tripId]/rate/route.ts                   | 78-85            | orgId match determines raterRole. DRIVER matches carrierId. Submits ratings as raterRole="CARRIER".                                                     |
| 8   | app/api/documents/[id]/route.ts GET                    | 105-110          | orgId match only. DRIVER sees carrier business docs (license, insurance, tax).                                                                          |
| 9   | app/api/documents/upload/route.ts                      | 227-231, 260-261 | orgId match. DRIVER has UPLOAD_DOCUMENTS permission. Can upload/overwrite carrier org and truck docs. Mitigated by documentsLockedAt for approved orgs. |
| 10  | app/api/organizations/[id]/route.ts GET                | 68               | orgId isMember. DRIVER sees full org data + all user names, emails, roles.                                                                              |
| 11  | app/api/organizations/invitations/route.ts POST        | 55-66            | NO role guard. DRIVER can invite new CARRIER/SHIPPER/DISPATCHER users to carrier org.                                                                   |
| 12  | app/api/organizations/invitations/[id]/route.ts DELETE | 118              | orgId match. DRIVER can delete pending invitations.                                                                                                     |
| 13  | app/api/organizations/me/route.ts                      | 11-55            | orgId query. Returns full org including financialAccounts with balance, all users, truck/load counts.                                                   |
| 14  | lib/gpsTracking.ts canAccessTracking()                 | 459-461          | orgId match. DRIVER tracks ANY carrier load. Affects loads/tracking and loads/live-position routes.                                                     |

### HIGH — 9 org-scoped data leaks

| #   | File                                           | Line    | Problem                                                                                           |
| --- | ---------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| 15  | app/api/loads/[id]/progress/route.ts           | 57-59   | orgId in hasAccess OR chain. DRIVER sees any carrier load progress.                               |
| 16  | app/api/loads/[id]/gps-history/route.ts        | 57-58   | isCarrier = orgId match. DRIVER sees GPS history of any carrier load.                             |
| 17  | app/api/loads/[id]/next-loads/route.ts         | 45      | isAssignedCarrier = orgId match. DRIVER sees return load recommendations.                         |
| 18  | app/api/loads/[id]/matching-trucks/route.ts    | 62-68   | isAssignedCarrier = orgId match. DRIVER sees matching trucks for any carrier load.                |
| 19  | app/api/loads/[id]/route.ts GET                | 220-221 | isAssignedCarrier = orgId match. DRIVER sees full details of any load assigned to carrier trucks. |
| 20  | app/api/trucks/[id]/history/route.ts           | 64      | isOwner = orgId match. DRIVER sees GPS history of any carrier truck.                              |
| 21  | app/api/trucks/[id]/position/route.ts          | 64      | Same as #20. DRIVER sees current position of any carrier truck.                                   |
| 22  | app/api/gps/positions/route.ts                 | 41-44   | With truckId param: orgId match. DRIVER sees GPS positions of any carrier truck.                  |
| 23  | app/api/organizations/invitations/route.ts GET | 170-195 | orgId query. DRIVER sees all pending/accepted invitation data.                                    |

### HIGH — 8 functionality gaps

| #   | File                                    | Line    | Problem                                                                                |
| --- | --------------------------------------- | ------- | -------------------------------------------------------------------------------------- |
| 24  | lib/notificationRoutes.ts               | 36-55   | No DRIVER case. Notification taps go nowhere.                                          |
| 25  | mobile/src/utils/notificationRouting.ts | 38-39   | No DRIVER handling. Mobile notification taps unroutable.                               |
| 26  | app/login/page.tsx                      | 63-69   | No DRIVER in roleRedirects. Login loop.                                                |
| 27  | app/page.tsx                            | 20-31   | No DRIVER redirect. Combined with #26 creates infinite loop.                           |
| 28  | lib/websocket-server.ts                 | 109-123 | DRIVER blocked from trip GPS subscription. Driver app cant receive real-time tracking. |
| 29  | mobile/app/\_layout.tsx                 | 183-210 | DRIVER falls through CARRIER/SHIPPER routing. Force logout with "Unsupported Role".    |
| 30  | mobile/src/stores/auth.ts               | 65      | Register type excludes DRIVER. Correct for registration. Noted for awareness.          |
| 31  | prisma/schema.prisma Invitation model   | N/A     | No phone field. Driver invites need phone for validation.                              |

### MEDIUM — 3 lower-impact

| #   | File                                                | Line | Problem                                                                |
| --- | --------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| 32  | app/api/trucks/[id]/route.ts GET                    | 118  | orgId in canView. DRIVER sees truck details including GPS device IMEI. |
| 33  | app/api/truck-postings/[id]/matching-loads/route.ts | 140  | orgId match. DRIVER sees matching loads for carrier postings.          |
| 34  | components/RoleAwareSidebar.tsx                     | 552  | Role type excludes DRIVER. Minor TS issue.                             |

---

## REMAINING TASKS

### Task 6: DRIVER Access Lockdown

**MUST be done BEFORE any other task. These are live security holes.**

Fixes all 14 CRITICAL + 9 HIGH data leaks. One focused commit. 21 files.

**Group A — Block DRIVER completely (add role guard before orgId check):**

| File                                            | Handler  | Fix                                                                   |
| ----------------------------------------------- | -------- | --------------------------------------------------------------------- |
| app/api/wallet/balance/route.ts                 | GET      | After requireActiveUser: `if (user.role === "DRIVER") return 403`     |
| app/api/wallet/transactions/route.ts            | GET      | Same                                                                  |
| app/api/wallet/deposit/route.ts                 | GET only | Same (POST already guarded)                                           |
| app/api/organizations/members/[id]/route.ts     | DELETE   | `if (session.role === "DRIVER") return 403`                           |
| app/api/organizations/members/[id]/route.ts     | PATCH    | Same                                                                  |
| app/api/trucks/route.ts                         | GET      | After SHIPPER block: `if (user.role === "DRIVER") return 403`         |
| app/api/match-proposals/route.ts                | GET      | Add in role switch: `else if (session.role === "DRIVER") return 403`  |
| app/api/trips/[tripId]/rate/route.ts            | POST     | Before orgId: `if (session.role === "DRIVER") return 403`             |
| app/api/trips/[tripId]/rate/route.ts            | GET      | In isParty check: add `&& session.role !== "DRIVER"`                  |
| app/api/organizations/invitations/route.ts      | POST     | `if (session.role === "DRIVER") return 403`                           |
| app/api/organizations/invitations/route.ts      | GET      | Same                                                                  |
| app/api/organizations/invitations/[id]/route.ts | DELETE   | Same                                                                  |
| app/api/documents/[id]/route.ts                 | GET      | `if (session.role === "DRIVER") return 403`                           |
| app/api/documents/upload/route.ts               | POST     | Both org and truck paths: `if (session.role === "DRIVER") return 403` |
| app/api/gps/positions/route.ts                  | GET      | Add `&& user?.role !== "DRIVER"` to canView                           |
| app/api/organizations/me/route.ts               | GET      | If DRIVER: return { id, name, contactPhone } only                     |
| app/api/organizations/[id]/route.ts             | GET      | If DRIVER: return limited data (no users array, no financial)         |

**Group B — Add role === "CARRIER" to isCarrier/isOwner/isAssignedCarrier:**

| File                                        | Variable                   | Change                                                                |
| ------------------------------------------- | -------------------------- | --------------------------------------------------------------------- |
| app/api/loads/[id]/progress/route.ts        | hasAccess line 59          | Wrap carrier orgId in: `(session.role === "CARRIER" && ...)`          |
| app/api/loads/[id]/gps-history/route.ts     | isCarrier line 58          | Add: `user?.role === "CARRIER" &&`                                    |
| app/api/loads/[id]/next-loads/route.ts      | isAssignedCarrier line 45  | Add: `user?.role === "CARRIER" &&`                                    |
| app/api/loads/[id]/matching-trucks/route.ts | isAssignedCarrier line 62  | Add: `user?.role === "CARRIER" &&`                                    |
| app/api/loads/[id]/route.ts GET             | isAssignedCarrier line 220 | Add: `user.role === "CARRIER" &&`                                     |
| app/api/trucks/[id]/history/route.ts        | isOwner line 64            | Add: `user?.role === "CARRIER" &&`                                    |
| app/api/trucks/[id]/position/route.ts       | isOwner line 64            | Add: `user?.role === "CARRIER" &&`                                    |
| lib/gpsTracking.ts                          | canAccessTracking line 459 | Add: `if (user.role === "DRIVER") return false;` before carrier check |

**Validation:**

- npx tsc -p tsconfig.build.json --noEmit
- npm test — all 3207+ tests must pass
- NO behavior changes for CARRIER/SHIPPER/ADMIN/DISPATCHER

---

### Task 7: GPS Pipeline Fix

**File 1: app/api/trips/[tripId]/gps/route.ts (POST)**

Before transaction (~line 164): determine source based on role:

```
const isDriverRole = session.role === "DRIVER";
const gpsSource = isDriverRole ? "MOBILE_DRIVER" : "MOBILE_CARRIER";
const gpsDriverId = isDriverRole ? session.userId : null;
```

Device logic (lines 167-184): If DRIVER skip device creation, deviceId = null. If CARRIER/ADMIN: existing logic unchanged.

GpsPosition.create (lines 187-208): Add `deviceId: isDriverRole ? null : deviceId`, `source: gpsSource`, `driverId: gpsDriverId`.

GpsDevice.update (lines 233-240): Wrap in `if (deviceId) { ... }`.

GET handler positions select (lines 339-353): Add `source: true, driverId: true`. Add to response map.

**File 2: app/api/gps/batch/route.ts**

createData map (line 163): Add `source: "MOBILE_CARRIER", driverId: null`. No DRIVER support.

**Validation:** npx tsc + npm test.

---

### Task 8: Messaging Fix

**Files:** messages/route.ts (POST+GET), messages/[messageId]/read, messages/unread-count

POST: Check DRIVER before orgId. senderRole = "DRIVER". Add driverId to trip select.
GET + read + unread: Add isDriver check. Add driverId to trip select.

**Validation:** npx tsc + npm test.

---

### Task 9: Truck Reassignment + Driver

**File:** reassign-truck/route.ts. Handle driver when truck changes. Optional newDriverId. Update audit fields. Notify drivers.

---

### Task 10: Geofence + GPS Alerts

**Files:** geofenceNotifications.ts, gpsAlerts.ts. Targeted driver notifications for trip events. Filter GPS alerts to assigned driver only.

---

### Task 11: Trip Cron + Carrier Dashboard

**Files:** trip-monitor/route.ts (add driver notification), carrier/dashboard/route.ts (add driver stats).

---

### Task 12: Web Login + Root Page

**Files:** login/page.tsx (add DRIVER redirect), page.tsx (add DRIVER redirect), NEW app/driver/page.tsx.

---

### Task 13: Driver Invite & Registration API

**Schema:** Add phone to Invitation model. Migration.
**New routes:** drivers/invite, drivers/accept-invite.

---

### Task 14: Driver CRUD API

**New routes:** drivers/ (GET list), drivers/[id] (GET/PUT/DELETE), drivers/[id]/approve, drivers/[id]/reject.

---

### Task 15: Trip Assignment + Conflict Detection

**New routes:** trips/[tripId]/assign-driver, trips/[tripId]/unassign-driver.
**Modified:** assignmentConflictDetection.ts (checkDriverConflicts).

---

### Task 16: Notification Types + Wiring

Add DRIVER notification types. Wire into notificationRoutes.ts + mobile notificationRouting.ts.

---

### Task 17: WebSocket DRIVER Support

Add DRIVER case to checkLoadGpsPermission in websocket-server.ts.

---

### Task 18: Carrier Web — Driver Management

New pages: driver list, invite, detail. Add to carrier sidebar.

---

### Task 19: Carrier Web — Trip UI Updates

Driver column in trip list. Assign dropdown in trip detail. Driver stats in dashboard.

---

### Task 20: Shipper/Dispatcher/Admin Web — Trip UI

Show driver info on trip detail across all portals.

---

### Task 21: Mobile Monorepo Restructure

Split mobile/ into packages/shared + apps/shipper + apps/carrier + apps/driver. Fix \_layout.tsx and auth store.

---

### Task 22: Carrier Mobile — Driver Management + Trip UI

Driver management screens + trip UI updates in apps/carrier/.

---

### Task 23: Driver App — Auth

Join carrier (invite code), CDL upload, pending approval, login.

---

### Task 24: Driver App — Trips + POD

My trips, trip detail, status buttons, POD upload, availability toggle.

---

### Task 25: Driver App — GPS + Navigation

Background location service, Google Maps, offline GPS queue.

---

### Task 26: Driver App — Messaging + Profile

Chat, profile, CDL info, notification list.

---

### Task 27: Backend Tests

All 34 gaps verified blocked. Full driver lifecycle. Assignment conflicts. GPS source tagging. Messaging senderRole. Notifications.

---

### Task 28: E2E + Backward Compatibility

All existing Jest (3207+), E2E (895+), mobile (570+) tests pass. Trip with driverId=null identical to before.

---

## WHAT NOT TO TOUCH

- Load state machine / Load CRUD
- Truck CRUD & approval & posting
- Matching/request flow (match-proposals, truck-requests, load-requests)
- Service fee CALCULATION logic
- Rating system logic (just block DRIVER from calling it)
- Corridor/distance management
- Truck.defaultDriverId — DO NOT CREATE
- Existing test expectations — fix implementation, not tests

---

_Spec v5.0 — 10 rounds of deep analysis. 34 gaps. 5 done. 23 remaining._
_Git commits verified: 9a8b08f, d4e1fb0, 839e097, ec7badb, 324d78a, f51a424_
_202 API routes audited. 23 routes verified SAFE. 34 gaps documented with file, line, and fix._
