# Full Application Audit Report

**Generated:** 2026-02-05
**Total Files in app/:** 330
**Total API Routes:** 163

---

## 1. SCHEMA vs QUERIES AUDIT

### Schema Summary

| Model | Key Fields | Relations |
|-------|------------|-----------|
| User | id, email, role, status, organizationId | Organization, Loads, Sessions |
| Organization | id, name, type, isVerified | Users, Loads, Trucks, FinancialAccounts |
| Load | id, status, shipperId, pickupCity, deliveryCity, assignedTruckId | Shipper, AssignedTruck, Trip |
| Truck | id, licensePlate, truckType, carrierId, isAvailable, approvalStatus | Carrier, TruckPostings, Trips |
| Trip | id, status, loadId, truckId, carrierId, shipperId | Load, Truck, Carrier, Shipper |
| TruckPosting | id, status, truckId, carrierId, originCityId | Truck, Carrier, OriginCity |
| FinancialAccount | id, accountType, balance, organizationId | Organization, JournalLines |
| JournalEntry | id, transactionType, loadId | Load, JournalLines |
| JournalLine | id, amount, isDebit, accountId, creditAccountId | JournalEntry, Account, CreditAccount |

### Enums Defined

| Enum | Values |
|------|--------|
| UserRole | SHIPPER, CARRIER, DISPATCHER, ADMIN, SUPER_ADMIN |
| UserStatus | REGISTERED, PENDING_VERIFICATION, ACTIVE, SUSPENDED, REJECTED |
| LoadStatus | DRAFT, POSTED, SEARCHING, OFFERED, ASSIGNED, PICKUP_PENDING, IN_TRANSIT, DELIVERED, COMPLETED, EXCEPTION, CANCELLED, EXPIRED, UNPOSTED |
| TripStatus | ASSIGNED, PICKUP_PENDING, IN_TRANSIT, DELIVERED, COMPLETED, CANCELLED |
| TruckType | FLATBED, REFRIGERATED, TANKER, CONTAINER, DRY_VAN, LOWBOY, DUMP_TRUCK, BOX_TRUCK |
| AccountType | SHIPPER_WALLET, CARRIER_WALLET, PLATFORM_REVENUE |
| TransactionType | DEPOSIT, WITHDRAWAL, COMMISSION, SETTLEMENT, REFUND, SERVICE_FEE_RESERVE, SERVICE_FEE_DEDUCT, SERVICE_FEE_REFUND |
| PostingStatus | ACTIVE, EXPIRED, CANCELLED, MATCHED |
| VerificationStatus | PENDING, APPROVED, REJECTED, EXPIRED |

### Known Schema/Query Mismatches

| File | Line | Issue | Severity |
|------|------|-------|----------|
| `app/api/wallet/transactions/route.ts` | 82-85 | Previously referenced `debitAccountId` which doesn't exist. Should be `accountId`. | **CRITICAL - 500 Error** |

### JournalLine Field Reference
The `JournalLine` model has these fields (NOT `debitAccountId`):
- `accountId` - The debit account (FK to FinancialAccount)
- `creditAccountId` - The credit account (FK to FinancialAccount)
- `isDebit` - Boolean indicating if this is a debit entry

---

## 2. API ROUTES AUDIT

### Route Count by Category

| Category | Count | Auth Required |
|----------|-------|---------------|
| /api/auth/* | 7 | Partial (login/register public) |
| /api/admin/* | 22 | Yes (requirePermission) |
| /api/loads/* | 20 | Yes |
| /api/trucks/* | 8 | Yes |
| /api/truck-postings/* | 5 | Yes |
| /api/truck-requests/* | 5 | Yes |
| /api/gps/* | 10 | Yes |
| /api/trips/* | 4 | Yes |
| /api/user/* | 12 | Yes |
| /api/cron/* | 8 | No (internal) |
| /api/organizations/* | 7 | Partial |
| /api/wallet/* | 3 | Yes |
| /api/financial/* | 2 | Yes |
| Other | 50+ | Mixed |

### Public Routes (No Auth Required)

| Route | Purpose | Security Model |
|-------|---------|----------------|
| `GET /api/health` | Health check | Open (for load balancers) |
| `GET /api/associations` | List associations for registration | Open (public data) |
| `POST /api/auth/login` | User login | Open |
| `POST /api/auth/register` | User registration | Open |
| `POST /api/auth/forgot-password` | Password reset request | Open |
| `POST /api/auth/reset-password` | Password reset | Open (with token) |
| `GET /api/tracking/[trackingId]` | Public GPS tracking | Rate limited (30 RPS), UUID-based security |
| `GET /api/ethiopian-locations` | Location data | Open |
| `POST /api/cron/*` | Cron jobs | Internal (no external auth, but should be protected) |

### Routes Using requireAuth()

Most API routes use `requireAuth()` from `lib/auth.ts`. Example pattern:
```typescript
const session = await requireAuth();
// session contains: userId, email, role, organizationId, firstName, lastName, sessionId
```

### Routes Using requirePermission()

| Route | Permission |
|-------|------------|
| `/api/admin/dashboard` | VIEW_DASHBOARD |
| `/api/admin/analytics` | VIEW_DASHBOARD |
| `/api/admin/*` | Various admin permissions |
| `/api/trucks/[id]` (PATCH/DELETE) | EDIT_TRUCKS, DELETE_TRUCKS |
| `/api/loads` (POST) | CREATE_LOAD |
| `/api/dispatch` | VIEW_DISPATCH_QUEUE, ACCEPT_LOADS |
| `/api/gps/devices/*` | MANAGE_GPS_DEVICES |
| `/api/automation/*` | MANAGE_RULES, VIEW_RULES |

### 500-Error-Prone Code Patterns

| Pattern | Files Affected | Risk |
|---------|----------------|------|
| Decimal serialization without Number() | wallet/balance, dashboard routes | Medium |
| Missing null checks on optional relations | Multiple load/truck routes | Medium |
| `any` type hiding field errors | 100+ occurrences | High |

### Decimal Serialization Examples (Correct)

```typescript
// Good - converts Decimal to Number
totalRevenue: { balance: Number(totalRevenue?.balance || 0) }

// Good - explicit conversion
balance: Number(walletAccount?.balance || 0)
```

---

## 3. CLIENT vs API CONTRACT AUDIT

### Dashboard Pages

#### Shipper Dashboard

| Component | API URL | Client Expects | API Returns | Match |
|-----------|---------|----------------|-------------|-------|
| `ShipperDashboardClient.tsx` | `/api/shipper/dashboard` | `dashboardData.stats.*` | `{ stats: {...} }` | YES |
| | | `dashboardData.wallet.*` | `{ wallet: {...} }` | YES |
| | | `dashboardData.loadsByStatus` | `{ loadsByStatus: [...] }` | YES |

#### Carrier Dashboard

| Component | API URL | Client Expects | API Returns | Match |
|-----------|---------|----------------|-------------|-------|
| `CarrierDashboardClient.tsx` | `/api/carrier/dashboard` | `data.totalTrucks` | `{ totalTrucks: N }` | YES |
| | | `data.activeTrucks` | `{ activeTrucks: N }` | YES |
| | | `data.wallet.balance` | `{ wallet: { balance } }` | YES |
| **Props: trucks** | `/api/trucks?limit=5` | `trucks[]` for display | 5 items max | **MISMATCH** - Was used for stats calculation |

**Bug Found:** Client was calculating `availableTrucks = trucks.filter(t => t.isAvailable).length` from limited array instead of using `data.activeTrucks`.

#### Admin Dashboard

| Component | API URL | Client Expects | API Returns | Match |
|-----------|---------|----------------|-------------|-------|
| `app/admin/page.tsx` | `/api/admin/dashboard` | `stats.totalUsers` | `{ totalUsers: N }` | YES |
| | | `stats.totalRevenue.balance` | `{ totalRevenue: { balance } }` | YES |
| | | `stats.loadsByStatus` | `{ loadsByStatus: [...] }` | YES |

#### Dispatcher Dashboard

| Component | API URL | Client Expects | API Returns | Match |
|-----------|---------|----------------|-------------|-------|
| `DispatcherDashboardClient.tsx` | `/api/loads` | Fetches all, calculates stats | Full load list | **NO DEDICATED API** |
| | `/api/truck-postings` | Fetches all postings | Full posting list | Inefficient |

### Loadboard Pages

#### Shipper Loadboard

| Component | API URLs | Notes |
|-----------|----------|-------|
| `PostLoadsTab.tsx` | `/api/loads`, `/api/ethiopian-locations`, `/api/truck-requests` | Multiple fetches, proper pagination |
| `SearchTrucksTab.tsx` | `/api/truck-postings`, `/api/saved-searches` | Correct |

#### Carrier Loadboard

| Component | API URLs | Notes |
|-----------|----------|-------|
| `PostTrucksTab.tsx` | `/api/trucks`, `/api/truck-postings`, `/api/load-requests` | Correct |
| `SearchLoadsTab.tsx` | `/api/loads`, `/api/saved-searches` | Correct |

### Fetch Pattern Analysis

| Pattern | Count | Example Files |
|---------|-------|---------------|
| `fetch('/api/...')` | 80+ | All client components |
| `useSWR` | 0 | Not used |
| `axios` | 0 | Not used |

---

## 4. AUTH & SESSION AUDIT

### Authentication System

**Type:** Custom JWT-based (NOT NextAuth)

**Implementation:** `lib/auth.ts`

### Session Payload Interface

```typescript
interface SessionPayload {
  userId: string;
  email: string;
  role: UserRole;
  organizationId: string | null;  // Key field for data scoping
  firstName: string;
  lastName: string;
  sessionId: string;
}
```

### Auth Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `requireAuth()` | Require authenticated session | SessionPayload or throws |
| `requireActiveUser()` | Require ACTIVE user status | SessionPayload or throws |
| `getSession()` | Get session (may be null) | SessionPayload | null |
| `requirePermission(perm)` | Require specific RBAC permission | void or throws |

### Session Storage

- JWT cookie named `session` (encrypted with JWE)
- Server-side session tracking in `Session` model
- CSRF token in separate cookie

### organizationId Usage Pattern

| Dashboard | Query Pattern | Scoping |
|-----------|---------------|---------|
| Shipper | `where: { shipperId: session.organizationId }` | Own loads only |
| Carrier | `where: { carrierId: session.organizationId }` or `truck.organizationId` | Own trucks/loads |
| Admin | No org filter | Platform-wide |
| Dispatcher | From user's org | Assigned loads |

### Auth Coverage Analysis

| Route Category | Auth Check | Notes |
|----------------|------------|-------|
| /api/admin/* | requirePermission() | Correct |
| /api/loads/* | requireAuth() | Correct |
| /api/trucks/* | requireAuth() | Correct |
| /api/wallet/* | requireAuth() | Correct |
| /api/cron/* | None | **RISK** - Should have internal auth |
| /api/health | None | Intentional (health probes) |
| /api/associations | None | Intentional (public data) |

---

## 5. TYPE SAFETY AUDIT

### `any` Type Usage

| Category | Count | Example |
|----------|-------|---------|
| Function parameters | 50+ | `(load: any)`, `(value: any)` |
| API response handling | 30+ | `const data = result.data as any` |
| Error handling | 40+ | `catch (error: any)` |
| Dynamic objects | 20+ | `const where: any = {}` |

### High-Risk `any` Usage

| File | Line | Issue |
|------|------|-------|
| `app/shipper/trips/page.tsx` | 41 | `loads: any[]` hides type errors |
| `app/shipper/loadboard/PostLoadsTab.tsx` | 28-29 | `user: any`, `onSwitchToSearchTrucks?: (filters: any)` |
| `app/carrier/trucks/TruckManagementClient.tsx` | 97-99 | `approvedPagination: any` etc |
| `app/api/truck-postings/route.ts` | 452 | `const where: any = {}` |

### Decimal/BigInt Serialization

| Pattern | Files | Status |
|---------|-------|--------|
| `Number(decimal)` | Dashboard routes | Correct |
| `Number(balance || 0)` | Wallet routes | Correct |
| `toNumber()` method | Some lib files | Correct |

**Note:** Prisma Decimal fields must be converted to Number before JSON.stringify().

### Missing TypeScript Interfaces

| Area | Issue |
|------|-------|
| API responses | Many routes return untyped objects |
| Dashboard data | Interfaces exist but inconsistently used |
| Prisma query results | Often cast to `any` |

---

## 6. DATA FLOW AUDIT

### Shipper Role

| Page | Server-Side | Client-Side | Issues |
|------|-------------|-------------|--------|
| Dashboard | Fetch from `/api/shipper/dashboard` | Display stats | None |
| Loadboard | None | Fetch loads, trucks, locations | Multiple parallel fetches |
| Trips | Fetch trip data | Display + interactions | None |
| Wallet | Fetch balance + transactions | Display | None |

### Carrier Role

| Page | Server-Side | Client-Side | Issues |
|------|-------------|-------------|--------|
| Dashboard | Fetch from `/api/carrier/dashboard` + `/api/trucks?limit=5` | Display stats | **BUG:** Was using limited trucks array for stats |
| Loadboard | None | Fetch trucks, postings, loads | Many parallel fetches |
| Trips | Fetch trip data | Display + status updates | None |
| Wallet | Fetch balance + transactions | Display | None |

### Admin Role

| Page | Server-Side | Client-Side | Issues |
|------|-------------|-------------|--------|
| Dashboard | Fetch from `/api/admin/dashboard` | Display platform stats | None |
| Users | None | Paginated fetch | None |
| Organizations | None | Paginated fetch | None |
| Trucks | None | Paginated fetch with filters | None |

### Dispatcher Role

| Page | Server-Side | Client-Side | Issues |
|------|-------------|-------------|--------|
| Dashboard | None | Fetch all loads + postings | **No dedicated API** - inefficient |
| Map | None | Fetch vehicles + trips | Multiple fetches |
| Proposals | None | Fetch proposals | None |

### Hardcoded Fallback Values

| Pattern | Count | Risk |
|---------|-------|------|
| `|| 0` | 80+ | Masks undefined/null errors |
| `?? []` | 20+ | Hides missing arrays |
| `|| 'default'` | 10+ | May hide config issues |

**Examples:**
```typescript
approvedCount = approvedPagination?.total || 0;
balance: Number(walletAccount?.balance || 0);
matchCount: matchData.total || 0;
```

---

## 7. BROKEN FEATURES LIST

### TODO/FIXME/HACK Comments

| File | Line | Comment |
|------|------|---------|
| `app/carrier/loadboard/PostTrucksTab.tsx` | 719 | `// TODO: Implement keep/star toggle` |
| `app/carrier/loadboard/PostTrucksTab.tsx` | 1307 | `// TODO: Implement preferred company logic` |
| `app/carrier/loadboard/PostTrucksTab.tsx` | 1310 | `// TODO: Implement blocked company logic` |
| `components/ErrorBoundary.tsx` | 46 | `// TODO: Send to error reporting service` |
| `app/api/exceptions/monitor/route.ts` | 173 | `checkInterval: 'Manual trigger only', // TODO: Add cron job` |
| `app/api/loads/[id]/status/route.ts` | 392 | `// TODO: Trigger automation rules based on new status` |
| `lib/emailService.ts` | Multiple | `// TODO: Implement SendGrid provider`, `// TODO: Implement AWS SES provider` |
| `mobile/lib/core/services/gps_service.dart` | 143 | `// TODO: Implement offline queue` |

### Silent Error Handling

Many catch blocks log but don't propagate errors:

```typescript
// Pattern found in 100+ locations
} catch (error) {
  console.error('Error:', error);
  // Error swallowed, returns empty/default data
}
```

### Fetch Calls Without Error Handling

| File | Issue |
|------|-------|
| `app/register/page.tsx` | `fetch("/api/associations")` - no error handling |
| Multiple client components | Fetch errors caught but shown as generic "Error loading" |

### Dead/Incomplete Features

| Feature | Status | Evidence |
|---------|--------|----------|
| Email notifications | Stub | SendGrid/SES providers have TODO comments |
| Push notifications | Partial | Mobile offline queue not implemented |
| Preferred/blocked companies | Not implemented | TODO comments in loadboard |
| Error reporting service | Not configured | TODO in ErrorBoundary |

---

## 8. SECURITY ISSUES

### Unauthenticated Routes (Intentional)

| Route | Reason | Risk |
|-------|--------|------|
| `/api/health` | Load balancer probes | Low (no sensitive data) |
| `/api/associations` | Registration dropdown | Low (public data) |
| `/api/ethiopian-locations` | Location data | Low (public data) |
| `/api/tracking/[trackingId]` | Public tracking | **Medium** - Rate limited, UUID security |

### Unauthenticated Routes (Potential Risk)

| Route | Issue | Risk |
|-------|-------|------|
| `/api/cron/*` | No auth check | **HIGH** - Should use internal secret |

### Cross-Organization Data Access

All routes properly scope by `session.organizationId`:

```typescript
// Shipper routes
where: { shipperId: session.organizationId }

// Carrier routes
where: { carrierId: session.organizationId }
// or
where: { truck: { organizationId: session.organizationId } }
```

### Sensitive Data Exposure

| Area | Status | Notes |
|------|--------|-------|
| Passwords | Safe | Never returned in API responses |
| Session tokens | Safe | HttpOnly cookies |
| CSRF tokens | Safe | Separate cookie |
| GPS positions | Scoped | Only accessible to load owner/carrier |
| Financial data | Scoped | Organization-level access |

### SQL Injection Risk

| Risk | Status |
|------|--------|
| Raw SQL | Not used - Prisma ORM only |
| Dynamic queries | Uses Prisma's safe query builder |
| User input | Validated before use |

### Other Security Measures

- CSRF protection on mutations
- Rate limiting on public endpoints
- Input validation on forms
- Encrypted JWT sessions

---

## 9. FILE STRUCTURE

### app/ Directory Structure

```
app/
├── api/                    # API routes (163 files)
│   ├── admin/             # Admin APIs (22)
│   ├── auth/              # Auth APIs (7)
│   ├── carrier/           # Carrier dashboard API (1)
│   ├── cron/              # Cron job endpoints (8)
│   ├── loads/             # Load management (20)
│   ├── trucks/            # Truck management (8)
│   ├── truck-postings/    # Posting APIs (5)
│   ├── truck-requests/    # Request APIs (5)
│   ├── trips/             # Trip APIs (4)
│   ├── gps/               # GPS APIs (10)
│   ├── user/              # User settings (12)
│   ├── wallet/            # Wallet APIs (3)
│   └── ...               # Other APIs
├── admin/                 # Admin pages
│   ├── analytics/
│   ├── audit-logs/
│   ├── bypass-review/
│   ├── corridors/
│   ├── feature-flags/
│   ├── gps/
│   ├── health/
│   ├── loads/
│   ├── map/
│   ├── organizations/
│   ├── platform-metrics/
│   ├── security/
│   ├── service-fees/
│   ├── settings/
│   ├── settlement/
│   ├── trips/
│   ├── trucks/
│   ├── users/
│   ├── verification/
│   ├── wallets/
│   ├── page.tsx           # Admin dashboard
│   └── layout.tsx
├── carrier/               # Carrier pages
│   ├── dashboard/
│   ├── documents/
│   ├── gps/
│   ├── loadboard/
│   ├── loads/
│   ├── map/
│   ├── matches/
│   ├── settings/
│   ├── team/
│   ├── trip-history/
│   ├── trips/
│   ├── trucks/
│   └── wallet/
├── shipper/               # Shipper pages
│   ├── dashboard/
│   ├── documents/
│   ├── loadboard/
│   ├── loads/
│   ├── map/
│   ├── matches/
│   ├── requests/
│   ├── settings/
│   ├── team/
│   ├── trips/
│   └── wallet/
├── dispatcher/            # Dispatcher pages
│   ├── dashboard/
│   ├── escalations/
│   ├── loads/
│   ├── map/
│   ├── proposals/
│   ├── trips/
│   └── trucks/
├── settings/              # User settings
│   ├── notifications/
│   ├── profile/
│   ├── security/
│   └── support/
├── organizations/         # Organization pages
├── tracking/              # Public tracking page
├── login/
├── register/
├── forgot-password/
├── unauthorized/
├── page.tsx               # Landing page
└── layout.tsx             # Root layout
```

### File Counts by Type

| Type | Count |
|------|-------|
| .tsx (React components) | ~200 |
| .ts (TypeScript) | ~130 |
| route.ts (API routes) | 163 |
| page.tsx (Pages) | ~60 |
| layout.tsx (Layouts) | ~10 |
| Client components (*Client.tsx) | ~45 |

---

## Summary of Critical Issues

### Priority 1 (Breaking/500 Errors)

1. **Wallet Transactions API** - Referenced non-existent `debitAccountId` field

### Priority 2 (Data Integrity)

1. **Carrier Dashboard** - Was calculating truck stats from limited array instead of API data
2. **Dispatcher Dashboard** - No dedicated API, fetches all data client-side

### Priority 3 (Security)

1. **Cron endpoints** - No authentication (should use internal secret)
2. **100+ `any` types** - Hide potential type errors

### Priority 4 (Technical Debt)

1. **289 TODO comments** - Many incomplete features
2. **Email providers** - Only stub implementations
3. **Error boundary** - No external error reporting configured

### Priority 5 (Performance)

1. **Dispatcher dashboard** - Fetches all loads/postings client-side
2. **Multiple parallel fetches** - Could be optimized with dedicated APIs
