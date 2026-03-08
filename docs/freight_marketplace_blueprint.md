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
