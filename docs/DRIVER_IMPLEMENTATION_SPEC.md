# 🚛 Driver Integration — Implementation Spec v6.1 (COMPLETE)

> **STATUS: ALL 27 TASKS COMPLETE.**
> 201 test suites, 3,266 tests passing. 0 failures.
> Type-check clean across web, mobile, and driver-app projects.
>
> Verified against: github.com/DanielMD1989/freight-managment (April 2026)

---

## 0. Guiding Principles

1. Driver is a User with `role=DRIVER` under the carrier's Organization (same organizationId)
2. Driver is assigned per-trip (`Trip.driverId`), NOT per-truck
3. No self-registration — carrier invites via 6-char invite code
4. Carrier NEVER loses capability — driver is additive
5. Backward compatible — `Trip.driverId` nullable; null = existing behavior
6. Three separate apps: FreightET web (all roles), FreightET Carrier (mobile), FreightET Driver (mobile)
7. Shared types via `types/domain.ts` at repo root

**CRITICAL ARCHITECTURE NOTE:** DRIVER shares the carrier's `organizationId`. Every API route that checks `organizationId === carrierId` was audited and scoped to `role === "CARRIER"` in Tasks 6A/6B. 34 security gaps found, all 34 closed.

---

## COMPLETED TASKS

### Task 1: Schema Migration ✅

**Commits:** `9a8b08f2` + `d4e1fb0e`
**Files:** `prisma/schema.prisma`, `lib/rbac/permissions.ts`

- DRIVER added to UserRole enum, INVITED to UserStatus enum
- DriverProfile model (14 fields, @@map "driver_profiles")
- Trip: driverId, driver relation, previousDriverId, driverReassignedAt, driverReassignReason, @@index([driverId])
- GpsPosition: deviceId nullable, device optional, source String?, driverId String?
- DRIVER added to Role type union + empty ROLE_PERMISSIONS placeholder

### Task 2: Notification System Fix ✅

**Commit:** `839e0970`
**File:** `lib/notifications.ts`

- notifyOrganization accepts `excludeRoles?: UserRole[]`, defaults to `[DRIVER]`
- All 81 existing callers automatically exclude DRIVER from org-wide fan-out

### Task 3: RBAC & Permissions ✅

**Commit:** `ec7badb1`
**Files:** `lib/rbac/permissions.ts`, `lib/rbac/accessHelpers.ts`, `lib/rbac/index.ts`, `lib/tripStateMachine.ts`, `lib/walletGate.ts`, `CLAUDE.md`

- DRIVER: 8 permissions (VIEW_LOADS, UPDATE_TRIP_STATUS, UPLOAD_POD, VIEW_POD, VIEW_GPS, VIEW_LIVE_TRACKING, UPLOAD_DOCUMENTS, VIEW_DOCUMENTS)
- isDriver in getAccessRoles (driverId === userId)
- canManageOrganization blocks DRIVER
- TRIP_ROLE_PERMISSIONS: PICKUP_PENDING, IN_TRANSIT, DELIVERED, COMPLETED, EXCEPTION (NO CANCELLED)
- Wallet gate bypasses DRIVER

### Task 3A: Auth Wiring ✅

**Commit:** `324d78ac`
**Files:** 7 trip route files

- isDriver added to GET/PATCH trip detail, POD upload/view, cancel (explicit 403), live, history, GPS GET/POST
- GET /api/trips: `case "DRIVER": whereClause.driverId = session.userId`

### Task 3B: Trip API Responses ✅

**Commit:** `f51a424a`
**Files:** 8 files, 10 Prisma queries

- All trip endpoints include `driver: { id, firstName, lastName, phone, driverProfile: { cdlNumber, isAvailable } }`

### Task 3C (Task 7): GPS Pipeline Fix ✅

**Commit:** `06488718`
**Files:** `app/api/trips/[tripId]/gps/route.ts`, `app/api/gps/batch/route.ts`

- Trip GPS POST: DRIVER path skips device creation (deviceId=null), source="MOBILE_DRIVER", driverId=session.userId
- CARRIER/ADMIN path: source="MOBILE_CARRIER", existing device logic unchanged
- gpsDevice.update guarded: `if (deviceId !== null)`
- Batch endpoint: source="ELD_HARDWARE", driverId=null (CARRIER-only)

### Task 6A: DRIVER Access Lockdown — CRITICAL ✅

**Commit:** `8e7b9275`
**Files:** 14 files

- 14 critical security gaps blocked: wallet (404), org members (403), trucks (403), match-proposals (404), rate (403), documents (403/404), org/me (limited payload), invitations (403), gpsTracking (role guard)

### Task 6B: DRIVER Access Lockdown — HIGH+MEDIUM ✅

**Commit:** `7c3e2fec`
**Files:** 11 files

- 8 HIGH data leaks closed: loads progress/gps-history/next-loads/matching-trucks/detail, trucks history/position, gps/positions — all scoped carrier org match to `role === "CARRIER"`
- 3 MEDIUM gaps: trucks/[id] GET canView, truck-postings matching-loads, RoleAwareSidebar type

### Task 8: Messaging Fix ✅

**Commit:** `cab70a9c`
**Files:** `messages/route.ts` (POST+GET), `messages/[messageId]/read/route.ts`, `messages/unread-count/route.ts`

- senderRole="DRIVER" (not "CARRIER") when session.role=DRIVER + trip.driverId=userId
- isDriver added to read/unread-count access checks

### Task 9: Truck Reassignment + Driver ✅

**Commit:** `3c1cadb6`
**File:** `app/api/trips/[tripId]/reassign-truck/route.ts`

- Optional newDriverId + driverReassignReason in Zod schema
- Driver validation: ACTIVE, same org, no conflict
- Audit fields: previousDriverId, driverReassignedAt
- Notifications: TRIP_DRIVER_ASSIGNED to new, TRIP_DRIVER_UNASSIGNED to old

### Task 10: Geofence + GPS Alerts ✅

**Commit:** `c8d4262b`
**Files:** `lib/geofenceNotifications.ts`, `lib/gpsAlerts.ts`

- Targeted driver notifications for TRUCK_AT_PICKUP, TRUCK_AT_DELIVERY, GPS_OFFLINE, GPS_BACK_ONLINE
- Trip.findFirst to resolve assigned driver; additive (existing org-level fan-out unchanged)

### Task 11: Trip Cron + Carrier Dashboard ✅

**Commit:** `60a0caac`
**Files:** `app/api/cron/trip-monitor/route.ts`, `app/api/carrier/dashboard/route.ts`

- Cron: notifies trip.driverId on 48h auto-close
- Dashboard: activeDrivers, availableDrivers, tripsWithDriver stats

### Task 12: Invitation Schema Update ✅

**Commit:** `ca17cfd3`
**File:** `prisma/schema.prisma`

- Added `phone String?` to Invitation model

### Task 13: Driver Invite & Registration API ✅

**Commit:** `7ba5bdac`
**Files:** `app/api/drivers/invite/route.ts` (NEW), `app/api/drivers/accept-invite/route.ts` (NEW), `app/api/auth/register/route.ts` (comment)

- POST /api/drivers/invite: carrier generates 6-char code, creates Invitation + INVITED User
- POST /api/drivers/accept-invite: unauthenticated, rate-limited, validates code+phone, hashes password, creates DriverProfile, returns loginEmail

### Task 14: Driver CRUD API ✅

**Commit:** `34807eca`
**Files:** `app/api/drivers/route.ts`, `app/api/drivers/[id]/route.ts`, `app/api/drivers/[id]/approve/route.ts`, `app/api/drivers/[id]/reject/route.ts` (all NEW)

- GET list with filters (status, available, page/limit), \_count activeTrips
- GET detail + PUT update (carrier full / driver self-serve subset)
- DELETE soft-suspend + revokeAllSessions
- POST approve (PENDING_VERIFICATION → ACTIVE), POST reject with reason

### Task 15: Trip Assignment + Conflict Detection ✅

**Commit:** `ab780574`
**Files:** `app/api/trips/[tripId]/assign-driver/route.ts` (NEW), `app/api/trips/[tripId]/unassign-driver/route.ts` (NEW), `lib/assignmentConflictDetection.ts`

- 8-step assign validation: trip status, driver exists/active/same-org/available/no-conflict
- Unassign: ASSIGNED only, notifies removed driver
- DRIVER_ALREADY_ASSIGNED conflict type added

### Task 16: Notification Types ✅

**Commit:** `1b3329ea`
**Files:** `lib/notifications.ts`, `lib/notificationRoutes.ts`

- 6 new NotificationType entries: DRIVER_REGISTERED, DRIVER_APPROVED, DRIVER_REJECTED, TRIP_DRIVER_ASSIGNED, TRIP_DRIVER_UNASSIGNED, DRIVER_REASSIGNED
- Routing cases: carrier → /carrier/drivers, trip-scoped → /carrier/trips/{id}

### Task 17: WebSocket DRIVER Support ✅

**Commit:** `01e32790`
**File:** `lib/websocket-server.ts`

- DRIVER case in checkTripSubscriptionPermission (async, Trip.driverId match)
- subscribe-fleet confirmed safe (ALL_GPS_ALLOWED_ROLES excludes DRIVER)

### Task 18: Carrier Web — Driver Management ✅

**Commit:** `cedbc360`
**Files:** 6 new + 1 modified (`components/RoleAwareSidebar.tsx`)

- `/carrier/drivers` — list with filter tabs, approve/reject/suspend inline
- `/carrier/drivers/invite` — form, shows 6-char code on success
- `/carrier/drivers/[id]` — detail with CDL, availability toggle, active trips
- Sidebar: "Drivers" nav item in carrier Operations section

### Task 19: Carrier Web — Trip UI Updates ✅

**Commit:** `98ff4e7b`
**Files:** `carrier/trips/page.tsx`, `carrier/trips/[id]/TripDetailClient.tsx`, `carrier/dashboard/CarrierDashboardClient.tsx`

- Trip list: Driver column after Truck
- Trip detail: Driver section with assign/reassign/unassign + modal picker
- Dashboard: driver stats row (activeDrivers, availableDrivers, tripsWithDriver)

### Task 20: Shipper/Admin Web + Login Routing ✅

**Commit:** `37115750`
**Files:** 7 modified + 1 new (`app/driver/page.tsx`)

- Shipper/admin trip list + detail: driver info displayed
- Login: DRIVER → /driver in both roleRedirects
- Root page: DRIVER redirect before default
- `/driver` web landing page: "Use the mobile app" message

### Task 21: Driver App — Project Skeleton ✅

**Commits:** `411be173` (pre-req) + `cbbfc829` (skeleton)
**Files:** 42 new in `driver-app/`

- Separate Expo project (SDK 54, same deps as mobile)
- 20 files copied from mobile (api/client, components, theme, i18n, services, stores)
- 7 new driver-specific files (types, services, stores, routing)
- Root layout with DRIVER-only AuthGuard
- Layout placeholders: (auth), (driver), (shared)

### Task 22: Carrier Mobile — Driver Management ✅

**Commit:** `500c37bf`
**Files:** 5 new + 5 modified in `mobile/`

- useDrivers hook (8 mutations/queries)
- Driver screens: list, invite, detail (approve/reject/suspend)
- Tab layout: hidden drivers screen
- Dashboard: "Drivers" quick action
- Trip list: driver name. Trip detail: assign/unassign modal

### Task 23: Driver App — Auth Screens ✅

**Commit:** `37d295a0`
**Files:** 5 new in `driver-app/`

- Login with full MFA support, "Join Your Carrier" link
- Join-carrier: 3-step wizard (code+phone → password → CDL), shows loginEmail
- Pending-approval: auto-polls checkAuth every 30s
- Account-rejected, Account-suspended screens

### Task 24: Driver App — Trips + POD + Profile ✅

**Commit:** `26ccc001`
**Files:** 10 new + 2 modified in `driver-app/`

- My Trips list: availability toggle, status filters, 30s auto-refresh
- Trip detail: DRIVER status buttons (no cancel), delivery receiver modal, POD camera/gallery, exception reporting
- Profile: CDL edit, availability toggle
- Settings: about, logout
- Chat: copied from mobile

### Task 25: Driver App — GPS + Background Location ✅

**Commit:** `ac47cc82`
**Files:** 3 new + 2 modified in `driver-app/`

- Background location service (expo-location + task-manager, 30s/50m, foreground service notification)
- Offline GPS queue (MMKV, 1000 max, 24h TTL, NetInfo auto-flush)
- useLocationTracking hook: auto-start on PICKUP_PENDING/IN_TRANSIT, auto-stop on terminal states
- Trip detail: tracking indicator bar (green dot active, gray off, queue count)

### Task 26: Driver App — Notifications ✅

**Commit:** `a3fab98e`
**Files:** 2 new + 3 modified in `driver-app/`

- Notification list screen with unread highlight, mark-all-read
- useNotifications hook (copied from mobile)
- Bell icon with badge on trips screen

### Task 27A: Backend Tests — Security Lockdown + Invite/CRUD ✅

**Commit:** `943c4b70`
**Files:** 2 new test suites + `jest.setup.js`

- driver-access-lockdown.test.ts: 10 tests (14 critical gaps verified blocked)
- driver-invite-crud.test.ts: 11 tests (invite, accept, list, approve, reject, suspend)
- jest.setup.js: driverProfile store + model + single:true relation support

### Task 27B: Backend Tests — Trip Assignment + Operations ✅

**Commit:** `ec574c1e`
**Files:** 2 new test suites + `jest.setup.js`

- driver-trip-assignment.test.ts: 11 tests (assign, unassign, conflicts, auth)
- driver-trip-operations.test.ts: 13 tests (status transitions, cancel denied, messaging senderRole, GPS source/driverId/deviceId)

### Task 27C: Backend Tests — Notifications + Backward Compatibility ✅

**Commit:** `28127b8c`
**Files:** 1 new test suite

- driver-notifications-compat.test.ts: 14 tests (notification access, HIGH gap verification, backward compatibility)

---

## SECURITY GAP ANALYSIS (34 gaps — ALL CLOSED)

### Root Cause

DRIVER shares carrier's `organizationId`. Routes that checked `orgId === carrierId` without `role === "CARRIER"` granted DRIVER full carrier access. Fixed in Tasks 6A (14 CRITICAL) and 6B (11 HIGH+MEDIUM).

### Gap Status

| #     | Severity                | Status    | Fixed In                                             |
| ----- | ----------------------- | --------- | ---------------------------------------------------- |
| 1-14  | CRITICAL                | ✅ CLOSED | Task 6A (`8e7b9275`)                                 |
| 15-23 | HIGH (data leaks)       | ✅ CLOSED | Task 6B (`7c3e2fec`)                                 |
| 24    | HIGH (notif routing)    | ✅ CLOSED | Task 16 (`1b3329ea`)                                 |
| 25    | HIGH (mobile notif)     | ✅ CLOSED | Defense-in-depth guard in mobile notificationRouting |
| 26-27 | HIGH (login routing)    | ✅ CLOSED | Task 20 (`37115750`)                                 |
| 28    | HIGH (WebSocket)        | ✅ CLOSED | Task 17 (`01e32790`)                                 |
| 29    | HIGH (app-role gate)    | ✅ CLOSED | x-client-type login gate + driver-app header         |
| 30    | HIGH (auth store type)  | ✅ CLOSED | Doc comment + correct by design (driver-app)         |
| 31    | HIGH (Invitation phone) | ✅ CLOSED | Task 12 (`ca17cfd3`)                                 |
| 32-34 | MEDIUM                  | ✅ CLOSED | Task 6B (`7c3e2fec`)                                 |

### Verified by Tests

- 59 driver-specific tests across 5 test suites
- 10 lockdown tests verify gaps 1-14 are blocked
- 7 HIGH gap tests verify gaps 15-22 are blocked
- 4 backward compatibility tests verify existing workflows unaffected

---

## PHASE 2 — Post-Launch Enhancements

### Auto-Availability Toggle ✅

**Commit:** `51f12ed4`
**Files:** 5 modified

Mirrors the truck availability pattern: driver `isAvailable` is automatically managed by the trip lifecycle.

| File                                              | Trigger                                  | Action                                                                                      |
| ------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| `app/api/trips/[tripId]/assign-driver/route.ts`   | Driver assigned                          | Set `isAvailable: false`. If replacing old driver, count other active trips → restore if 0. |
| `app/api/trips/[tripId]/unassign-driver/route.ts` | Driver unassigned                        | Count other active trips → restore `isAvailable: true` if 0.                                |
| `app/api/trips/[tripId]/route.ts` (PATCH)         | Trip COMPLETED or CANCELLED              | Inside `$transaction`, count other active trips → restore if 0.                             |
| `app/api/trips/[tripId]/reassign-truck/route.ts`  | Driver swapped during truck reassignment | Inside `$transaction`, new driver unavailable, old driver restored if 0 active.             |
| `app/api/trips/[tripId]/pod/route.ts`             | POD upload auto-completes trip           | Inside `$transaction`, count other active trips → restore if 0.                             |

Active trip statuses for the count query: `ASSIGNED, PICKUP_PENDING, IN_TRANSIT, DELIVERED, EXCEPTION` (same set as the truck pattern).

Manual toggle via `PUT /api/drivers/[id]` still works as a carrier/driver override.

### POD Upload — Driver-Only ✅

**Commit:** `def9bb5a`
**Files:** 3 modified

POD upload restricted to DRIVER + ADMIN only. Carrier can view PODs but cannot upload. Every trip has a driver assigned.

- Backend: removed CARRIER from POST /api/trips/[tripId]/pod auth check
- Carrier web: replaced upload modal with read-only POD status ("POD uploaded by driver" / "Waiting for driver")
- Carrier mobile: replaced upload buttons with read-only status text
- Driver-app: unchanged (already has POD upload from Task 24)

### Driver Name on Rating Form ✅

**Commit:** `749fc551`
**Files:** 4 modified

Shipper rating modal shows driver name as context below the carrier org name.
Display-only — Rating model unchanged (rates organization, not driver).

- `components/RatingModal.tsx` — added optional `driverName` prop, renders muted line in header
- `app/shipper/trips/[id]/ShipperTripDetailClient.tsx` — passes `driverName` from `trip.driver`
- `mobile/src/components/RatingModal.tsx` — added optional `driverName` prop + style
- `mobile/app/(shipper)/trips/[id].tsx` — passes `driverName` from `trip.driver`

When trip has no driver (old trips), prop is `undefined` and the line doesn't render.

### CDL Photo Upload ✅

**Commit:** `a00fb5a0`
**Files:** 1 new + 3 modified (+ 3 driver-app support files)

New `POST /api/drivers/[id]/cdl-upload` endpoint. Driver or carrier uploads CDL front/back photos and medical certificate via multipart form. Files validated (MIME + magic bytes + size) and stored via `lib/fileStorage.ts`; URLs saved to DriverProfile fields (`cdlFrontUrl`, `cdlBackUrl`, `medicalCertUrl`). Rate limited: 10 uploads/hour per driver. CSRF validated.

Separate from `/api/documents` (which remains blocked for DRIVER role). No Document model records created.

- `app/api/drivers/[id]/cdl-upload/route.ts` — new endpoint
- `driver-app/app/(driver)/profile.tsx` — CDL photo section with expo-image-picker upload
- `driver-app/src/services/driver.ts` — `uploadCdlPhoto` method
- `driver-app/src/hooks/useDriver.ts` — `useUploadCdlPhoto` hook
- `driver-app/src/types/index.ts` — added CDL URL fields to DriverProfile type
- `app/carrier/drivers/[id]/DriverDetailClient.tsx` — CDL photo display (web)
- `mobile/app/(carrier)/drivers/[id].tsx` — CDL photo display (mobile)

---

## PHASE 3 — Production Readiness

### E2E Flow Test ✅

**Commit:** `20e37fec`
**File:** `__tests__/e2e/driver-full-flow.test.ts`

Full driver lifecycle test: invite → accept → approve → assign → status transitions (ASSIGNED → PICKUP_PENDING → IN_TRANSIT → DELIVERED) → POD upload → auto-complete → auto-availability restore. Also verifies carrier cannot upload POD (gets 404).

2 tests, covers 7 API endpoints in one sequential flow.

### EAS Build Config ✅

**Commit:** `48148d9a`
**Files:** 1 new + 1 modified

`driver-app/eas.json` with dev/staging/prod build profiles. API base URL sourced from `EXPO_PUBLIC_API_BASE_URL` env var per profile. Removed hardcoded `apiBaseUrl` from `app.json` — the API client already reads the env var first with localhost fallback.

### Offline Trip Status Queue ✅

**Commit:** `214d8274`
**Files:** 1 new + 3 modified

Trip status changes queued in MMKV when offline. Auto-flush on connectivity restore via NetInfo (same pattern as GPS queue). Status changes flush in order (oldest first) to respect the trip state machine. UI shows pending count when changes are queued.

- `driver-app/src/services/status-queue.ts` — new queue service (MMKV, 50-item cap, 24h TTL, NetInfo auto-flush)
- `driver-app/src/services/trip.ts` — `updateTripStatus` queues on network error, returns optimistic result
- `driver-app/app/(driver)/trips/[id].tsx` — pending count indicator below status buttons
- `driver-app/app/(driver)/index.tsx` — flush queue on mount

### CDL Expiry Warning Cron ✅

**Commit:** `24eda57f`
**Files:** 1 new + 1 modified

New `POST /api/cron/cdl-expiry` endpoint. Checks DriverProfile `cdlExpiry` and `medicalCertExp`, notifies driver + carrier org at 30/14/7/0 day brackets. Mirrors insurance-monitor pattern. Also removed dead POD upload code (`handleUploadPod`, `handleTakePhoto`, `useUploadPod`, `ImagePicker`) from carrier mobile trip detail.

### Production File Serving Fixes ✅

**Commit:** `c75264be`
**Files:** 1 new component (2 copies) + 4 modified

- `/api/uploads/[...path]/route.ts`: path-aware access control. `documents/` is org-scoped, `pod/` is trip-scoped (carrier/shipper/driver/dispatcher/admin), `loads/` is shipper-scoped, `profiles/` is user-scoped, unknown prefixes require admin. Previously assumed path[1] was always an orgId, which broke POD access for everyone.
- `AuthenticatedImage` component (new, in `driver-app/src/components/` and `mobile/src/components/`): loads images via the authenticated apiClient, converts to base64 data URI. Used for POD thumbnails and CDL photos since React Native's `<Image>` can't send Bearer tokens.
- Replaced `<Image>` with `<AuthenticatedImage>` in: `driver-app/app/(driver)/trips/[id].tsx`, `driver-app/app/(driver)/profile.tsx`, `mobile/app/(carrier)/drivers/[id].tsx`.

### Driver Availability Restore on All Trip-End Paths ✅

**Commit:** `(this commit)`
**Files:** 4 modified

POD upload + unassign already restored `driverProfile.isAvailable` on completion. But four other trip-end code paths (shipper confirm, 48h auto-close cron, trip cancel, load cancel) restored _truck_ availability but silently left the driver flagged unavailable — blocking them from taking new trips.

All four now apply the canonical POD pattern: count other active trips for the driver, if zero → set `isAvailable: true`.

- `app/api/trips/[tripId]/confirm/route.ts` — shipper-confirmed completion
- `app/api/cron/trip-monitor/route.ts` — 48h DELIVERED auto-close
- `app/api/trips/[tripId]/cancel/route.ts` — trip cancel endpoint
- `app/api/loads/[id]/status/route.ts` — also added `driverId` to trip select; restore on COMPLETED or CANCELLED load

---

## REMAINING WORK

These items are NOT security issues — they are future feature enhancements.

### Mobile Monorepo Split

The spec originally planned a monorepo restructure (`mobile/packages/shared/` + `mobile/apps/shipper/` + `mobile/apps/carrier/` + `mobile/apps/driver/`). Instead, driver-app was created as a sibling project with copied shared code. A future monorepo split would deduplicate the shared code. Low priority since the current setup works and both apps are independently deployable.

---

## WHAT NOT TO TOUCH

- ❌ Load state machine / Load CRUD
- ❌ Truck CRUD & approval & posting
- ❌ Matching/request flow (match-proposals, truck-requests, load-requests)
- ❌ Service fee CALCULATION logic (`lib/serviceFeeManagement.ts` business logic)
- ❌ Rating system (stays org-level, DRIVER blocked from calling it)
- ❌ Corridor/distance management
- ❌ `Truck.defaultDriverId` — DO NOT CREATE
- ❌ Existing test expectations — fix implementation, not tests

---

_Spec v6.1 — ALL 27 TASKS COMPLETE. ALL 34 GAPS CLOSED. April 2026._
_201 test suites. 3,266 tests. 0 failures._
_34 security gaps found. 34 closed. 0 deferred._
_Git history: 30 driver commits from `9a8b08f2` to `28127b8c`._
