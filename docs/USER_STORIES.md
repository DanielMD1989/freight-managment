# Business Workflow User Stories

> Living reference for the freight management platform's end-to-end business logic.
> Each story maps to testable acceptance criteria and real API behavior.
>
> **Source of truth files:** `lib/foundation-rules.ts`, `lib/tripStateMachine.ts`, `lib/loadStateMachine.ts`, `lib/serviceFeeCalculation.ts`, `lib/serviceFeeManagement.ts`

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

- [ ] `POST /api/auth/register` accepts email, password, firstName, lastName, role
- [ ] Only SHIPPER, CARRIER, and DISPATCHER roles can self-register
- [ ] Attempting to register as ADMIN or SUPER_ADMIN returns 403
- [ ] Password requires 8-128 characters with uppercase, lowercase, and numbers
- [ ] Providing `companyName` auto-creates an Organization record
- [ ] Carrier registration accepts optional `carrierType` (CARRIER_COMPANY, CARRIER_INDIVIDUAL, FLEET_OWNER) and `associationId`
- [ ] A financial wallet is auto-created (SHIPPER_WALLET or CARRIER_WALLET based on role)
- [ ] Rate limit: maximum 3 registrations per hour per IP
- [ ] New user status is set to `REGISTERED`
- [ ] Response includes `limitedAccess: true` with allowed actions: `[view_profile, upload_documents, complete_registration]`

**API:** `POST /api/auth/register` (`app/api/auth/register/route.ts`)

---

### US-1.2: Status Progression

**As a** newly registered user,
**I want** my account to progress through verification stages,
**so that** the platform can verify my identity and documents before granting full access.

**Acceptance Criteria:**

- [ ] Status progression: `REGISTERED` &rarr; `PENDING_VERIFICATION` &rarr; `ACTIVE`
- [ ] `REGISTERED`: user has signed up but not yet uploaded documents
- [ ] `PENDING_VERIFICATION`: documents uploaded, awaiting admin review
- [ ] `ACTIVE`: admin-approved, full platform access granted
- [ ] Only an ADMIN or SUPER_ADMIN can transition a user to `ACTIVE`
- [ ] Rejected users receive a `REJECTED` status with a reason

---

### US-1.3: Blocked Access Until Active

**As a** platform operator,
**I want** non-ACTIVE users to be blocked from marketplace actions,
**so that** only verified participants can create trucks, loads, or transact.

**Acceptance Criteria:**

- [ ] Users with status `REGISTERED` or `PENDING_VERIFICATION` cannot create trucks
- [ ] Users with status `REGISTERED` or `PENDING_VERIFICATION` cannot create loads
- [ ] Users with status `REGISTERED` or `PENDING_VERIFICATION` cannot post to the marketplace
- [ ] Users with status `REGISTERED` or `PENDING_VERIFICATION` cannot send or respond to requests
- [ ] API endpoints enforcing this use `requireActiveUser()` which checks `user.status === 'ACTIVE'`
- [ ] Blocked users receive a clear error message directing them to complete verification

---

## 2. Truck Lifecycle

### US-2.1: Register a Truck

**As a** carrier,
**I want to** register a truck with its details (type, license plate, capacity),
**so that** it exists as an asset in the system ready for approval.

**Acceptance Criteria:**

- [ ] `POST /api/trucks` creates a truck record owned by the carrier's organization
- [ ] Required fields: truckType, licensePlate, capacity
- [ ] Truck is created with `approvalStatus: 'PENDING'`
- [ ] Only users with CARRIER role can create trucks
- [ ] Truck `carrierId` is set to the user's organizationId and is immutable (RULE: CARRIER_OWNS_TRUCKS)
- [ ] Response wraps the truck: `{ truck: {...} }`

**API:** `POST /api/trucks` (`app/api/trucks/route.ts`)

---

### US-2.2: Admin Approves or Rejects Truck

**As an** admin,
**I want to** review and approve or reject a carrier's truck,
**so that** only verified vehicles operate on the platform.

**Acceptance Criteria:**

- [ ] `POST /api/trucks/[id]/approve` with `{ action: 'APPROVE' }` sets `approvalStatus: 'APPROVED'`
- [ ] `POST /api/trucks/[id]/approve` with `{ action: 'REJECT', reason: '...' }` sets `approvalStatus: 'REJECTED'` and stores rejection reason
- [ ] Rejection reason is required (max 500 chars) when action is REJECT
- [ ] Only ADMIN or SUPER_ADMIN can approve/reject
- [ ] Approval records `approvedAt` timestamp and `approvedById`
- [ ] Carrier is notified on approval: "Your truck [licensePlate] has been approved"
- [ ] Carrier is notified on rejection with the reason and guidance to resubmit
- [ ] Cache is invalidated after status change

**API:** `POST /api/trucks/[id]/approve` (`app/api/trucks/[id]/approve/route.ts`)

---

### US-2.3: Resubmit After Rejection

**As a** carrier whose truck was rejected,
**I want to** update my truck details and resubmit for approval,
**so that** I can address the issues and get my truck approved.

**Acceptance Criteria:**

- [ ] Carrier can update truck details via `PATCH /api/trucks/[id]`
- [ ] Updating a rejected truck resets `approvalStatus` back to `PENDING`
- [ ] Previous rejection reason remains accessible for reference
- [ ] Admin can re-review the updated truck

---

### US-2.4: Post Approved Truck to Marketplace

**As a** carrier with an approved truck,
**I want to** post my truck to the marketplace with availability and location details,
**so that** shippers and dispatchers can find it for load matching.

**Acceptance Criteria:**

- [ ] `POST /api/truck-postings` creates a marketplace listing for an approved truck
- [ ] Truck must have `approvalStatus: 'APPROVED'` to be posted
- [ ] Posting requires: truckId, originCityId, availableFrom, contactName, contactPhone
- [ ] Optional: destinationCityId, availableTo, fullPartial, notes, expiresAt
- [ ] Posting is created with status `ACTIVE` (visible on marketplace)
- [ ] **ONE_ACTIVE_POST_PER_TRUCK**: if truck already has an ACTIVE posting, returns 409 Conflict
- [ ] Location data (origin/destination city) lives only in the posting, not in the truck master record (RULE: LOCATION_IN_DYNAMIC_TABLES)
- [ ] Rate limit: 100 postings per day per carrier organization
- [ ] CSRF protection required

**API:** `POST /api/truck-postings` (`app/api/truck-postings/route.ts`)

---

### US-2.5: One Active Post Per Truck

**As a** platform operator,
**I want to** enforce that each truck has at most one active marketplace listing,
**so that** there is no double-booking or marketplace confusion.

**Acceptance Criteria:**

- [ ] Creating a posting when an ACTIVE posting already exists for that truck returns 409
- [ ] Error response includes the existing active posting ID
- [ ] Carrier must expire or cancel the existing posting before creating a new one
- [ ] This is enforced in `lib/foundation-rules.ts` as `RULE_ONE_ACTIVE_POST_PER_TRUCK`

**Foundation Rule:** `ONE_ACTIVE_POST_PER_TRUCK` (`lib/foundation-rules.ts`)

---

## 3. Load Lifecycle

### US-3.1: Create a Load

**As a** shipper,
**I want to** create a load with cargo details, pickup/delivery information,
**so that** I can describe what needs to be transported.

**Acceptance Criteria:**

- [ ] `POST /api/loads` creates a load owned by the shipper's organization
- [ ] Required fields: pickupCity, pickupDate, deliveryCity, deliveryDate, truckType, weight, cargoDescription
- [ ] Optional fields: addresses, coordinates, volume, insurance details, special instructions
- [ ] Load can be created as `DRAFT` (private) or `POSTED` (marketplace-visible)
- [ ] If status is `POSTED`, `postedAt` timestamp is set and a load event is created
- [ ] If status is `DRAFT`, no marketplace visibility
- [ ] Response wraps the load: `{ load: {...} }`
- [ ] All text fields are sanitized before storage
- [ ] Shipper contact info is stored but never exposed in public list endpoints

**API:** `POST /api/loads` (`app/api/loads/route.ts`)

---

### US-3.2: Post Load to Marketplace

**As a** shipper,
**I want to** post my draft load to the marketplace,
**so that** carriers can discover and request it.

**Acceptance Criteria:**

- [ ] Load status transitions from `DRAFT` to `POSTED`
- [ ] Only the shipper who owns the load can post it
- [ ] `postedAt` timestamp is recorded
- [ ] Push notification sent to carriers: "New [truckType] load available: [pickup] &rarr; [delivery]"
- [ ] Marketplace caches are invalidated
- [ ] Only `POSTED` loads are visible to carriers browsing the marketplace

**Load Status Machine:** `lib/loadStateMachine.ts`

---

### US-3.3: Marketplace Visibility Rules

**As a** carrier browsing loads,
**I want to** see only loads that are available for transport,
**so that** I don't waste time on unavailable loads.

**Acceptance Criteria:**

- [ ] Only loads with status `POSTED`, `SEARCHING`, or `OFFERED` are visible on the marketplace
- [ ] `DRAFT` loads are visible only to the owning shipper
- [ ] `ASSIGNED` and later statuses are no longer visible on the marketplace
- [ ] Shippers always see only their own loads (scoped by organizationId)
- [ ] `CANCELLED` and `EXPIRED` loads are not shown in default marketplace views

---

### US-3.4: Load Status Machine

**As a** platform developer,
**I want** load status transitions to follow a strict state machine,
**so that** invalid state changes are prevented.

**Acceptance Criteria:**

- [ ] Valid statuses: DRAFT, POSTED, SEARCHING, OFFERED, ASSIGNED, PICKUP_PENDING, IN_TRANSIT, DELIVERED, COMPLETED, EXCEPTION, CANCELLED, EXPIRED, UNPOSTED
- [ ] DRAFT &rarr; [POSTED, CANCELLED]
- [ ] POSTED &rarr; [SEARCHING, OFFERED, ASSIGNED, UNPOSTED, CANCELLED, EXPIRED]
- [ ] ASSIGNED &rarr; [PICKUP_PENDING, IN_TRANSIT, EXCEPTION, CANCELLED]
- [ ] IN_TRANSIT &rarr; [DELIVERED, EXCEPTION] (cannot cancel IN_TRANSIT directly)
- [ ] DELIVERED &rarr; [COMPLETED, EXCEPTION]
- [ ] COMPLETED &rarr; [EXCEPTION] (only for dispute resolution)
- [ ] CANCELLED, EXPIRED are terminal states (no outbound transitions except EXPIRED &rarr; POSTED)
- [ ] Invalid transitions return 400 with allowed next states
- [ ] Role permissions: Shipper can set [DRAFT, POSTED, CANCELLED, UNPOSTED]; Carrier can set [ASSIGNED, PICKUP_PENDING, IN_TRANSIT, DELIVERED]; Dispatcher can set [SEARCHING, OFFERED, ASSIGNED, PICKUP_PENDING, EXCEPTION]

**Source of truth:** `lib/loadStateMachine.ts`

---

## 4. Marketplace & Matching

### US-4.1: Carrier Requests Shipper's Load

**As a** carrier,
**I want to** browse available loads and send a request to transport one,
**so that** the shipper can review and approve my truck for the job.

**Acceptance Criteria:**

- [ ] Carrier browses loads on the marketplace (only POSTED/SEARCHING/OFFERED loads visible)
- [ ] Carrier sends a load request via `POST /api/load-requests` specifying loadId and truckId
- [ ] Load request is created with status `PENDING` and an expiration time
- [ ] Shipper is notified of the incoming request
- [ ] Shipper reviews and responds via `POST /api/load-requests/[id]/respond`
- [ ] Shipper can `APPROVE` or `REJECT` the request

**API:** `POST /api/load-requests`, `POST /api/load-requests/[id]/respond` (`app/api/load-requests/[id]/respond/route.ts`)

---

### US-4.2: Shipper Requests Carrier's Truck

**As a** shipper,
**I want to** browse available truck postings and request a specific truck for my load,
**so that** I can proactively find transport for my cargo.

**Acceptance Criteria:**

- [ ] Shipper browses `/api/truck-postings` (NOT `/api/trucks` &mdash; see RULE: SHIPPER_DEMAND_FOCUS)
- [ ] Shipper sends a truck request via `POST /api/truck-requests` specifying truckPostingId and loadId
- [ ] Truck request is created with status `PENDING` and an expiration time
- [ ] Carrier is notified of the incoming request
- [ ] **CARRIER_FINAL_AUTHORITY**: only the carrier who owns the truck can approve or reject
- [ ] Carrier responds via `POST /api/truck-requests/[id]/respond` with APPROVE or REJECT

**API:** `POST /api/truck-requests`, `POST /api/truck-requests/[id]/respond` (`app/api/truck-requests/[id]/respond/route.ts`)

**Foundation Rule:** `CARRIER_FINAL_AUTHORITY` (`lib/foundation-rules.ts`)

---

### US-4.3: Dispatcher Proposes a Match

**As a** dispatcher,
**I want to** propose a match between a load and a truck posting,
**so that** I can coordinate logistics without directly assigning loads.

**Acceptance Criteria:**

- [ ] Dispatcher can view all POSTED loads and all ACTIVE truck postings
- [ ] Dispatcher creates a match proposal via `POST /api/match-proposals` specifying loadId and truckId
- [ ] Proposal is created with status `PENDING`
- [ ] **CARRIER_FINAL_AUTHORITY**: only the carrier who owns the truck can accept or reject the proposal
- [ ] Carrier responds via `POST /api/match-proposals/[id]/respond` with ACCEPT or REJECT
- [ ] Dispatcher CANNOT directly assign loads (RULE: DISPATCHER_COORDINATION_ONLY)
- [ ] Wallet balances are validated before acceptance (validation only, no deduction)

**API:** `POST /api/match-proposals`, `POST /api/match-proposals/[id]/respond` (`app/api/match-proposals/[id]/respond/route.ts`)

**Foundation Rule:** `DISPATCHER_COORDINATION_ONLY` (`lib/foundation-rules.ts`)

---

### US-4.4: First-Accept-Wins (Atomic Approval)

**As a** platform operator,
**I want** the first approval to win when multiple requests/proposals compete for the same load,
**so that** there are no double-assignments or race conditions.

**Acceptance Criteria:**

- [ ] When a load request, truck request, or match proposal is approved, all other PENDING requests/proposals for the same load are atomically cancelled
- [ ] This includes cancellation of: other load requests, truck requests, AND match proposals for the load
- [ ] All operations (assignment, trip creation, competing request cancellation) happen in a single database transaction
- [ ] If the load was already assigned (race condition), approval returns 409 Conflict
- [ ] If the truck is already busy on an active load, approval returns 400 or 409
- [ ] Fresh load status is re-fetched inside the transaction to prevent stale reads

---

### US-4.5: Marketplace Cleanup on Match

**As a** platform operator,
**I want** the marketplace to reflect accurate availability after a match,
**so that** other users don't interact with already-matched resources.

**Acceptance Criteria:**

- [ ] On approval: truck posting status changes from `ACTIVE` to `MATCHED` (hidden from marketplace) _(load-requests and truck-requests respond routes; match-proposals respond route does not currently update postings)_
- [ ] On approval: truck `isAvailable` is set to `false` _(load-requests and truck-requests respond routes only)_
- [ ] On approval: load status changes to `ASSIGNED`
- [ ] Cache invalidation runs for both load and truck after transaction commits
- [ ] A Trip record is created atomically with the assignment (status: `ASSIGNED`)
- [ ] GPS tracking is enabled for the truck if it has a verified IMEI
- [ ] Notifications sent to relevant parties (carrier on load request approval, shipper on truck request approval)

---

## 5. Trip Lifecycle

### US-5.1: Trip State Machine

**As a** carrier,
**I want to** progress my trip through well-defined statuses,
**so that** all parties can track the transport lifecycle.

**Acceptance Criteria:**

- [ ] Valid trip statuses: ASSIGNED, PICKUP_PENDING, IN_TRANSIT, DELIVERED, COMPLETED, CANCELLED
- [ ] Valid transitions:
  - ASSIGNED &rarr; [PICKUP_PENDING, CANCELLED]
  - PICKUP_PENDING &rarr; [IN_TRANSIT, CANCELLED]
  - IN_TRANSIT &rarr; [DELIVERED, CANCELLED]
  - DELIVERED &rarr; [COMPLETED, CANCELLED]
  - COMPLETED &rarr; [] (terminal)
  - CANCELLED &rarr; [] (terminal)
- [ ] Invalid transitions return 400 with the list of valid next states
- [ ] Trip status is updated via `PATCH /api/trips/[tripId]`
- [ ] Trip status is synced to the corresponding load status in the same transaction

**API:** `PATCH /api/trips/[tripId]` (`app/api/trips/[tripId]/route.ts`)

**Source of truth:** `lib/tripStateMachine.ts`

---

### US-5.2: Trip Status Role Permissions

**As a** platform operator,
**I want** only authorized roles to trigger specific trip transitions,
**so that** the workflow integrity is maintained.

**Acceptance Criteria:**

- [ ] CARRIER can set: PICKUP_PENDING, IN_TRANSIT, DELIVERED
- [ ] DISPATCHER can set: ASSIGNED, CANCELLED
- [ ] ADMIN / SUPER_ADMIN can set any status (exception handling)
- [ ] Only the carrier who owns the trip can update it (carrier's orgId must match trip.carrierId)
- [ ] Non-owners receive 404 (not 403) to avoid information leakage (cross-org isolation)

---

### US-5.3: Timestamps at Each Transition

**As a** platform operator,
**I want** timestamps recorded at each status transition,
**so that** there is a complete audit trail.

**Acceptance Criteria:**

- [ ] PICKUP_PENDING sets `startedAt`
- [ ] IN_TRANSIT sets `pickedUpAt`
- [ ] DELIVERED sets `deliveredAt` (also accepts receiverName, receiverPhone, deliveryNotes)
- [ ] COMPLETED sets `completedAt` and disables GPS tracking
- [ ] CANCELLED sets `cancelledAt` and disables GPS tracking
- [ ] A LoadEvent is created for every trip status change with previous and new status in metadata

---

### US-5.4: Cancellation

**As a** carrier or admin,
**I want to** cancel a trip from any non-terminal state,
**so that** unexpected situations can be handled.

**Acceptance Criteria:**

- [ ] CANCELLED is a valid transition from ASSIGNED, PICKUP_PENDING, IN_TRANSIT, and DELIVERED
- [ ] CANCELLED is a terminal state (no further transitions)
- [ ] Cancelling restores truck availability: `isAvailable = true`
- [ ] Cancelling reactivates the truck posting: `MATCHED` &rarr; `ACTIVE`
- [ ] Load status is synced to CANCELLED
- [ ] If service fees were previously deducted, shipper receives a refund (see US-7.5)

---

### US-5.5: Cross-Org Trip Isolation

**As a** platform operator,
**I want** trips to be invisible to non-participating organizations,
**so that** business data remains private.

**Acceptance Criteria:**

- [ ] A carrier requesting a trip they don't own receives 404 (not 403)
- [ ] Shippers can only see trips for their own loads
- [ ] Dispatchers and admins have broader visibility based on their role
- [ ] Access is checked using `getAccessRoles()` utility with org-level matching

---

## 6. Proof of Delivery

### US-6.1: Carrier Uploads POD

**As a** carrier,
**I want to** upload proof of delivery (photo or document) after delivering the load,
**so that** the shipper can verify the delivery.

**Acceptance Criteria:**

- [ ] `POST /api/trips/[tripId]/pod` accepts file upload
- [ ] Trip must be in `DELIVERED` status before POD can be uploaded
- [ ] Accepted file types: JPEG, PNG, PDF
- [ ] Maximum file size: 10MB
- [ ] Only carrier or admin can upload
- [ ] POD record is created in the TripPod table (supports multiple PODs per trip)
- [ ] Load is updated: `podSubmitted = true`
- [ ] A LoadEvent is created with eventType `POD_SUBMITTED`

**API:** `POST /api/trips/[tripId]/pod` (`app/api/trips/[tripId]/pod/route.ts`)

---

### US-6.2: Shipper Verifies POD

**As a** shipper,
**I want to** review and verify the proof of delivery,
**so that** I can confirm the cargo was delivered correctly.

**Acceptance Criteria:**

- [ ] `PUT /api/loads/[id]/pod` with verification action
- [ ] Only the **shipper** who owns the load (or admin) can verify — carriers cannot verify their own deliveries
- [ ] Load must have `podSubmitted = true` before verification is allowed
- [ ] Cannot verify if already verified
- [ ] Sets `podVerified = true` and records `podVerifiedAt` timestamp
- [ ] A LoadEvent is created with eventType `POD_VERIFIED`

**API:** `PUT /api/loads/[id]/pod` (`app/api/loads/[id]/pod/route.ts`)

---

### US-6.3: COMPLETED Blocked Until POD Verified

**As a** platform operator,
**I want** trip completion to be gated on POD submission and verification,
**so that** financial settlement only occurs after confirmed delivery.

**Acceptance Criteria:**

- [ ] Attempting to set trip status to `COMPLETED` without `podSubmitted = true` returns 400 with `requiresPod: true`
- [ ] Attempting to set trip status to `COMPLETED` without `podVerified = true` returns 400 with `awaitingVerification: true`
- [ ] Only after both conditions are met can the carrier mark the trip as COMPLETED
- [ ] POD verification automatically triggers service fee deduction (see US-7.3)

---

## 7. Financial Settlement

### US-7.1: Service Fee Calculation

**As a** platform operator,
**I want** service fees calculated based on corridor pricing,
**so that** both shipper and carrier are charged according to the route.

**Acceptance Criteria:**

- [ ] Fees are calculated per-km using corridor-specific pricing
- [ ] Dual-party fees: shipper pays `shipperPricePerKm * distanceKm`, carrier pays `carrierPricePerKm * distanceKm`
- [ ] Promo discounts can reduce fees: `discount = baseFee * promoDiscountPct / 100`
- [ ] Corridor matching: exact match first, then bidirectional match, then null (no corridor)
- [ ] Distance priority: `actualTripKm` (GPS) > `estimatedTripKm` > `tripKm` (legacy) > `corridor.distanceKm` (fallback)
- [ ] All calculations use Decimal.js for precision, rounded to 2 decimal places
- [ ] Total platform fee = shipper final fee + carrier final fee

**Source of truth:** `lib/serviceFeeCalculation.ts`

---

### US-7.2: Wallet Balance Validation Before Assignment

**As a** platform operator,
**I want** wallet balances validated before a load is assigned,
**so that** both parties can cover the service fees.

**Acceptance Criteria:**

- [ ] `validateWalletBalancesForTrip(loadId, carrierId)` is called during match proposal acceptance
- [ ] Checks shipper wallet has sufficient balance for shipper fee
- [ ] Checks carrier wallet has sufficient balance for carrier fee
- [ ] If either balance is insufficient, returns 400 with details of required vs. available amounts
- [ ] This is validation only &mdash; no money is moved at this stage
- [ ] If no corridor matches the route, fees are zero and validation passes

**Source of truth:** `lib/serviceFeeManagement.ts`

---

### US-7.3: Fee Deduction on Completion

**As a** platform operator,
**I want** service fees deducted from wallets when a trip is completed,
**so that** the platform earns revenue only after confirmed delivery.

**Acceptance Criteria:**

- [ ] `deductServiceFee(loadId)` is triggered after POD verification
- [ ] Deduction happens on COMPLETED status (not at assignment)
- [ ] Shipper wallet is debited by shipper fee amount
- [ ] Carrier wallet is debited by carrier fee amount
- [ ] Platform revenue account is credited by total deducted amount
- [ ] All operations (journal entry, balance updates, load updates) are in a single database transaction
- [ ] Balance is re-verified inside the transaction to prevent race conditions
- [ ] Load records updated: `shipperFeeStatus = 'DEDUCTED'`, `carrierFeeStatus = 'DEDUCTED'`
- [ ] Journal entry created with `transactionType: 'SERVICE_FEE_DEDUCT'` for audit trail
- [ ] Notifications sent to both shipper and carrier about fee amounts

**Source of truth:** `lib/serviceFeeManagement.ts`

---

### US-7.4: Double-Deduction Prevention

**As a** platform operator,
**I want** the system to prevent fees from being deducted twice,
**so that** users are not overcharged.

**Acceptance Criteria:**

- [ ] If `shipperFeeStatus === 'DEDUCTED'` AND `carrierFeeStatus === 'DEDUCTED'`, deduction returns early with error "Service fees already deducted"
- [ ] Idempotent: calling `deductServiceFee` again on a fully-deducted load is a no-op
- [ ] Balance re-verification inside the transaction prevents concurrent deduction attempts

---

### US-7.5: Refund on Cancellation

**As a** shipper whose trip was cancelled,
**I want** my service fee refunded,
**so that** I am not charged for a trip that did not complete.

**Acceptance Criteria:**

- [ ] `refundServiceFee(loadId)` is called when a load/trip is cancelled
- [ ] Only the shipper's fee is refunded (carrier fee is only deducted on completion, so nothing to refund)
- [ ] Platform revenue account is debited by the refund amount
- [ ] Shipper wallet is credited by the refund amount
- [ ] All operations are in a single database transaction
- [ ] Platform balance is verified before refund (must have sufficient balance)
- [ ] Load is updated: `shipperFeeStatus = 'REFUNDED'`, `serviceFeeRefundedAt` set
- [ ] Journal entry created with `transactionType: 'SERVICE_FEE_REFUND'`
- [ ] If fee was zero, status is still marked as REFUNDED (no money moves)

**Source of truth:** `lib/serviceFeeManagement.ts`

---

### US-7.6: No Corridor Means Fees Waived

**As a** platform operator,
**I want** fees to be waived when no corridor matches the route,
**so that** trips on unpriced routes can still proceed.

**Acceptance Criteria:**

- [ ] If `findMatchingCorridor()` returns null, both fees are set to 0
- [ ] Load is updated: `shipperFeeStatus = 'WAIVED'`, `carrierFeeStatus = 'WAIVED'`
- [ ] No wallet deductions occur
- [ ] No journal entry is created (nothing to record)
- [ ] Trip completion proceeds normally despite waived fees

---

### US-7.7: Journal Entries for Audit Trail

**As an** auditor,
**I want** every financial transaction recorded as a journal entry,
**so that** there is a complete ledger for reconciliation.

**Acceptance Criteria:**

- [ ] Service fee deductions create a journal entry with type `SERVICE_FEE_DEDUCT`
- [ ] Refunds create a journal entry with type `SERVICE_FEE_REFUND`
- [ ] Each journal entry has line items: debit lines (wallet decrements) and credit lines (wallet/platform increments)
- [ ] Journal entry metadata includes: fee amounts, corridor ID, distance, price per km, distance source
- [ ] Journal entry references the loadId for traceability
- [ ] All journal operations are atomic with balance updates (same transaction)

---

## 8. Post-Delivery & Marketplace Return

### US-8.1: Truck Availability Restored

**As a** carrier,
**I want** my truck to become available again after a trip is completed or cancelled,
**so that** it can accept new jobs.

**Acceptance Criteria:**

- [ ] On trip COMPLETED: `truck.isAvailable` set to `true` (truck returns to marketplace for next job)
- [ ] On trip CANCELLED: `truck.isAvailable` set to `true` (truck returns to marketplace for next job)
- [ ] Both happen inside the trip update transaction (atomic with status change)

---

### US-8.2: Truck Posting Reactivated

**As a** carrier,
**I want** my truck's marketplace posting reactivated after a trip ends,
**so that** I don't need to manually re-list it.

**Acceptance Criteria:**

- [ ] On trip COMPLETED or CANCELLED: truck postings with status `MATCHED` are set back to `ACTIVE` (automatic re-listing)
- [ ] The posting's `updatedAt` timestamp is refreshed
- [ ] The truck becomes visible on the marketplace again immediately — no manual re-listing required
- [ ] This is atomic with the trip status change (same transaction)

---

### US-8.3: Trip History Accessible

**As a** carrier or shipper,
**I want to** view my completed trip history,
**so that** I can reference past deliveries.

**Acceptance Criteria:**

- [ ] `GET /api/trips` returns trips filtered by user's organization
- [ ] Completed and cancelled trips remain queryable
- [ ] Trip includes load details, route history, timestamps, and POD references
- [ ] Cross-org isolation: users only see trips where their organization is the shipper or carrier

---

## 9. Admin & Super Admin

### US-9.1: Approve/Reject User Registrations

**As an** admin,
**I want to** review and approve or reject user registrations,
**so that** only legitimate participants access the platform.

**Acceptance Criteria:**

- [ ] Admin can view all users with status `PENDING_VERIFICATION`
- [ ] Admin can set user status to `ACTIVE` (approved) or `REJECTED` (with reason)
- [ ] Only ADMIN or SUPER_ADMIN roles can perform this action
- [ ] Approved users gain full platform access
- [ ] Rejected users are notified with the rejection reason

---

### US-9.2: Approve/Reject Trucks

**As an** admin,
**I want to** review and approve or reject truck registrations,
**so that** only verified vehicles operate on the platform.

**Acceptance Criteria:**

- [ ] See US-2.2 for full acceptance criteria
- [ ] Admin dashboard shows all trucks with `approvalStatus: 'PENDING'`
- [ ] Approved trucks can be posted to the marketplace
- [ ] Rejected trucks cannot be posted until issues are resolved and re-approved

---

### US-9.3: Monitor Platform Operations

**As an** admin,
**I want to** monitor all trips, loads, and organizations,
**so that** I can ensure platform health and resolve disputes.

**Acceptance Criteria:**

- [ ] Admin can view all trips regardless of organization
- [ ] Admin can view all loads regardless of organization
- [ ] Admin can view all organizations and their statuses
- [ ] Admin can set any trip status (exception handling override)
- [ ] Admin can set any load status (exception handling override)

---

### US-9.4: Manage Corridors and Pricing

**As an** admin,
**I want to** manage route corridors and per-km pricing,
**so that** service fees are correctly calculated for each route.

**Acceptance Criteria:**

- [ ] Admin can create corridors with origin/destination regions, distance, and pricing
- [ ] Each corridor has separate shipper and carrier per-km rates
- [ ] Corridors support direction types: ONE_WAY, ROUND_TRIP, BIDIRECTIONAL
- [ ] Promotional discounts can be configured per party (flag + percentage)
- [ ] Corridors can be activated or deactivated (`isActive` flag)
- [ ] Fee preview calculations available for corridor management UI

---

### US-9.5: View Platform Analytics and Revenue

**As an** admin,
**I want to** view platform analytics and revenue,
**so that** I can track business performance.

**Acceptance Criteria:**

- [ ] Platform revenue account tracks cumulative service fees collected
- [ ] Journal entries provide a complete financial audit trail
- [ ] Dashboard shows trip counts, completion rates, and active users
- [ ] Revenue breakdown available by corridor and time period

---

### US-9.6: Process Withdrawals

**As an** admin,
**I want to** process withdrawal requests from carriers and shippers,
**so that** they can access their wallet funds.

**Acceptance Criteria:**

- [ ] Users can request withdrawals from their wallet balance
- [ ] Admin reviews and approves or rejects withdrawal requests
- [ ] Approved withdrawals deduct from user wallet and create a journal entry
- [ ] Rejected withdrawals return funds to the user's available balance

---

## 10. Foundation Rules (Cross-Cutting)

These rules are enforced globally across all API endpoints and business logic.

**Source of truth:** `lib/foundation-rules.ts`

### RULE: CARRIER_OWNS_TRUCKS

> Carrier is the sole owner of trucks. Only carrier can modify truck records.

- Truck `carrierId` is required and immutable after creation
- Only CARRIER role can create, edit, or delete trucks
- Other roles can view trucks but never modify ownership

### RULE: POSTING_IS_AVAILABILITY

> Posting expresses availability, not ownership. Location lives only in posting.

- Posting a truck does not create a truck (truck must exist first)
- Location data (current city, lat/lng) exists only in TruckPosting
- Truck master record has no location fields
- Postings are ephemeral; trucks are permanent assets

### RULE: DISPATCHER_COORDINATION_ONLY

> Dispatcher coordinates availability but cannot execute assignments.

- Dispatcher can see posted trucks and loads
- Dispatcher can propose matches
- Dispatcher CANNOT assign loads, accept requests, or start trips
- Dispatcher has `PROPOSE_MATCH` permission, not `ASSIGN_LOADS`

### RULE: ONE_ACTIVE_POST_PER_TRUCK

> Each truck can have at most one active posting at any time.

- Creating a second active posting returns 409 Conflict
- Previous active post must be expired or cancelled first
- Prevents double-booking and marketplace confusion

### RULE: LOCATION_IN_DYNAMIC_TABLES

> Location data lives only in dynamic tables (posting, GPS), never in master.

- Truck master table has no `currentCity` or `currentLocationLat` fields
- TruckPosting contains location at time of posting
- GPSUpdate contains real-time location during trips

### RULE: CARRIER_FINAL_AUTHORITY

> Carrier is the final authority on truck execution. No assignment without carrier approval.

- Shipper can request a truck, but carrier must approve
- Dispatcher can propose a match, but carrier must accept
- No load is assigned to a truck without the carrier's explicit consent
- Carrier starts and drives the trip

### RULE: SHIPPER_DEMAND_FOCUS

> Shipper manages demand (loads). Can request available trucks but cannot browse fleets.

- Shippers POST loads; they do not browse `/api/trucks`
- Shippers browse `/api/truck-postings` (availability, not fleet inventory)
- Shippers see only their own loads
- Contact info is hidden until trip reaches IN_TRANSIT status

### RULE: Cross-Org Data Isolation

> Resources are invisible (404) to non-owning organizations.

- Requesting a resource owned by another organization returns 404 (not 403)
- This prevents information leakage (attacker cannot confirm resource existence)
- Applies to: trucks, loads, trips, requests, proposals
- Enforced via `getAccessRoles()` checks in all API routes

### RULE: Contact Info Hidden Until IN_TRANSIT

> Carrier contact details are not exposed to shippers until the trip is actively in transit.

- When trip status is `ASSIGNED`, shipper sees `contactPhone: "(hidden)"`
- Route history (GPS data) is also hidden before pickup
- Once trip reaches `PICKUP_PENDING` or later, contact info is revealed

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
