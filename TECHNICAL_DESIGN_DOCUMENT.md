# Technical Design Document (TDD)
## Freight Management Platform MVP

**Version:** 1.0
**Last Updated:** January 21, 2026
**Status:** Production-Ready
**Completion:** 96% (1723/1788 tasks)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Data Architecture](#4-data-architecture)
5. [API Design](#5-api-design)
6. [Authentication & Security](#6-authentication--security)
7. [Business Logic & Rules](#7-business-logic--rules)
8. [User Flows](#8-user-flows)
9. [Integration Points](#9-integration-points)
10. [Mobile Application](#10-mobile-application)
11. [Real-time Features](#11-real-time-features)
12. [Deployment Architecture](#12-deployment-architecture)
13. [Testing Strategy](#13-testing-strategy)
14. [Known Issues & Roadmap](#14-known-issues--roadmap)

---

## 1. Executive Summary

### 1.1 Purpose

The Freight Management Platform is a comprehensive logistics marketplace connecting shippers with carriers in Ethiopia. It enables:

- **Shippers** to post loads and find available trucks
- **Carriers** to post truck availability and find loads
- **Dispatchers** to coordinate matches and manage exceptions
- **Administrators** to manage users, verify documents, and configure platform settings

### 1.2 Key Metrics

| Metric | Value |
|--------|-------|
| Total API Endpoints | 162 |
| Database Models | 45+ |
| Mobile Screens | 32 |
| Web Portal Pages | 50+ |
| Test Pass Rate | 95% (177/187) |
| Sprint Completion | 96% |

### 1.3 Core Features

- **Load Lifecycle Management**: Draft → Posted → Assigned → In-Transit → Delivered → Completed
- **GPS Real-time Tracking**: Device integration, live position, route history
- **Service Fee System**: Corridor-based pricing with commission automation
- **Escrow & Settlement**: Automated fund holding and release
- **Multi-factor Authentication**: OTP via SMS + recovery codes
- **Role-based Access Control**: 5 roles with 50+ permissions

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
├─────────────────────┬─────────────────────┬─────────────────────────────────┤
│   Flutter Mobile    │    Next.js Web      │      GPS Devices                │
│   (iOS/Android)     │    (Browser)        │   (Teltonika/Queclink)          │
└─────────┬───────────┴─────────┬───────────┴──────────────┬──────────────────┘
          │                     │                          │
          │ REST/JSON           │ REST/JSON + WebSocket    │ Webhook
          │                     │                          │
┌─────────▼─────────────────────▼──────────────────────────▼──────────────────┐
│                         NEXT.JS API LAYER                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │    Auth      │  │    Loads     │  │    Trucks    │  │    GPS       │     │
│  │  Middleware  │  │   Service    │  │   Service    │  │  Ingestion   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Trips      │  │  Financial   │  │ Notifications│  │  Automation  │     │
│  │   Service    │  │   Service    │  │   Service    │  │    Engine    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  │ Prisma ORM
                                  │
┌─────────────────────────────────▼───────────────────────────────────────────┐
│                           POSTGRESQL DATABASE                                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │  users  │ │  loads  │ │ trucks  │ │  trips  │ │ gps_pos │ │ wallet  │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────────────┐
│                         EXTERNAL SERVICES                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  AWS S3      │  │ Google Maps  │  │ AfroMessage  │  │   CHAPA      │     │
│  │  (Storage)   │  │   (Routes)   │  │    (SMS)     │  │  (Payments)  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| **Auth Middleware** | JWT verification, session management, CSRF protection |
| **Loads Service** | Load CRUD, status transitions, assignment |
| **Trucks Service** | Fleet management, posting, availability |
| **Trips Service** | Trip execution, GPS tracking, POD |
| **Financial Service** | Wallet, escrow, settlement, commissions |
| **Notifications Service** | Real-time alerts, email, SMS |
| **Automation Engine** | Rules evaluation, scheduled tasks |

### 2.3 Request Flow

```
Client Request
    │
    ▼
┌─────────────────┐
│   Middleware    │ ─── CORS, Rate Limiting, Security Headers
│   (Edge)        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Auth Check    │ ─── JWT Verification, Session Validation
│                 │     CSRF Token Check (for mutations)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   RBAC Check    │ ─── Role & Permission Verification
│                 │     Organization Context
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Route Handler │ ─── Business Logic Execution
│                 │     Database Operations
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Side Effects  │ ─── Notifications, Audit Logs
│                 │     Event Publishing
└────────┬────────┘
         │
         ▼
    JSON Response
```

---

## 3. Technology Stack

### 3.1 Backend

| Layer | Technology | Version |
|-------|------------|---------|
| **Framework** | Next.js (App Router) | 16.1.1 |
| **Language** | TypeScript | 5.x |
| **ORM** | Prisma | 7.2 |
| **Database** | PostgreSQL | 14+ |
| **Auth** | Custom JWT (jose library) | - |
| **Validation** | Zod | 3.x |
| **File Storage** | AWS S3 / Local | - |

### 3.2 Frontend (Web)

| Layer | Technology | Version |
|-------|------------|---------|
| **Framework** | Next.js (App Router) | 16.1.1 |
| **UI Library** | React | 19.x |
| **Styling** | Tailwind CSS | 4.x |
| **Components** | Custom + Radix UI | - |
| **Maps** | Leaflet + Google Maps | - |
| **State** | React Server Components + useState | - |

### 3.3 Mobile

| Layer | Technology | Version |
|-------|------------|---------|
| **Framework** | Flutter | 3.24+ |
| **Language** | Dart | 3.x |
| **State Management** | Riverpod | 2.x |
| **Navigation** | GoRouter | 14.x |
| **HTTP Client** | Dio | 5.x |
| **Storage** | Flutter Secure Storage | - |

### 3.4 External Services

| Service | Provider | Purpose |
|---------|----------|---------|
| **Maps/Routing** | Google Maps API | Distance calculation, visualization |
| **SMS** | AfroMessage | MFA OTP, notifications |
| **Payments** | CHAPA | Wallet deposits (planned) |
| **Storage** | AWS S3 | Document & POD storage |
| **GPS Devices** | Teltonika/Queclink | Vehicle tracking |

---

## 4. Data Architecture

### 4.1 Entity Relationship Overview

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    User      │──────▶│ Organization │◀──────│ FinancialAcc │
└──────────────┘       └──────────────┘       └──────────────┘
       │                      │ ▲                    │
       │                      │ │                    │
       ▼                      ▼ │                    ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   Session    │       │    Load      │       │ JournalEntry │
└──────────────┘       └──────────────┘       └──────────────┘
                              │ ▲
                              │ │
       ┌──────────────────────┼─┼──────────────────────┐
       │                      │ │                      │
       ▼                      ▼ │                      ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    Truck     │       │    Trip      │       │  LoadEvent   │
└──────────────┘       └──────────────┘       └──────────────┘
       │                      │
       │                      │
       ▼                      ▼
┌──────────────┐       ┌──────────────┐
│ TruckPosting │       │ GpsPosition  │
└──────────────┘       └──────────────┘
       │
       ▼
┌──────────────┐
│ TruckRequest │
└──────────────┘
```

### 4.2 Core Models

#### User & Organization
```prisma
model User {
  id             String       @id @default(cuid())
  email          String       @unique
  phone          String?      @unique
  passwordHash   String
  role           UserRole     // SHIPPER, CARRIER, DISPATCHER, ADMIN, SUPER_ADMIN
  status         UserStatus   // REGISTERED, PENDING_VERIFICATION, ACTIVE, SUSPENDED, REJECTED
  organizationId String?
  organization   Organization?
  sessions       Session[]
  mfa            UserMFA?
}

model Organization {
  id                    String           @id @default(cuid())
  name                  String
  type                  OrganizationType // SHIPPER, CARRIER_COMPANY, CARRIER_INDIVIDUAL, etc.
  isVerified            Boolean          @default(false)
  completionRate        Decimal?         // Trust metric
  cancellationRate      Decimal?         // Trust metric
  isFlagged             Boolean          @default(false)
  trucks                Truck[]
  loads                 Load[]
  financialAccounts     FinancialAccount[]
}
```

#### Load & Trip
```prisma
model Load {
  id              String      @id @default(cuid())
  status          LoadStatus  // 13 states
  shipperId       String
  shipper         Organization
  assignedTruckId String?     @unique
  assignedTruck   Truck?

  // Location
  pickupCity      String
  deliveryCity    String
  pickupLat       Decimal?
  pickupLon       Decimal?

  // Pricing
  baseFareEtb     Decimal?
  perKmEtb        Decimal?
  totalFareEtb    Decimal?

  // Service Fee
  serviceFeeStatus ServiceFeeStatus?
  shipperServiceFee Decimal?

  // Tracking
  trackingUrl     String?     @unique
  trackingEnabled Boolean     @default(false)

  trip            Trip?
  events          LoadEvent[]
}

model Trip {
  id              String      @id @default(cuid())
  loadId          String      @unique
  load            Load
  truckId         String
  truck           Truck
  status          TripStatus  // ASSIGNED, PICKUP_PENDING, IN_TRANSIT, DELIVERED, COMPLETED, CANCELLED

  // Timestamps
  startedAt       DateTime?
  pickedUpAt      DateTime?
  deliveredAt     DateTime?
  completedAt     DateTime?

  // Current Location
  currentLat      Decimal?
  currentLng      Decimal?

  // POD
  pods            TripPod[]
  routeHistory    GpsPosition[]
}
```

### 4.3 State Machines

#### Load Status Transitions
```
                                    ┌─────────────┐
                                    │   DRAFT     │
                                    └──────┬──────┘
                                           │
                              ┌────────────┼────────────┐
                              ▼            ▼            ▼
                        ┌─────────┐  ┌──────────┐  ┌──────────┐
                        │ POSTED  │  │ UNPOSTED │  │CANCELLED │
                        └────┬────┘  └──────────┘  └──────────┘
                             │
               ┌─────────────┼─────────────┐
               ▼             ▼             ▼
         ┌──────────┐  ┌──────────┐  ┌──────────┐
         │SEARCHING │  │ OFFERED  │  │ ASSIGNED │◀─────────┐
         └────┬─────┘  └────┬─────┘  └────┬─────┘          │
              │             │             │                │
              └─────────────┴─────────────┘                │
                            │                              │
                            ▼                              │
                   ┌────────────────┐                      │
                   │ PICKUP_PENDING │                      │
                   └───────┬────────┘                      │
                           │                               │
                           ▼                               │
                    ┌──────────────┐                       │
                    │  IN_TRANSIT  │                       │
                    └──────┬───────┘                       │
                           │                               │
                           ▼                               │
                    ┌──────────────┐                       │
                    │  DELIVERED   │                       │
                    └──────┬───────┘                       │
                           │                               │
                           ▼                               │
                    ┌──────────────┐                       │
                    │  COMPLETED   │                       │
                    └──────────────┘                       │
                                                           │
                    ┌──────────────┐                       │
                    │  EXCEPTION   │───────────────────────┘
                    └──────────────┘
```

#### Trip Status Transitions
```
ASSIGNED ──▶ PICKUP_PENDING ──▶ IN_TRANSIT ──▶ DELIVERED ──▶ COMPLETED
    │              │                │              │
    └──────────────┴────────────────┴──────────────┴───────▶ CANCELLED
```

### 4.4 Database Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| `loads` | `(status, pickupCity)` | Load search filtering |
| `loads` | `(shipperId, status)` | Shipper dashboard |
| `loads` | `(trackingUrl)` | Public tracking lookup |
| `trips` | `(carrierId, status)` | Carrier active trips |
| `gps_positions` | `(tripId, timestamp)` | Route history queries |
| `sessions` | `(tokenHash)` | Session validation |
| `notifications` | `(userId, read)` | Unread count |

---

## 5. API Design

### 5.1 API Categories

| Category | Endpoints | Description |
|----------|-----------|-------------|
| **Authentication** | 13 | Login, register, MFA, sessions |
| **Loads** | 30 | Load CRUD, status, assignment |
| **Trucks** | 14 | Fleet management, GPS |
| **Truck Postings** | 9 | Availability posting |
| **Trips** | 9 | Trip execution, POD |
| **Requests** | 8 | TruckRequest, LoadRequest, MatchProposal |
| **Financial** | 10 | Wallet, escrow, settlement |
| **GPS** | 11 | Position ingestion, tracking |
| **Admin** | 31 | User verification, settings |
| **Other** | 27 | Notifications, documents, etc. |

### 5.2 Key Endpoints

#### Load Management
```
POST   /api/loads                    # Create load
GET    /api/loads                    # Search loads (with filters)
GET    /api/loads/[id]               # Get load details
PATCH  /api/loads/[id]               # Update load / change status
POST   /api/loads/[id]/assign        # Assign truck to load
GET    /api/loads/[id]/tracking      # Get tracking URL
GET    /api/loads/[id]/live-position # Current GPS position
POST   /api/loads/[id]/service-fee   # Calculate/reserve service fee
```

#### Trip Management
```
GET    /api/trips                    # List trips
GET    /api/trips/[id]               # Trip details
GET    /api/trips/[id]/live          # Live GPS position
GET    /api/trips/[id]/history       # Route history
POST   /api/trips/[id]/pod           # Upload POD
POST   /api/trips/[id]/confirm       # Shipper confirms delivery
```

#### Request Flows
```
# Shipper requests carrier's truck
POST   /api/truck-requests           # Create request
POST   /api/truck-requests/[id]/respond  # Carrier approves/rejects

# Carrier requests shipper's load
POST   /api/load-requests            # Create request
POST   /api/load-requests/[id]/respond   # Shipper approves/rejects
```

### 5.3 Response Format

```typescript
// Success Response
{
  "data": { ... },
  "message": "Operation successful"
}

// Error Response
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "requestId": "unique-request-id",
  "timestamp": "2026-01-21T12:00:00Z",
  "details": { ... }  // Optional validation details
}
```

### 5.4 Pagination

```typescript
// Request
GET /api/loads?page=0&limit=20&sortBy=createdAt&sortOrder=desc

// Response
{
  "data": [...],
  "pagination": {
    "page": 0,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

## 6. Authentication & Security

### 6.1 Authentication Flow

```
┌────────────┐    POST /api/auth/login    ┌─────────────┐
│   Client   │ ─────────────────────────▶ │   Server    │
└────────────┘    { email, password }      └──────┬──────┘
                                                  │
                                                  ▼
                                           ┌──────────────┐
                                           │ Verify Pass  │
                                           │   (bcrypt)   │
                                           └──────┬───────┘
                                                  │
                                    ┌─────────────┴─────────────┐
                                    │                           │
                                    ▼                           ▼
                            ┌──────────────┐          ┌──────────────┐
                            │   MFA OFF    │          │   MFA ON     │
                            └──────┬───────┘          └──────┬───────┘
                                   │                         │
                                   │                         ▼
                                   │                  ┌──────────────┐
                                   │                  │ Return with  │
                                   │                  │ requiresMfa  │
                                   │                  └──────┬───────┘
                                   │                         │
                                   │                         ▼
                                   │              POST /api/auth/verify-mfa
                                   │                         │
                                   ▼                         ▼
                            ┌──────────────────────────────────────┐
                            │     Generate JWT + Session Record    │
                            │   - Sign with HS256                  │
                            │   - Encrypt with A256GCM (prod)      │
                            │   - Store session in DB              │
                            └──────────────────┬───────────────────┘
                                               │
                                               ▼
                            ┌──────────────────────────────────────┐
                            │     Set httpOnly Cookie              │
                            │   - Secure: true (production)        │
                            │   - SameSite: Lax                    │
                            │   - Expires: 7 days                  │
                            └──────────────────────────────────────┘
```

### 6.2 JWT Structure

```typescript
// Payload
{
  userId: string,
  email: string,
  role: UserRole,
  status: UserStatus,
  organizationId: string | null,
  firstName: string,
  lastName: string,
  sessionId: string,  // Links to Session record
  iat: number,        // Issued at
  exp: number         // Expiration (7 days)
}

// Token Processing
1. Sign: SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).sign(JWT_SECRET)
2. Encrypt (production): EncryptJWT(token).encrypt(JWT_ENCRYPTION_KEY)
3. Verify: jwtVerify(token, JWT_SECRET)
4. Decrypt (production): jwtDecrypt(token, JWT_ENCRYPTION_KEY)
```

### 6.3 CSRF Protection

```
┌────────────┐                              ┌─────────────┐
│   Client   │  1. GET /api/csrf-token     │   Server    │
│            │ ────────────────────────▶   │             │
│            │                              │             │
│            │  2. { token: "abc123" }      │             │
│            │ ◀────────────────────────   │             │
│            │     + Set-Cookie: csrf_token│             │
│            │                              │             │
│            │  3. POST /api/loads         │             │
│            │     Cookie: csrf_token=abc  │             │
│            │     Header: X-CSRF-Token=abc│             │
│            │ ────────────────────────▶   │             │
│            │                              │             │
│            │  4. Verify header == cookie │             │
│            │     (constant-time compare) │             │
└────────────┘                              └─────────────┘
```

### 6.4 Role-Based Access Control

```typescript
// Roles
enum UserRole {
  SHIPPER,      // Posts loads, searches trucks
  CARRIER,      // Owns trucks, searches loads
  DISPATCHER,   // Coordinates matches (read-only except proposals)
  ADMIN,        // Platform management (non-admin users)
  SUPER_ADMIN   // Full platform access
}

// Permission Examples
Permission.CREATE_LOAD        // SHIPPER only
Permission.CREATE_TRUCK       // CARRIER only
Permission.PROPOSE_MATCH      // DISPATCHER only
Permission.VERIFY_DOCUMENT    // ADMIN, SUPER_ADMIN
Permission.MANAGE_ADMINS      // SUPER_ADMIN only

// Check in API Route
await requirePermission(session, Permission.CREATE_LOAD);
```

### 6.5 Security Measures

| Layer | Protection |
|-------|------------|
| **Transport** | HTTPS (TLS 1.3) |
| **Cookies** | httpOnly, Secure, SameSite=Lax |
| **Passwords** | bcrypt (10 rounds) |
| **Tokens** | JWT + Encryption (A256GCM) |
| **Sessions** | Server-side validation, revocation |
| **CSRF** | Double-submit cookie pattern |
| **Rate Limiting** | IP + Email based (5/15min for auth) |
| **IP Blocking** | Admin-managed blocklist |
| **Input** | HTML entity escaping, Zod validation |
| **Headers** | CSP, X-Frame-Options, HSTS |

---

## 7. Business Logic & Rules

### 7.1 Foundation Rules

```typescript
// Rule 1: CARRIER_OWNS_TRUCKS
// Only carriers can own trucks. Trucks are permanent assets.
assertCarrierOwnership(user, truckId);

// Rule 2: POSTING_IS_AVAILABILITY
// TruckPosting expresses temporary availability, not ownership.
// Current location lives in posting, not truck master.

// Rule 3: DISPATCHER_COORDINATION_ONLY
// Dispatchers can propose matches but cannot directly assign.
assertDispatcherCannotAssign(user, action);

// Rule 4: ONE_ACTIVE_POST_PER_TRUCK
// Each truck can have only 1 active posting at a time.
await enforceOneActivePostPerTruck(truckId);

// Rule 5: CARRIER_FINAL_AUTHORITY
// Only the carrier can approve execution of their truck.
// Shippers and dispatchers can only REQUEST, not ASSIGN.
assertCarrierFinalAuthority(user, request);

// Rule 6: SHIPPER_DEMAND_FOCUS
// Shippers manage demand (loads), not supply (trucks).
// Must use TruckPostings, not Trucks, to find availability.
```

### 7.2 Commission & Service Fee

```typescript
// Commission Calculation
const shipperCommission = totalFareEtb * 0.05;  // 5% default
const carrierCommission = totalFareEtb * 0.05;  // 5% default
const platformRevenue = shipperCommission + carrierCommission;
const carrierPayout = totalFareEtb - carrierCommission;

// Service Fee (Corridor-based)
const corridor = findCorridor(originRegion, destRegion);
const shipperFee = tripKm * corridor.shipperPricePerKm;
const carrierFee = tripKm * corridor.carrierPricePerKm;

// With Promotions
if (corridor.shipperPromoFlag) {
  shipperFee *= (1 - corridor.shipperPromoPct / 100);
}
```

### 7.3 Escrow Flow

```
Load Assignment
      │
      ▼
┌──────────────────────┐
│ Hold Funds in Escrow │  Shipper Wallet → Escrow Account
│ Amount = totalFareEtb│  JournalEntry: ESCROW_FUND
└──────────┬───────────┘
           │
           ▼
    Trip Execution
           │
           ▼
┌──────────────────────┐
│   POD Submitted      │
│   POD Verified       │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Release to Carrier  │  Escrow → Carrier Wallet
│  Deduct Commission   │  JournalEntry: COMMISSION
└──────────────────────┘
```

### 7.4 Trust Metrics

```typescript
interface TrustMetrics {
  completionRate: number;      // % delivered successfully
  cancellationRate: number;    // % cancelled (flag if >20%)
  disputeRate: number;         // % disputed
  totalLoadsCompleted: number;
  isFlagged: boolean;          // Admin review needed
  flagReason?: string;
}

// Calculation
completionRate = completedLoads / totalLoads * 100;
cancellationRate = cancelledLoads / totalLoads * 100;

// Flagging Threshold
if (cancellationRate > 20) {
  organization.isFlagged = true;
  organization.flagReason = 'High cancellation rate';
}
```

---

## 8. User Flows

### 8.1 Shipper Flow

```
1. Login → Shipper Dashboard
     │
     ├──▶ Post Load
     │      │
     │      ├── Fill details (pickup, delivery, cargo, price)
     │      ├── Save as DRAFT or POST immediately
     │      └── Load appears in marketplace
     │
     ├──▶ Search Trucks (via TruckPostings)
     │      │
     │      ├── Filter by location, type, capacity
     │      ├── View truck details
     │      └── Send TruckRequest → Carrier approves
     │
     ├──▶ Track Shipments
     │      │
     │      ├── View assigned loads
     │      ├── Real-time GPS tracking
     │      ├── Trip progress %
     │      └── ETA to delivery
     │
     └──▶ Verify Delivery
            │
            ├── Review POD
            ├── Confirm delivery
            └── Payment settled
```

### 8.2 Carrier Flow

```
1. Login → Carrier Dashboard
     │
     ├──▶ Manage Fleet (/trucks)
     │      │
     │      ├── Add trucks (pending approval)
     │      ├── Register GPS devices
     │      └── View truck status
     │
     ├──▶ Post Truck Availability
     │      │
     │      ├── Select truck
     │      ├── Set origin/destination
     │      ├── Set availability window
     │      └── Posting appears in marketplace
     │
     ├──▶ Search Loads
     │      │
     │      ├── Filter by route, type, rate
     │      ├── View load details
     │      └── Send LoadRequest → Shipper approves
     │
     ├──▶ Manage Requests
     │      │
     │      ├── View TruckRequests (from shippers)
     │      ├── Approve/reject
     │      └── Load auto-assigned on approval
     │
     └──▶ Execute Trip
            │
            ├── Mark pickup pending
            ├── Mark in transit (GPS tracking starts)
            ├── Mark delivered
            ├── Upload POD
            └── Payment received
```

### 8.3 Dispatcher Flow

```
1. Login → Dispatcher Dashboard
     │
     ├──▶ View All Loads (cross-organization)
     │
     ├──▶ View All Trucks (cross-organization)
     │
     ├──▶ Create MatchProposals
     │      │
     │      ├── Select load + truck
     │      ├── Propose rate
     │      └── Carrier must approve (CARRIER_FINAL_AUTHORITY)
     │
     ├──▶ Handle Exceptions
     │      │
     │      ├── View escalations
     │      ├── Assign to team
     │      └── Resolve issues
     │
     └──▶ Monitor GPS (all trips)
```

---

## 9. Integration Points

### 9.1 GPS Device Integration

```
┌─────────────────┐     Webhook     ┌─────────────────┐
│  GPS Device     │ ──────────────▶ │ POST /api/gps   │
│  (Teltonika)    │                 │    /position    │
└─────────────────┘                 └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │  gpsIngestion   │
                                    │  - Validate IMEI│
                                    │  - Find truck   │
                                    │  - Link to trip │
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │  GpsPosition    │
                                    │  - lat, lng     │
                                    │  - speed        │
                                    │  - heading      │
                                    │  - timestamp    │
                                    └─────────────────┘
```

**Supported Providers:**
- Teltonika (FMB series)
- Queclink (GV series)

**Data Fields:**
- IMEI (device identifier)
- Latitude, Longitude
- Speed (km/h)
- Heading (degrees)
- Altitude (meters)
- Timestamp (UTC)

### 9.2 SMS Integration (AfroMessage)

```typescript
// lib/sms/afromessage.ts

// MFA OTP
await sendMFAOTP(phone, code);
// Message: "Your verification code is: 123456"

// Password Reset
await sendPasswordResetOTP(phone, code);
// Message: "Your password reset code is: 123456"

// Login Alert
await sendLoginAlert(phone, deviceInfo);
// Message: "New login detected from Chrome on Windows"
```

### 9.3 Google Maps Integration

```typescript
// lib/googleRoutes.ts

// Distance Calculation
const distance = await calculateRouteDistance(
  { lat: 9.0320, lng: 38.7469 },  // Addis Ababa
  { lat: 9.6010, lng: 41.8515 }   // Dire Dawa
);
// Returns: { distanceKm: 450, durationMin: 420 }

// Route caching to minimize API calls
const cacheKey = `${originLat},${originLng}-${destLat},${destLng}`;
const cached = await db.routeCache.findUnique({ where: { cacheKey } });
```

### 9.4 File Storage (S3)

```typescript
// lib/storage.ts

// Upload POD
const url = await uploadFile(file, 'pod', tripId);
// Returns: https://bucket.s3.region.amazonaws.com/pod/tripId/filename.pdf

// Generate signed URL (expiring)
const signedUrl = await getSignedUrl(fileKey, 3600); // 1 hour

// Delete file
await deleteFile(fileKey);
```

---

## 10. Mobile Application

### 10.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Flutter App                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   Presentation                       │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐│    │
│  │  │ Screens │  │ Widgets │  │ Modals  │  │  Maps   ││    │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘│    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 State Management                     │    │
│  │  ┌─────────────────────────────────────────────┐   │    │
│  │  │              Riverpod Providers              │   │    │
│  │  │  - AuthProvider                              │   │    │
│  │  │  - LoadProvider                              │   │    │
│  │  │  - TruckProvider                             │   │    │
│  │  └─────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    Services                          │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐│    │
│  │  │ AuthSvc  │ │ LoadSvc  │ │ TruckSvc │ │ TripSvc ││    │
│  │  └──────────┘ └──────────┘ └──────────┘ └─────────┘│    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    Core Layer                        │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │    │
│  │  │  API Client  │  │   Models     │  │  Storage  │ │    │
│  │  │  (Dio)       │  │   (Dart)     │  │  (Secure) │ │    │
│  │  └──────────────┘  └──────────────┘  └───────────┘ │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 Navigation (GoRouter)

```dart
// Route Structure
/onboarding          → OnboardingScreen
/login               → LoginScreen
/register            → RegisterScreen

// Shipper Routes (ShellRoute with NavBar)
/shipper             → ShipperHomeScreen
/shipper/loads       → MyLoadsScreen
/shipper/loads/post  → PostLoadScreen
/shipper/trucks      → TruckboardScreen
/shipper/trips       → TripsScreen
/shipper/map         → MapScreen

// Carrier Routes (ShellRoute with NavBar)
/carrier             → CarrierHomeScreen
/carrier/trucks      → MyTrucksScreen
/carrier/trucks/add  → AddTruckScreen
/carrier/loadboard   → LoadboardScreen
/carrier/trips       → TripsScreen
/carrier/map         → MapScreen

// Shared Routes
/profile             → ProfileScreen
/notifications       → NotificationsScreen
/wallet              → WalletScreen
```

### 10.3 API Client Configuration

```dart
class ApiClient {
  late final Dio _dio;

  ApiClient() {
    _dio = Dio(BaseOptions(
      baseUrl: Environment.apiBaseUrl,
      connectTimeout: Duration(seconds: 30),
      receiveTimeout: Duration(seconds: 30),
    ));

    // Auth interceptor
    _dio.interceptors.add(AuthInterceptor(
      getToken: () => _storage.read(key: 'session_token'),
      getCsrfToken: () => _storage.read(key: 'csrf_token'),
    ));

    // Logging interceptor
    _dio.interceptors.add(LogInterceptor());
  }
}
```

### 10.4 Screen Inventory

| Feature | Shipper Screens | Carrier Screens |
|---------|-----------------|-----------------|
| **Dashboard** | ShipperHomeScreen | CarrierHomeScreen |
| **Load Management** | MyLoadsScreen, PostLoadScreen | LoadboardScreen, LoadDetailsScreen |
| **Truck Management** | TruckboardScreen, TruckDetailsScreen | MyTrucksScreen, AddTruckScreen |
| **Trips** | ShipperTripsScreen | CarrierTripsScreen, PodUploadScreen |
| **Requests** | TruckRequestsScreen | LoadRequestsScreen |
| **Map** | ShipperMapScreen | CarrierMapScreen |
| **Total** | 12 screens | 15 screens |

---

## 11. Real-time Features

### 11.1 GPS Live Tracking

```typescript
// Client polling (every 5 seconds)
const pollLivePosition = async (tripId: string) => {
  const response = await fetch(`/api/trips/${tripId}/live`);
  const { currentLat, currentLng, speed, heading, eta } = await response.json();
  updateMapMarker(currentLat, currentLng, heading);
  updateEtaDisplay(eta);
};

// Server response
{
  currentLat: 9.0320,
  currentLng: 38.7469,
  speed: 45,
  heading: 120,
  tripProgressPercent: 65,
  remainingDistanceKm: 150,
  eta: "2026-01-21T15:30:00Z"
}
```

### 11.2 WebSocket Notifications

```typescript
// lib/websocket-server.ts

// Send real-time notification
sendRealtimeNotification(userId, {
  type: 'TRUCK_REQUEST',
  title: 'New Truck Request',
  message: 'Shipper ABC wants your truck',
  metadata: { loadId, truckId }
});

// Client subscription
socket.on('notification', (notification) => {
  showToast(notification.title);
  refreshNotificationBadge();
});
```

### 11.3 Notification Types

| Type | Trigger | Recipients |
|------|---------|------------|
| `TRUCK_REQUEST` | Shipper requests truck | Carrier |
| `LOAD_REQUEST` | Carrier requests load | Shipper |
| `REQUEST_APPROVED` | Request approved | Requester |
| `REQUEST_REJECTED` | Request rejected | Requester |
| `GPS_OFFLINE` | No GPS signal >15min | Carrier, Dispatcher |
| `POD_SUBMITTED` | Carrier uploads POD | Shipper |
| `TRIP_COMPLETED` | Settlement done | Both parties |
| `EXCEPTION_CREATED` | Late/issue detected | Dispatcher, Admin |

---

## 12. Deployment Architecture

### 12.1 Production Environment

```
┌─────────────────────────────────────────────────────────────┐
│                        VERCEL                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Next.js Application                     │   │
│  │  - API Routes (162 endpoints)                       │   │
│  │  - Server Components                                 │   │
│  │  - Edge Middleware                                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
           ┌────────────────┴────────────────┐
           │                                 │
           ▼                                 ▼
┌─────────────────────┐           ┌─────────────────────┐
│   PostgreSQL DB     │           │      AWS S3         │
│   (Supabase/RDS)    │           │   (File Storage)    │
└─────────────────────┘           └─────────────────────┘
```

### 12.2 Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Authentication
JWT_SECRET=<32-byte-secret>
JWT_ENCRYPTION_KEY=<32-byte-key>

# External Services
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<key>
AFROMESSAGE_API_KEY=<key>
CHAPA_SECRET_KEY=<key>

# AWS S3
AWS_REGION=eu-west-1
AWS_S3_BUCKET=freight-files
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>

# Feature Flags
ENABLE_MFA=true
ENABLE_SMS_NOTIFICATIONS=true
```

### 12.3 Cron Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| `expire-loads` | Every hour | Expire old loads |
| `expire-postings` | Every hour | Expire old truck postings |
| `auto-settle` | Every 15 min | Process settlements |
| `gps-monitor` | Every 5 min | Detect GPS offline |
| `gps-cleanup` | Daily | Delete old GPS data |

---

## 13. Testing Strategy

### 13.1 Test Categories

| Type | Coverage | Tools |
|------|----------|-------|
| **Unit Tests** | Services, utilities | Jest |
| **Integration Tests** | API routes | Jest + Supertest |
| **E2E Tests** | User flows | Playwright |
| **Security Tests** | Auth, RBAC, CSRF | Jest |

### 13.2 Current Test Results

```
Test Suites: 8 passed, 8 total
Tests:       177 passed, 10 skipped, 187 total
Pass Rate:   95%

Security Tests:     ✓ All passing
Foundation Rules:   ✓ All passing
API Routes:         ✓ All passing
RBAC:              ✓ All passing
```

### 13.3 Test Commands

```bash
# Run all tests
npm test

# Run security tests
npm test -- --testPathPattern=security

# Run with coverage
npm test -- --coverage
```

---

## 14. Known Issues & Roadmap

### 14.1 Open Issues

| Priority | Issue | Status |
|----------|-------|--------|
| **High** | Payment gateway integration incomplete | In Progress |
| **High** | Push notifications (mobile) not implemented | TODO |
| **Medium** | Error tracking service not configured | TODO |
| **Medium** | CSP headers need tightening | TODO |
| **Low** | Multi-language support | Future |
| **Low** | Offline mode (mobile) | Future |

### 14.2 Recent Fixes (Sprint 22)

- ✅ Trip/Load status bidirectional sync
- ✅ Trip timestamp management
- ✅ TruckPosting automatic expiration
- ✅ GPS history endpoint mobile compatibility
- ✅ Load.podUrl always uses latest POD
- ✅ Request idempotency handling
- ✅ TrackingUrl collision prevention

### 14.3 Future Roadmap

**Q1 2026:**
- Complete payment gateway (CHAPA)
- Implement push notifications
- Add error tracking (Sentry)
- Mobile app store release

**Q2 2026:**
- Multi-language support (Amharic)
- Advanced analytics dashboard
- Carrier rating system
- Offline mode for mobile

**Q3 2026:**
- API versioning (v2)
- Performance optimization
- Load balancing
- CDN for static assets

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Load** | A shipment request from shipper to carrier |
| **Trip** | The execution of a load (tracking, POD) |
| **TruckPosting** | A carrier's truck availability listing |
| **TruckRequest** | Shipper requesting a specific truck |
| **LoadRequest** | Carrier requesting a specific load |
| **MatchProposal** | Dispatcher-suggested load-truck match |
| **POD** | Proof of Delivery document |
| **Escrow** | Funds held during trip execution |
| **Service Fee** | Platform fee based on corridor pricing |
| **Commission** | Percentage taken from shipper/carrier |

---

## Appendix B: API Quick Reference

```
Authentication:
  POST /api/auth/login
  POST /api/auth/register
  POST /api/auth/logout
  POST /api/auth/verify-mfa
  GET  /api/auth/me

Loads:
  GET  /api/loads
  POST /api/loads
  GET  /api/loads/[id]
  PATCH /api/loads/[id]
  POST /api/loads/[id]/assign

Trucks:
  GET  /api/trucks
  POST /api/trucks
  GET  /api/trucks/[id]

Truck Postings:
  GET  /api/truck-postings
  POST /api/truck-postings

Trips:
  GET  /api/trips
  GET  /api/trips/[id]
  GET  /api/trips/[id]/live
  POST /api/trips/[id]/pod

Requests:
  POST /api/truck-requests
  POST /api/truck-requests/[id]/respond
  POST /api/load-requests
  POST /api/load-requests/[id]/respond
```

---

**Document Version:** 1.0
**Last Updated:** January 21, 2026
**Author:** Engineering Team
**Reviewed By:** Architecture Review Board
