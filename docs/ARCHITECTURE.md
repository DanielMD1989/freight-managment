# Freight Management Platform - Architecture Documentation

## Overview

The Freight Management Platform is a comprehensive logistics solution for Ethiopian freight operations, connecting shippers, carriers, and dispatchers with real-time GPS tracking.

---

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **Next.js 15** | React framework with App Router |
| **React 19** | UI library |
| **TypeScript** | Type-safe JavaScript |
| **Tailwind CSS** | Utility-first CSS |
| **Shadcn/ui** | Component library |
| **React Hook Form** | Form management |
| **Zod** | Schema validation |
| **TanStack Query** | Data fetching & caching |

### Backend
| Technology | Purpose |
|------------|---------|
| **Next.js API Routes** | REST API endpoints |
| **Prisma** | ORM & database migrations |
| **PostgreSQL** | Primary database |
| **Redis** | Caching, rate limiting, sessions |
| **BullMQ** | Background job queue |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| **AWS S3** | File storage (documents, POD) |
| **Sentry** | Error tracking |
| **Chapa** | Ethiopian payment gateway |
| **AfroMessage** | SMS notifications |

---

## Folder Structure

```
freight-management/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth pages (login, register)
│   ├── (panels)/                 # Role-based dashboards
│   │   ├── admin/                # Admin panel
│   │   ├── carrier/              # Carrier panel
│   │   ├── dispatcher/           # Dispatcher panel
│   │   └── shipper/              # Shipper panel
│   ├── api/                      # API routes (168 endpoints)
│   │   ├── admin/                # Admin endpoints
│   │   ├── auth/                 # Authentication
│   │   ├── carrier/              # Carrier-specific
│   │   ├── dispatcher/           # Dispatcher-specific
│   │   ├── gps/                  # GPS tracking
│   │   ├── loads/                # Load management
│   │   ├── trips/                # Trip management
│   │   ├── trucks/               # Truck management
│   │   ├── wallet/               # Financial operations
│   │   └── ...
│   ├── global-error.tsx          # Global error boundary
│   └── layout.tsx                # Root layout
│
├── components/                   # React components
│   ├── ui/                       # Shadcn/ui primitives
│   ├── forms/                    # Form components
│   ├── dashboard/                # Dashboard widgets
│   ├── maps/                     # Map components
│   └── ...
│
├── lib/                          # Core libraries
│   ├── auth.ts                   # JWT & session management
│   ├── db.ts                     # Prisma client
│   ├── cache.ts                  # Redis cache utilities
│   ├── rateLimit.ts              # Rate limiting
│   ├── matchingEngine.ts         # Load/truck matching
│   ├── loadStateMachine.ts       # Load state transitions
│   ├── tripStateMachine.ts       # Trip state transitions
│   ├── serviceFeeCalculation.ts  # Fee calculations
│   ├── serviceFeeManagement.ts   # Fee deduction/refund
│   ├── geo.ts                    # Haversine distance
│   └── rounding.ts               # Numeric rounding
│
├── prisma/
│   ├── schema.prisma             # Database schema
│   ├── migrations/               # Migration history
│   └── seed.ts                   # Seed data
│
├── __tests__/                    # Jest test files
│   ├── api/                      # API route tests
│   └── lib/                      # Library tests
│
├── docs/                         # Documentation
│   ├── openapi.yaml              # OpenAPI specification
│   ├── API.md                    # API documentation
│   ├── ARCHITECTURE.md           # This file
│   └── DEPLOYMENT.md             # Deployment guide
│
├── public/                       # Static assets
└── hooks/                        # Custom React hooks
```

---

## Database Schema

### Core Entities

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│      User       │     │  Organization   │     │   UserSession   │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id              │────▶│ id              │     │ id              │
│ email           │     │ name            │     │ userId          │
│ password        │     │ type            │     │ token           │
│ firstName       │     │ isVerified      │     │ expiresAt       │
│ lastName        │     │ trustScore      │     │ userAgent       │
│ phone           │     │ wallets[]       │     │ ipAddress       │
│ role            │     └─────────────────┘     └─────────────────┘
│ status          │
│ organizationId  │
│ mfaEnabled      │
└─────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│      Load       │     │      Truck      │     │      Trip       │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id              │     │ id              │     │ id              │
│ status          │────▶│ licensePlate    │◀────│ loadId          │
│ pickupCity      │     │ truckType       │     │ truckId         │
│ deliveryCity    │     │ capacity        │     │ status          │
│ pickupDate      │     │ isAvailable     │     │ carrierId       │
│ deliveryDate    │     │ carrierId       │     │ shipperId       │
│ truckType       │     │ currentLat      │     │ startedAt       │
│ weight          │     │ currentLon      │     │ deliveredAt     │
│ shipperId       │     │ gpsDeviceId     │     │ completedAt     │
│ assignedTruckId │     └─────────────────┘     │ trackingUrl     │
│ serviceFeeEtb   │                             └─────────────────┘
└─────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Corridor     │     │ FinancialAccount│     │  JournalEntry   │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id              │     │ id              │     │ id              │
│ name            │     │ organizationId  │     │ transactionType │
│ originRegion    │     │ accountType     │     │ description     │
│ destRegion      │     │ balance         │     │ amount          │
│ distanceKm      │     │ currency        │     │ loadId          │
│ shipperPrice/Km │     │ isActive        │     │ lines[]         │
│ carrierPrice/Km │     └─────────────────┘     └─────────────────┘
│ promoFlag       │
│ promoPct        │
└─────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   TruckPosting  │     │  GPSPosition    │     │   Document      │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id              │     │ id              │     │ id              │
│ truckId         │     │ truckId         │     │ type            │
│ originCity      │     │ latitude        │     │ filename        │
│ destinationCity │     │ longitude       │     │ url             │
│ availableDate   │     │ speed           │     │ entityType      │
│ expiresAt       │     │ heading         │     │ entityId        │
│ status          │     │ timestamp       │     │ uploadedBy      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Key Relationships

- **User** → **Organization**: Many-to-one (users belong to organization)
- **Organization** → **FinancialAccount**: One-to-many (wallets)
- **Load** → **Trip**: One-to-one (load creates trip when assigned)
- **Truck** → **Trip**: One-to-many (truck can have trip history)
- **Truck** → **TruckPosting**: One-to-one (active posting)
- **Truck** → **GPSPosition**: One-to-many (position history)
- **Load** → **Corridor**: Many-to-one (pricing corridor)

---

## Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │     │   API    │     │   Auth   │     │ Database │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ POST /login    │                │                │
     │───────────────▶│                │                │
     │                │ Verify creds   │                │
     │                │───────────────▶│                │
     │                │                │ Query user     │
     │                │                │───────────────▶│
     │                │                │◀───────────────│
     │                │◀───────────────│                │
     │                │                │                │
     │ [MFA Required] │                │                │
     │◀───────────────│                │                │
     │                │                │                │
     │ POST /verify-mfa                │                │
     │───────────────▶│                │                │
     │                │ Verify OTP     │                │
     │                │───────────────▶│                │
     │                │◀───────────────│                │
     │                │                │                │
     │ Session + CSRF │                │                │
     │◀───────────────│                │                │
     │                │                │                │
     │ GET /loads     │                │                │
     │ + CSRF Token   │                │                │
     │───────────────▶│                │                │
     │                │ Validate session               │
     │                │───────────────▶│                │
     │                │◀───────────────│                │
     │                │                │ Query loads   │
     │                │                │───────────────▶│
     │                │◀───────────────│◀───────────────│
     │ Loads response │                │                │
     │◀───────────────│                │                │
```

### Security Features

1. **Password Security**
   - Argon2 hashing
   - Password policy enforcement
   - Brute force protection

2. **Session Management**
   - JWT with A256GCM encryption
   - Session invalidation on logout
   - Concurrent session limits

3. **CSRF Protection**
   - Token-based for web clients
   - Double-submit cookie pattern

4. **Rate Limiting**
   - Per-endpoint limits
   - IP-based throttling
   - Account lockout

---

## Business Logic Flow

### Load Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                         SHIPPER FLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. CREATE LOAD                                                 │
│     POST /loads {pickupCity, deliveryCity, weight, ...}         │
│     └─▶ Status: DRAFT                                           │
│                                                                 │
│  2. POST LOAD                                                   │
│     PATCH /loads/{id}/status {status: "POSTED"}                 │
│     └─▶ Status: POSTED                                          │
│     └─▶ Corridor auto-assigned (service fee calculated)         │
│     └─▶ Notifications sent to matching carriers                 │
│                                                                 │
│  3. SEARCH FOR TRUCKS                                           │
│     GET /loads/{id}/matching-trucks                             │
│     └─▶ Returns trucks sorted by match score                    │
│                                                                 │
│  4. ASSIGN TRUCK                                                │
│     POST /loads/{id}/assign {truckId}                           │
│     └─▶ Status: ASSIGNED                                        │
│     └─▶ Trip created                                            │
│     └─▶ Carrier notified                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         CARRIER FLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  5. CONFIRM ASSIGNMENT                                          │
│     POST /trips/{tripId}/confirm                                │
│     └─▶ Trip Status: PICKUP_PENDING                             │
│     └─▶ Load Status: PICKUP_PENDING                             │
│                                                                 │
│  6. START TRIP (At pickup location)                             │
│     PATCH /trips/{tripId} {status: "IN_TRANSIT"}                │
│     └─▶ Trip Status: IN_TRANSIT                                 │
│     └─▶ Load Status: IN_TRANSIT                                 │
│     └─▶ GPS tracking activated                                  │
│                                                                 │
│  7. DELIVER (At delivery location)                              │
│     PATCH /trips/{tripId} {status: "DELIVERED"}                 │
│     └─▶ Trip Status: DELIVERED                                  │
│     └─▶ Load Status: DELIVERED                                  │
│                                                                 │
│  8. UPLOAD POD & COMPLETE                                       │
│     POST /trips/{tripId}/pod {file, receiverName, ...}          │
│     └─▶ Trip Status: COMPLETED                                  │
│     └─▶ Load Status: COMPLETED                                  │
│     └─▶ Service fees deducted from wallets                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Service Fee Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE FEE DEDUCTION                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TRIGGER: Trip status changes to COMPLETED                      │
│                                                                 │
│  1. Find matching corridor                                      │
│     └─▶ Match by origin/destination regions                    │
│                                                                 │
│  2. Calculate fees                                              │
│     └─▶ Shipper Fee = distance × shipperPricePerKm             │
│     └─▶ Carrier Fee = distance × carrierPricePerKm             │
│     └─▶ Apply promo discounts if active                        │
│                                                                 │
│  3. Deduct from wallets (atomic transaction)                    │
│     └─▶ Shipper wallet -= shipperFee                           │
│     └─▶ Carrier wallet -= carrierFee                           │
│     └─▶ Platform revenue += totalFee                           │
│     └─▶ Journal entry created                                  │
│                                                                 │
│  4. Update load record                                          │
│     └─▶ shipperServiceFee, carrierServiceFee stored            │
│     └─▶ shipperFeeStatus = DEDUCTED                            │
│     └─▶ carrierFeeStatus = DEDUCTED                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Matching Engine

The matching engine scores trucks/loads based on multiple factors:

### Scoring Criteria

| Factor | Weight | Description |
|--------|--------|-------------|
| **Distance (DH-O)** | 30% | Dead-head to origin (< 200km required) |
| **Truck Type** | 25% | Exact match or compatible group |
| **Capacity** | 20% | Weight fits, good utilization (70-95% ideal) |
| **Destination** | 15% | Truck heading matches delivery location |
| **Availability** | 10% | Available date matches pickup date |

### Compatibility Groups

```
GENERAL:     DRY_VAN, FLATBED, BOX_TRUCK, CONTAINER
COLD_CHAIN:  REFRIGERATED, REEFER
SPECIALIZED: TANKER, LOWBOY, DUMP_TRUCK
```

Trucks in the same group can carry loads of any type in that group.

---

## Caching Strategy

### Cache Layers

1. **Redis Cache** (distributed)
   - Session data
   - Rate limit counters
   - Feature flags
   - Load/truck listings

2. **In-Memory Cache** (per-instance)
   - Ethiopian locations
   - Corridor pricing
   - Configuration

### Cache Invalidation

| Entity | TTL | Invalidation |
|--------|-----|--------------|
| Load listings | 30s | On create/update/delete |
| Truck listings | 30s | On create/update/delete |
| Active trips | 60s | On status change |
| Corridors | 5min | On admin update |
| User sessions | 7d | On logout/revoke |

---

## Background Jobs

### Job Queues (BullMQ)

| Queue | Purpose |
|-------|---------|
| `notifications` | Email/SMS notifications |
| `settlements` | Carrier payment processing |
| `gps-cleanup` | Remove old GPS positions |
| `load-expiry` | Auto-expire stale loads |
| `posting-expiry` | Auto-expire truck postings |
| `sla-aggregation` | Daily SLA metrics |

### Cron Jobs

| Schedule | Job | Description |
|----------|-----|-------------|
| `*/5 * * * *` | `expire-loads` | Expire loads past pickup date |
| `*/5 * * * *` | `expire-postings` | Expire truck postings |
| `0 * * * *` | `gps-cleanup` | Delete GPS positions > 30 days |
| `0 2 * * *` | `aggregate-sla` | Calculate daily SLA metrics |
| `0 3 * * *` | `auto-settle` | Process pending settlements |

---

## Error Handling

### Error Hierarchy

```typescript
// Base error
class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
}

// Specific errors
class ValidationError extends AppError {}  // 400
class AuthenticationError extends AppError {} // 401
class AuthorizationError extends AppError {}  // 403
class NotFoundError extends AppError {}       // 404
class ConflictError extends AppError {}       // 409
class RateLimitError extends AppError {}      // 429
```

### Error Flow

```
API Request
    │
    ▼
┌─────────────────┐
│   Middleware    │───▶ Rate Limit Error (429)
│  (Rate Limit)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Middleware    │───▶ Auth Error (401/403)
│     (Auth)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Validation    │───▶ Validation Error (400)
│     (Zod)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Route Handler  │───▶ Business Logic Error
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Error Handler   │───▶ Sentry (if enabled)
│   (Sanitize)    │───▶ Formatted Response
└─────────────────┘
```

---

## Monitoring

### Health Checks

- **Database:** Connection pool status
- **Redis:** Connection status
- **Queue:** Job counts by status
- **Memory:** Heap usage
- **CPU:** Event loop latency

### Metrics (Sentry + Custom)

| Metric | Type | Alert Threshold |
|--------|------|-----------------|
| Request latency | Histogram | P95 > 2s |
| Error rate | Counter | > 5% |
| Database queries | Counter | Slow queries > 1s |
| Memory usage | Gauge | > 85% |
| Active sessions | Gauge | - |

---

## Security Considerations

### Data Protection

- **Encryption at rest:** PostgreSQL with encryption
- **Encryption in transit:** TLS 1.3 everywhere
- **PII masking:** Phone numbers, emails in logs
- **Anonymous loads:** Shipper identity hidden

### Input Validation

- Zod schemas for all API inputs
- SQL injection prevention (Prisma parameterization)
- XSS prevention (React auto-escaping)
- CSRF tokens for state-changing operations

### Audit Trail

All sensitive operations are logged:
- User authentication events
- Permission changes
- Financial transactions
- Document access
- Admin actions

---

## Deployment Architecture

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

```
                    ┌─────────────────┐
                    │   CloudFlare    │
                    │      (CDN)      │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   Load Balancer │
                    │    (ALB/NLB)    │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
   ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐
   │  Next.js    │    │  Next.js    │    │  Next.js    │
   │  Instance 1 │    │  Instance 2 │    │  Instance N │
   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
     ┌───────────────────────┼───────────────────────┐
     │                       │                       │
┌────▼────┐            ┌─────▼─────┐           ┌─────▼─────┐
│ Redis   │            │PostgreSQL │           │    S3     │
│ Cluster │            │   (RDS)   │           │  Bucket   │
└─────────┘            └───────────┘           └───────────┘
```
