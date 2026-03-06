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
Search Matching Trucks   ← system matches by origin & destination; filters out trucks on active trips
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
  │  Search Load Marketplace                                               │
  │    ← browses loads matching truck origin & destination                 │
  │    ← Carrier sets DH-O (deadhead origin) radius per truck             │
  │    ← Carrier sets DH-D (deadhead destination) radius per truck        │
  │    ← loads within those radii are shown; ASSIGNED+ loads hidden       │
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

| Capability           | Details                                                                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full Visibility      | Sees ALL trucks and ALL shipper loads across the platform simultaneously                                                                                                         |
| Propose Matches Only | Proposes load-truck matches on behalf of Carrier or Shipper — **cannot** accept or reject on their behalf. Notification goes to actual Carrier/Shipper; decision belongs to them |
| Monitor All Trips    | Tracks every active trip; if accepted but not started, can contact carrier/shipper                                                                                               |
| Handle Cancellations | Monitors trips cancelled or rejected multiple times; facilitates intervention                                                                                                    |

> **Key constraint:** Dispatcher has NO accept/reject authority. Any UI or endpoint that
> lets Dispatcher accept/reject on behalf of another party is a bug.

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

---

## 7. Trip State Machine

**Normal path:**

```
ASSIGNED → PICKUP_PENDING → IN_TRANSIT → DELIVERED → COMPLETED
```

| Transition       | Actor                | Timestamp Set |
| ---------------- | -------------------- | ------------- |
| → PICKUP_PENDING | Carrier              | `startedAt`   |
| → IN_TRANSIT     | Carrier              | `pickedUpAt`  |
| → DELIVERED      | Carrier              | `deliveredAt` |
| → COMPLETED      | Carrier + POD upload | `completedAt` |

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

| Action             | Scope                                                             |
| ------------------ | ----------------------------------------------------------------- |
| Approve / Reject   | Shipper registrations, Carrier registrations, Truck registrations |
| Revoke Access      | Dispatcher, Shipper, or Carrier accounts                          |
| Full Data Access   | All loads, trucks, trips, and documents                           |
| Financial Overview | Revenue from each Carrier & Shipper individually                  |
| Time-Based Reports | Revenue by Day / Week / Month / Year                              |
| Match Loads        | Manually match loads and trucks                                   |
| Wallet Management  | Deposit funds via bank slip into user wallets                     |

---

## 10. Super Admin Capabilities

| Action                  | Scope                                     |
| ----------------------- | ----------------------------------------- |
| Everything Admin Can Do | Full platform-wide visibility and control |
| Create Admin Accounts   | Onboard new Admins to the system          |
| Revoke Admin Access     | Disable or remove Admin accounts          |
| Platform-Wide Analytics | All financial, operational, and user data |

---

---

# 🔍 CLI Review Rounds

> One functionality per round. Confirm each before moving to the next.
> Always start every session with: `Read freight_marketplace_blueprint.md first.`

---

## SCHEMA REVIEWS

### Round S1 — User Roles & Account Hierarchy

```
Read freight_marketplace_blueprint.md first.
Open the schema file.
Check only this: Does the schema correctly represent the 5 roles —
SuperAdmin, Admin, Dispatcher, Shipper, Carrier — and their hierarchy?
Is there a clear way to distinguish each role and who created whom?
List gaps only.
```

### Round S2 — Shipper Registration Fields

```
Read freight_marketplace_blueprint.md first.
Open the schema file.
Check only this: Does the Shipper model have all fields needed for
registration, document upload, approval status, rejection reason,
and document lock after approval?
List gaps only.
```

### Round S3 — Carrier Registration Fields

```
Read freight_marketplace_blueprint.md first.
Open the schema file.
Check only this: Does the Carrier model have all fields needed for
registration, document upload, approval status, rejection reason,
and document lock after approval?
List gaps only.
```

### Round S4 — Truck Model

```
Read freight_marketplace_blueprint.md first.
Open the schema file.
Check only this: Does the Truck model have fields for document upload,
approval status, rejection reason, DH-O radius, DH-D radius,
and marketplace visibility (available/unavailable)?
List gaps only.
```

### Round S5 — Load Model & State Machine

```
Read freight_marketplace_blueprint.md first.
Open the schema file.
Check only this: Does the Load model support all 8 states —
DRAFT, POSTED, SEARCHING, OFFERED, ASSIGNED, PICKUP_PENDING,
IN_TRANSIT, DELIVERED, COMPLETED?
Is there a status field that maps to these exactly?
List gaps only.
```

### Round S6 — Trip Model & State Machine

```
Read freight_marketplace_blueprint.md first.
Open the schema file.
Check only this: Does the Trip model have all 5 states —
ASSIGNED, PICKUP_PENDING, IN_TRANSIT, DELIVERED, COMPLETED —
plus CANCELLED and EXCEPTION?
Are all timestamps present: startedAt, pickedUpAt, deliveredAt,
completedAt, cancelledAt?
List gaps only.
```

### Round S7 — Trip to Load Relationship

```
Read freight_marketplace_blueprint.md first.
Open the schema file.
Check only this: Is there a clear relationship between Trip and Load?
When a Trip state changes, is there a mechanism to sync the Load state?
List gaps only.
```

### Round S8 — Wallet Model

```
Read freight_marketplace_blueprint.md first.
Open the schema file.
Check only this: Does the Wallet model support balance tracking,
minimum threshold configuration, deposit history, and individual
rate/km per Shipper and Carrier?
List gaps only.
```

### Round S9 — Service Fee Model

```
Read freight_marketplace_blueprint.md first.
Open the schema file.
Check only this: Does the schema support storing the service fee
per trip — separately for Shipper and Carrier — with the rate/km
used and total KM?
Is there a promotional price field per account?
List gaps only.
```

### Round S10 — Notification Model

```
Read freight_marketplace_blueprint.md first.
Open the schema file.
Check only this: Does the schema have a Notification model that
supports sending to specific roles (Carrier, Shipper, Dispatcher, Admin)?
Can it store notification type, read status, and related entity (trip, load, truck)?
List gaps only.
```

---

## API REVIEWS

### Round A1 — Registration Endpoints (Shipper & Carrier)

```
Read freight_marketplace_blueprint.md first.
Open the auth/registration routes.
Check only this: Are there endpoints for register, OTP verify,
document upload, and resubmit after rejection — for both Shipper and Carrier?
List missing or incomplete endpoints only.
```

### Round A2 — Admin Approval Endpoints

```
Read freight_marketplace_blueprint.md first.
Open the admin routes.
Check only this: Are there endpoints for Admin to approve/reject
Shipper registration, Carrier registration, and Truck registration?
Does the rejection response include a reason field?
List missing or incomplete endpoints only.
```

### Round A3 — Document Lock Enforcement

```
Read freight_marketplace_blueprint.md first.
Check only this: Is there middleware or a guard that prevents
Shipper or Carrier from editing documents after approval?
Does it apply to both account docs and truck docs?
List gaps only.
```

### Round A4 — Wallet Threshold Check Middleware

```
Read freight_marketplace_blueprint.md first.
Check only this: Is there a middleware or guard that checks
wallet balance before any of these actions:
- searching loads
- searching trucks
- sending a request
- receiving a request
Does it block the action if below threshold?
List gaps only.
```

### Round A5 — Load CRUD Endpoints

```
Read freight_marketplace_blueprint.md first.
Open the load routes.
Check only this: Are there endpoints to create (DRAFT), publish (POSTED),
edit (only in DRAFT), and view a load?
Can a Shipper post multiple loads at the same time?
List missing or incomplete endpoints only.
```

### Round A6 — Load Marketplace Search

```
Read freight_marketplace_blueprint.md first.
Open the load search routes.
Check only this: Can Carriers search loads filtered by
origin, destination, DH-O radius, and DH-D radius?
Does the search exclude loads that are ASSIGNED or beyond?
List gaps only.
```

### Round A7 — Truck Marketplace Search

```
Read freight_marketplace_blueprint.md first.
Open the truck search routes.
Check only this: Can Shippers search trucks filtered by
origin and destination?
Does the search exclude trucks that are currently on an active trip?
List gaps only.
```

### Round A8 — Shipper Request Flow Endpoints

```
Read freight_marketplace_blueprint.md first.
Open the request/matching routes.
Check only this: Can a Shipper send a load request to a truck?
Does it trigger a notification to the Carrier?
Can the Carrier accept or reject?
On accept — does the load and truck disappear from marketplace immediately?
List gaps only.
```

### Round A9 — Carrier Request Flow Endpoints

```
Read freight_marketplace_blueprint.md first.
Open the request/matching routes.
Check only this: Can a Carrier request a load?
Does it notify the Shipper?
Can the Shipper accept or reject?
On Shipper accept — does the Carrier get a final confirmation step?
On Carrier final confirm — do load and truck disappear from marketplace?
List gaps only.
```

### Round A10 — Trip State Transition Endpoints

```
Read freight_marketplace_blueprint.md first.
Open the trip routes.
Check only this: Are there endpoints for each transition —
ASSIGNED → PICKUP_PENDING → IN_TRANSIT → DELIVERED → COMPLETED?
Is each transition restricted to CARRIER only?
Are the correct timestamps set on each transition?
List gaps only.
```

### Round A11 — Trip Cancellation Endpoint

```
Read freight_marketplace_blueprint.md first.
Open the trip routes.
Check only this: Is there a cancel endpoint for trips?
Is it restricted to CARRIER and DISPATCHER only?
Is IN_TRANSIT blocked from direct cancellation?
List gaps only.
```

### Round A12 — Exception Path Endpoint

```
Read freight_marketplace_blueprint.md first.
Open the trip routes.
Check only this: Is there an endpoint to move a trip to EXCEPTION state?
Is the resolution endpoint (EXCEPTION → any state) restricted to ADMIN only?
List gaps only.
```

### Round A13 — Dispatcher Propose Match Endpoint

```
Read freight_marketplace_blueprint.md first.
Open the dispatcher routes.
Check only this: Can a Dispatcher propose a match between a load and a truck?
Does it send a notification to the Carrier or Shipper?
Is there any endpoint that lets Dispatcher accept or reject on their behalf?
(There should NOT be — flag it if found.)
List gaps only.
```

### Round A14 — POD Upload Endpoint

```
Read freight_marketplace_blueprint.md first.
Open the trip routes.
Check only this: Is there a POD upload endpoint?
Does it trigger the DELIVERED → COMPLETED transition?
Does it trigger the service fee calculation?
Does it make the truck available on the marketplace again?
List gaps only.
```

### Round A15 — Service Fee Calculation

```
Read freight_marketplace_blueprint.md first.
Open the fee calculation logic.
Check only this: Is the fee calculated as rate/km × total KM?
Is it calculated separately for Shipper and Carrier?
Is the rate/km configurable per account?
Is there a promotional price override per account?
Are the fees deducted from the correct wallets?
List gaps only.
```

### Round A16 — Admin Financial Reports

```
Read freight_marketplace_blueprint.md first.
Open the admin report routes.
Check only this: Can Admin view revenue collected —
per Carrier, per Shipper, and total —
filtered by day, week, month, and year?
List missing filters or breakdowns only.
```

### Round A17 — Access Revocation Endpoints

```
Read freight_marketplace_blueprint.md first.
Open the admin routes.
Check only this: Can Admin revoke access for Dispatcher, Shipper, Carrier?
Can Super Admin revoke access for Admin?
Does revoking immediately block marketplace and platform access?
List gaps only.
```

---

## NOTIFICATION REVIEWS

### Round N1 — Registration & Approval Notifications

```
Read freight_marketplace_blueprint.md first.
Check only this: Are notifications sent for —
- Shipper/Carrier submits documents → notify Admin
- Admin approves Shipper/Carrier → notify user
- Admin rejects Shipper/Carrier → notify user with reason
- Admin approves Truck → notify Carrier
- Admin rejects Truck → notify Carrier with reason
List missing notification triggers only.
```

### Round N2 — Request & Match Notifications

```
Read freight_marketplace_blueprint.md first.
Check only this: Are notifications sent for —
- Shipper sends request to Carrier → notify Carrier
- Carrier sends request to Shipper → notify Shipper
- Dispatcher proposes match → notify both Carrier and Shipper
- Carrier accepts Shipper request → notify Shipper
- Carrier rejects Shipper request → notify Shipper
- Shipper accepts Carrier request → notify Carrier
- Shipper rejects Carrier request → notify Carrier
- Carrier gives final confirmation → notify Shipper
List missing notification triggers only.
```

### Round N3 — Trip State Change Notifications

```
Read freight_marketplace_blueprint.md first.
Check only this: Are notifications sent when trip moves to each state —
PICKUP_PENDING, IN_TRANSIT, DELIVERED, COMPLETED, CANCELLED, EXCEPTION?
Who receives each notification (Shipper, Carrier, Dispatcher, Admin)?
List missing triggers only.
```

### Round N4 — Wallet Notifications

```
Read freight_marketplace_blueprint.md first.
Check only this: Are notifications sent for —
- Wallet balance drops below threshold → notify user
- Wallet top-up confirmed by Admin → notify user
List missing triggers only.
```

---

## UI REVIEWS

### Round U1 — Dispatcher UI: Propose Only

```
Read freight_marketplace_blueprint.md first.
Open the Dispatcher UI components.
Check only this: Does the Dispatcher UI have accept/reject buttons
on behalf of Carrier or Shipper anywhere?
(There should NOT be — flag every instance found.)
List gaps only.
```

### Round U2 — Shipper UI: Multiple Loads

```
Read freight_marketplace_blueprint.md first.
Open the Shipper dashboard UI.
Check only this: Can a Shipper see and manage multiple active loads
at the same time from the dashboard?
List gaps only.
```

### Round U3 — Carrier UI: DH-O and DH-D Input

```
Read freight_marketplace_blueprint.md first.
Open the Carrier truck management UI.
Check only this: Is there an input for DH-O and DH-D per truck?
Is it editable before approval?
Is it locked after approval alongside documents?
List gaps only.
```

### Round U4 — Marketplace Visibility

```
Read freight_marketplace_blueprint.md first.
Open the marketplace UI components.
Check only this: Do loads disappear from the marketplace
the moment they reach ASSIGNED state?
Do trucks disappear from the marketplace the moment they are on an active trip?
List gaps only.
```

### Round U5 — Document Lock UI

```
Read freight_marketplace_blueprint.md first.
Open the profile/document UI for Shipper and Carrier.
Check only this: Are document upload/edit fields disabled
after the account is approved?
Does the UI clearly communicate that documents are locked?
List gaps only.
```

---

_Total rounds: 10 Schema + 17 API + 4 Notification + 5 UI = 36 focused rounds._
_Complete one round, review the output, confirm, then move to the next._
