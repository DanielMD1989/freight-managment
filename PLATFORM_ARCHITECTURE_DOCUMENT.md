# Freight Management Platform - Technical Architecture Document

**Version:** 1.0
**Date:** January 26, 2026
**Purpose:** Comprehensive mapping of business logic, database structure, and data flows

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Logic Mapping](#2-business-logic-mapping)
3. [Database Schema & Tables](#3-database-schema--tables)
4. [Data Flow & Cross-Platform Sync](#4-data-flow--cross-platform-sync)
5. [Impact Analysis](#5-impact-analysis)
6. [Architecture Diagrams](#6-architecture-diagrams)

---

## 1. Executive Summary

The Freight Management Platform is a two-sided marketplace connecting **Shippers** (who need to transport goods) with **Carriers** (who own trucks). The platform supports:

- **5 User Roles**: Super Admin, Admin, Dispatcher, Shipper, Carrier
- **25+ Database Tables**: Managing users, organizations, trucks, loads, trips, finances, and auditing
- **14 Load States**: Complete lifecycle from DRAFT to COMPLETED
- **6 Trip States**: From ASSIGNED to COMPLETED/CANCELLED
- **Dual Platform**: Web (Next.js) + Mobile (Flutter) with full feature parity

### Core Principles

| Principle | Implementation |
|-----------|----------------|
| **Single Source of Truth** | PostgreSQL database via Prisma ORM |
| **Carrier Final Authority** | Carriers must approve all assignments |
| **Atomic Transactions** | Assignment + Trip creation in single transaction |
| **Cache Invalidation** | Immediate invalidation on all mutations |
| **Dual-Party Fees** | Service fees from both shipper and carrier |

---

## 2. Business Logic Mapping

### 2.1 Role-Based Workflows

#### Super Admin
```
Full platform control with global override capabilities

Capabilities:
- All Admin permissions PLUS
- Assign/revoke admin roles
- Manage system configuration
- Access all organizations' data
- Override any restriction
- Configure commission rates
- Manage corridors and pricing
```

#### Admin
```
Platform operations and verification

Capabilities:
- Verify users and organizations
- Approve/reject truck registrations
- Manage user wallets
- Resolve exceptions and escalations
- View all analytics
- Access audit logs
- Manage disputes
```

#### Dispatcher
```
Coordination and monitoring (read-heavy, limited write)

Capabilities:
- View all loads and trucks
- Create match proposals
- Monitor active trips
- View GPS positions
- Create exceptions
- Coordinate assignments (via proposals)

Restrictions:
- Cannot directly assign trucks (proposes only)
- Cannot modify load/truck data
- Cannot access financial data
```

#### Shipper
```
Load posting and trip tracking

Workflow:
1. POST /api/loads → Create load (DRAFT or POSTED)
2. GET /api/truck-postings → Browse available trucks
3. POST /api/truck-requests → Request specific truck
4. [Wait for carrier approval]
5. GET /api/trips → Track assigned trips
6. PATCH /api/loads/[id]/status → Confirm delivery

Restrictions:
- Cannot browse truck fleet (/api/trucks forbidden)
- Cannot directly assign trucks
- Can only cancel own loads in DRAFT/POSTED states
```

#### Carrier
```
Truck posting and trip execution

Workflow:
1. POST /api/trucks → Register truck (pending approval)
2. [Wait for admin approval]
3. POST /api/truck-postings → Post truck availability
4. GET /api/loads → Browse loadboard (POSTED loads)
5. POST /api/load-requests → Request specific load
   OR
   POST /api/truck-requests/[id]/respond → Approve shipper request
6. GET /api/trips → View assigned trips
7. PATCH /api/trips/[id]/status → Update trip progress
8. POST /api/trips/[id]/pod → Upload proof of delivery

Authority:
- Final authority on truck assignment (RULE_CARRIER_FINAL_AUTHORITY)
- Can reject any truck request
- Controls trip status progression
```

### 2.2 Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     AUTHENTICATION FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐     ┌──────────────┐     ┌─────────────────────┐  │
│  │ Login   │────▶│ Validate     │────▶│ MFA Enabled?        │  │
│  │ Request │     │ Credentials  │     │                     │  │
│  └─────────┘     └──────────────┘     └──────────┬──────────┘  │
│                         │                         │              │
│                         │ Failed                  │              │
│                         ▼                    YES  │  NO          │
│                  ┌──────────────┐                 │              │
│                  │ Log Attempt  │                 ▼              │
│                  │ Check Limits │          ┌───────────┐         │
│                  └──────────────┘          │ Send OTP  │         │
│                         │                  │ via SMS   │         │
│                         │ Locked?          └─────┬─────┘         │
│                         ▼                        │               │
│                  ┌──────────────┐                ▼               │
│                  │ Block IP/    │         ┌───────────┐          │
│                  │ Lock Account │         │ Verify    │          │
│                  └──────────────┘         │ MFA Code  │          │
│                                           └─────┬─────┘          │
│                                                 │                │
│                                                 ▼                │
│                                          ┌───────────┐           │
│                                          │ Create    │           │
│                                          │ Session   │◀──────────┘
│                                          └─────┬─────┘           │
│                                                │                 │
│                    ┌───────────────────────────┼──────────┐      │
│                    │                           │          │      │
│                    ▼                           ▼          ▼      │
│             ┌───────────┐              ┌───────────┐  ┌───────┐  │
│             │ Set Cookie│              │ Return    │  │ Log   │  │
│             │ (Web)     │              │ JWT Token │  │ Event │  │
│             └───────────┘              │ (Mobile)  │  └───────┘  │
│                                        └───────────┘             │
└─────────────────────────────────────────────────────────────────┘

Rate Limits:
- 5 attempts per 15 minutes per email+IP
- 10+ failed attempts → IP blocked 24 hours
- Account lockout after 10 consecutive failures
```

### 2.3 Truck Registration & Approval

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRUCK REGISTRATION FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Carrier                          Admin                          │
│  ───────                          ─────                          │
│                                                                  │
│  ┌─────────────┐                                                │
│  │ POST /trucks│                                                │
│  │ + Documents │                                                │
│  └──────┬──────┘                                                │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐        │
│  │ Validate    │────▶│ Create Truck│────▶│ Create GPS  │        │
│  │ - License   │     │ status=     │     │ Device (if  │        │
│  │ - IMEI      │     │ PENDING     │     │ IMEI given) │        │
│  │ - Capacity  │     └─────────────┘     └─────────────┘        │
│  └─────────────┘                                                │
│                                                                  │
│                              │                                   │
│                              ▼                                   │
│                       ┌─────────────┐                           │
│                       │ Appears in  │                           │
│                       │ Admin Queue │                           │
│                       └──────┬──────┘                           │
│                              │                                   │
│                    ┌─────────┴─────────┐                        │
│                    ▼                   ▼                        │
│             ┌───────────┐       ┌───────────┐                   │
│             │ APPROVE   │       │ REJECT    │                   │
│             │ POST      │       │ POST      │                   │
│             │ /approve  │       │ /approve  │                   │
│             └─────┬─────┘       └─────┬─────┘                   │
│                   │                   │                          │
│                   ▼                   ▼                          │
│            ┌───────────┐       ┌───────────┐                    │
│            │ status=   │       │ status=   │                    │
│            │ APPROVED  │       │ REJECTED  │                    │
│            └─────┬─────┘       └───────────┘                    │
│                  │                                               │
│                  ▼                                               │
│           ┌───────────┐                                         │
│           │ Can Post  │                                         │
│           │ Availability│                                        │
│           └───────────┘                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Validation Rules:
- License plate: unique, min 3 chars
- Capacity: positive number (kg)
- Truck type: valid enum (FLATBED, REFRIGERATED, etc.)
- IMEI: exactly 15 digits, verified via GPS provider
```

### 2.4 Load Posting & Assignment

```
┌─────────────────────────────────────────────────────────────────┐
│                       LOAD LIFECYCLE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  DRAFT ──────▶ POSTED ──────▶ SEARCHING ──────▶ OFFERED         │
│    │             │               │                │              │
│    │             │               │                │              │
│    ▼             ▼               ▼                ▼              │
│  CANCELLED   UNPOSTED        ASSIGNED ◀──────────┘              │
│                  │               │                               │
│                  │               ▼                               │
│                  │         PICKUP_PENDING                        │
│                  │               │                               │
│                  │               ▼                               │
│                  │          IN_TRANSIT                           │
│                  │               │                               │
│                  │               ▼                               │
│                  │          DELIVERED                            │
│                  │               │                               │
│                  │               ▼                               │
│                  │          COMPLETED                            │
│                  │                                               │
│                  ▼                                               │
│              EXPIRED                                             │
│                                                                  │
│  ──────────── EXCEPTION (can occur at any active state) ───────  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

State Transition Rules:

| Current State    | Valid Next States                              | Allowed Roles        |
|------------------|------------------------------------------------|----------------------|
| DRAFT            | POSTED, CANCELLED                              | Shipper              |
| POSTED           | SEARCHING, OFFERED, ASSIGNED, UNPOSTED, EXPIRED| Shipper, System      |
| SEARCHING        | OFFERED, ASSIGNED, EXCEPTION, CANCELLED        | Dispatcher, System   |
| OFFERED          | ASSIGNED, SEARCHING, EXCEPTION                 | Dispatcher, Carrier  |
| ASSIGNED         | PICKUP_PENDING, IN_TRANSIT, EXCEPTION, CANCELLED| Carrier             |
| PICKUP_PENDING   | IN_TRANSIT, EXCEPTION, CANCELLED               | Carrier              |
| IN_TRANSIT       | DELIVERED, EXCEPTION                           | Carrier              |
| DELIVERED        | COMPLETED, EXCEPTION                           | Carrier, Shipper     |
| COMPLETED        | EXCEPTION                                      | Admin                |
| EXCEPTION        | Any active state, CANCELLED, COMPLETED         | Admin, Dispatcher    |
```

### 2.5 Request & Assignment Flow (Two-Way Matching)

```
┌─────────────────────────────────────────────────────────────────┐
│                    TWO-WAY MATCHING SYSTEM                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PATH A: Shipper Requests Truck (TruckRequest)                  │
│  ─────────────────────────────────────────────                  │
│                                                                  │
│  Shipper                           Carrier                       │
│  ────────                          ───────                       │
│                                                                  │
│  Browse Truck ──▶ POST ──▶ TruckRequest ──▶ Notification        │
│  Postings        /truck-    (PENDING)       to Carrier          │
│                  requests                                        │
│                                    │                             │
│                                    ▼                             │
│                              ┌───────────┐                       │
│                              │ APPROVE   │──▶ Trip Created      │
│                              │ or REJECT │    Load Assigned     │
│                              └───────────┘    Notify Shipper    │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  PATH B: Carrier Requests Load (LoadRequest)                    │
│  ─────────────────────────────────────────────                  │
│                                                                  │
│  Carrier                           Shipper                       │
│  ───────                           ───────                       │
│                                                                  │
│  Browse ──▶ POST ──▶ LoadRequest ──▶ Notification               │
│  Loadboard   /load-   (PENDING)      to Shipper                 │
│              requests                                            │
│                                    │                             │
│                                    ▼                             │
│                              ┌───────────┐                       │
│                              │ APPROVE   │──▶ Trip Created      │
│                              │ or REJECT │    Load Assigned     │
│                              └───────────┘    Notify Carrier    │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  ATOMIC APPROVAL TRANSACTION:                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 1. Re-fetch load (race condition check)                 │    │
│  │ 2. Verify load not already assigned                     │    │
│  │ 3. Verify truck not busy with active trip               │    │
│  │ 4. Update request status to APPROVED                    │    │
│  │ 5. Assign truck to load                                 │    │
│  │ 6. Create Trip record (ASSIGNED status)                 │    │
│  │ 7. Cancel other pending requests for same load          │    │
│  │ 8. Create LoadEvent audit record                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  POST-TRANSACTION (fire-and-forget):                            │
│  - Enable GPS tracking (if truck has GPS)                       │
│  - Send notifications to approved/rejected parties              │
│  - Invalidate caches                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.6 Trip Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                       TRIP LIFECYCLE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ASSIGNED ──▶ PICKUP_PENDING ──▶ IN_TRANSIT ──▶ DELIVERED      │
│     │              │                  │              │           │
│     │              │                  │              ▼           │
│     │              │                  │         COMPLETED        │
│     │              │                  │              │           │
│     ▼              ▼                  ▼              │           │
│  CANCELLED     CANCELLED          CANCELLED          │           │
│                                                      │           │
│                                                      ▼           │
│                                              ┌─────────────┐     │
│                                              │ Service Fee │     │
│                                              │ Deducted    │     │
│                                              │ Trust++     │     │
│                                              └─────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Trip State Actions:

| State          | Carrier Actions           | System Actions               |
|----------------|---------------------------|------------------------------|
| ASSIGNED       | Accept/Start trip         | Enable GPS tracking          |
| PICKUP_PENDING | Confirm at pickup         | Geofence detection           |
| IN_TRANSIT     | Update position           | Track progress, ETA          |
| DELIVERED      | Upload POD                | Geofence detection           |
| COMPLETED      | -                         | Deduct fees, update metrics  |
| CANCELLED      | Provide reason            | Refund fees, flag if suspicious|
```

### 2.7 Cancellation & Edit Rules

```
┌─────────────────────────────────────────────────────────────────┐
│                    CANCELLATION RULES                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  LOADS:                                                          │
│  ──────                                                          │
│  ✓ Can Cancel: DRAFT, POSTED, UNPOSTED, SEARCHING, OFFERED      │
│  ✗ Cannot Cancel: ASSIGNED, IN_TRANSIT, DELIVERED, COMPLETED    │
│                                                                  │
│  On Cancellation:                                                │
│  1. Reject all pending LoadRequests/TruckRequests               │
│  2. Notify affected carriers                                     │
│  3. Increment shipper's cancelledLoads                          │
│  4. Check for suspicious cancellation pattern                    │
│  5. Refund service fee if reserved                              │
│  6. Invalidate cache                                             │
│                                                                  │
│  TRIPS:                                                          │
│  ──────                                                          │
│  ✓ Can Cancel: ASSIGNED, PICKUP_PENDING                         │
│  ✗ Cannot Cancel: IN_TRANSIT (must complete), DELIVERED         │
│                                                                  │
│  On Trip Cancellation:                                           │
│  1. Unassign truck from load                                    │
│  2. Revert load status to SEARCHING                             │
│  3. Refund escrow if funded                                     │
│  4. Notify both parties                                          │
│  5. Log cancellation reason                                      │
│                                                                  │
│  TRUCKS:                                                         │
│  ───────                                                         │
│  ✓ Can Delete: No active trips                                  │
│  ✗ Cannot Delete: Has ASSIGNED/PICKUP_PENDING/IN_TRANSIT trip   │
│                                                                  │
│  EDIT RESTRICTIONS:                                              │
│  ─────────────────                                               │
│  - Loads: Cannot edit after ASSIGNED (route locked)             │
│  - Trucks: Cannot edit IMEI after GPS verified                  │
│  - Trips: Cannot edit pickup/delivery after IN_TRANSIT          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema & Tables

### 3.1 Entity Relationship Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    CORE ENTITY RELATIONSHIPS                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                        ┌──────────────┐                         │
│                        │ Organization │                         │
│                        │ (Shipper/    │                         │
│                        │  Carrier)    │                         │
│                        └──────┬───────┘                         │
│               ┌───────────────┼───────────────┐                 │
│               │               │               │                  │
│               ▼               ▼               ▼                  │
│        ┌──────────┐    ┌──────────┐    ┌──────────┐            │
│        │  User    │    │  Truck   │    │   Load   │            │
│        │          │    │          │    │          │            │
│        └────┬─────┘    └────┬─────┘    └────┬─────┘            │
│             │               │               │                    │
│             │               │    ┌──────────┴──────────┐        │
│             │               │    │                     │        │
│             │               ▼    ▼                     ▼        │
│             │         ┌──────────────┐          ┌──────────┐    │
│             │         │    Trip      │          │ Document │    │
│             │         │              │          └──────────┘    │
│             │         └──────┬───────┘                          │
│             │                │                                   │
│             ▼                ▼                                   │
│      ┌──────────┐     ┌──────────────┐                         │
│      │ Session  │     │ GpsPosition  │                         │
│      └──────────┘     └──────────────┘                         │
│                                                                  │
│  ──────────────────── REQUEST ENTITIES ────────────────────────  │
│                                                                  │
│        ┌──────────────┐              ┌──────────────┐           │
│        │ LoadRequest  │              │ TruckRequest │           │
│        │ (Carrier→    │              │ (Shipper→    │           │
│        │  Shipper)    │              │  Carrier)    │           │
│        └──────────────┘              └──────────────┘           │
│                                                                  │
│  ──────────────────── FINANCIAL ENTITIES ──────────────────────  │
│                                                                  │
│   ┌────────────────┐    ┌──────────────┐    ┌──────────────┐   │
│   │ FinancialAcct  │───▶│ JournalEntry │───▶│ JournalLine  │   │
│   │ (Wallet)       │    │              │    │              │   │
│   └────────────────┘    └──────────────┘    └──────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Complete Table Reference

#### Core User & Organization Tables

| Table | Primary Key | Purpose | Source of Truth For |
|-------|-------------|---------|---------------------|
| `User` | `id` (CUID) | User accounts | Authentication, roles |
| `Organization` | `id` (CUID) | Companies | Trust metrics, verification |
| `Session` | `id` (CUID) | Active sessions | Login state |
| `UserMFA` | `id` (CUID) | MFA configuration | Two-factor auth |
| `SecurityEvent` | `id` (CUID) | Security audit | Login attempts, failures |
| `DeviceToken` | `id` (CUID) | Push notification tokens | Mobile push |
| `Invitation` | `id` (CUID) | Pending invitations | User onboarding |

#### Truck & Posting Tables

| Table | Primary Key | Purpose | Source of Truth For |
|-------|-------------|---------|---------------------|
| `Truck` | `id` (CUID) | Truck inventory | Truck status, GPS |
| `TruckPosting` | `id` (CUID) | Truck availability | Marketplace visibility |
| `GpsDevice` | `id` (CUID) | GPS hardware | Device status |
| `GpsPosition` | `id` (CUID) | Location history | Real-time tracking |
| `TruckDocument` | `id` (CUID) | Truck documents | Verification docs |

#### Load & Trip Tables

| Table | Primary Key | Purpose | Source of Truth For |
|-------|-------------|---------|---------------------|
| `Load` | `id` (CUID) | Freight loads | Load status, assignment |
| `LoadEvent` | `id` (CUID) | Load audit trail | Status history |
| `LoadEscalation` | `id` (CUID) | Exceptions | Issue tracking |
| `Trip` | `id` (CUID) | Active deliveries | Trip status, tracking |
| `TripPod` | `id` (CUID) | Proof of delivery | Delivery confirmation |
| `Document` | `id` (CUID) | Load documents | BOL, POD files |

#### Request & Matching Tables

| Table | Primary Key | Purpose | Source of Truth For |
|-------|-------------|---------|---------------------|
| `LoadRequest` | `id` (CUID) | Carrier→Shipper requests | Request status |
| `TruckRequest` | `id` (CUID) | Shipper→Carrier requests | Request status |
| `MatchProposal` | `id` (CUID) | Dispatcher proposals | Match suggestions |

#### Financial Tables

| Table | Primary Key | Purpose | Source of Truth For |
|-------|-------------|---------|---------------------|
| `FinancialAccount` | `id` (CUID) | Wallets | Balance |
| `JournalEntry` | `id` (CUID) | Transactions | Financial audit |
| `JournalLine` | `id` (CUID) | Entry details | Debit/credit amounts |
| `Corridor` | `id` (CUID) | Route pricing | Service fee rates |
| `CommissionRate` | `id` (CUID) | Platform commission | Fee percentages |
| `WithdrawalRequest` | `id` (CUID) | Payout requests | Withdrawal status |

#### System & Audit Tables

| Table | Primary Key | Purpose | Source of Truth For |
|-------|-------------|---------|---------------------|
| `Notification` | `id` (CUID) | User notifications | Notification state |
| `AuditLog` | `id` (CUID) | System audit | All system events |
| `EthiopianLocation` | `id` (CUID) | Location master | City/region data |
| `SystemSettings` | `id` (fixed) | Platform config | Rate limits, toggles |
| `RouteCache` | `id` (CUID) | Distance cache | Route calculations |

### 3.3 Key Relationships

```
Organization (1) ──────────────── (N) User
     │
     ├── (1) ────────────────── (N) Truck
     │                               │
     │                               ├── (1) ────── (N) TruckPosting
     │                               │
     │                               ├── (1) ────── (N) GpsPosition
     │                               │
     │                               └── (1) ────── (1) Load.assignedTruck
     │
     ├── (1) ────────────────── (N) Load
     │                               │
     │                               ├── (1) ────── (N) LoadEvent
     │                               │
     │                               ├── (1) ────── (N) Document
     │                               │
     │                               ├── (1) ────── (1) Trip
     │                               │
     │                               └── (1) ────── (1) Corridor
     │
     └── (1) ────────────────── (N) FinancialAccount

Truck (1) ──────────────────── (N) TruckRequest
                                    │
                                    └── (N) ────── (1) Load

Load (1) ───────────────────── (N) LoadRequest
                                    │
                                    └── (N) ────── (1) Truck

Trip (1) ───────────────────── (N) GpsPosition (routeHistory)
     │
     └── (1) ────────────────── (N) TripPod

JournalEntry (1) ────────────── (N) JournalLine
                                    │
                                    └── (N) ────── (1) FinancialAccount
```

### 3.4 Source of Truth Matrix

| Data Domain | Source Table | Derived/Cached In | Invalidation Trigger |
|-------------|--------------|-------------------|----------------------|
| **User Authentication** | `User` | `Session`, Redis | Login, logout, password change |
| **User Permissions** | `User.role` | Redis cache | Role change |
| **Truck Status** | `Truck.approvalStatus` | Cache | Admin approval |
| **Truck Availability** | `TruckPosting.status` | Cache | Posting create/update |
| **Truck Location** | `GpsPosition` | `Truck.currentLocation*` | GPS update |
| **Load Status** | `Load.status` | Cache | Status change API |
| **Load Assignment** | `Load.assignedTruckId` | `Trip.truckId` | Assignment/unassignment |
| **Trip Status** | `Trip.status` | Cache | Status change API |
| **Trip Progress** | `Load.tripProgressPercent` | Real-time | GPS calculation |
| **Request Status** | `LoadRequest/TruckRequest.status` | None | Respond API |
| **Wallet Balance** | `FinancialAccount.balance` | None | JournalEntry creation |
| **Trust Score** | `Organization.*Rate` | Calculated | Load completion/cancellation |
| **Platform Revenue** | `FinancialAccount (PLATFORM_REVENUE)` | None | Service fee deduction |

---

## 4. Data Flow & Cross-Platform Sync

### 4.1 API Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐                    ┌─────────────┐             │
│  │  Web App    │                    │ Mobile App  │             │
│  │  (Next.js)  │                    │  (Flutter)  │             │
│  └──────┬──────┘                    └──────┬──────┘             │
│         │                                  │                     │
│         │ Cookie + CSRF                    │ Bearer Token        │
│         │                                  │                     │
│         └──────────────┬───────────────────┘                    │
│                        │                                         │
│                        ▼                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    API LAYER                             │    │
│  │                  /api/* routes                           │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │                                                          │    │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐           │    │
│  │  │ Rate      │  │ Auth      │  │ CSRF      │           │    │
│  │  │ Limiter   │  │ Middleware│  │ Check     │           │    │
│  │  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘           │    │
│  │        │              │              │                   │    │
│  │        └──────────────┼──────────────┘                   │    │
│  │                       ▼                                  │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │              ROUTE HANDLERS                      │    │    │
│  │  │  /auth/*  /trucks/*  /loads/*  /trips/*         │    │    │
│  │  └─────────────────────┬───────────────────────────┘    │    │
│  │                        │                                 │    │
│  └────────────────────────┼─────────────────────────────────┘    │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   SERVICE LAYER                          │    │
│  │                     lib/*                                │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │    │
│  │  │ Cache   │ │ Notify  │ │ Trust   │ │ Pricing │       │    │
│  │  │         │ │         │ │ Metrics │ │         │       │    │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘       │    │
│  │       │           │           │           │             │    │
│  └───────┼───────────┼───────────┼───────────┼─────────────┘    │
│          │           │           │           │                   │
│          ▼           ▼           ▼           ▼                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   DATA LAYER                             │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐           │    │
│  │  │ PostgreSQL│  │   Redis   │  │ Background│           │    │
│  │  │ (Prisma)  │  │  (Cache)  │  │   Queue   │           │    │
│  │  └───────────┘  └───────────┘  └───────────┘           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Cache Invalidation Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                   CACHE INVALIDATION MATRIX                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  MUTATION                    CACHE KEYS INVALIDATED              │
│  ────────                    ──────────────────────              │
│                                                                  │
│  Truck Created/Updated       trucks:*, matching:*, postings:*   │
│  Truck Deleted               trucks:*, matching:*, postings:*   │
│  Truck Approved              trucks:*, matching:*, postings:*   │
│  TruckPosting Created        trucks:*, matching:*, postings:*   │
│  TruckPosting Updated        trucks:*, matching:*, postings:*   │
│                                                                  │
│  Load Created                loads:*, status:*                   │
│  Load Updated                loads:*, status:*                   │
│  Load Deleted                loads:*, status:*                   │
│  Load Status Changed         loads:*, status:*, trips:*         │
│  Load Assigned               loads:*, trucks:*, trips:*         │
│                                                                  │
│  Trip Created                trips:*, loads:*                    │
│  Trip Status Changed         trips:*, loads:*                    │
│                                                                  │
│  User Status Changed         user:{id}, permissions:user:{id}   │
│  Session Created/Revoked     session:{id}                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Cache TTLs:

| Cache Key Pattern    | TTL      | Purpose                        |
|---------------------|----------|--------------------------------|
| session:{id}        | 24 hours | Session validation             |
| user:{id}           | 5 min    | User profile                   |
| permissions:{id}    | 10 min   | RBAC permissions               |
| loads:list:*        | 30 sec   | Marketplace listings           |
| trucks:list:*       | 30 sec   | Fleet listings                 |
| trips:active        | 60 sec   | Active trip dashboard          |
| geodata:distance:*  | 24 hours | Route calculations             |
| corridor:*          | 24 hours | Pricing corridors              |
```

### 4.3 Notification Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  API Mutation                                                    │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────┐                                                │
│  │ Create      │                                                │
│  │ Notification│                                                │
│  │ Record      │                                                │
│  └──────┬──────┘                                                │
│         │                                                        │
│         ├──────────────────────────────────────┐                │
│         │                                      │                 │
│         ▼                                      ▼                 │
│  ┌─────────────┐                       ┌─────────────┐          │
│  │ Check User  │                       │ WebSocket   │          │
│  │ Preferences │                       │ Real-time   │          │
│  └──────┬──────┘                       │ Delivery    │          │
│         │                              └─────────────┘          │
│         │ Enabled?                                               │
│         │                                                        │
│    YES  │  NO                                                   │
│         │   └──▶ Skip                                           │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────┐                                                │
│  │ Store in    │                                                │
│  │ Database    │                                                │
│  └──────┬──────┘                                                │
│         │                                                        │
│         ├──────────────┬──────────────┐                         │
│         ▼              ▼              ▼                          │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐                   │
│  │ In-App    │  │ Push      │  │ Email/SMS │                   │
│  │ (Web/     │  │ (Mobile)  │  │ (Async)   │                   │
│  │  Mobile)  │  │           │  │           │                   │
│  └───────────┘  └───────────┘  └───────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Notification Types:

| Type                    | Trigger                          | Recipients         |
|-------------------------|----------------------------------|-------------------|
| GPS_OFFLINE             | GPS signal lost > 30 min         | Carrier, Shipper  |
| LOAD_REQUEST_RECEIVED   | Carrier requests load            | Shipper users     |
| LOAD_REQUEST_APPROVED   | Shipper approves request         | Carrier users     |
| TRUCK_REQUEST_RECEIVED  | Shipper requests truck           | Carrier users     |
| TRUCK_REQUEST_APPROVED  | Carrier approves request         | Shipper users     |
| LOAD_STATUS_CHANGE      | Any status transition            | Both parties      |
| POD_SUBMITTED           | Carrier uploads POD              | Shipper users     |
| SERVICE_FEE_DEDUCTED    | Trip completed                   | Both parties      |
| EXCEPTION_CREATED       | Issue raised                     | Admins            |
| USER_STATUS_CHANGED     | Admin changes user status        | Affected user     |
```

### 4.4 Trust Metrics Update Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   TRUST METRICS FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Load Status → COMPLETED                                         │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ incrementCompletedLoads(shipperId)                       │    │
│  │ incrementCompletedLoads(carrierId)                       │    │
│  │                                                          │    │
│  │ Organization.totalLoadsCompleted++                       │    │
│  │ Organization.completionRate = completed / total          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Load Status → CANCELLED                                         │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ incrementCancelledLoads(shipperId)                       │    │
│  │                                                          │    │
│  │ Organization.totalLoadsCancelled++                       │    │
│  │ Organization.cancellationRate = cancelled / total        │    │
│  │                                                          │    │
│  │ checkSuspiciousCancellation(loadId)                      │    │
│  │   ├── Was contact info viewed?                           │    │
│  │   ├── Cancellation within 48h of view?                   │    │
│  │   ├── Pattern detected?                                  │    │
│  │   └── Flag for review if suspicious                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Trust Score Calculation:                                        │
│                                                                  │
│  Score = (completionRate × 0.40)                                │
│        + ((100 - cancellationRate) × 0.30)                      │
│        + ((100 - disputeRate) × 0.20)                           │
│        + (isVerified ? 10 : 0)                                  │
│                                                                  │
│  Badge Levels: PLATINUM (90+), GOLD (75+), SILVER (60+),        │
│                BRONZE (40+), NONE (<40)                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.5 Service Fee Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE FEE FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Trip Status → COMPLETED (POD verified)                          │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ deductServiceFee(loadId)                                 │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                             │                                    │
│                             ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 1. Find Corridor (origin region → dest region)          │    │
│  │                                                          │    │
│  │ 2. Calculate Distance:                                   │    │
│  │    distance = actualTripKm || estimatedTripKm ||         │    │
│  │               tripKm || corridor.distanceKm              │    │
│  │                                                          │    │
│  │ 3. Calculate Fees:                                       │    │
│  │    shipperFee = distance × shipperPricePerKm             │    │
│  │    carrierFee = distance × carrierPricePerKm             │    │
│  │                                                          │    │
│  │ 4. Apply Promotions:                                     │    │
│  │    if (shipperPromoFlag) shipperFee *= (1 - promoPct)    │    │
│  │    if (carrierPromoFlag) carrierFee *= (1 - promoPct)    │    │
│  │                                                          │    │
│  │ 5. Deduct from Wallets:                                  │    │
│  │    SHIPPER_WALLET.balance -= shipperFee                  │    │
│  │    CARRIER_WALLET.balance -= carrierFee                  │    │
│  │    PLATFORM_REVENUE.balance += (shipperFee + carrierFee) │    │
│  │                                                          │    │
│  │ 6. Create JournalEntry:                                  │    │
│  │    type: SERVICE_FEE_DEDUCT                              │    │
│  │    lines: [shipper debit, carrier debit, platform credit]│    │
│  │                                                          │    │
│  │ 7. Update Load:                                          │    │
│  │    shipperServiceFee, carrierServiceFee                  │    │
│  │    shipperFeeStatus = DEDUCTED                           │    │
│  │    carrierFeeStatus = DEDUCTED                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  On Cancellation: refundServiceFee(loadId)                      │
│  - Reverses shipper deduction only                              │
│  - Creates SERVICE_FEE_REFUND journal entry                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.6 Potential Data Inconsistency Points

```
┌─────────────────────────────────────────────────────────────────┐
│               POTENTIAL INCONSISTENCY RISKS                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  RISK 1: Race Condition in Assignment                           │
│  ─────────────────────────────────────                          │
│  Scenario: Two carriers approve requests for same load          │
│  Mitigation: Atomic transaction with fresh load re-fetch        │
│  Status: MITIGATED (P0-002, P0-003)                             │
│                                                                  │
│  RISK 2: Cache Stale After Mutation                             │
│  ────────────────────────────────────                           │
│  Scenario: User sees old data after another user's update       │
│  Mitigation: Immediate cache invalidation on all mutations      │
│  Status: MITIGATED (P1-001, P1-001-B)                           │
│                                                                  │
│  RISK 3: Load-Trip Status Mismatch                              │
│  ────────────────────────────────                               │
│  Scenario: Load shows DELIVERED but Trip shows IN_TRANSIT       │
│  Mitigation: Status changes sync both entities                  │
│  Status: MITIGATED                                              │
│                                                                  │
│  RISK 4: Orphaned Requests on Load Deletion                     │
│  ──────────────────────────────────────────                     │
│  Scenario: Load deleted with pending requests → FK error        │
│  Mitigation: Clean up requests before deletion                  │
│  Status: MITIGATED (P1-007)                                     │
│                                                                  │
│  RISK 5: Analytics Timezone Drift                               │
│  ────────────────────────────────                               │
│  Scenario: Daily analytics boundary wrong for ETB timezone      │
│  Mitigation: Use explicit timezone in date calculations         │
│  Status: P2 (Sprint 2)                                          │
│                                                                  │
│  RISK 6: Trust Metrics Not Updated                              │
│  ────────────────────────────────                               │
│  Scenario: Load completed but trust metrics not incremented     │
│  Mitigation: Call incrementCompletedLoads in status endpoint    │
│  Status: MITIGATED (P1-006)                                     │
│                                                                  │
│  RISK 7: GPS Fields Missing on Mobile                           │
│  ──────────────────────────────────                             │
│  Scenario: Web shows GPS but mobile model missing fields        │
│  Mitigation: Add GPS fields to Dart model                       │
│  Status: MITIGATED (P1-003, P1-003-B)                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Impact Analysis

### 5.1 Mutation Impact Matrix

```
┌─────────────────────────────────────────────────────────────────┐
│                    MUTATION IMPACT MATRIX                        │
├─────────────────────────────────────────────────────────────────┤

┌─────────────────┬───────────────────────────────────────────────┐
│ Mutation        │ Downstream Effects                            │
├─────────────────┼───────────────────────────────────────────────┤
│ User Created    │ • Organization created (if company)           │
│                 │ • Session created                              │
│                 │ • No cache impact (new user)                   │
├─────────────────┼───────────────────────────────────────────────┤
│ User Status     │ • Cache: user:{id}, permissions:user:{id}     │
│ Changed         │ • Sessions: revoke if SUSPENDED/REJECTED      │
│                 │ • Notifications: USER_STATUS_CHANGED          │
│                 │ • Access: API calls fail if not ACTIVE        │
├─────────────────┼───────────────────────────────────────────────┤
│ Truck Created   │ • Cache: trucks:*, matching:*, postings:*     │
│                 │ • GpsDevice created (if IMEI provided)        │
│                 │ • Admin queue: appears for approval           │
│                 │ • Not visible in marketplace until approved   │
├─────────────────┼───────────────────────────────────────────────┤
│ Truck Approved  │ • Cache: trucks:*, matching:*, postings:*     │
│                 │ • Can now create postings                     │
│                 │ • Visible in Find Trucks                      │
│                 │ • Notifications: TRUCK_APPROVAL               │
├─────────────────┼───────────────────────────────────────────────┤
│ TruckPosting    │ • Cache: trucks:*, matching:*, postings:*     │
│ Created         │ • Visible in shipper's Find Trucks            │
│                 │ • Match count updated for loads               │
├─────────────────┼───────────────────────────────────────────────┤
│ Load Created    │ • Cache: loads:*, status:*                    │
│                 │ • LoadEvent: CREATED/POSTED                   │
│                 │ • If POSTED: visible in loadboard             │
│                 │ • Notifications: NEW_LOAD_POSTED (to carriers)│
├─────────────────┼───────────────────────────────────────────────┤
│ Load Status     │ • Cache: loads:*, status:*, trips:*           │
│ Changed         │ • LoadEvent: STATUS_CHANGED                   │
│                 │ • Trip: status synced if exists               │
│                 │ • Trust: metrics updated if terminal          │
│                 │ • Service Fee: deduct/refund if terminal      │
│                 │ • Notifications: LOAD_STATUS_CHANGE           │
│                 │ • Truck: unassigned if terminal               │
├─────────────────┼───────────────────────────────────────────────┤
│ Load Assigned   │ • Cache: loads:*, trucks:*, trips:*           │
│                 │ • Trip: created atomically                    │
│                 │ • Truck: marked as assigned                   │
│                 │ • GPS: tracking enabled if available          │
│                 │ • Escrow: funds held                          │
│                 │ • Service Fee: reserved                       │
│                 │ • Requests: other pending cancelled           │
│                 │ • LoadEvent: ASSIGNED, TRIP_CREATED           │
│                 │ • Notifications: to both parties              │
├─────────────────┼───────────────────────────────────────────────┤
│ Load Deleted    │ • Cache: loads:*, status:*                    │
│                 │ • Requests: pending auto-rejected             │
│                 │ • Notifications: to affected carriers         │
│                 │ • Cascade: LoadEvents, Documents deleted      │
├─────────────────┼───────────────────────────────────────────────┤
│ Request         │ • Cache: loads:*, trucks:*, trips:*           │
│ Approved        │ • Load: assigned to truck                     │
│                 │ • Trip: created                               │
│                 │ • Other requests: cancelled                   │
│                 │ • GPS: tracking enabled                       │
│                 │ • Notifications: to both parties              │
├─────────────────┼───────────────────────────────────────────────┤
│ Trip Status     │ • Cache: trips:*, loads:*                     │
│ Changed         │ • Load: status synced                         │
│                 │ • If COMPLETED: service fee deducted          │
│                 │ • If COMPLETED: trust metrics updated         │
│                 │ • Notifications: LOAD_STATUS_CHANGE           │
├─────────────────┼───────────────────────────────────────────────┤
│ GPS Position    │ • GpsPosition: record created                 │
│ Updated         │ • Truck: currentLocation* updated             │
│                 │ • Trip: routeHistory appended                 │
│                 │ • Load: tripProgressPercent recalculated      │
│                 │ • Geofence: check pickup/delivery proximity   │
└─────────────────┴───────────────────────────────────────────────┘
```

### 5.2 Critical Atomic Transactions

```
┌─────────────────────────────────────────────────────────────────┐
│                 CRITICAL ATOMIC TRANSACTIONS                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TRANSACTION 1: Request Approval                                │
│  ───────────────────────────────                                │
│  Purpose: Prevent race conditions and ensure data integrity     │
│                                                                  │
│  db.$transaction(async (tx) => {                                │
│    // 1. Re-fetch load with fresh data (race check)             │
│    const freshLoad = await tx.load.findUnique(...)              │
│                                                                  │
│    // 2. Verify load still available                            │
│    if (freshLoad.assignedTruckId) throw ALREADY_ASSIGNED        │
│    if (!['POSTED','SEARCHING','OFFERED'].includes(status))      │
│      throw LOAD_NOT_AVAILABLE                                   │
│                                                                  │
│    // 3. Verify truck not busy                                  │
│    const activeTruckLoad = await tx.load.findFirst(...)         │
│    if (activeTruckLoad) throw TRUCK_BUSY                        │
│                                                                  │
│    // 4. Update request to APPROVED                             │
│    await tx.loadRequest.update({ status: 'APPROVED' })          │
│                                                                  │
│    // 5. Assign truck to load                                   │
│    await tx.load.update({ assignedTruckId, status: 'ASSIGNED' })│
│                                                                  │
│    // 6. Create trip (MUST be inside transaction)               │
│    const trip = await tx.trip.create({ loadId, truckId, ... })  │
│                                                                  │
│    // 7. Cancel other pending requests                          │
│    await tx.loadRequest.updateMany({ status: 'CANCELLED' })     │
│    await tx.truckRequest.updateMany({ status: 'CANCELLED' })    │
│                                                                  │
│    // 8. Create audit event                                     │
│    await tx.loadEvent.create({ eventType: 'ASSIGNED' })         │
│                                                                  │
│    return { request, load, trip }                               │
│  })                                                              │
│                                                                  │
│  // Post-transaction (fire-and-forget, non-blocking):           │
│  enableGpsTracking(loadId, truckId)                             │
│  sendNotifications(...)                                         │
│  invalidateCache(...)                                           │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  TRANSACTION 2: Load Deletion with Request Cleanup              │
│  ─────────────────────────────────────────────────              │
│                                                                  │
│  db.$transaction(async (tx) => {                                │
│    // 1. Find pending requests                                  │
│    const pendingLoadRequests = await tx.loadRequest.findMany()  │
│    const pendingTruckRequests = await tx.truckRequest.findMany()│
│                                                                  │
│    // 2. Reject all pending requests                            │
│    await tx.loadRequest.updateMany({ status: 'REJECTED' })      │
│    await tx.truckRequest.updateMany({ status: 'REJECTED' })     │
│                                                                  │
│    // 3. Delete load                                            │
│    await tx.load.delete({ where: { id } })                      │
│                                                                  │
│    return { rejectedLoadRequests, rejectedTruckRequests }       │
│  })                                                              │
│                                                                  │
│  // Post-transaction: notify affected carriers                  │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  TRANSACTION 3: Service Fee Deduction                           │
│  ────────────────────────────────────                           │
│                                                                  │
│  db.$transaction(async (tx) => {                                │
│    // 1. Debit shipper wallet                                   │
│    await tx.financialAccount.update({                           │
│      where: { type: 'SHIPPER_WALLET', organizationId },         │
│      data: { balance: { decrement: shipperFee } }               │
│    })                                                            │
│                                                                  │
│    // 2. Debit carrier wallet                                   │
│    await tx.financialAccount.update({                           │
│      where: { type: 'CARRIER_WALLET', organizationId },         │
│      data: { balance: { decrement: carrierFee } }               │
│    })                                                            │
│                                                                  │
│    // 3. Credit platform revenue                                │
│    await tx.financialAccount.update({                           │
│      where: { type: 'PLATFORM_REVENUE' },                       │
│      data: { balance: { increment: totalFee } }                 │
│    })                                                            │
│                                                                  │
│    // 4. Create journal entry with lines                        │
│    await tx.journalEntry.create({ ... lines ... })              │
│                                                                  │
│    // 5. Update load fee status                                 │
│    await tx.load.update({ feeStatus: 'DEDUCTED' })              │
│  })                                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Architecture Diagrams

### 6.1 System Context Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    SYSTEM CONTEXT DIAGRAM                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                      ┌─────────────────┐                        │
│                      │    Shippers     │                        │
│                      │ (Web & Mobile)  │                        │
│                      └────────┬────────┘                        │
│                               │                                  │
│                               │ Posts loads                     │
│                               │ Tracks shipments                │
│                               ▼                                  │
│  ┌─────────────┐    ┌─────────────────────────┐    ┌──────────┐│
│  │   Carriers  │    │                         │    │  Admins  ││
│  │ (Web &      │───▶│   FREIGHT MANAGEMENT    │◀───│ (Web)    ││
│  │  Mobile)    │    │       PLATFORM          │    │          ││
│  └─────────────┘    │                         │    └──────────┘│
│        │            │  • Two-way matching     │         │       │
│        │            │  • GPS tracking         │         │       │
│        │            │  • Service fee mgmt     │         │       │
│        │            │  • Trust metrics        │         │       │
│        │            └───────────┬─────────────┘         │       │
│        │ Posts trucks           │                       │       │
│        │ Executes trips         │                Verifies│       │
│        │                        │                users  │       │
│        │                        ▼                       │       │
│        │            ┌─────────────────────────┐         │       │
│        │            │    External Services    │         │       │
│        │            │  • SMS (Afromessage)    │         │       │
│        └───────────▶│  • GPS Providers        │◀────────┘       │
│                     │  • Google Routes API    │                  │
│                     │  • Payment Gateway      │                  │
│                     └─────────────────────────┘                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      DATA FLOW DIAGRAM                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐         ┌─────────┐         ┌─────────┐           │
│  │ Shipper │         │ Carrier │         │  Admin  │           │
│  └────┬────┘         └────┬────┘         └────┬────┘           │
│       │                   │                   │                  │
│       │ Create            │ Create            │ Approve          │
│       │ Load              │ Truck             │ Truck            │
│       ▼                   ▼                   ▼                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                     API Gateway                          │    │
│  │              (Authentication + Rate Limiting)            │    │
│  └────────────────────────────┬────────────────────────────┘    │
│                               │                                  │
│                               ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Service Layer                          │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │    │
│  │  │ Load    │  │ Truck   │  │ Trip    │  │ Request │    │    │
│  │  │ Service │  │ Service │  │ Service │  │ Service │    │    │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘    │    │
│  │       │            │            │            │          │    │
│  │       └────────────┼────────────┼────────────┘          │    │
│  │                    │            │                        │    │
│  │                    ▼            ▼                        │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │    │
│  │  │ Cache   │  │ Notify  │  │ Trust   │  │ Service │    │    │
│  │  │ Manager │  │ Manager │  │ Metrics │  │ Fee Mgr │    │    │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘    │    │
│  └───────┼────────────┼────────────┼────────────┼──────────┘    │
│          │            │            │            │                │
│          ▼            ▼            ▼            ▼                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Data Layer                            │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │    │
│  │  │PostgreSQL│  │  Redis   │  │  Queue   │              │    │
│  │  │          │  │ (Cache)  │  │(BullMQ)  │              │    │
│  │  │ • Users  │  │          │  │          │              │    │
│  │  │ • Loads  │  │ • Session│  │ • Email  │              │    │
│  │  │ • Trucks │  │ • Lists  │  │ • SMS    │              │    │
│  │  │ • Trips  │  │ • Metrics│  │ • GPS    │              │    │
│  │  └──────────┘  └──────────┘  └──────────┘              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Load Assignment Sequence Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│               LOAD ASSIGNMENT SEQUENCE DIAGRAM                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Carrier        API          Database       Cache      Notify   │
│    │             │              │             │           │      │
│    │  POST       │              │             │           │      │
│    │  /respond   │              │             │           │      │
│    │─────────────▶              │             │           │      │
│    │             │              │             │           │      │
│    │             │ BEGIN TX     │             │           │      │
│    │             │─────────────▶│             │           │      │
│    │             │              │             │           │      │
│    │             │ Re-fetch     │             │           │      │
│    │             │ load         │             │           │      │
│    │             │─────────────▶│             │           │      │
│    │             │◀─────────────│             │           │      │
│    │             │              │             │           │      │
│    │             │ Check truck  │             │           │      │
│    │             │ availability │             │           │      │
│    │             │─────────────▶│             │           │      │
│    │             │◀─────────────│             │           │      │
│    │             │              │             │           │      │
│    │             │ Update       │             │           │      │
│    │             │ request      │             │           │      │
│    │             │─────────────▶│             │           │      │
│    │             │              │             │           │      │
│    │             │ Assign load  │             │           │      │
│    │             │─────────────▶│             │           │      │
│    │             │              │             │           │      │
│    │             │ Create trip  │             │           │      │
│    │             │─────────────▶│             │           │      │
│    │             │              │             │           │      │
│    │             │ Cancel other │             │           │      │
│    │             │ requests     │             │           │      │
│    │             │─────────────▶│             │           │      │
│    │             │              │             │           │      │
│    │             │ Create event │             │           │      │
│    │             │─────────────▶│             │           │      │
│    │             │              │             │           │      │
│    │             │ COMMIT TX    │             │           │      │
│    │             │─────────────▶│             │           │      │
│    │             │◀─────────────│             │           │      │
│    │             │              │             │           │      │
│    │             │ Invalidate   │             │           │      │
│    │             │──────────────────────────▶│           │      │
│    │             │              │             │           │      │
│    │             │ Send         │             │           │      │
│    │             │ notification │             │           │      │
│    │             │─────────────────────────────────────▶│      │
│    │             │              │             │           │      │
│    │◀────────────│              │             │           │      │
│    │  Response   │              │             │           │      │
│    │  + Trip     │              │             │           │      │
│    │  + Tracking │              │             │           │      │
│    │             │              │             │           │      │
└─────────────────────────────────────────────────────────────────┘
```

### 6.4 Suggested Additional Diagrams

For complete documentation, consider creating:

1. **Entity Relationship Diagram (ERD)** - Full database schema visualization
2. **State Machine Diagrams** - For Load, Trip, Request, and Truck states
3. **Deployment Architecture** - Infrastructure layout
4. **Security Architecture** - Authentication and authorization flows
5. **GPS Tracking Flow** - Real-time position updates
6. **Settlement Flow** - Financial reconciliation process

---

## Appendix A: Quick Reference

### API Endpoint Summary

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/auth/login` | POST | No | User login |
| `/api/auth/logout` | POST | Yes | User logout |
| `/api/auth/me` | GET | Yes | Current user profile |
| `/api/trucks` | GET/POST | Yes | List/create trucks |
| `/api/trucks/[id]` | GET/PATCH/DELETE | Yes | Truck CRUD |
| `/api/trucks/[id]/approve` | POST | Admin | Approve truck |
| `/api/truck-postings` | GET/POST | Yes | List/create postings |
| `/api/loads` | GET/POST | Yes | List/create loads |
| `/api/loads/[id]` | GET/PATCH/DELETE | Yes | Load CRUD |
| `/api/loads/[id]/status` | PATCH | Yes | Update load status |
| `/api/load-requests` | GET/POST | Yes | List/create requests |
| `/api/load-requests/[id]/respond` | POST | Yes | Approve/reject |
| `/api/truck-requests` | GET/POST | Yes | List/create requests |
| `/api/truck-requests/[id]/respond` | POST | Yes | Approve/reject |
| `/api/trips` | GET/POST | Yes | List/create trips |

### Cache Key Patterns

| Pattern | TTL | Invalidated By |
|---------|-----|----------------|
| `session:{id}` | 24h | Logout, session revoke |
| `user:{id}` | 5m | User update |
| `permissions:user:{id}` | 10m | Role change |
| `loads:list:*` | 30s | Load mutation |
| `trucks:list:*` | 30s | Truck mutation |
| `trips:active` | 60s | Trip mutation |

### Status Enums Quick Reference

**Load Statuses:** DRAFT, POSTED, SEARCHING, OFFERED, ASSIGNED, PICKUP_PENDING, IN_TRANSIT, DELIVERED, COMPLETED, EXCEPTION, CANCELLED, EXPIRED, UNPOSTED

**Trip Statuses:** ASSIGNED, PICKUP_PENDING, IN_TRANSIT, DELIVERED, COMPLETED, CANCELLED

**Request Statuses:** PENDING, APPROVED, REJECTED, EXPIRED, CANCELLED

**Truck Approval:** PENDING, APPROVED, REJECTED, EXPIRED

---

**Document Version:** 1.0
**Last Updated:** January 26, 2026
**Maintained By:** Engineering Team
