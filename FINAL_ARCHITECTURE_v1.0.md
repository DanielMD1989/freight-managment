# FINAL ARCHITECTURE v1.0

**Document Version:** 1.0
**Freeze Date:** 2026-01-03
**Status:** FROZEN - No changes allowed without version increment
**Platform:** Ethiopian Freight Management System

---

## STOP CONDITIONS

**Development MUST halt immediately if any of the following occur:**

1. **Marketplace logic is altered** - Core load/truck matching flow changes
2. **Roles are merged or blurred** - Role boundaries must remain distinct
3. **Pricing intelligence is added** - No dynamic/smart pricing algorithms
4. **AI/ML is introduced** - No machine learning or artificial intelligence
5. **Mobile modifies backend logic** - Mobile consumes APIs only

---

## TABLE OF CONTENTS

1. [System Overview](#1-system-overview)
2. [Role Definitions](#2-role-definitions)
3. [Permission Matrix](#3-permission-matrix)
4. [Load/Trip Lifecycle](#4-loadtrip-lifecycle)
5. [Deadhead (DH) Logic](#5-deadhead-dh-logic)
6. [Automation Rules](#6-automation-rules)
7. [Escalation Flows](#7-escalation-flows)
8. [Mobile Scope](#8-mobile-scope)
9. [Mobile Tracking Rules](#9-mobile-tracking-rules)
10. [Shipper-Led Truck Matching](#10-shipper-led-truck-matching)
11. [Revoked Features](#11-revoked-features)

---

## 1. SYSTEM OVERVIEW

### 1.1 Platform Purpose

A **marketplace-only freight management platform** connecting Ethiopian shippers with carriers. The platform facilitates load posting, truck matching, trip execution, and settlement.

### 1.2 Core Principles

| Principle | Description |
|-----------|-------------|
| **Marketplace Model** | Platform connects parties; does NOT own trucks or cargo |
| **Deterministic Pricing** | `totalFare = baseFare + (tripKm x perKmEtb)` - NO dynamic pricing |
| **Rule-Based Automation** | Simple threshold-based rules - NO AI/ML |
| **Role Separation** | 5 distinct roles with non-overlapping core functions |
| **Escrow-Based Settlement** | Funds held on assignment, released on delivery |

### 1.3 Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React, TypeScript, TailwindCSS |
| Backend | Next.js API Routes, Prisma ORM |
| Database | PostgreSQL |
| Authentication | JWT, bcrypt |
| Real-time | WebSocket notifications |
| GPS | Device IMEI tracking, mobile location pings |

### 1.4 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER                           │
├─────────────┬─────────────┬─────────────┬─────────────┬────────┤
│   Shipper   │   Carrier   │  Dispatcher │    Admin    │ Mobile │
│   Portal    │   Portal    │   Portal    │   Portal    │  Apps  │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴───┬────┘
       │             │             │             │          │
       └─────────────┴─────────────┴─────────────┴──────────┘
                              │
                    ┌─────────▼─────────┐
                    │    API LAYER      │
                    │  (Next.js Routes) │
                    └─────────┬─────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
┌──────▼──────┐      ┌───────▼───────┐      ┌──────▼──────┐
│    RBAC     │      │ State Machine │      │   Escrow    │
│  (68 perms) │      │  (12 states)  │      │  Management │
└─────────────┘      └───────────────┘      └─────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   DATABASE LAYER  │
                    │   (PostgreSQL)    │
                    └───────────────────┘
```

---

## 2. ROLE DEFINITIONS

### 2.1 Role Hierarchy

```
SuperAdmin (Platform Owner)
    │
    ├── Admin (Operations Manager)
    │       │
    │       └── Dispatcher (Daily Operations)
    │
    ├── Shipper (Load Owner)
    │
    └── Carrier (Truck Owner/Operator)
```

### 2.2 Role Capabilities

#### SuperAdmin
| Capability | Description |
|------------|-------------|
| Assign Roles | Grant/revoke any role to any user |
| Platform Config | System-wide settings, feature flags |
| Full Analytics | Access to all platform metrics |
| Audit Logs | Complete audit trail access |
| Global Override | Can override any decision or status |

#### Admin
| Capability | Description |
|------------|-------------|
| Verify Documents | Approve/reject organization documents |
| Manage Wallet | View/adjust wallet balances |
| Configure Commission | Set commission rates and penalties |
| Automation Rules | Create/edit automation rule thresholds |
| Resolve Escalations | Handle escalated issues from dispatchers |
| View Analytics | Platform-wide analytics (read-only) |

#### Dispatcher
| Capability | Description |
|------------|-------------|
| Daily Dispatching | Assign trucks to loads |
| Assign/Unassign Loads | Manage load-truck assignments |
| Monitor Unassigned | View loads without carriers |
| Monitor Rejected | Track rejected loads |
| Handle Operational Issues | First-line exception handling |
| Escalate to Admin | Escalate unresolved issues |

#### Carrier
| Capability | Description |
|------------|-------------|
| Register | Create carrier organization |
| Upload Documents | Submit verification documents |
| Search/Filter Loads | Browse available loads (with DH-O filter) |
| Accept Loads | Accept load assignments |
| Execute Trips | Perform pickup and delivery |
| Update Status | Change load status (Assigned → Delivered) |
| Upload POD | Submit proof of delivery |
| View Wallet | Read-only wallet balance view |
| GPS Tracking | Location tracked during active trips |

#### Shipper
| Capability | Description |
|------------|-------------|
| Post Loads | Create and publish load requests |
| Track Status | Monitor load progress |
| View Live Map | See carrier location during trips |
| View POD | Access proof of delivery documents |
| View History | Access completed load history |
| Select Trucks | Choose from matching trucks (Web only) |

---

## 3. PERMISSION MATRIX

### 3.1 Core Permissions by Role

| Permission | SuperAdmin | Admin | Dispatcher | Carrier | Shipper |
|------------|:----------:|:-----:|:----------:|:-------:|:-------:|
| **User Management** |
| VIEW_USERS | ✓ | ✓ | - | - | - |
| CREATE_USERS | ✓ | ✓ | - | - | - |
| EDIT_USERS | ✓ | ✓ | - | - | - |
| DELETE_USERS | ✓ | - | - | - | - |
| ASSIGN_ROLES | ✓ | - | - | - | - |
| **Organization Management** |
| VIEW_ORGANIZATIONS | ✓ | ✓ | ✓ | ✓ | ✓ |
| CREATE_ORGANIZATION | ✓ | ✓ | - | ✓ | ✓ |
| EDIT_ORGANIZATION | ✓ | ✓ | - | Own | Own |
| VERIFY_ORGANIZATION | ✓ | ✓ | - | - | - |
| **Load Management** |
| VIEW_LOADS | ✓ | ✓ | ✓ | ✓ | Own |
| CREATE_LOAD | ✓ | ✓ | ✓ | - | ✓ |
| EDIT_LOAD | ✓ | ✓ | ✓ | - | Own |
| DELETE_LOAD | ✓ | ✓ | - | - | Own |
| ASSIGN_LOAD | ✓ | ✓ | ✓ | - | - |
| UPDATE_LOAD_STATUS | ✓ | ✓ | ✓ | Assigned | - |
| **Truck Management** |
| VIEW_TRUCKS | ✓ | ✓ | ✓ | Own | - |
| CREATE_TRUCK | ✓ | ✓ | - | ✓ | - |
| EDIT_TRUCKS | ✓ | ✓ | - | Own | - |
| DELETE_TRUCKS | ✓ | ✓ | - | Own | - |
| **Financial** |
| VIEW_WALLET | ✓ | ✓ | - | Own | Own |
| MANAGE_WALLET | ✓ | ✓ | - | - | - |
| VIEW_SETTLEMENTS | ✓ | ✓ | - | Own | Own |
| PROCESS_SETTLEMENT | ✓ | ✓ | - | - | - |
| CONFIGURE_COMMISSION | ✓ | ✓ | - | - | - |
| **GPS & Tracking** |
| VIEW_GPS | ✓ | ✓ | ✓ | Own | Assigned |
| MANAGE_GPS_DEVICES | ✓ | ✓ | - | Own | - |
| **Exceptions & Escalation** |
| VIEW_EXCEPTIONS | ✓ | ✓ | ✓ | Own | Own |
| MANAGE_EXCEPTIONS | ✓ | ✓ | ✓ | - | - |
| RESOLVE_EXCEPTIONS | ✓ | ✓ | - | - | - |
| ESCALATE_TO_ADMIN | ✓ | - | ✓ | - | - |
| **Analytics** |
| VIEW_ANALYTICS | ✓ | ✓ | - | - | - |
| VIEW_FULL_ANALYTICS | ✓ | - | - | - | - |
| **System** |
| VIEW_AUDIT_LOGS | ✓ | ✓ | - | - | - |
| MANAGE_SYSTEM_SETTINGS | ✓ | - | - | - | - |
| CONFIGURE_AUTOMATION | ✓ | ✓ | - | - | - |

### 3.2 Permission Count

**Total Permissions: 68**

| Role | Permission Count |
|------|-----------------|
| SuperAdmin | 68 (all) |
| Admin | 52 |
| Dispatcher | 24 |
| Carrier | 18 |
| Shipper | 16 |

---

## 4. LOAD/TRIP LIFECYCLE

### 4.1 State Machine

```
┌─────────┐
│  DRAFT  │ ← Initial state (shipper saves incomplete load)
└────┬────┘
     │ post()
     ▼
┌─────────┐
│ POSTED  │ ← Load visible in marketplace
└────┬────┘
     │ search()
     ▼
┌──────────┐
│SEARCHING │ ← Actively looking for carrier
└────┬─────┘
     │ offer() / assign()
     ▼
┌──────────┐     ┌─────────┐
│ OFFERED  │ ──► │ ASSIGNED│ ← Truck assigned, escrow funded
└──────────┘     └────┬────┘
                      │ arrive_pickup()
                      ▼
              ┌───────────────┐
              │PICKUP_PENDING │ ← Carrier at pickup location
              └───────┬───────┘
                      │ pickup()
                      ▼
              ┌───────────┐
              │ IN_TRANSIT│ ← Cargo loaded, en route
              └─────┬─────┘
                    │ deliver()
                    ▼
              ┌───────────┐
              │ DELIVERED │ ← Cargo delivered, POD pending
              └─────┬─────┘
                    │ complete() [POD verified]
                    ▼
              ┌───────────┐
              │ COMPLETED │ ← Trip finished, escrow released
              └───────────┘

EXCEPTION STATES:
┌───────────┐
│ EXCEPTION │ ← Any abnormal condition (can transition back)
├───────────┤
│ CANCELLED │ ← Load cancelled before pickup
├───────────┤
│  EXPIRED  │ ← Load expired (7-day auto-expiration)
├───────────┤
│ UNPOSTED  │ ← Shipper withdrew from marketplace
└───────────┘
```

### 4.2 Valid State Transitions

| From State | Valid Transitions |
|------------|-------------------|
| DRAFT | POSTED, CANCELLED |
| POSTED | SEARCHING, OFFERED, ASSIGNED, CANCELLED, EXPIRED, UNPOSTED |
| SEARCHING | OFFERED, ASSIGNED, CANCELLED, EXPIRED, EXCEPTION |
| OFFERED | ASSIGNED, SEARCHING, CANCELLED, EXCEPTION |
| ASSIGNED | PICKUP_PENDING, SEARCHING, CANCELLED, EXCEPTION |
| PICKUP_PENDING | IN_TRANSIT, EXCEPTION, CANCELLED |
| IN_TRANSIT | DELIVERED, EXCEPTION |
| DELIVERED | COMPLETED, EXCEPTION |
| COMPLETED | (terminal state) |
| EXCEPTION | SEARCHING, ASSIGNED, IN_TRANSIT, DELIVERED, CANCELLED |
| CANCELLED | (terminal state) |
| EXPIRED | POSTED (re-post) |
| UNPOSTED | POSTED (re-post) |

### 4.3 State Transition Rules

1. **All transitions are logged** with timestamp, user, and reason
2. **Only valid transitions allowed** - enforced by state machine
3. **Role-based transition permissions**:
   - Shipper: DRAFT → POSTED, POSTED → CANCELLED/UNPOSTED
   - Carrier: ASSIGNED → PICKUP_PENDING → IN_TRANSIT → DELIVERED
   - Dispatcher: Any operational transition
   - Admin: Any transition including EXCEPTION resolution
4. **Exceptions must be explicitly resolved** before continuing workflow

---

## 5. DEADHEAD (DH) LOGIC

### 5.1 Definitions

| Term | Definition | Formula |
|------|------------|---------|
| **DH-O (Deadhead to Origin)** | Distance from carrier's current location to load pickup point | `distance(carrier.location, load.pickup)` |
| **DH-D (Deadhead after Delivery)** | Distance from delivery point to carrier's preferred zone/next load | `distance(load.delivery, carrier.preferredZone)` |

### 5.2 Usage

| Use Case | Description |
|----------|-------------|
| **Carrier Filters** | Carriers can filter available loads by max DH-O |
| **Dispatcher Visibility** | Dispatchers see DH metrics when assigning |
| **Admin Analytics** | Platform-wide deadhead efficiency metrics |

### 5.3 Rules (CRITICAL)

| Rule | Enforcement |
|------|-------------|
| **Advisory Only** | DH is informational - NEVER blocks operations |
| **No Pricing Effect** | DH does NOT affect `totalFare` calculation |
| **No Visibility Blocking** | High DH does NOT hide loads from carriers |
| **Optional Filter** | Carriers MAY filter by DH-O, not required |

### 5.4 Implementation

```typescript
// DH-O Calculation
function calculateDHO(truckLocation, loadPickup): number {
  return haversineDistance(truckLocation, loadPickup);
}

// DH-D Calculation
function calculateDHD(loadDelivery, carrierPreferredZone): number {
  return haversineDistance(loadDelivery, carrierPreferredZone);
}

// DH Metrics (for analytics only)
function calculateDeadheadMetrics(dho, dhd, tripKm) {
  return {
    dhoPercent: (dho / tripKm) * 100,
    dhdPercent: (dhd / tripKm) * 100,
    totalDeadheadPercent: ((dho + dhd) / tripKm) * 100,
    efficiency: tripKm / (tripKm + dho + dhd),
  };
}
```

---

## 6. AUTOMATION RULES

### 6.1 Rule Types

| Type | Description |
|------|-------------|
| **TIME_BASED** | Triggers based on elapsed time |
| **GPS_BASED** | Triggers based on GPS events |
| **THRESHOLD_BASED** | Triggers when metrics exceed limits |

### 6.2 Predefined Rules

| Rule | Trigger | Action |
|------|---------|--------|
| **Load Unassigned Timeout** | Load unassigned > X minutes | Create EXCEPTION |
| **Pickup Missed** | Past pickup time, no status update | Create EXCEPTION |
| **DH-O Warning** | DH-O > threshold | Generate WARNING (advisory) |
| **Load Rejection Alert** | Load rejected N times | Alert dispatcher |
| **GPS Offline** | No GPS ping > 30 minutes | Create GPS_OFFLINE exception |
| **Load Expiration** | Load posted > 7 days | Auto-expire load |
| **Auto Settlement** | Load DELIVERED + POD verified | Release escrow |

### 6.3 Rule Configuration

| Parameter | Configurable By | Default |
|-----------|-----------------|---------|
| Unassigned timeout | Admin | 60 minutes |
| Pickup grace period | Admin | 30 minutes |
| DH-O warning threshold | Admin | 100 km |
| Max rejection count | Admin | 3 |
| GPS offline threshold | Admin | 30 minutes |
| Load expiration days | Admin | 7 days |

### 6.4 Rules (CRITICAL)

| Rule | Enforcement |
|------|-------------|
| **NO AI/ML** | All rules use simple conditional logic |
| **Admin Configurable** | Thresholds editable by Admin role |
| **Deterministic** | Same input always produces same output |
| **Auditable** | All rule executions logged |

---

## 7. ESCALATION FLOWS

### 7.1 Exception Types

| Type | Description | Initial Handler |
|------|-------------|-----------------|
| LATE_PICKUP | Carrier missed pickup window | Dispatcher |
| CARRIER_NO_SHOW | Carrier didn't arrive | Dispatcher |
| GPS_OFFLINE | GPS signal lost during trip | Dispatcher |
| TRUCK_BREAKDOWN | Vehicle mechanical failure | Dispatcher |
| PAYMENT_DISPUTE | Financial disagreement | Admin |
| CARGO_DAMAGE | Goods damaged in transit | Admin |
| ROUTE_DEVIATION | Carrier deviated from route | Dispatcher |
| DELIVERY_REFUSED | Receiver refused delivery | Admin |

### 7.2 Escalation Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    EXCEPTION DETECTED                        │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                 DISPATCHER (Level 1)                         │
│  • First response within 15 minutes                          │
│  • Can: Reassign, contact parties, log notes                 │
│  • Cannot: Adjust financials, override policies              │
└─────────────────────────┬───────────────────────────────────┘
                          │ Unresolved after 1 hour
                          │ OR requires financial decision
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    ADMIN (Level 2)                           │
│  • Response within 4 hours                                   │
│  • Can: Adjust wallet, apply penalties, resolve disputes     │
│  • Cannot: Change system configuration                       │
└─────────────────────────┬───────────────────────────────────┘
                          │ Policy exception needed
                          │ OR system-wide impact
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                 SUPERADMIN (Level 3)                         │
│  • Final authority                                           │
│  • Can: Override any decision, change policies               │
│  • Handles: Appeals, policy exceptions, system issues        │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Escalation SLAs

| Level | Response Time | Resolution Time |
|-------|---------------|-----------------|
| Dispatcher | 15 minutes | 1 hour |
| Admin | 4 hours | 24 hours |
| SuperAdmin | 24 hours | 72 hours |

### 7.4 Escalation Audit Trail

Every escalation records:
- **Who**: User who created/escalated
- **What**: Exception type and details
- **When**: Timestamp of each action
- **Why**: Reason for escalation
- **Resolution**: Final outcome and notes

---

## 8. MOBILE SCOPE

### 8.1 Carrier Mobile App

| Feature | Included | Notes |
|---------|:--------:|-------|
| Login / Auth | ✓ | JWT authentication |
| Set Online / Offline | ✓ | Toggle availability |
| View Available Loads | ✓ | With DH-O filter |
| Accept Load | ✓ | Triggers assignment + escrow |
| Active Trip Screen | ✓ | Map view, route, status |
| Status Updates | ✓ | Arrived → Picked Up → In Transit → Delivered |
| POD Upload | ✓ | Camera/gallery image upload |
| Wallet View | ✓ | Read-only balance |
| Location Tracking | ✓ | During active trips only |

**NOT Included in Carrier Mobile:**
- Load creation
- Truck management
- Document upload
- Dispute creation
- Analytics

### 8.2 Shipper Mobile App

| Feature | Included | Notes |
|---------|:--------:|-------|
| Login / Auth | ✓ | JWT authentication |
| Post Load Requests | ✓ | Basic load creation |
| Track Trips | ✓ | Live map view |
| Timeline Updates | ✓ | Status notifications |
| View POD | ✓ | View submitted POD |
| Load History | ✓ | Past loads list |

**NOT Included in Shipper Mobile:**
- Truck selection (Web only)
- Direct carrier offers (Web only)
- Advanced load editing
- Organization management
- Analytics

### 8.3 Mobile Exclusions (ALL ROLES)

| Feature | Platform |
|---------|----------|
| Admin functions | Web only |
| Dispatcher functions | Web only |
| Document verification | Web only |
| System settings | Web only |
| Analytics dashboards | Web only |
| Bulk operations | Web only |

---

## 9. MOBILE TRACKING RULES

### 9.1 When Tracking is Enabled

| Condition | Tracking Status |
|-----------|-----------------|
| Carrier accepts load | **ENABLED** |
| Load status = ASSIGNED | **ENABLED** |
| Load status = PICKUP_PENDING | **ENABLED** |
| Load status = IN_TRANSIT | **ENABLED** |
| Load status = DELIVERED | **DISABLED** |
| Load status = COMPLETED | **DISABLED** |
| Carrier logs out | **DISABLED** |
| Load cancelled/exception | **DISABLED** |

### 9.2 Tracking Behavior

| Parameter | Value |
|-----------|-------|
| Ping interval | 30-60 seconds |
| Data transmitted | lat, lon, speed, heading, timestamp |
| Backend endpoint | `POST /api/gps/positions` |
| Merge with vehicle GPS | Yes (via truck IMEI) |
| Background tracking | Yes (during active trips) |
| Battery optimization | Adaptive interval based on speed |

### 9.3 Tracking Data Usage

| Use Case | Access |
|----------|--------|
| Shipper live map | Assigned loads only |
| Dispatcher monitoring | All active loads |
| Admin analytics | Aggregated metrics |
| Geofence detection | Automated alerts |
| Trip history | 90-day retention |

### 9.4 Privacy Rules

| Rule | Enforcement |
|------|-------------|
| Carrier location hidden when offline | Automatic |
| Location only shared for assigned loads | API enforced |
| Historical data anonymized after 90 days | Cron job |
| No location sharing without active trip | State machine enforced |

---

## 10. SHIPPER-LED TRUCK MATCHING

### 10.1 Scope

**WEB ONLY** - This feature does NOT exist on mobile.

### 10.2 Workflow

```
┌─────────────────────────────────────────────────────────────┐
│              SHIPPER-LED MATCHING (Web Only)                 │
└─────────────────────────────────────────────────────────────┘

1. Shipper posts load
         │
         ▼
2. Shipper clicks "View Matching Trucks"
         │
         ▼
3. System displays eligible trucks with:
   • Match score
   • DH-O distance
   • Carrier rating
   • Truck details
         │
         ▼
4. Shipper selects preferred truck
         │
         ▼
5. System sends offer to carrier
         │
         ▼
6. Carrier receives notification
         │
         ▼
7. Carrier accepts/rejects offer
         │
         ├── Accept → Load ASSIGNED
         │
         └── Reject → Shipper can select another truck
```

### 10.3 Rules

| Rule | Enforcement |
|------|-------------|
| Web only | Not available on mobile apps |
| Shipper initiates | Shipper selects, carrier responds |
| Carrier must accept | No automatic assignment |
| Single offer at a time | Cannot offer to multiple carriers |
| Offer expiration | 30 minutes default |

### 10.4 API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/loads/[id]/matching-trucks` | List eligible trucks |
| `GET /api/loads/[id]/matches` | Detailed match scores |
| `POST /api/loads/[id]/assign` | Send offer to carrier |

---

## 11. REVOKED FEATURES

### 11.1 Explicitly NOT Implemented

| Feature | Reason | Alternative |
|---------|--------|-------------|
| **AI/ML Matching** | Complexity, unpredictability | Rule-based matching |
| **Dynamic Pricing** | Market manipulation risk | Fixed base + per-km |
| **RPM Pricing** | Does not fit Ethiopian market | Base + per-km model |
| **Automatic Carrier Assignment** | Carrier consent required | Offer/accept workflow |
| **Cross-role Functions** | Role boundary enforcement | Strict RBAC |
| **Mobile Admin** | Security risk | Web-only admin |
| **Mobile Dispatcher** | Operational complexity | Web-only dispatch |
| **Offline Load Creation** | Data sync complexity | Online-only posting |
| **Carrier-initiated Pricing** | Platform sets pricing model | Shipper posts with rate |
| **Multi-load Bundling** | MVP scope | Single load per trip |
| **Route Optimization** | Requires mapping service | Manual route selection |
| **Fuel Surcharges** | Pricing complexity | Included in per-km rate |
| **Accessorial Charges** | MVP scope | Flat rate model |
| **Driver App** | Carrier handles drivers | Carrier mobile only |
| **Public API** | Security scope | Internal APIs only |

### 11.2 Deferred to Phase 2

| Feature | Status | Notes |
|---------|--------|-------|
| GPS Map Visualization | Backend ready | Needs mapping library |
| Native Mobile Apps | APIs ready | React Native/Flutter |
| Advanced Analytics | Basic ready | Charts/graphs |
| API Documentation | Internal docs exist | Swagger/OpenAPI |
| Multi-language | English only | i18n framework |
| SMS Notifications | Email only | SMS gateway |
| Payment Gateway | Manual settlement | Chapa/Telebirr |

### 11.3 Feature Freeze Statement

**The following features are FROZEN in v1.0:**

1. Pricing model: `totalFare = baseFare + (tripKm x perKmEtb)`
2. Role structure: 5 roles (SuperAdmin, Admin, Dispatcher, Carrier, Shipper)
3. State machine: 12 states with defined transitions
4. Automation: Rule-based only, admin-configurable thresholds
5. Mobile scope: Carrier (track/execute), Shipper (post/track)
6. Deadhead: Advisory only, no pricing impact
7. Matching: Rule-based scores, shipper-led selection (Web)

---

## VERSION CONTROL

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-03 | Platform Team | Initial freeze |

---

## CHANGE REQUEST PROCESS

To modify this architecture:

1. **Submit Change Request** with:
   - Proposed change description
   - Business justification
   - Impact analysis
   - Rollback plan

2. **Review by**:
   - Technical Lead
   - Product Owner
   - Security Review (if applicable)

3. **Approval required from**:
   - SuperAdmin sign-off
   - Version increment (1.0 → 1.1)

4. **Documentation update**:
   - Update this document
   - Update version number
   - Record change in VERSION CONTROL table

---

## SIGNATURES

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Technical Lead | _________________ | __________ | __________ |
| Product Owner | _________________ | __________ | __________ |
| Platform SuperAdmin | _________________ | __________ | __________ |

---

**DOCUMENT STATUS: FROZEN**

*This document represents the final architecture for v1.0 of the Ethiopian Freight Management Platform. No changes are permitted without following the Change Request Process and incrementing the version number.*

---

*Generated: 2026-01-03*
*Document: FINAL_ARCHITECTURE_v1.0.md*
*Status: PRODUCTION FROZEN*
