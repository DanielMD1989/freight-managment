# 🚛 Freight Marketplace — Blueprint

> Canonical reference for the intended finished state of the system.
> Every CLI review round begins with: `Read freight_marketplace_blueprint.md first.`

---

## 1. Account Hierarchy & Creation

```
SuperAdmin
  └── creates → Admin
                  └── creates → Dispatcher
Shipper  ← self-registers
Carrier  ← self-registers
```

| Role       | Created By  | Key Privilege                                                                                                                                             |
| ---------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SuperAdmin | System seed | Full platform access; creates/revokes Admin accounts                                                                                                      |
| Admin      | SuperAdmin  | Creates Dispatcher accounts; approves/rejects Shipper, Carrier, Truck registrations; full financial visibility; revokes Dispatcher/Shipper/Carrier access |
| Dispatcher | Admin       | Sees all trucks and loads; proposes matches only; monitors trips; handles cancellations/rejections                                                        |
| Shipper    | Self        | Posts loads; searches trucks; sends/receives requests                                                                                                     |
| Carrier    | Self        | Registers trucks; searches loads; sends/receives requests                                                                                                 |

---

## 2. Registration Flow (Shipper & Carrier)

```
Register Account
    ↓
SMS / Email OTP Verification
    ↓
Upload Documents (identity, business, compliance)
    ↓
Awaiting Admin Approval (no marketplace access)
    ↓
  ┌─ Approved ──────────────────────────────────────┐
  │  Access granted → proceed to role-specific flow  │
  └──────────────────────────────────────────────────┘
  ┌─ Rejected ──────────────────────────────────────┐
  │  User sees rejection reason                      │
  │  → Edit & re-upload documents                    │
  │  → Loop back to Awaiting Admin Approval          │
  └──────────────────────────────────────────────────┘
```

> **Document Lock:** After approval, documents are permanently locked. No further edits
> allowed for account documents (Shipper, Carrier) or truck documents.

---

## 3. Shipper Flow

> **Wallet Check:** Before any action (searching, matching, requesting), minimum wallet
> balance is verified. Below threshold → blocked from all marketplace activity.

```
Approved Shipper
    ↓
Insert Load(s)           ← multiple active loads allowed simultaneously; each independently searchable
    ↓
Search Matching Trucks   ← load's pickup point must fall within truck's DH-O (deadhead-origin) radius
                         ← load's delivery point must fall within truck's DH-D (deadhead-destination) radius
                         ← only trucks meeting BOTH radius conditions are shown
                         ← trucks on active trips are excluded
    ↓
Send Request to Truck    ← notification delivered to Carrier
    ↓
  ┌─ Carrier Accepts ───────────────────────────────────────────────────────┐
  │  Load AND Truck removed from marketplace immediately                     │
  │  → Load State Machine (DRAFT→POSTED→SEARCHING→ASSIGNED→…→COMPLETED)     │
  │  → Trip State Machine (ASSIGNED→PICKUP_PENDING→IN_TRANSIT→DELIVERED→COMPLETED) │
  │  → After POD upload + completion: Truck returns to marketplace           │
  └─────────────────────────────────────────────────────────────────────────┘
  ┌─ Carrier Rejects ───────────────────────────────┐
  │  Shipper can request another matching truck      │
  └─────────────────────────────────────────────────┘
```

### Trip Visibility (active trip only)

- **Live GPS tracking:** Shipper can see the truck's real-time location during an active trip (status `IN_TRANSIT` only).
- **No GPS access** before the trip starts or on any other truck.
- **Route history:** After trip completion (`COMPLETED`), Shipper can view the full route from pickup to delivery.

---

## 4. Carrier Flow

> **Wallet Check:** Before any action, minimum wallet balance is verified.

```
Approved Carrier
    ↓
Register Truck(s)              ← each truck goes through its own approval flow independently
    ↓
Awaiting Truck Approval        ← Admin reviews truck registration documents
    ↓
  ┌─ Truck Approved ─────────────────────────────────────────────────────┐
  │  Post Truck to Marketplace (TruckPosting)                              │
  │    ← Carrier creates a TruckPosting per truck                          │
  │    ← DH-O (deadhead-origin) radius stored on TruckPosting             │
  │    ← DH-D (deadhead-destination) radius stored on TruckPosting        │
  │  ↓                                                                     │
  │  Search Load Marketplace                                               │
  │    ← browses loads whose pickup falls within truck DH-O radius         │
  │    ← browses loads whose delivery falls within truck DH-D radius       │
  │    ← ASSIGNED+ loads are hidden                                        │
  │  ↓                                                                     │
  │  Request a Load             ← notification sent to Shipper             │
  │  ↓                                                                     │
  │  ┌─ Shipper Accepts ──────────────────────────────────────────────┐   │
  │  │  Carrier Final Confirmation (Carrier has final say)             │   │
  │  │  ↓                                                              │   │
  │  │  Load AND Truck removed from marketplace immediately            │   │
  │  │  → Trip State Machine begins                                    │   │
  │  │  → After POD + completion: Truck returns to marketplace         │   │
  │  └────────────────────────────────────────────────────────────────┘   │
  │  ┌─ Shipper Rejects ──────────────────────────────────────────────┐   │
  │  │  Carrier can request another load                               │   │
  │  └────────────────────────────────────────────────────────────────┘   │
  └──────────────────────────────────────────────────────────────────────┘
  ┌─ Truck Rejected ────────────────────────────────┐
  │  Edit & re-upload truck docs → re-approval loop  │
  └─────────────────────────────────────────────────┘
```

> Carriers can register multiple trucks — each goes through its own independent approval flow.

---

## 5. Dispatcher Role

Platform-level operator role, created by Admin. Works under Admin authority but operates across the entire platform — **not affiliated with any specific carrier or shipper organization**.

### Full Visibility (Platform-Wide)

- Sees ALL trucks, ALL loads, ALL trips, ALL truck-postings across ALL organizations simultaneously
- GPS live tracking and route history for any active trip
- Dashboard metrics (operational — no financial/revenue data)

### Explicit Capabilities

| CAN                                     | Details                                                                                                     |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| View all loads                          | All statuses, all orgs — platform-wide                                                                      |
| View all trucks                         | All statuses, all orgs — platform-wide                                                                      |
| View all truck-postings                 | All statuses — platform-wide                                                                                |
| View all trips                          | All statuses, all orgs — platform-wide                                                                      |
| View GPS live + route history           | Any trip in IN_TRANSIT or COMPLETED                                                                         |
| Propose matches                         | Load-truck match proposals on behalf of Carrier or Shipper — notification goes to actual party for decision |
| Set trip EXCEPTION                      | Flag an active trip (IN_TRANSIT) as EXCEPTION for Admin resolution                                          |
| Set trip ASSIGNED                       | Reassign a trip back to ASSIGNED (e.g., after EXCEPTION resolution by Admin)                                |
| Cancel trips (ASSIGNED, PICKUP_PENDING) | Cancel pre-pickup trips — notifies both shipper and carrier                                                 |
| Set load EXCEPTION                      | Flag a load as EXCEPTION for Admin resolution                                                               |
| Truck reassignment on EXCEPTION         | Propose replacement truck from same carrier org (Admin approves)                                            |

| CANNOT                       | Reason                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------- |
| Accept/reject load requests  | Blueprint §5: decision belongs to Carrier/Shipper — dispatcher proposes only |
| Accept/reject truck requests | Same — carrier-only authority                                                |
| Approve match proposals      | Same — actual party decides                                                  |
| Edit load details            | Shipper-only (or Admin)                                                      |
| Delete loads                 | Shipper-only (or Admin)                                                      |
| Manage trucks (edit, delete) | Carrier-only (or Admin)                                                      |
| Resolve EXCEPTION trips      | Admin-only — dispatcher can raise but not resolve                            |
| View financial/revenue data  | Admin/SuperAdmin only — dispatcher sees `null` for revenue fields            |
| Approve/reject registrations | Admin-only                                                                   |

> **Key constraint:** Dispatcher has NO accept/reject authority. Any UI or endpoint that
> lets Dispatcher accept/reject on behalf of another party is a bug.
>
> **Authorization model:** All dispatcher endpoints use **role-only** checks (`role === "DISPATCHER"`), never org-scoped checks. Dispatcher's organization (type `LOGISTICS_AGENT`) does not match any carrier or shipper org.

---

## 6. Load State Machine

```
DRAFT → POSTED → SEARCHING / OFFERED → ASSIGNED → PICKUP_PENDING → IN_TRANSIT → DELIVERED → COMPLETED
```

| State               | Description                                            |
| ------------------- | ------------------------------------------------------ |
| DRAFT               | Load created but not yet visible on marketplace        |
| POSTED              | Load published and visible on marketplace              |
| SEARCHING / OFFERED | Active search or offer in progress                     |
| ASSIGNED            | Truck accepted; load + truck removed from marketplace  |
| PICKUP_PENDING      | Carrier has started toward pickup (mirrors Trip state) |
| IN_TRANSIT          | Cargo picked up (mirrors Trip state)                   |
| DELIVERED           | Cargo delivered; awaiting POD (mirrors Trip state)     |
| COMPLETED           | POD uploaded; service fees deducted; trip complete     |

> Purple states (ASSIGNED through COMPLETED) mirror the Trip state machine.
> Load state changes are synced from Trip state transitions.

### Cancellation Policy

#### Shipper Load Cancellation

| Load State     | Can Cancel? | Effect                                                                     |
| -------------- | ----------- | -------------------------------------------------------------------------- |
| DRAFT          | Yes         | Load deleted or set to CANCELLED — no external impact                      |
| POSTED         | Yes         | Load set to CANCELLED freely — no trip exists                              |
| SEARCHING      | Yes         | Load set to CANCELLED — pending requests voided                            |
| OFFERED        | Yes         | Load set to CANCELLED — pending requests voided                            |
| ASSIGNED       | Yes         | Load → CANCELLED, linked trip → CANCELLED, truck freed, notifications sent |
| PICKUP_PENDING | Yes         | Same as ASSIGNED — carrier notified, truck freed                           |
| IN_TRANSIT     | No          | Blocked — cargo is on the truck. Must go through EXCEPTION first           |
| DELIVERED      | No          | Blocked — cargo already delivered. Cannot cancel post-delivery             |
| COMPLETED      | No          | Terminal state — no changes allowed                                        |

> When a shipper cancels a load that has an active trip (ASSIGNED or PICKUP_PENDING), the trip cancellation must include: `loadId` nulled on trip, `trackingEnabled` set to false, `cancelledBy` set to shipper userId, truck availability restored (with `otherActiveTrips` guard), and TruckPosting reverted to ACTIVE (not EXPIRED).

#### Carrier Trip Cancellation

| Trip State     | Can Cancel?  | Route                       | Effect                                                             |
| -------------- | ------------ | --------------------------- | ------------------------------------------------------------------ |
| ASSIGNED       | Yes          | POST /api/trips/{id}/cancel | Trip → CANCELLED, load → POSTED (re-bookable), truck freed         |
| PICKUP_PENDING | Yes          | POST /api/trips/{id}/cancel | Same — carrier hasn't loaded cargo yet                             |
| IN_TRANSIT     | No           | Blocked                     | Must raise EXCEPTION first → Admin resolves to CANCELLED if needed |
| DELIVERED      | No           | Blocked                     | Cargo delivered — cancellation would cause payment disputes        |
| EXCEPTION      | No (carrier) | Blocked for carrier         | Admin-only resolution — carrier cannot self-resolve                |
| COMPLETED      | No           | N/A                         | Terminal state                                                     |

> **Audit fields:** Every cancellation records `cancelledBy` (userId), `cancelReason` (user-provided text), and `cancelledAt` (timestamp). The cancel route requires a reason (`z.string().min(1).max(500)`).

---

## 7. Trip State Machine

**Normal path:**

```
ASSIGNED → PICKUP_PENDING → IN_TRANSIT → DELIVERED → COMPLETED
```

| Transition       | Actor                                                                     | Timestamp Set |
| ---------------- | ------------------------------------------------------------------------- | ------------- |
| → PICKUP_PENDING | Carrier                                                                   | `startedAt`   |
| → IN_TRANSIT     | Carrier                                                                   | `pickedUpAt`  |
| → DELIVERED      | Carrier                                                                   | `deliveredAt` |
| → COMPLETED      | Carrier (POD upload), Shipper (delivery confirmation), or AUTO (48h cron) | `completedAt` |

### Delivery Completion Paths

Three paths can close a DELIVERED trip:

1. **Carrier uploads POD** — carrier uploads photo/document proof. Existing flow unchanged.

2. **Shipper confirms delivery** — shipper taps "Confirm Delivery" on mobile or web. No carrier POD required. Shipper's digital confirmation acts as proof of acceptance. Trip → COMPLETED immediately.

3. **Auto-close after 48 hours** — if neither carrier POD nor shipper confirmation within 48 hours of DELIVERED status, cron automatically closes trip as COMPLETED. Notifies Admin, Dispatcher, Carrier, and Shipper. settlementStatus stays PENDING if fee collection fails — Admin resolves separately. Truck is always freed.

> Carrier and shipper settle payments outside the platform. Late POD only affects platform fee calculation timing. Auto-close ensures trucks return to marketplace without Admin intervention.

**Exception path (IN_TRANSIT only):**

```
IN_TRANSIT → EXCEPTION → Admin resolves to one of:
  SEARCHING / ASSIGNED / IN_TRANSIT / CANCELLED / COMPLETED
```

- Admin-only resolution. Carrier and Dispatcher cannot resolve exceptions.

**Cancellation:**

```
Any state except IN_TRANSIT → CANCELLED   (sets cancelledAt)
IN_TRANSIT → must use EXCEPTION path first → then Admin may resolve to CANCELLED
```

- CARRIER or DISPATCHER can cancel from any state except IN_TRANSIT.
- Direct IN_TRANSIT → CANCELLED is blocked; must go through EXCEPTION first.

### Truck Reassignment (Mid-Trip)

When a truck breaks down or becomes unavailable mid-trip, the truck can be swapped without cancelling the trip.

**Who:** Admin or Dispatcher
**Prerequisites:** Trip must be in EXCEPTION status. Replacement truck must belong to the same carrier organization. Replacement truck must be available (no active trips).

**Flow:**

```
1. Carrier (or Dispatcher) raises EXCEPTION on IN_TRANSIT trip
2. Admin or Dispatcher selects replacement truck from same carrier org
3. POST /api/trips/{id}/reassign-truck
     body: { newTruckId, reason }
4. System validates: trip is EXCEPTION, new truck is same carrier, new truck is available
5. Transaction:
     a. trip.truckId → newTruckId
     b. trip.previousTruckId → old truckId (audit trail)
     c. trip.reassignedAt → now
     d. trip.reassignmentReason → reason
     e. Old truck: restore availability (if no other active trips)
     f. New truck: set isAvailable = false
     g. Load.assignedTruckId → newTruckId
     h. TruckPosting for new truck: ACTIVE → MATCHED
6. Trip status → IN_TRANSIT (resumes)
7. Notifications: shipper org, carrier org, admin audit
```

**Schema additions:**

- `Trip.previousTruckId` — String? (references Truck)
- `Trip.reassignedAt` — DateTime?
- `Trip.reassignmentReason` — String?

**Endpoint:** `POST /api/trips/{id}/reassign-truck`

---

## 8. Service Fee & Wallet System

### Fee Calculation Formula

> Triggered after trip completion + POD upload.

```
Shipper Fee = Shipper Rate/km × Total KM
Carrier Fee = Carrier Rate/km × Total KM
─────────────────────────────────────────
Revenue     = Shipper Fee + Carrier Fee
```

- Each Shipper and Carrier has their own configurable rate/km.
- Promotional prices can be injected individually per account.
- Fees are deducted from Shipper wallet and Carrier wallet separately after trip completion.

### Wallet Top-Up Methods

- Bank Transfer Slip (processed by Admin)
- Telebirr
- M-Pesa
- Future bank integrations

### Wallet Threshold Enforcement

> Before any action — searching loads, matching trucks, sending/receiving requests — the
> system checks wallet balance. If below the required minimum, the user **cannot** view,
> match, request, or be requested. All marketplace activity is blocked.

---

## 9. Admin Capabilities

| Action             | Scope                                                                   |
| ------------------ | ----------------------------------------------------------------------- |
| Approve / Reject   | Shipper registrations, Carrier registrations, Truck registrations       |
| Revoke Access      | Dispatcher, Shipper, or Carrier accounts                                |
| Full Data Access   | All loads, trucks, trips, and documents                                 |
| Financial Overview | Revenue from each Carrier & Shipper individually                        |
| Time-Based Reports | Revenue by Day / Week / Month / Year                                    |
| Match Loads        | Manually match loads and trucks                                         |
| Wallet Management  | Deposit funds via bank slip into user wallets                           |
| Exception Handling | Resolve EXCEPTION-state trips; only Admin can transition from EXCEPTION |

---

## 10. Super Admin Capabilities

| Action                  | Scope                                     |
| ----------------------- | ----------------------------------------- |
| Everything Admin Can Do | Full platform-wide visibility and control |
| Create Admin Accounts   | Onboard new Admins to the system          |
| Revoke Admin Access     | Disable or remove Admin accounts          |
| Platform-Wide Analytics | All financial, operational, and user data |

---

## 11. GPS Tracking Policy

### Two GPS Sources (Priority Order)

1. **Hardware device (ELD/telematics)** — Primary.
   Plugged into truck OBD port. Sends data via
   POST /api/gps/positions. Automatic, continuous.
2. **Mobile app GPS** — Fallback. Phase 2 implementation.
   Carrier app sends location via
   POST /api/tracking/ingest/batch.

### GPS Requirement at Truck Posting (not Approval)

- Admin approves truck documents → truck APPROVED
  (no GPS required at this stage)
- Carrier posts truck to marketplace →
  system checks GPS device exists and status is ACTIVE
- No active GPS device → posting BLOCKED:
  "Register a GPS device before posting your truck"
- Existing approvals never invalidated

### actualTripKm Calculation at Completion

- Calculated INSIDE deductServiceFee() before billing:
  - If ANY GpsPosition records exist for the trip →
    calculate Haversine sum → write to Load.actualTripKm
    → use for billing
  - If ZERO positions → actualTripKm stays null →
    fall back to corridor.distanceKm →
    Admin notified (never silent)
- Fee priority: actualTripKm (GPS) →
  corridor.distanceKm (planned) → Admin exception

### Signal Loss Mid-Trip

- Trip never blocked — operational continuity first
- Admin + Dispatcher notified when truck on active
  trip goes SIGNAL_LOST
- At completion with no GPS data → corridor fallback
  - Admin alert

---

## 12. Ratings & Reviews

### Trigger

After a trip reaches DELIVERED status, both parties are prompted to rate each other:

- **Shipper rates Carrier** (how was the transport service?)
- **Carrier rates Shipper** (how was the load accuracy, communication, loading dock?)

### Rating Model

| Field     | Type     | Details                               |
| --------- | -------- | ------------------------------------- |
| id        | String   | Unique rating ID                      |
| tripId    | String   | FK to Trip (one rating pair per trip) |
| raterId   | String   | FK to User who submitted the rating   |
| ratedId   | String   | FK to User being rated                |
| raterRole | Enum     | SHIPPER or CARRIER                    |
| stars     | Int      | 1–5 (single overall score)            |
| comment   | String?  | Optional text, max 300 characters     |
| createdAt | DateTime | Timestamp of submission               |

- One rating per direction per trip (shipper→carrier and carrier→shipper)
- Ratings are immutable after submission (no edits)
- Both parties can rate independently (no requirement for both to rate)

### Computed Fields

- `Organization.averageRating` — computed from all ratings where `ratedId` belongs to that org
- `Organization.totalRatings` — count of ratings received
- Displayed on company profiles and in matching/request results

### Visibility

- Shipper sees carrier's average rating when viewing match proposals, truck postings, and load requests
- Carrier sees shipper's average rating when viewing posted loads and truck requests
- Dispatcher sees both ratings when proposing matches
- Ratings are public within the platform (all authenticated users)

### UI Flow

1. Trip reaches DELIVERED → rating prompt appears on trip detail page (web) and push notification (mobile)
2. User selects 1–5 stars
3. Optionally adds comment (max 300 chars)
4. Submit → saved to database
5. Average rating recalculated
6. Rating displayed on profile pages, proposal/request cards, and matching results

### Platforms

Web + Mobile (both shipper and carrier apps)

---

## 13. In-App Messaging

### Scope

One conversation thread per trip. Only the Shipper and the assigned Carrier for that trip can participate.

### Message Model

| Field         | Type      | Details                                  |
| ------------- | --------- | ---------------------------------------- |
| id            | String    | Unique message ID                        |
| tripId        | String    | FK to Trip (conversation scoped to trip) |
| senderId      | String    | FK to User who sent the message          |
| senderRole    | Enum      | SHIPPER or CARRIER                       |
| content       | String    | Text content (max 2000 chars)            |
| attachmentUrl | String?   | Image/file attachment URL (nullable)     |
| createdAt     | DateTime  | Timestamp of message                     |
| readAt        | DateTime? | When the other party read the message    |

### Rules

- Chat becomes **active** when trip is created (ASSIGNED) and stays active through DELIVERED
- Chat becomes **read-only** after trip reaches COMPLETED or CANCELLED — both parties can still view history but cannot send new messages
- Messages are permanent (no delete) — useful for dispute evidence
- Unread message count tracked per user per trip for notification badges

### Notifications

- Push notification sent when new message received (if recipient has push enabled)
- Unread badge shown on trip card in loadboard/trip list
- Notification type: `NEW_MESSAGE`

### Content Types

- Text messages (required, 1–2000 chars)
- Image attachments (optional, same upload rules as documents: JPG/PNG, max 10MB)
- No video, no voice — text + images only

### Access Control

- Only the shipper who owns the load and the carrier who owns the assigned truck can read/write messages for that trip
- Admin can view messages (read-only) for dispute resolution
- Dispatcher has no message access

### UI Flow

1. Access chat from trip detail page (button: "Messages" or chat icon with unread count)
2. Message list: newest at bottom, scroll up for history
3. Text input at bottom + attachment button (camera/gallery picker on mobile)
4. Real-time display (polling or WebSocket — polling for MVP)
5. After trip completed → "This conversation is now read-only" banner at top, input disabled

### Platforms

Web + Mobile (both shipper and carrier apps)

---

## 14. Settings, Help & Support

### Universal Settings (All Roles)

Accessible via profile menu (header dropdown) at `/settings/*`:

| Page           | Route                     | Content                                                        |
| -------------- | ------------------------- | -------------------------------------------------------------- |
| Profile        | `/settings/profile`       | Edit name, phone. View email, role, status, org info.          |
| Security       | `/settings/security`      | Change password, MFA setup/disable, active sessions, audit log |
| Notifications  | `/settings/notifications` | Toggle per-type notification preferences                       |
| Help & Support | `/settings/support`       | Help documentation, contact info, report issue form            |

### Role-Specific Settings

| Role            | Route              | Content                                                                          |
| --------------- | ------------------ | -------------------------------------------------------------------------------- |
| Carrier/Shipper | `/{role}/settings` | Company profile (name, description, contact, license, tax)                       |
| Admin           | `/admin/settings`  | System config: rate limits, matching thresholds, email toggles, maintenance mode |
| Dispatcher      | `/settings/*`      | Uses universal settings (no role-specific settings page)                         |

### Help Documentation Topics

| Topic                  | Content                                                         |
| ---------------------- | --------------------------------------------------------------- |
| Getting Started        | Account setup, document upload, verification process            |
| Posting Loads          | Load creation, status tabs, matching, requesting trucks         |
| GPS Tracking           | Device setup, IMEI registration, live tracking, signal loss     |
| Payments & Settlements | Wallet top-up, service fees, corridor rates, settlement process |

### Support & Reporting

- Contact: email (support@freightet.com) + phone (+251 911 123 456)
- Report types: BUG, MISCONDUCT, FEEDBACK, OTHER
- Reports generate reference ID (SR-{timestamp})
- Admin notified of new reports
- User can view status of submitted reports

### Mobile Settings

Mobile apps mirror web settings with platform-appropriate UI:

- Company profile edit (carrier + shipper)
- Security: change password, MFA, session management
- Notification preferences toggle
- Language and theme selection
- Help/support with contact info and report form

---

_Blueprint version: 1.6 — Added: Ratings & Reviews (§12), In-App Messaging (§13), Settings & Help documentation (§14). Fixes: truck type single source of truth, wallet gates on match-proposals, hardcoded distance table replaced with Haversine, insurance enforcement at assignment, required document enforcement at truck approval, load insurance UI, batch match counts, rejection cascade notifications, truck document checklist, post-approval edit guard, mobile parity (insurance fields, IMEI, phone validation)._

---
