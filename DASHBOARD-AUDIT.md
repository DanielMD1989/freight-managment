# Dashboard API & Client Component Audit

## 1. API Routes - JSON Shapes & Prisma Queries

### `/api/shipper/dashboard/route.ts`

**Prisma Queries:**
```typescript
// Load counts by organizationId (as shipperId)
db.load.count({ where: { shipperId: session.organizationId } })
db.load.count({ where: { shipperId: session.organizationId, status: 'POSTED' } })
db.load.count({ where: { shipperId: session.organizationId, status: 'IN_TRANSIT' } })
db.load.count({ where: { shipperId: session.organizationId, status: 'DELIVERED' } })

// Financial aggregates
db.load.aggregate({
  where: { shipperId: session.organizationId },
  _sum: { platformFee: true, totalCarrierPay: true }
})

// Status breakdown
db.load.groupBy({
  by: ['status'],
  where: { shipperId: session.organizationId },
  _count: true
})

// Wallet balance
db.financialAccount.findFirst({
  where: { organizationId: session.organizationId, accountType: 'SHIPPER_WALLET', isActive: true }
})
```

**Response JSON Shape:**
```json
{
  "stats": {
    "totalLoads": number,
    "activeLoads": number,
    "inTransitLoads": number,
    "deliveredLoads": number,
    "totalSpent": number,
    "pendingPayments": number
  },
  "loadsByStatus": [
    { "status": string, "_count": number }
  ],
  "wallet": {
    "balance": number,
    "currency": string
  }
}
```

---

### `/api/carrier/dashboard/route.ts`

**Prisma Queries:**
```typescript
// Truck counts
db.truck.count({ where: { organizationId: session.organizationId } })
db.truck.count({ where: { organizationId: session.organizationId, isAvailable: true } })

// Posting counts
db.truckPosting.count({
  where: { truck: { organizationId: session.organizationId }, status: 'ACTIVE' }
})

// Trip counts
db.trip.count({
  where: { truck: { organizationId: session.organizationId }, status: 'COMPLETED' }
})
db.trip.count({
  where: { truck: { organizationId: session.organizationId }, status: 'IN_PROGRESS' }
})

// Revenue aggregate (from loads where carrier is this org)
db.load.aggregate({
  where: { carrierId: session.organizationId, status: 'DELIVERED' },
  _sum: { totalCarrierPay: true }
})

// Distance aggregate
db.trip.aggregate({
  where: { truck: { organizationId: session.organizationId }, status: 'COMPLETED' },
  _sum: { actualDistance: true }
})

// Wallet
db.financialAccount.findFirst({
  where: { organizationId: session.organizationId, accountType: 'CARRIER_WALLET', isActive: true }
})

// Recent postings (limit 5)
db.truckPosting.findMany({
  where: { truck: { organizationId: session.organizationId } },
  take: 5,
  orderBy: { createdAt: 'desc' },
  include: { truck: true }
})

// Pending approvals
db.load.count({
  where: { carrierId: session.organizationId, status: 'PENDING_PICKUP' }
})
```

**Response JSON Shape:**
```json
{
  "totalTrucks": number,
  "activeTrucks": number,
  "activePostings": number,
  "completedDeliveries": number,
  "inTransitTrips": number,
  "totalRevenue": number,
  "totalDistance": number,
  "wallet": {
    "balance": number,
    "currency": string
  },
  "recentPostings": [
    {
      "id": string,
      "status": string,
      "availableFrom": string,
      "availableTo": string,
      "originCity": string,
      "originState": string,
      "destinationCity": string,
      "destinationState": string,
      "truck": { "plateNumber": string, "type": string }
    }
  ],
  "pendingApprovals": number
}
```

---

### `/api/admin/dashboard/route.ts`

**Prisma Queries:**
```typescript
// Platform-wide counts (no org filtering)
db.user.count()
db.organization.count()
db.load.count()
db.truck.count()
db.load.count({ where: { status: { in: ['POSTED', 'MATCHED', 'IN_TRANSIT'] } } })
db.trip.count({ where: { status: 'IN_PROGRESS' } })

// Platform revenue (PLATFORM_REVENUE account)
db.financialAccount.findFirst({
  where: { accountType: 'PLATFORM_REVENUE' }
})

// Pending withdrawals
db.withdrawalRequest.count({ where: { status: 'PENDING' } })

// Open disputes
db.dispute.count({ where: { status: 'OPEN' } })

// Load status breakdown
db.load.groupBy({
  by: ['status'],
  _count: true
})

// Recent users (limit 5)
db.user.findMany({
  take: 5,
  orderBy: { createdAt: 'desc' },
  select: { id, email, firstName, lastName, role, createdAt }
})

// Recent loads (limit 5)
db.load.findMany({
  take: 5,
  orderBy: { createdAt: 'desc' },
  select: { id, status, originCity, destinationCity, createdAt }
})
```

**Response JSON Shape:**
```json
{
  "totalUsers": number,
  "totalOrganizations": number,
  "totalLoads": number,
  "totalTrucks": number,
  "activeLoads": number,
  "activeTrips": number,
  "totalRevenue": {
    "balance": number
  },
  "pendingWithdrawals": number,
  "openDisputes": number,
  "loadsByStatus": [
    { "status": string, "_count": number }
  ],
  "recentUsers": [
    { "id": string, "email": string, "firstName": string, "lastName": string, "role": string, "createdAt": string }
  ],
  "recentLoads": [
    { "id": string, "status": string, "originCity": string, "destinationCity": string, "createdAt": string }
  ]
}
```

---

### `/api/dispatcher/dashboard/route.ts`

**Note:** No dedicated dispatcher dashboard API exists. The dispatcher dashboard fetches from `/api/loads` and `/api/truck-postings` directly.

---

### `/api/wallet/transactions/route.ts`

**Prisma Queries:**
```typescript
// Get wallet accounts for org
db.financialAccount.findMany({
  where: {
    organizationId: user.organizationId,
    accountType: { in: ['SHIPPER_WALLET', 'CARRIER_WALLET'] },
    isActive: true
  }
})

// Get journal entries affecting wallet
db.journalEntry.findMany({
  where: {
    lines: {
      some: {
        OR: [
          { accountId: { in: walletAccountIds } },
          { creditAccountId: { in: walletAccountIds } }
        ]
      }
    }
  },
  // ... includes lines filtered by same criteria
})
```

**Response JSON Shape:**
```json
{
  "transactions": [
    {
      "id": string,
      "type": "COMMISSION" | "PAYMENT" | "REFUND" | "ADJUSTMENT",
      "description": string,
      "reference": string,
      "loadId": string | null,
      "amount": number,
      "createdAt": string
    }
  ],
  "pagination": {
    "limit": number,
    "offset": number,
    "totalCount": number,
    "hasMore": boolean
  }
}
```

---

## 2. Client Components - Data Fields & TypeScript Interfaces

### `app/shipper/dashboard/ShipperDashboardClient.tsx`

**Props Interface:**
```typescript
interface ShipperDashboardClientProps {
  dashboardData: {
    stats: {
      totalLoads: number;
      activeLoads: number;
      inTransitLoads: number;
      deliveredLoads: number;
      totalSpent: number;
      pendingPayments: number;
    };
    wallet: {
      balance: number;
      currency: string;
    };
    loadsByStatus: Array<{ status: string; _count: number }>;
  };
  recentLoads: Load[];
}
```

**Fields Accessed:**
- `dashboardData.stats.totalLoads`
- `dashboardData.stats.activeLoads`
- `dashboardData.stats.inTransitLoads`
- `dashboardData.stats.deliveredLoads`
- `dashboardData.stats.totalSpent`
- `dashboardData.stats.pendingPayments`
- `dashboardData.wallet.balance`
- `dashboardData.wallet.currency`
- `dashboardData.loadsByStatus[].status`
- `dashboardData.loadsByStatus[]._count`

---

### `app/carrier/dashboard/CarrierDashboardClient.tsx`

**Props Interface:**
```typescript
interface CarrierDashboardClientProps {
  data: {
    totalTrucks: number;
    activeTrucks: number;
    activePostings: number;
    completedDeliveries: number;
    inTransitTrips: number;
    totalRevenue: number;
    totalDistance: number;
    wallet: {
      balance: number;
      currency: string;
    };
    recentPostings: TruckPosting[];
    pendingApprovals: number;
  };
  trucks: Truck[];
}
```

**Fields Accessed:**
- `data.totalTrucks`
- `data.activeTrucks`
- `data.activePostings`
- `data.completedDeliveries`
- `data.inTransitTrips`
- `data.totalRevenue`
- `data.totalDistance`
- `data.wallet.balance`
- `data.wallet.currency`
- `data.recentPostings[]`
- `data.pendingApprovals`
- `trucks[]` (separate prop, limited to 5 items from page.tsx)

**BUG:** The component previously calculated `availableTrucks` from the `trucks` prop array instead of using `data.activeTrucks`. Since `trucks` is fetched with `limit=5`, this caused incorrect counts.

---

### `app/admin/page.tsx` (Server Component)

**Expected Data Shape from `/api/admin/dashboard`:**
```typescript
interface AdminDashboardData {
  totalUsers: number;
  totalOrganizations: number;
  totalLoads: number;
  totalTrucks: number;
  activeLoads: number;
  activeTrips: number;
  totalRevenue: {
    balance: number;
  };
  pendingWithdrawals: number;
  openDisputes: number;
  loadsByStatus: Array<{ status: string; _count: number }>;
  recentUsers: User[];
  recentLoads: Load[];
}
```

**Fields Accessed:**
- `stats.totalUsers`
- `stats.totalOrganizations`
- `stats.totalLoads`
- `stats.totalTrucks`
- `stats.activeLoads`
- `stats.activeTrips`
- `stats.totalRevenue.balance`
- `stats.pendingWithdrawals`
- `stats.openDisputes`
- `stats.loadsByStatus[].status`
- `stats.loadsByStatus[]._count`
- `stats.recentUsers[]`
- `stats.recentLoads[]`

---

### `app/dispatcher/dashboard/DispatcherDashboardClient.tsx`

**No dedicated API - calculates stats client-side**

**Fetches from:**
- `/api/loads` - gets all loads, calculates counts by filtering
- `/api/truck-postings` - gets all postings

**Calculated fields:**
- Total loads (from loads array length)
- Active loads (filtered by status)
- Pending loads (filtered by status)
- In-transit loads (filtered by status)
- Available trucks (from postings with ACTIVE status)

---

## 3. Mismatch Table: API Returns vs Client Expects

| Dashboard | Field | API Returns | Client Expects | Status |
|-----------|-------|-------------|----------------|--------|
| **Shipper** | stats | `{ stats: {...} }` | `dashboardData.stats` | MATCH |
| **Shipper** | wallet | `{ wallet: {...} }` | `dashboardData.wallet` | MATCH |
| **Shipper** | loadsByStatus | `{ loadsByStatus: [...] }` | `dashboardData.loadsByStatus` | MATCH |
| **Carrier** | totalTrucks | `{ totalTrucks: N }` | `data.totalTrucks` | MATCH |
| **Carrier** | activeTrucks | `{ activeTrucks: N }` | `data.activeTrucks` | MATCH |
| **Carrier** | availableTrucks | Not returned (derived) | Was using `trucks.filter()` | **MISMATCH** - Should use `data.activeTrucks` |
| **Carrier** | trucksOnJob | Not returned (derived) | Was using `trucks.length - availableTrucks` | **MISMATCH** - Should use `data.totalTrucks - data.activeTrucks` |
| **Carrier** | trucks prop | N/A (separate fetch) | Limited to 5 items | **DATA ISSUE** - Used for display, but was wrongly used for stats |
| **Admin** | totalRevenue | `{ totalRevenue: { balance: N } }` | `stats.totalRevenue.balance` | MATCH |
| **Admin** | all other fields | Flat object | Accessed as `stats.*` | MATCH |
| **Dispatcher** | all stats | No dedicated API | Calculated from `/api/loads` response | **NO API** |

---

## 4. 500 Errors Identified

### `/api/wallet/transactions/route.ts` - Line 82-85

**Error:** Prisma query referenced non-existent field `debitAccountId`

**Original Code:**
```typescript
const where: any = {
  lines: {
    some: {
      OR: [
        { debitAccountId: { in: walletAccountIds } },  // WRONG - field doesn't exist
        { creditAccountId: { in: walletAccountIds } },
      ],
    },
  },
};
```

**Correct Code Should Be:**
```typescript
const where: any = {
  lines: {
    some: {
      OR: [
        { accountId: { in: walletAccountIds } },  // Correct field name
        { creditAccountId: { in: walletAccountIds } },
      ],
    },
  },
};
```

**Schema Reference (JournalLine model):**
- `accountId` - The debit account (money coming from)
- `creditAccountId` - The credit account (money going to)
- There is no `debitAccountId` field

---

## 5. Authentication Flow: How `session.organizationId` Scopes Queries

### Session Creation (`lib/auth.ts`)

```typescript
interface SessionPayload {
  userId: string;
  email: string;
  role: UserRole;
  organizationId: string | null;  // Key field for scoping
  firstName: string;
  lastName: string;
  sessionId: string;
}
```

The session is created during login and stored as an encrypted JWT cookie.

### Auth Middleware Pattern

Each protected API route uses:
```typescript
const session = await requireAuth();
// session.organizationId is now available
```

### Query Scoping by Dashboard Type

| Dashboard | Field Used | Query Pattern |
|-----------|------------|---------------|
| **Shipper** | `session.organizationId` | `where: { shipperId: session.organizationId }` |
| **Carrier** | `session.organizationId` | `where: { carrierId: session.organizationId }` or `where: { truck: { organizationId: session.organizationId } }` |
| **Admin** | None (platform-wide) | No org filtering; uses `requirePermission(Permission.VIEW_DASHBOARD)` instead |
| **Dispatcher** | `session.organizationId` | Fetches from general APIs, org scoping happens in those APIs |

### Data Isolation

- **Shippers** only see loads where they are the `shipperId`
- **Carriers** only see trucks/trips/postings where their org owns the truck, or loads where they are the `carrierId`
- **Admins** see platform-wide aggregates (no org filtering)
- **Wallet queries** filter by `organizationId` on `FinancialAccount`

### Flow Diagram

```
User Login
    │
    ▼
Session Created (includes organizationId from User.organizationId)
    │
    ▼
JWT Cookie Set (encrypted)
    │
    ▼
API Request
    │
    ▼
requireAuth() decrypts cookie, returns session
    │
    ▼
API uses session.organizationId to filter queries
    │
    ▼
Response contains only data for that organization
```

---

## Summary of Issues Found

1. **Carrier Dashboard Bug**: Client calculated truck stats from limited `trucks` prop (5 items) instead of API-provided `totalTrucks`/`activeTrucks` values.

2. **Wallet Transactions 500 Error**: Prisma query used non-existent `debitAccountId` field; should use `accountId`.

3. **Dispatcher Dashboard**: No dedicated API exists - relies on fetching all loads/postings and calculating client-side, which is inefficient.

4. **Data Type Concerns**: Wallet balances are stored as `Decimal` in Prisma but need conversion to `Number` for JSON responses (currently handled via `Number()` conversion).
