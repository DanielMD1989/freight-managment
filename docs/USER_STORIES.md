# Business Workflow User Stories

> Living reference for the freight management platform's end-to-end business logic.
> Each story maps to testable acceptance criteria and real API behavior.
>
> **Source of truth files:** `lib/foundation-rules.ts`, `lib/tripStateMachine.ts`, `lib/loadStateMachine.ts`, `lib/serviceFeeCalculation.ts`, `lib/serviceFeeManagement.ts`

---

## Test Coverage Summary

> Last updated: 2026-03-03 · Carrier QA Sprint complete

| Metric      | Value |
| ----------- | ----- |
| Test suites | 91    |
| Total tests | 2,172 |
| Passing     | 2,162 |
| Skipped     | 10    |
| Failures    | 0     |

### Coverage by User Story

| US         | Story                       | Test File(s)                                                                                                                                                                                                          | Status      |
| ---------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| US-1.1–1.3 | Registration & Verification | `carrier-registration.test.ts`, `auth.test.ts`                                                                                                                                                                        | ✅ Complete |
| US-2.1–2.5 | Truck Lifecycle             | `trucks.test.ts`, `trucks-approve.test.ts`, `trucks-deep.test.ts`, `trucks-edge-cases.test.ts`, `truck-postings.test.ts`, `truck-postings-duplicate.test.ts`                                                          | ✅ Complete |
| US-3.1–3.4 | Load Lifecycle              | `loads.test.ts`, `loads-edge-cases.test.ts`                                                                                                                                                                           | ✅ Complete |
| US-4.1–4.5 | Marketplace & Matching      | `carrier-match-proposals.test.ts`, `match-proposals-deep.test.ts`, `carrier-truck-requests.test.ts`, `truck-requests-deep.test.ts`, `load-request-respond.test.ts`, `requests.test.ts`, `requests-edge-cases.test.ts` | ✅ Complete |
| US-5.1–5.5 | Trip Lifecycle              | `trips.test.ts`, `trip-cancel.test.ts`, `trip-confirm.test.ts`, `trips-edge-cases.test.ts`, `trips-tracking.test.ts`                                                                                                  | ✅ Complete |
| US-6.1–6.3 | Proof of Delivery           | `pod-management.test.ts`                                                                                                                                                                                              | ✅ Complete |
| US-7.1–7.7 | Financial Settlement        | `wallet-settlement.test.ts`, `wallet.test.ts`, `financial-wallet.test.ts`, `financial-withdraw.test.ts`, `pod-management.test.ts`                                                                                     | ✅ Complete |
| US-8.1–8.3 | Post-Delivery & Return      | `trips.test.ts`, `trip-cancel.test.ts`                                                                                                                                                                                | ✅ Complete |
| US-9.1–9.6 | Admin & Super Admin         | `trucks-approve.test.ts`, `dashboard.test.ts`                                                                                                                                                                         | ✅ Complete |
| US-11      | Dispatcher Workflow         | `dispatcher-scoping.test.ts`                                                                                                                                                                                          | ✅ New      |
| US-13      | Cron Automation             | `carrier-automation.test.ts`                                                                                                                                                                                          | ✅ New      |
| US-14      | Mobile API Parity           | `mobile-parity.test.ts`                                                                                                                                                                                               | ✅ New      |
| US-15      | Cross-Role Access           | `cross-role-access.test.ts`                                                                                                                                                                                           | ✅ New      |

---

## Table of Contents

1. [Registration & Verification](#1-registration--verification)
2. [Truck Lifecycle](#2-truck-lifecycle)
3. [Load Lifecycle](#3-load-lifecycle)
4. [Marketplace & Matching](#4-marketplace--matching)
5. [Trip Lifecycle](#5-trip-lifecycle)
6. [Proof of Delivery](#6-proof-of-delivery)
7. [Financial Settlement](#7-financial-settlement)
8. [Post-Delivery & Marketplace Return](#8-post-delivery--marketplace-return)
9. [Admin & Super Admin](#9-admin--super-admin)
10. [Foundation Rules (Cross-Cutting)](#10-foundation-rules-cross-cutting)

---

## 1. Registration & Verification

### US-1.1: Self-Registration

**As a** carrier, shipper, or dispatcher,
**I want to** register on the platform with my company information,
**so that** I can begin the onboarding process.

**Acceptance Criteria:**

- [x] `POST /api/auth/register` accepts email, password, firstName, lastName, role
- [x] Only SHIPPER, CARRIER, and DISPATCHER roles can self-register
- [x] Attempting to register as ADMIN or SUPER_ADMIN returns 400
- [x] Password requires 8-128 characters with uppercase, lowercase, and numbers
- [x] Providing `companyName` auto-creates an Organization record
- [x] Carrier registration accepts optional `carrierType` (CARRIER_COMPANY, CARRIER_INDIVIDUAL, FLEET_OWNER) and `associationId`
- [x] A financial wallet is auto-created (SHIPPER_WALLET or CARRIER_WALLET based on role)
- [x] Rate limit: maximum 3 registrations per hour per IP → returns 429
- [x] New user status is set to `REGISTERED`
- [x] Response includes `limitedAccess: true` with allowed actions: `[view_profile, upload_documents, complete_registration]`
- [x] Mobile registration (`x-client-type: mobile`) receives `sessionToken` in response

**API:** `POST /api/auth/register` (`app/api/auth/register/route.ts`)

**Test:** `__tests__/api/auth/carrier-registration.test.ts`

---

### US-1.2: Status Progression

**As a** newly registered user,
**I want** my account to progress through verification stages,
**so that** the platform can verify my identity and documents before granting full access.

**Acceptance Criteria:**

- [x] Status progression: `REGISTERED` &rarr; `PENDING_VERIFICATION` &rarr; `ACTIVE`
- [x] `REGISTERED`: user has signed up but not yet uploaded documents
- [x] `PENDING_VERIFICATION`: documents uploaded, awaiting admin review
- [x] `ACTIVE`: admin-approved, full platform access granted
- [x] Only an ADMIN or SUPER_ADMIN can transition a user to `ACTIVE`
- [ ] Rejected users receive a `REJECTED` status with a reason

**Test:** `__tests__/api/auth/carrier-registration.test.ts`

---

### US-1.3: Blocked Access Until Active

**As a** platform operator,
**I want** non-ACTIVE users to be blocked from marketplace actions,
**so that** only verified participants can create trucks, loads, or transact.

**Acceptance Criteria:**

- [x] Users with status `REGISTERED` or `PENDING_VERIFICATION` cannot create trucks
- [x] Users with status `REGISTERED` or `PENDING_VERIFICATION` cannot create loads
- [x] Users with status `REGISTERED` or `PENDING_VERIFICATION` cannot post to the marketplace
- [x] Users with status `REGISTERED` or `PENDING_VERIFICATION` cannot send or respond to requests
- [x] API endpoints enforcing this use `requireActiveUser()` which checks `user.status === 'ACTIVE'`
- [x] Blocked users receive a clear error message directing them to complete verification
- [x] SUSPENDED users receive 401 "Account suspended"

**Test:** `__tests__/api/auth/carrier-registration.test.ts`

---

## 2. Truck Lifecycle

### US-2.1: Register a Truck

**As a** carrier,
**I want to** register a truck with its details (type, license plate, capacity),
**so that** it exists as an asset in the system ready for approval.

**Acceptance Criteria:**

- [x] `POST /api/trucks` creates a truck record owned by the carrier's organization
- [x] Required fields: truckType, licensePlate, capacity
- [x] Truck is created with `approvalStatus: 'PENDING'`
- [x] Only users with CARRIER role can create trucks
- [x] Truck `carrierId` is set to the user's organizationId and is immutable (RULE: CARRIER_OWNS_TRUCKS)
- [x] Response wraps the truck: `{ truck: {...} }`

**API:** `POST /api/trucks` (`app/api/trucks/route.ts`)

**Test:** `__tests__/api/carrier/trucks.test.ts`

---

### US-2.2: Admin Approves or Rejects Truck

**As an** admin,
**I want to** review and approve or reject a carrier's truck,
**so that** only verified vehicles operate on the platform.

**Acceptance Criteria:**

- [x] `POST /api/trucks/[id]/approve` with `{ action: 'APPROVE' }` sets `approvalStatus: 'APPROVED'`
- [x] `POST /api/trucks/[id]/approve` with `{ action: 'REJECT', reason: '...' }` sets `approvalStatus: 'REJECTED'` and stores rejection reason
- [x] Rejection reason is required (max 500 chars) when action is REJECT
- [x] Only ADMIN or SUPER_ADMIN can approve/reject
- [x] Approval records `approvedAt` timestamp and `approvedById`
- [x] Carrier is notified on approval: "Your truck [licensePlate] has been approved"
- [x] Carrier is notified on rejection with the reason and guidance to resubmit
- [x] Cache is invalidated after status change

**API:** `POST /api/trucks/[id]/approve` (`app/api/trucks/[id]/approve/route.ts`)

**Test:** `__tests__/api/carrier/trucks-approve.test.ts`

---

### US-2.3: Resubmit After Rejection

**As a** carrier whose truck was rejected,
**I want to** update my truck details and resubmit for approval,
**so that** I can address the issues and get my truck approved.

**Acceptance Criteria:**

- [x] Carrier can update truck details via `PATCH /api/trucks/[id]`
- [x] Updating a rejected truck resets `approvalStatus` back to `PENDING`
- [x] Previous rejection reason remains accessible for reference
- [x] Admin can re-review the updated truck

**Test:** `__tests__/api/carrier/trucks-deep.test.ts`

---

### US-2.4: Post Approved Truck to Marketplace

**As a** carrier with an approved truck,
**I want to** post my truck to the marketplace with availability and location details,
**so that** shippers and dispatchers can find it for load matching.

**Acceptance Criteria:**

- [x] `POST /api/truck-postings` creates a marketplace listing for an approved truck
- [x] Truck must have `approvalStatus: 'APPROVED'` to be posted
- [x] Posting requires: truckId, originCityId, availableFrom, contactName, contactPhone
- [x] Optional: destinationCityId, availableTo, fullPartial, notes, expiresAt
- [x] Posting is created with status `ACTIVE` (visible on marketplace)
- [x] **ONE_ACTIVE_POST_PER_TRUCK**: if truck already has an ACTIVE posting, returns 409 Conflict
- [x] Location data (origin/destination city) lives only in the posting, not in the truck master record (RULE: LOCATION_IN_DYNAMIC_TABLES)
- [x] Rate limit: 100 postings per day per carrier organization
- [x] CSRF protection required

**API:** `POST /api/truck-postings` (`app/api/truck-postings/route.ts`)

**Test:** `__tests__/api/carrier/truck-postings.test.ts`

---

### US-2.5: One Active Post Per Truck

**As a** platform operator,
**I want to** enforce that each truck has at most one active marketplace listing,
**so that** there is no double-booking or marketplace confusion.

**Acceptance Criteria:**

- [x] Creating a posting when an ACTIVE posting already exists for that truck returns 409
- [x] Error response includes the existing active posting ID
- [x] Carrier must expire or cancel the existing posting before creating a new one
- [x] This is enforced in `lib/foundation-rules.ts` as `RULE_ONE_ACTIVE_POST_PER_TRUCK`

**Foundation Rule:** `ONE_ACTIVE_POST_PER_TRUCK` (`lib/foundation-rules.ts`)

**Test:** `__tests__/api/carrier/truck-postings-edge-cases.test.ts`

---

## 3. Load Lifecycle

### US-3.1: Create a Load

**As a** shipper,
**I want to** create a load with cargo details, pickup/delivery information,
**so that** I can describe what needs to be transported.

**Acceptance Criteria:**

- [x] `POST /api/loads` creates a load owned by the shipper's organization
- [x] Required fields: pickupCity, pickupDate, deliveryCity, deliveryDate, truckType, weight, cargoDescription
- [x] Optional fields: addresses, coordinates, volume, insurance details, special instructions
- [x] Load can be created as `DRAFT` (private) or `POSTED` (marketplace-visible)
- [x] If status is `POSTED`, `postedAt` timestamp is set and a load event is created
- [x] If status is `DRAFT`, no marketplace visibility
- [x] Response wraps the load: `{ load: {...} }`
- [x] All text fields are sanitized before storage
- [x] Shipper contact info is stored but never exposed in public list endpoints

**API:** `POST /api/loads` (`app/api/loads/route.ts`)

**Test:** `__tests__/api/carrier/loads.test.ts`

---

### US-3.2: Post Load to Marketplace

**As a** shipper,
**I want to** post my draft load to the marketplace,
**so that** carriers can discover and request it.

**Acceptance Criteria:**

- [x] Load status transitions from `DRAFT` to `POSTED`
- [x] Only the shipper who owns the load can post it
- [x] `postedAt` timestamp is recorded
- [x] Push notification sent to carriers: "New [truckType] load available: [pickup] &rarr; [delivery]"
- [x] Marketplace caches are invalidated
- [x] Only `POSTED` loads are visible to carriers browsing the marketplace

**Load Status Machine:** `lib/loadStateMachine.ts`

**Test:** `__tests__/api/carrier/loads.test.ts`

---

### US-3.3: Marketplace Visibility Rules

**As a** carrier browsing loads,
**I want to** see only loads that are available for transport,
**so that** I don't waste time on unavailable loads.

**Acceptance Criteria:**

- [x] Only loads with status `POSTED`, `SEARCHING`, or `OFFERED` are visible on the marketplace
- [x] `DRAFT` loads are visible only to the owning shipper
- [x] `ASSIGNED` and later statuses are no longer visible on the marketplace
- [x] Shippers always see only their own loads (scoped by organizationId)
- [x] `CANCELLED` and `EXPIRED` loads are not shown in default marketplace views

**Test:** `__tests__/api/carrier/loads-edge-cases.test.ts`

---

### US-3.4: Load Status Machine

**As a** platform developer,
**I want** load status transitions to follow a strict state machine,
**so that** invalid state changes are prevented.

**Acceptance Criteria:**

- [x] Valid statuses: DRAFT, POSTED, SEARCHING, OFFERED, ASSIGNED, PICKUP_PENDING, IN_TRANSIT, DELIVERED, COMPLETED, EXCEPTION, CANCELLED, EXPIRED, UNPOSTED
- [x] DRAFT &rarr; [POSTED, CANCELLED]
- [x] POSTED &rarr; [SEARCHING, OFFERED, ASSIGNED, UNPOSTED, CANCELLED, EXPIRED]
- [x] ASSIGNED &rarr; [PICKUP_PENDING, IN_TRANSIT, EXCEPTION, CANCELLED]
- [x] IN_TRANSIT &rarr; [DELIVERED, EXCEPTION] (cannot cancel IN_TRANSIT directly)
- [x] DELIVERED &rarr; [COMPLETED, EXCEPTION]
- [x] COMPLETED &rarr; [EXCEPTION] (only for dispute resolution)
- [x] CANCELLED, EXPIRED are terminal states (no outbound transitions except EXPIRED &rarr; POSTED)
- [x] Invalid transitions return 400 with allowed next states
- [x] Role permissions: Shipper can set [DRAFT, POSTED, CANCELLED, UNPOSTED]; Carrier can set [ASSIGNED, PICKUP_PENDING, IN_TRANSIT, DELIVERED]; Dispatcher can set [SEARCHING, OFFERED, ASSIGNED, PICKUP_PENDING, EXCEPTION]

**Source of truth:** `lib/loadStateMachine.ts`

**Test:** `__tests__/api/carrier/loads-edge-cases.test.ts`

---

## 4. Marketplace & Matching

### US-4.1: Carrier Requests Shipper's Load

**As a** carrier,
**I want to** browse available loads and send a request to transport one,
**so that** the shipper can review and approve my truck for the job.

**Acceptance Criteria:**

- [x] Carrier browses loads on the marketplace (only POSTED/SEARCHING/OFFERED loads visible)
- [x] Carrier sends a load request via `POST /api/load-requests` specifying loadId and truckId
- [x] Load request is created with status `PENDING` and an expiration time
- [x] Shipper is notified of the incoming request
- [x] Wallet balances are validated before request creation (validation only, no deduction)
- [x] Shipper reviews and responds via `POST /api/load-requests/[id]/respond`
- [x] Shipper can `APPROVE` or `REJECT` the request

**API:** `POST /api/load-requests`, `POST /api/load-requests/[id]/respond` (`app/api/load-requests/[id]/respond/route.ts`)

**Test:** `__tests__/api/carrier/load-request-respond.test.ts`

---

### US-4.2: Shipper Requests Carrier's Truck

**As a** shipper,
**I want to** browse available truck postings and request a specific truck for my load,
**so that** I can proactively find transport for my cargo.

**Acceptance Criteria:**

- [x] Shipper browses `/api/truck-postings` (NOT `/api/trucks` &mdash; see RULE: SHIPPER_DEMAND_FOCUS)
- [x] Shipper sends a truck request via `POST /api/truck-requests` specifying truckPostingId and loadId
- [x] Truck request is created with status `PENDING` and an expiration time
- [x] Carrier is notified of the incoming request
- [x] Wallet balances are validated before request creation (validation only, no deduction)
- [x] **CARRIER_FINAL_AUTHORITY**: only the carrier who owns the truck can approve or reject
- [x] Carrier responds via `POST /api/truck-requests/[id]/respond` with APPROVE or REJECT

**API:** `POST /api/truck-requests`, `POST /api/truck-requests/[id]/respond` (`app/api/truck-requests/[id]/respond/route.ts`)

**Foundation Rule:** `CARRIER_FINAL_AUTHORITY` (`lib/foundation-rules.ts`)

**Test:** `__tests__/api/carrier/carrier-truck-requests.test.ts`, `__tests__/api/carrier/truck-requests-deep.test.ts`

---

### US-4.3: Dispatcher Proposes a Match

**As a** dispatcher,
**I want to** propose a match between a load and a truck posting,
**so that** I can coordinate logistics without directly assigning loads.

**Acceptance Criteria:**

- [x] Dispatcher can view all POSTED loads and all ACTIVE truck postings
- [x] Dispatcher creates a match proposal via `POST /api/match-proposals` specifying loadId and truckId
- [x] Proposal is created with status `PENDING`
- [x] **CARRIER_FINAL_AUTHORITY**: only the carrier who owns the truck can accept or reject the proposal
- [x] Carrier responds via `POST /api/match-proposals/[id]/respond` with ACCEPT or REJECT
- [x] Dispatcher CANNOT directly assign loads (RULE: DISPATCHER_COORDINATION_ONLY)
- [x] Wallet balances are validated at proposal creation AND again at acceptance time as a safety net

**API:** `POST /api/match-proposals`, `POST /api/match-proposals/[id]/respond` (`app/api/match-proposals/[id]/respond/route.ts`)

**Foundation Rule:** `DISPATCHER_COORDINATION_ONLY` (`lib/foundation-rules.ts`)

**Test:** `__tests__/api/carrier/dispatcher-scoping.test.ts`, `__tests__/api/carrier/match-proposals-deep.test.ts`

---

### US-4.4: First-Accept-Wins (Atomic Approval)

**As a** platform operator,
**I want** the first approval to win when multiple requests/proposals compete for the same load,
**so that** there are no double-assignments or race conditions.

**Acceptance Criteria:**

- [x] When a load request, truck request, or match proposal is approved, all other PENDING requests/proposals for the same load are atomically cancelled
- [x] This includes cancellation of: other load requests, truck requests, AND match proposals for the load
- [ ] All operations (assignment, trip creation, competing request cancellation) happen in a single database transaction
- [x] If the load was already assigned (race condition), approval returns 409 Conflict
- [x] If the truck is already busy on an active load, approval returns 400 or 409
- [x] Fresh load status is re-fetched inside the transaction to prevent stale reads

**Test:** `__tests__/api/carrier/requests-edge-cases.test.ts`

---

### US-4.5: Marketplace Cleanup on Match

**As a** platform operator,
**I want** the marketplace to reflect accurate availability after a match,
**so that** other users don't interact with already-matched resources.

**Acceptance Criteria:**

- [x] On approval: truck posting status changes from `ACTIVE` to `MATCHED` (hidden from marketplace) _(load-requests and truck-requests respond routes; match-proposals respond route does not currently update postings)_
- [x] On approval: truck `isAvailable` is set to `false` _(load-requests and truck-requests respond routes only)_
- [x] On approval: load status changes to `ASSIGNED`
- [x] Cache invalidation runs for both load and truck after transaction commits
- [x] A Trip record is created atomically with the assignment (status: `ASSIGNED`)
- [x] GPS tracking is enabled for the truck if it has a verified IMEI
- [x] Notifications sent to relevant parties (carrier on load request approval, shipper on truck request approval, shipper and dispatcher on match proposal acceptance)

**Test:** `__tests__/api/carrier/requests.test.ts`

---

## 5. Trip Lifecycle

### US-5.1: Trip State Machine

**As a** carrier,
**I want to** progress my trip through well-defined statuses,
**so that** all parties can track the transport lifecycle.

**Acceptance Criteria:**

- [x] Valid trip statuses: ASSIGNED, PICKUP_PENDING, IN_TRANSIT, DELIVERED, COMPLETED, CANCELLED
- [x] Valid transitions:
  - ASSIGNED &rarr; [PICKUP_PENDING, CANCELLED]
  - PICKUP_PENDING &rarr; [IN_TRANSIT, CANCELLED]
  - IN_TRANSIT &rarr; [DELIVERED, CANCELLED]
  - DELIVERED &rarr; [COMPLETED, CANCELLED]
  - COMPLETED &rarr; [] (terminal)
  - CANCELLED &rarr; [] (terminal)
- [x] Invalid transitions return 400 with the list of valid next states
- [x] Trip status is updated via `PATCH /api/trips/[tripId]`
- [x] Trip status is synced to the corresponding load status in the same transaction

**API:** `PATCH /api/trips/[tripId]` (`app/api/trips/[tripId]/route.ts`)

**Source of truth:** `lib/tripStateMachine.ts`

**Test:** `__tests__/api/carrier/trips.test.ts`

---

### US-5.2: Trip Status Role Permissions

**As a** platform operator,
**I want** only authorized roles to trigger specific trip transitions,
**so that** the workflow integrity is maintained.

**Acceptance Criteria:**

- [x] CARRIER can set: PICKUP_PENDING, IN_TRANSIT, DELIVERED
- [x] DISPATCHER can set: ASSIGNED, CANCELLED
- [x] ADMIN / SUPER_ADMIN can set any status (exception handling)
- [x] Only the carrier who owns the trip can update it (carrier's orgId must match trip.carrierId)
- [x] Non-owners receive 404 (not 403) to avoid information leakage (cross-org isolation)

**Test:** `__tests__/api/carrier/cross-role-access.test.ts`

---

### US-5.3: Timestamps at Each Transition

**As a** platform operator,
**I want** timestamps recorded at each status transition,
**so that** there is a complete audit trail.

**Acceptance Criteria:**

- [x] PICKUP_PENDING sets `startedAt`
- [x] IN_TRANSIT sets `pickedUpAt`
- [x] DELIVERED sets `deliveredAt` (also accepts receiverName, receiverPhone, deliveryNotes)
- [x] COMPLETED sets `completedAt` and disables GPS tracking
- [x] CANCELLED sets `cancelledAt` and disables GPS tracking
- [x] A LoadEvent is created for every trip status change with previous and new status in metadata

**Test:** `__tests__/api/carrier/trips.test.ts`

---

### US-5.4: Cancellation

**As a** carrier or admin,
**I want to** cancel a trip from any non-terminal state,
**so that** unexpected situations can be handled.

**Acceptance Criteria:**

- [x] CANCELLED is a valid transition from ASSIGNED, PICKUP_PENDING, and DELIVERED. IN_TRANSIT trips cannot be cancelled directly; use the exception workflow instead.
- [x] CANCELLED is a terminal state (no further transitions)
- [x] Cancelling restores truck availability: `isAvailable = true`
- [x] Cancelling reactivates the truck posting: `MATCHED` &rarr; `ACTIVE`
- [x] Load status is synced to CANCELLED
- [x] If service fees were previously deducted, shipper receives a refund (see US-7.5)

**Test:** `__tests__/api/carrier/trip-cancel.test.ts`

---

### US-5.5: Cross-Org Trip Isolation

**As a** platform operator,
**I want** trips to be invisible to non-participating organizations,
**so that** business data remains private.

**Acceptance Criteria:**

- [x] A carrier requesting a trip they don't own receives 404 (not 403)
- [x] Shippers can only see trips for their own loads
- [x] Dispatchers and admins have broader visibility based on their role
- [x] Access is checked using `getAccessRoles()` utility with org-level matching

**Test:** `__tests__/api/carrier/cross-role-access.test.ts`

---

## 6. Proof of Delivery

### US-6.1: Carrier Uploads POD

**As a** carrier,
**I want to** upload proof of delivery (photo or document) after delivering the load,
**so that** the shipper can verify the delivery.

**Acceptance Criteria:**

- [x] `POST /api/trips/[tripId]/pod` accepts file upload
- [x] Trip must be in `DELIVERED` status before POD can be uploaded
- [x] Accepted file types: JPEG, PNG, PDF
- [x] Maximum file size: 10MB
- [x] Only carrier or admin can upload
- [x] POD record is created in the TripPod table (supports multiple PODs per trip)
- [x] Load is updated: `podSubmitted = true`
- [x] A LoadEvent is created with eventType `POD_SUBMITTED`

**API:** `POST /api/trips/[tripId]/pod` (`app/api/trips/[tripId]/pod/route.ts`)

**Test:** `__tests__/api/carrier/pod-management.test.ts`

---

### US-6.2: Shipper Verifies POD

**As a** shipper,
**I want to** review and verify the proof of delivery,
**so that** I can confirm the cargo was delivered correctly.

**Acceptance Criteria:**

- [x] `PUT /api/loads/[id]/pod` with verification action
- [x] Only the **shipper** who owns the load (or admin) can verify — carriers cannot verify their own deliveries
- [x] Load must have `podSubmitted = true` before verification is allowed
- [x] Cannot verify if already verified
- [x] Sets `podVerified = true` and records `podVerifiedAt` timestamp
- [x] A LoadEvent is created with eventType `POD_VERIFIED`

**API:** `PUT /api/loads/[id]/pod` (`app/api/loads/[id]/pod/route.ts`)

**Test:** `__tests__/api/carrier/pod-management.test.ts`

---

### US-6.3: COMPLETED Blocked Until POD Verified

**As a** platform operator,
**I want** trip completion to be gated on POD submission and verification,
**so that** financial settlement only occurs after confirmed delivery.

**Acceptance Criteria:**

- [x] Attempting to set trip status to `COMPLETED` without `podSubmitted = true` returns 400 with `requiresPod: true`
- [x] Attempting to set trip status to `COMPLETED` without `podVerified = true` returns 400 with `awaitingVerification: true`
- [x] Only after both conditions are met can the carrier mark the trip as COMPLETED
- [x] POD verification automatically triggers service fee deduction (see US-7.3)

**Test:** `__tests__/api/carrier/trips.test.ts`

---

## 7. Financial Settlement

### US-7.1: Service Fee Calculation

**As a** platform operator,
**I want** service fees calculated based on corridor pricing,
**so that** both shipper and carrier are charged according to the route.

**Acceptance Criteria:**

- [x] Fees are calculated per-km using corridor-specific pricing
- [x] Dual-party fees: shipper pays `shipperPricePerKm * distanceKm`, carrier pays `carrierPricePerKm * distanceKm`
- [x] Promo discounts can reduce fees: `discount = baseFee * promoDiscountPct / 100`
- [x] Corridor matching: exact match first, then bidirectional match, then null (no corridor)
- [x] Distance priority: `actualTripKm` (GPS) > `estimatedTripKm` > `tripKm` (legacy) > `corridor.distanceKm` (fallback)
- [x] All calculations use Decimal.js for precision, rounded to 2 decimal places
- [x] Total platform fee = shipper final fee + carrier final fee

**Source of truth:** `lib/serviceFeeCalculation.ts`

**Test:** `__tests__/api/financial/wallet-settlement.test.ts`

---

### US-7.2: Wallet Balance Validation Before Assignment

**As a** platform operator,
**I want** wallet balances validated before a load is assigned,
**so that** both parties can cover the service fees.

**Acceptance Criteria:**

- [x] `validateWalletBalancesForTrip(loadId, carrierId)` is called at request/proposal **creation** time (truck requests, load requests, match proposals) AND again at acceptance time as a safety net
- [x] Checks shipper wallet has sufficient balance for shipper fee
- [x] Checks carrier wallet has sufficient balance for carrier fee
- [x] If either balance is insufficient, returns 400 with details of required vs. available amounts
- [x] This is validation only &mdash; no money is moved at this stage
- [x] If no corridor matches the route, fees are zero and validation passes

**Source of truth:** `lib/serviceFeeManagement.ts`

**Test:** `__tests__/api/financial/wallet-settlement.test.ts`

---

### US-7.3: Fee Deduction on Completion

**As a** platform operator,
**I want** service fees deducted from wallets when a trip is completed,
**so that** the platform earns revenue only after confirmed delivery.

**Acceptance Criteria:**

- [x] `deductServiceFee(loadId)` is triggered after POD verification
- [x] Deduction happens on COMPLETED status (not at assignment)
- [x] Shipper wallet is debited by shipper fee amount
- [x] Carrier wallet is debited by carrier fee amount
- [x] Platform revenue account is credited by total deducted amount
- [ ] All operations (journal entry, balance updates, load updates) are in a single database transaction
- [ ] Balance is re-verified inside the transaction to prevent race conditions
- [x] Load records updated: `shipperFeeStatus = 'DEDUCTED'`, `carrierFeeStatus = 'DEDUCTED'`
- [x] Journal entry created with `transactionType: 'SERVICE_FEE_DEDUCT'` for audit trail
- [x] Notifications sent to both shipper and carrier about fee amounts

**Source of truth:** `lib/serviceFeeManagement.ts`

**Test:** `__tests__/api/carrier/pod-management.test.ts`

---

### US-7.4: Double-Deduction Prevention

**As a** platform operator,
**I want** the system to prevent fees from being deducted twice,
**so that** users are not overcharged.

**Acceptance Criteria:**

- [x] If `shipperFeeStatus === 'DEDUCTED'` AND `carrierFeeStatus === 'DEDUCTED'`, deduction returns early with error "Service fees already deducted"
- [x] Idempotent: calling `deductServiceFee` again on a fully-deducted load is a no-op
- [ ] Balance re-verification inside the transaction prevents concurrent deduction attempts

**Test:** `__tests__/api/carrier/pod-management.test.ts`

---

### US-7.5: Refund on Cancellation

**As a** shipper whose trip was cancelled,
**I want** my service fee refunded,
**so that** I am not charged for a trip that did not complete.

**Acceptance Criteria:**

- [x] `refundServiceFee(loadId)` is called when a load/trip is cancelled
- [x] Only the shipper's fee is refunded (carrier fee is only deducted on completion, so nothing to refund)
- [x] Platform revenue account is debited by the refund amount
- [x] Shipper wallet is credited by the refund amount
- [ ] All operations are in a single database transaction
- [ ] Platform balance is verified before refund (must have sufficient balance)
- [x] Load is updated: `shipperFeeStatus = 'REFUNDED'`, `serviceFeeRefundedAt` set
- [x] Journal entry created with `transactionType: 'SERVICE_FEE_REFUND'`
- [x] If fee was zero, status is still marked as REFUNDED (no money moves)

**Source of truth:** `lib/serviceFeeManagement.ts`

**Test:** `__tests__/api/carrier/trip-cancel.test.ts`

---

### US-7.6: No Corridor Means Fees Waived

**As a** platform operator,
**I want** fees to be waived when no corridor matches the route,
**so that** trips on unpriced routes can still proceed.

**Acceptance Criteria:**

- [x] If `findMatchingCorridor()` returns null, both fees are set to 0
- [x] Load is updated: `shipperFeeStatus = 'WAIVED'`, `carrierFeeStatus = 'WAIVED'`
- [x] No wallet deductions occur
- [x] No journal entry is created (nothing to record)
- [x] Trip completion proceeds normally despite waived fees

**Test:** `__tests__/api/carrier/pod-management.test.ts`

---

### US-7.7: Journal Entries for Audit Trail

**As an** auditor,
**I want** every financial transaction recorded as a journal entry,
**so that** there is a complete ledger for reconciliation.

**Acceptance Criteria:**

- [x] Service fee deductions create a journal entry with type `SERVICE_FEE_DEDUCT`
- [x] Refunds create a journal entry with type `SERVICE_FEE_REFUND`
- [x] Each journal entry has line items: debit lines (wallet decrements) and credit lines (wallet/platform increments)
- [x] Journal entry metadata includes: fee amounts, corridor ID, distance, price per km, distance source
- [x] Journal entry references the loadId for traceability
- [ ] All journal operations are atomic with balance updates (same transaction)

**Test:** `__tests__/api/carrier/pod-management.test.ts`

---

## 8. Post-Delivery & Marketplace Return

### US-8.1: Truck Availability Restored

**As a** carrier,
**I want** my truck to become available again after a trip is completed or cancelled,
**so that** it can accept new jobs.

**Acceptance Criteria:**

- [x] On trip COMPLETED: `truck.isAvailable` set to `true` (truck returns to marketplace for next job)
- [x] On trip CANCELLED: `truck.isAvailable` set to `true` (truck returns to marketplace for next job)
- [ ] Both happen inside the trip update transaction (atomic with status change)

**Test:** `__tests__/api/carrier/trips.test.ts`, `__tests__/api/carrier/trip-cancel.test.ts`

---

### US-8.2: Truck Posting Reactivated

**As a** carrier,
**I want** my truck's marketplace posting reactivated after a trip ends,
**so that** I don't need to manually re-list it.

**Acceptance Criteria:**

- [x] On trip COMPLETED or CANCELLED: truck postings with status `MATCHED` are set back to `ACTIVE` (automatic re-listing)
- [x] The posting's `updatedAt` timestamp is refreshed
- [x] The truck becomes visible on the marketplace again immediately — no manual re-listing required
- [ ] This is atomic with the trip status change (same transaction)

**Test:** `__tests__/api/carrier/trip-cancel.test.ts`

---

### US-8.3: Trip History Accessible

**As a** carrier or shipper,
**I want to** view my completed trip history,
**so that** I can reference past deliveries.

**Acceptance Criteria:**

- [x] `GET /api/trips` returns trips filtered by user's organization
- [x] Completed and cancelled trips remain queryable
- [x] Trip includes load details, route history, timestamps, and POD references
- [x] Cross-org isolation: users only see trips where their organization is the shipper or carrier

**Test:** `__tests__/api/carrier/trips.test.ts`

---

## 9. Admin & Super Admin

### US-9.1: Approve/Reject User Registrations

**As an** admin,
**I want to** review and approve or reject user registrations,
**so that** only legitimate participants access the platform.

**Acceptance Criteria:**

- [x] Admin can view all users with status `PENDING_VERIFICATION`
- [x] Admin can set user status to `ACTIVE` (approved) or `REJECTED` (with reason)
- [x] Only ADMIN or SUPER_ADMIN roles can perform this action
- [x] Approved users gain full platform access
- [x] Rejected users are notified with the rejection reason

**Test:** `__tests__/api/auth/carrier-registration.test.ts`

---

### US-9.2: Approve/Reject Trucks

**As an** admin,
**I want to** review and approve or reject truck registrations,
**so that** only verified vehicles operate on the platform.

**Acceptance Criteria:**

- [x] See US-2.2 for full acceptance criteria
- [x] Admin dashboard shows all trucks with `approvalStatus: 'PENDING'`
- [x] Approved trucks can be posted to the marketplace
- [x] Rejected trucks cannot be posted until issues are resolved and re-approved

**Test:** `__tests__/api/carrier/trucks-approve.test.ts`

---

### US-9.3: Monitor Platform Operations

**As an** admin,
**I want to** monitor all trips, loads, and organizations,
**so that** I can ensure platform health and resolve disputes.

**Acceptance Criteria:**

- [x] Admin can view all trips regardless of organization
- [x] Admin can view all loads regardless of organization
- [x] Admin can view all organizations and their statuses
- [x] Admin can set any trip status (exception handling override)
- [x] Admin can set any load status (exception handling override)

**Test:** `__tests__/api/carrier/cross-role-access.test.ts`, `__tests__/api/carrier/trips.test.ts`

---

### US-9.4: Manage Corridors and Pricing

**As an** admin,
**I want to** manage route corridors and per-km pricing,
**so that** service fees are correctly calculated for each route.

**Acceptance Criteria:**

- [x] Admin can create corridors with origin/destination regions, distance, and pricing
- [x] Each corridor has separate shipper and carrier per-km rates
- [x] Corridors support direction types: ONE_WAY, ROUND_TRIP, BIDIRECTIONAL
- [x] Promotional discounts can be configured per party (flag + percentage)
- [x] Corridors can be activated or deactivated (`isActive` flag)
- [x] Fee preview calculations available for corridor management UI

---

### US-9.5: View Platform Analytics and Revenue

**As an** admin,
**I want to** view platform analytics and revenue,
**so that** I can track business performance.

**Acceptance Criteria:**

- [x] Platform revenue account tracks cumulative service fees collected
- [x] Journal entries provide a complete financial audit trail
- [x] Dashboard shows trip counts, completion rates, and active users
- [x] Revenue breakdown available by corridor and time period

**Test:** `__tests__/api/carrier/dashboard.test.ts`

---

### US-9.6: Process Withdrawals

**As an** admin,
**I want to** process withdrawal requests from carriers and shippers,
**so that** they can access their wallet funds.

**Acceptance Criteria:**

- [x] Users can request withdrawals from their wallet balance
- [x] Admin reviews and approves or rejects withdrawal requests
- [x] Approved withdrawals deduct from user wallet and create a journal entry
- [x] Rejected withdrawals return funds to the user's available balance

**Test:** `__tests__/api/financial/wallet-settlement.test.ts`

---

## 10. Foundation Rules (Cross-Cutting)

These rules are enforced globally across all API endpoints and business logic.

**Source of truth:** `lib/foundation-rules.ts`

### RULE: CARRIER_OWNS_TRUCKS

> Carrier is the sole owner of trucks. Only carrier can modify truck records.

- Truck `carrierId` is required and immutable after creation
- Only CARRIER role can create, edit, or delete trucks
- Other roles can view trucks but never modify ownership
- **Tested:** `__tests__/api/carrier/trucks.test.ts`, `__tests__/api/carrier/cross-role-access.test.ts`

### RULE: POSTING_IS_AVAILABILITY

> Posting expresses availability, not ownership. Location lives only in posting.

- Posting a truck does not create a truck (truck must exist first)
- Location data (current city, lat/lng) exists only in TruckPosting
- Truck master record has no location fields
- Postings are ephemeral; trucks are permanent assets
- **Tested:** `__tests__/api/carrier/truck-postings.test.ts`

### RULE: DISPATCHER_COORDINATION_ONLY

> Dispatcher coordinates availability but cannot execute assignments.

- Dispatcher can see posted trucks and loads
- Dispatcher can propose matches
- Dispatcher CANNOT assign loads, accept requests, or start trips
- Dispatcher has `PROPOSE_MATCH` permission, not `ASSIGN_LOADS`
- **Tested:** `__tests__/api/carrier/dispatcher-scoping.test.ts`, `__tests__/api/carrier/cross-role-access.test.ts`

### RULE: ONE_ACTIVE_POST_PER_TRUCK

> Each truck can have at most one active posting at any time.

- Creating a second active posting returns 409 Conflict
- Previous active post must be expired or cancelled first
- Prevents double-booking and marketplace confusion
- **Tested:** `__tests__/api/carrier/truck-postings-edge-cases.test.ts`

### RULE: LOCATION_IN_DYNAMIC_TABLES

> Location data lives only in dynamic tables (posting, GPS), never in master.

- Truck master table has no `currentCity` or `currentLocationLat` fields
- TruckPosting contains location at time of posting
- GPSUpdate contains real-time location during trips
- **Tested:** `__tests__/api/carrier/truck-postings.test.ts`, `__tests__/api/carrier/gps-position.test.ts`

### RULE: CARRIER_FINAL_AUTHORITY

> Carrier is the final authority on truck execution. No assignment without carrier approval.

- Shipper can request a truck, but carrier must approve
- Dispatcher can propose a match, but carrier must accept
- No load is assigned to a truck without the carrier's explicit consent
- Carrier starts and drives the trip
- **Tested:** `__tests__/api/carrier/carrier-truck-requests.test.ts`, `__tests__/api/carrier/match-proposals-deep.test.ts`

### RULE: SHIPPER_DEMAND_FOCUS

> Shipper manages demand (loads). Can request available trucks but cannot browse fleets.

- Shippers POST loads; they do not browse `/api/trucks`
- Shippers browse `/api/truck-postings` (availability, not fleet inventory)
- Shippers see only their own loads
- Contact info is hidden until trip reaches IN_TRANSIT status
- **Tested:** `__tests__/api/carrier/cross-role-access.test.ts`

### RULE: Cross-Org Data Isolation

> Resources are invisible (404) to non-owning organizations.

- Requesting a resource owned by another organization returns 404 (not 403)
- This prevents information leakage (attacker cannot confirm resource existence)
- Applies to: trucks, loads, trips, requests, proposals
- Enforced via `getAccessRoles()` checks in all API routes
- **Tested:** `__tests__/api/carrier/cross-role-access.test.ts`

### RULE: Contact Info Hidden Until IN_TRANSIT

> Carrier contact details are not exposed to shippers until the trip is actively in transit.

- When trip status is `ASSIGNED`, shipper sees `contactPhone: "(hidden)"`
- Route history (GPS data) is also hidden before pickup
- Once trip reaches `PICKUP_PENDING` or later, contact info is revealed
- **Tested:** `__tests__/api/carrier/trips.test.ts`

---

## Mobile API Parity

**As a** mobile carrier user,
**I want** all web features available from the React Native app,
**so that** I can manage my operations from my phone.

**Acceptance Criteria:**

- [x] Registration: `companyName`, `carrierType`, `associationId` all accepted from mobile
- [x] Mobile registration returns `sessionToken` for Bearer-token auth
- [x] Trip status updates via Bearer token → CSRF skipped, state machine still enforced
- [x] GPS submission via Bearer token → no CSRF needed, same validation as web
- [x] Invalid GPS data (lat > 90, missing fields) → 400 from mobile same as web
- [x] Mobile without auth → 401
- [x] `x-client-type: mobile` header correctly identifies mobile clients

**Test:** `__tests__/api/carrier/mobile-parity.test.ts`

---

## Cron Automation

**As the** platform,
**I want** automated jobs to maintain data integrity,
**so that** stale data is cleaned up without manual intervention.

**Acceptance Criteria:**

- [x] `POST /api/cron/expire-postings` auto-expires old truck postings and pending requests
- [x] `POST /api/cron/expire-loads` auto-expires unassigned loads
- [x] `POST /api/cron/gps-monitor` polls GPS devices and sets SIGNAL_LOST on offline trucks
- [x] All cron endpoints require `Authorization: Bearer <CRON_SECRET>` → 401 without it
- [x] Wrong `CRON_SECRET` → 401
- [x] Missing `CRON_SECRET` env var → 500 (misconfigured)
- [x] GPS monitor triggers alerts only for detected offline trucks (not when list is empty)

**Test:** `__tests__/api/cron/carrier-automation.test.ts`

---

## Key Source Files

| File                                            | What It Defines                                            |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `lib/foundation-rules.ts`                       | 7 foundation rules + enforcement helpers                   |
| `lib/tripStateMachine.ts`                       | Trip status enum, valid transitions, role permissions      |
| `lib/loadStateMachine.ts`                       | Load status enum, valid transitions, role permissions      |
| `lib/serviceFeeCalculation.ts`                  | Per-km fee calculation, corridor matching, promo discounts |
| `lib/serviceFeeManagement.ts`                   | Deduction, wallet validation, refund, corridor assignment  |
| `app/api/auth/register/route.ts`                | User registration with org and wallet creation             |
| `app/api/trucks/[id]/approve/route.ts`          | Admin truck approval/rejection                             |
| `app/api/truck-postings/route.ts`               | Truck posting creation with ONE_ACTIVE_POST enforcement    |
| `app/api/loads/route.ts`                        | Load creation (DRAFT or POSTED)                            |
| `app/api/load-requests/[id]/respond/route.ts`   | Shipper approves/rejects carrier's load request            |
| `app/api/truck-requests/[id]/respond/route.ts`  | Carrier approves/rejects shipper's truck request           |
| `app/api/match-proposals/[id]/respond/route.ts` | Carrier accepts/rejects dispatcher's match proposal        |
| `app/api/trips/[tripId]/route.ts`               | Trip status updates with state machine enforcement         |
| `app/api/trips/[tripId]/pod/route.ts`           | POD upload (carrier)                                       |
| `app/api/loads/[id]/pod/route.ts`               | POD verification (shipper) + auto-settlement trigger       |
| `prisma/schema.prisma`                          | Data model and relationships                               |
