# DISPATCHER SYSTEM AUDIT

## Overview

The Dispatcher role is a platform-operated coordination role that helps match loads with trucks. The system is governed by **Foundation Rules** that establish clear boundaries between coordination (dispatcher) and execution (carrier).

---

## 1. Pages (What Exists vs What's Missing)

### Pages That Exist

| Page | Path | File | Description |
|------|------|------|-------------|
| Dashboard | `/dispatcher` | `app/dispatcher/dashboard/page.tsx` | System-wide view with stats, tabs for loads/trucks, quick actions |
| Map | `/dispatcher/map` | `app/dispatcher/map/page.tsx` | Real-time GPS tracking with truck/load/trip visualization |
| Layout | N/A | `app/dispatcher/layout.tsx` | Auth check and RoleAwareSidebar wrapper |

### Pages Missing (In Sidebar But Don't Exist)

| Page | Expected Path | Status | Priority |
|------|---------------|--------|----------|
| All Loads | `/dispatcher/loads` | **MISSING** | High |
| All Trucks | `/dispatcher/trucks` | **MISSING** | High |
| Proposals | `/dispatcher/proposals` | **MISSING** | High |
| Active Trips | `/dispatcher/trips` | **MISSING** | Medium |
| Escalations | `/dispatcher/escalations` | **MISSING** | Medium |
| Assign Load | `/dispatcher/assign` | **MISSING** | Low (Quick Action uses modal instead) |

### Navigation (from RoleAwareSidebar.tsx)

```
dispatcher: [
  Dashboard    → /dispatcher
  Map          → /dispatcher/map

  Operations:
  All Loads    → /dispatcher/loads     ❌ MISSING
  All Trucks   → /dispatcher/trucks    ❌ MISSING
  Proposals    → /dispatcher/proposals ❌ MISSING

  Monitoring:
  Active Trips → /dispatcher/trips     ❌ MISSING
  Escalations  → /dispatcher/escalations ❌ MISSING
]
```

---

## 2. APIs (Dispatcher-Related Endpoints)

### Dispatch API

| Method | Endpoint | Purpose | File |
|--------|----------|---------|------|
| POST | `/api/dispatch` | Direct load assignment (requires DISPATCH_LOADS or ACCEPT_LOADS permission) | `app/api/dispatch/route.ts` |

### Match Proposals API

| Method | Endpoint | Purpose | File |
|--------|----------|---------|------|
| POST | `/api/match-proposals` | Create match proposal (Dispatcher → Carrier) | `app/api/match-proposals/route.ts` |
| GET | `/api/match-proposals` | List proposals (filtered by role) | `app/api/match-proposals/route.ts` |
| POST | `/api/match-proposals/[id]/respond` | Carrier accepts/rejects proposal | `app/api/match-proposals/[id]/respond/route.ts` |

### Supporting APIs Used by Dispatcher

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/loads` | Fetch all loads (dispatcher sees all) |
| GET | `/api/truck-postings` | Fetch posted trucks (availability) |
| GET | `/api/loads/[id]/matching-trucks` | Get matching trucks for a load |
| GET | `/api/map/vehicles` | Map data for trucks |
| GET | `/api/map/loads` | Map data for loads |
| GET | `/api/map/trips` | Map data for active trips |
| PUT | `/api/loads/[id]/assign` | Direct assignment (used by QuickAssignModal) |

---

## 3. Business Logic (How Match Proposals Work)

### Permission System (`lib/dispatcherPermissions.ts`)

```typescript
// Dispatcher CAN:
canViewAllLoads()        → true (see all loads)
canViewAllTrucks()       → true (see all posted trucks)
canProposeMatch()        → true (create match proposals)
canUpdateLoadStatus()    → true (change load status)
canAccessGpsTracking()   → true (view all GPS)
canViewSystemDashboard() → true (system-wide view)

// Dispatcher CANNOT:
canAssignLoads()         → false (carrier authority only)
canApproveRequests()     → false (carrier must approve)
canManageTrucks()        → false (carrier owns trucks)
```

### Matching Engine (`lib/matchingEngine.ts`)

Algorithm scores truck-load compatibility:
- Route compatibility: 40%
- Time window overlap: 30%
- Capacity match: 20%
- Deadhead distance: 10%

Total score: 0-100

### Match Proposal Flow

```
1. Dispatcher searches for loads (status: POSTED, SEARCHING, OFFERED)
2. Dispatcher views matching trucks (via matchingEngine)
3. Dispatcher creates MatchProposal:
   - loadId, truckId, notes, proposedRate, expiresInHours
4. Carrier receives notification
5. Carrier responds: ACCEPT or REJECT
   - If ACCEPT: Load assigned to truck, Trip created
   - If REJECT: Proposal marked rejected, load remains available
```

---

## 4. Permissions (What Dispatcher Can/Cannot Do)

### RBAC Permissions (`lib/rbac/permissions.ts`)

```typescript
DISPATCHER: [
  // View permissions
  Permission.VIEW_ALL_LOADS,
  Permission.VIEW_LOADS,
  Permission.VIEW_ALL_TRUCKS,
  Permission.VIEW_TRUCKS,
  Permission.VIEW_UNASSIGNED_LOADS,
  Permission.VIEW_REJECTED_LOADS,
  Permission.VIEW_EXCEPTIONS,
  Permission.VIEW_RULES,
  Permission.VIEW_ALL_GPS,
  Permission.VIEW_WALLET,
  Permission.VIEW_DASHBOARD,

  // Action permissions
  Permission.DISPATCH_LOADS,      // ⚠️ See issue below
  Permission.PROPOSE_MATCH,
  Permission.ESCALATE_TO_ADMIN,
]
```

### Foundation Rules (`lib/foundation-rules.ts`)

| Rule | ID | Description |
|------|-----|-------------|
| Dispatcher Coordination Only | `DISPATCHER_COORDINATION_ONLY` | Dispatcher can PROPOSE but cannot ASSIGN. Carrier is final authority. |
| Carrier Final Authority | `CARRIER_FINAL_AUTHORITY` | Only carrier can commit a truck to a load. No assignment without carrier approval. |
| Carrier Owns Trucks | `CARRIER_OWNS_TRUCKS` | Only carriers can create, edit, delete trucks. |
| Posting = Availability | `POSTING_IS_AVAILABILITY` | Posting a truck means availability, not ownership. |

---

## 5. Navigation (How Dispatcher Moves Through the App)

### Entry Points

1. Login → Role detected as DISPATCHER → Redirect to `/dispatcher`
2. Direct URL access with auth check in layout

### Dashboard Navigation

```
Dashboard (/dispatcher)
├── Stats Cards: Unassigned Loads, In Transit, Deliveries Today, On-Time Rate, Available Trucks, Alerts
├── Quick Actions:
│   ├── Assign Load → Opens QuickAssignModal (⚠️ Uses direct assignment)
│   ├── View Map → /dispatcher/map
│   └── Manage Trucks → /dispatcher/trucks (❌ 404)
├── Tabs:
│   ├── All Loads → In-page table with filters
│   └── All Trucks → In-page table
├── Load Table Actions:
│   ├── Assign → QuickAssignModal (⚠️ Direct assignment)
│   ├── Update → StatusUpdateModal
│   ├── GPS → /tracking?loadId=xxx
│   └── View → /carrier/loads/[id]
└── Sidebar Navigation → Various pages (many 404)
```

### Map Page Navigation

```
Map (/dispatcher/map)
├── View Modes: All, Trucks, Loads, Trips, Matching
├── Filters: Truck Type, Region
├── Actions:
│   └── Marker Click → Show details panel
└── Real-time GPS via WebSocket
```

---

## 6. Flow Diagrams

### Flow A: Carrier Calls Dispatcher

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│   Carrier   │────>│  Dispatcher  │────>│  Database   │────>│   Shipper   │
│  (Phone)    │     │  (Platform)  │     │  (Loads)    │     │ (Notified)  │
└─────────────┘     └──────────────┘     └─────────────┘     └─────────────┘
      │                    │                    │
      │ "I have a truck    │ Search loads      │
      │  in Addis Ababa"   │ matching route    │
      │                    │                    │
      │                    ▼                    │
      │            ┌──────────────┐             │
      │            │ Create Match │             │
      │            │   Proposal   │             │
      │            └──────────────┘             │
      │                    │                    │
      │                    ▼                    │
      │            ┌──────────────┐             │
      │◄───────────│ Notification │─────────────│
      │            │ to Carrier   │             │
      │            └──────────────┘             │
      │                    │                    │
      ▼                    │                    │
┌─────────────┐            │                    │
│  Carrier    │            │                    │
│  ACCEPTS    │────────────┼────────────────────│
│  Proposal   │            │                    │
└─────────────┘            │                    │
                           ▼                    │
                  ┌──────────────┐              │
                  │ Load Assigned│              │
                  │ Trip Created │              │
                  └──────────────┘              │
```

**WHO APPROVES?** → **CARRIER** (accepts the proposal they initiated via phone)

### Flow B: Shipper Calls Dispatcher

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│   Shipper   │────>│  Dispatcher  │────>│  Database   │────>│   Carrier   │
│  (Phone)    │     │  (Platform)  │     │  (Trucks)   │     │ (Notified)  │
└─────────────┘     └──────────────┘     └─────────────┘     └─────────────┘
      │                    │                    │                    │
      │ "I need a truck    │ Search posted     │                    │
      │  for my load"      │ trucks matching   │                    │
      │                    │ load requirements │                    │
      │                    │                    │                    │
      │                    ▼                    │                    │
      │            ┌──────────────┐             │                    │
      │            │ Create Match │             │                    │
      │            │   Proposal   │             │                    │
      │            └──────────────┘             │                    │
      │                    │                    │                    │
      │                    │                    │                    ▼
      │                    │                    │            ┌─────────────┐
      │                    │                    │            │  Carrier    │
      │                    │                    │            │  REVIEWS    │
      │                    │                    │            │  Proposal   │
      │                    │                    │            └─────────────┘
      │                    │                    │                    │
      │                    │                    │    ACCEPT or REJECT│
      │                    │                    │◄───────────────────┘
      │                    │                    │
      │◄───────────────────┼────────────────────│
      │   Load Assigned    │                    │
      │   (if accepted)    │                    │
```

**WHO APPROVES?** → **CARRIER** (who owns the truck being requested)

---

## 7. Issues Found

### CRITICAL: Foundation Rule Violation

**Issue:** `QuickAssignModal.tsx` uses direct assignment via `/api/loads/[id]/assign` instead of creating a match proposal.

**Location:** `components/QuickAssignModal.tsx:101`

```typescript
// CURRENT (WRONG):
const response = await fetch(`/api/loads/${loadId}/assign`, {
  method: 'PUT',
  body: JSON.stringify({ truckPostingId: selectedTruckId }),
});
```

**Violation:** This bypasses the `DISPATCHER_COORDINATION_ONLY` rule. Dispatchers should only PROPOSE matches, not directly assign.

**Fix Required:** Change to use `/api/match-proposals` API and create a proposal instead.

---

### HIGH: Missing Pages

5 pages in the sidebar navigation return 404:
1. `/dispatcher/loads` - All Loads listing
2. `/dispatcher/trucks` - All Trucks listing
3. `/dispatcher/proposals` - Match Proposals management
4. `/dispatcher/trips` - Active Trips monitoring
5. `/dispatcher/escalations` - Escalation handling

---

### MEDIUM: Dashboard Uses Carrier Links

**Location:** `DispatcherDashboardClient.tsx:478, 540, 832`

```typescript
href={`/carrier/loads/${load.id}`}  // Links to carrier portal, not dispatcher
```

Dispatcher should have their own load detail view or the link should go to a shared detail page.

---

### LOW: Permission Confusion

`DISPATCH_LOADS` permission is granted to DISPATCHER, but the foundation rule says they CANNOT dispatch. The permission name is misleading.

**Suggestion:** Rename to `VIEW_DISPATCH_QUEUE` or similar to clarify it's for viewing, not action.

---

### LOW: QuickAssignModal References Non-Existent Field

**Location:** `QuickAssignModal.tsx:79`

```typescript
originCity: m.truckPosting.truck.currentCity,  // Truck doesn't have currentCity
```

Per `RULE_LOCATION_IN_DYNAMIC_TABLES`, location should be in TruckPosting, not Truck.

---

## 8. What Needs to Be Built

### Priority 1: Fix Foundation Rule Violation

- [ ] Modify `QuickAssignModal` to create Match Proposal instead of direct assignment
- [ ] Add UI feedback that proposal was sent and awaiting carrier approval
- [ ] Add proposal status tracking in dispatcher dashboard

### Priority 2: Missing Pages

- [ ] Create `/dispatcher/loads` - Dedicated loads listing with advanced filters
- [ ] Create `/dispatcher/trucks` - Dedicated truck postings listing
- [ ] Create `/dispatcher/proposals` - Match proposals management (create, view status, cancel)
- [ ] Create `/dispatcher/trips` - Active trips monitoring with GPS integration
- [ ] Create `/dispatcher/escalations` - Issue tracking and admin escalation

### Priority 3: Improvements

- [ ] Create dispatcher-specific load detail view (or use shared view)
- [ ] Add proposal notification badge to sidebar
- [ ] Add real-time proposal status updates
- [ ] Rename `DISPATCH_LOADS` permission to avoid confusion

### Priority 4: Documentation

- [ ] Document the proposal workflow for dispatchers
- [ ] Create training material for dispatcher role
- [ ] Add inline help/tooltips explaining the approval process

---

## Appendix: File Locations

| Component | File Path |
|-----------|-----------|
| Dashboard Page | `app/dispatcher/dashboard/page.tsx` |
| Dashboard Client | `app/dispatcher/dashboard/DispatcherDashboardClient.tsx` |
| Map Page | `app/dispatcher/map/page.tsx` |
| Layout | `app/dispatcher/layout.tsx` |
| Dispatch API | `app/api/dispatch/route.ts` |
| Match Proposals API | `app/api/match-proposals/route.ts` |
| Proposal Response API | `app/api/match-proposals/[id]/respond/route.ts` |
| Permissions | `lib/dispatcherPermissions.ts` |
| Foundation Rules | `lib/foundation-rules.ts` |
| Matching Engine | `lib/matchingEngine.ts` |
| RBAC Permissions | `lib/rbac/permissions.ts` |
| Quick Assign Modal | `components/QuickAssignModal.tsx` |
| Status Update Modal | `components/StatusUpdateModal.tsx` |
| Role Aware Sidebar | `components/RoleAwareSidebar.tsx` |
| MatchProposal Model | `prisma/schema.prisma:1353` |
