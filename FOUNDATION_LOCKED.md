# FOUNDATION LOCKED - v1.0
**Lock Date:** 2026-01-02
**Status:** FROZEN - Do Not Modify Without Version Increment

---

## 🔒 PROTECTED CORE FEATURES

These features are **WORKING** and **FROZEN**. All changes must be **ADDITIVE ONLY**.

### 1. MARKETPLACE ENGINE ✅ LOCKED

**Load Posting** (`/app/api/loads/route.ts`)
- ✅ POST /api/loads - Create load
- ✅ Fields: pickupCity, deliveryCity, truckType, weight, lengthM
- ✅ Pricing model: baseFareEtb + (perKmEtb × tripKm)
- ✅ Status: DRAFT or POSTED
- ✅ Permission: Permission.CREATE_LOAD
- ✅ Coordinates: originLat, originLon, destinationLat, destinationLon

**Load Search & Filter** (`/app/api/loads/route.ts`)
- ✅ GET /api/loads - Search loads
- ✅ Filter by: pickupCity (origin)
- ✅ Filter by: deliveryCity (destination)
- ✅ Filter by: truckType
- ✅ Filter by: weight, length
- ✅ Filter by: date range
- ✅ Case-insensitive search
- ✅ Pagination support

**Truck Posting** (`/app/api/truck-postings/route.ts`)
- ✅ POST /api/truck-postings - Post truck availability
- ✅ Fields: originCity, destinationCity, truckType, capacity
- ✅ Availability window: availableFrom, availableTo
- ✅ Contact: carrierContactPhone

**Load-Truck Matching** (`/lib/matchCalculation.ts`)
- ✅ DH-O calculation (Deadhead to Origin)
- ✅ DH-D calculation (Deadhead to Destination)
- ✅ Origin/Destination matching
- ✅ Truck type compatibility
- ✅ Weight/capacity validation

---

### 2. AUTHENTICATION SYSTEM ✅ LOCKED

**User Registration** (`/app/api/auth/register/route.ts`)
- ✅ Email/password registration
- ✅ Password hashing (bcrypt)
- ✅ Organization creation
- ✅ JWT token generation
- ✅ HTTP-only cookie session

**User Login** (`/app/api/auth/login/route.ts`)
- ✅ Email + password authentication
- ✅ Password verification
- ✅ Session creation
- ✅ JWT token with expiry

**Session Management** (`/lib/auth.ts`)
- ✅ requireAuth() middleware
- ✅ verifyToken() validation
- ✅ Session payload: userId, email, role, organizationId

**Logout** (`/app/api/auth/logout/route.ts`)
- ✅ Session termination
- ✅ Cookie clearing

---

### 3. ROLE-BASED ACCESS CONTROL ✅ LOCKED (with known gaps)

**Current Roles** (Schema)
```
SHIPPER, CARRIER, LOGISTICS_AGENT, DRIVER, DISPATCHER, PLATFORM_OPS, ADMIN
```

**Permission System** (`/lib/rbac/permissions.ts`)
- ✅ Permission enum defined
- ✅ Role-to-permission mapping
- ✅ requirePermission() middleware
- ✅ hasPermission() utility

**Known Issues (to be fixed in Sprint 1):**
- ⚠️ Roles don't match final spec (needs consolidation)
- ⚠️ Missing SuperAdmin role
- ⚠️ PLATFORM_OPS should become Admin
- ⚠️ LOGISTICS_AGENT, DRIVER to be removed

---

### 4. DAT-STYLE UI ✅ LOCKED

**Components** (`/components/dat-ui/`)
- ✅ DatNavTabs - Navigation tabs
- ✅ DatDataTable - Data grid
- ✅ DatFilterPanel - Filter sidebar
- ✅ DatActionButton - Action buttons
- ✅ DatAgeIndicator - Age display
- ✅ DatReferencePricing - Pricing display
- ✅ DatCompanyLink - Company links
- ✅ DatSavedSearches - Saved search management

**Shipper Portal** (`/app/shipper/dat-board/`)
- ✅ POST_LOADS tab - Load posting interface
- ✅ SEARCH_TRUCKS tab - Truck search interface
- ✅ Load grid with status tabs
- ✅ Inline editing
- ✅ Match count display

**Carrier Portal** (`/app/carrier/dat-board/`)
- ✅ POST_TRUCKS tab - Truck posting interface
- ✅ SEARCH_LOADS tab - Load search interface
- ✅ Truck grid with status tabs
- ✅ Load matching display

---

### 5. GPS TRACKING ✅ LOCKED

**GPS Infrastructure** (`/app/api/gps/`)
- ✅ GPS device registration
- ✅ Position ingestion endpoint
- ✅ Live position query
- ✅ GPS history tracking
- ✅ Device verification

**GPS Models** (Schema)
- ✅ GpsDevice table
- ✅ GpsPosition table
- ✅ Device status tracking

---

### 6. WALLET SYSTEM ✅ LOCKED (partial)

**Wallet Core** (Schema)
- ✅ Account table (per user)
- ✅ Transaction table (audit trail)
- ✅ Balance tracking
- ✅ Transaction types: DEPOSIT, WITHDRAWAL, COMMISSION, SETTLEMENT, ESCROW

**APIs** (`/app/api/wallet/`, `/app/api/financial/`)
- ✅ GET /api/wallet/balance
- ✅ GET /api/wallet/transactions
- ✅ POST /api/financial/withdraw

**Known Gaps (to be fixed in Sprint 8):**
- ⚠️ No automatic fund hold on load assignment
- ⚠️ No automatic fund release on delivery

---

### 7. COMMISSION SYSTEM ✅ LOCKED (partial)

**Commission Tracking** (Schema)
- ✅ CommissionRate table
- ✅ Platform/Shipper/Carrier rate configuration
- ✅ Effective date ranges

**Calculation** (`/lib/commissionCalculation.ts`)
- ✅ Rate calculation logic
- ✅ Percentage-based commission

**Known Gaps (to be fixed in Sprint 8):**
- ⚠️ Not tied to load lifecycle
- ⚠️ No auto-deduction on settlement

---

## 🚫 WHAT MUST NOT CHANGE

### Pricing Model
```
Total Fare = baseFareEtb + (perKmEtb × tripKm)
```
- ❌ DO NOT add rate-per-mile (RPM)
- ❌ DO NOT add AI/ML pricing
- ❌ DO NOT add broker role
- ❌ DO NOT change to trip-based only pricing

### Marketplace Model
```
Shippers post loads → Carriers search loads → Carriers accept loads
Carriers post trucks → Shippers search trucks (optional)
```
- ❌ DO NOT introduce broker intermediary
- ❌ DO NOT change load-centric model
- ❌ DO NOT merge carrier and shipper roles

### Search & Filter
- ❌ DO NOT remove origin/destination search
- ❌ DO NOT remove distance (km) filtering
- ❌ DO NOT remove deadhead calculations

### Database Schema - Core Fields
**Load Table:**
- ✅ pickupCity, deliveryCity (locked)
- ✅ tripKm (locked)
- ✅ baseFareEtb, perKmEtb (locked)
- ✅ originLat, originLon, destinationLat, destinationLon (locked)

**TruckPosting Table:**
- ✅ originCity, destinationCity (locked)
- ✅ truckType, capacity (locked)

---

## ✅ WHAT CAN BE ADDED (Additive Changes)

### Sprint 1-11 Additions:
- ✅ UserStatus enum (Registered, PendingVerification, Active, Suspended, Rejected)
- ✅ Load lifecycle states (Searching, Offered, PickupPending, Completed, Exception)
- ✅ Exception table (NoCarrier, LatePickup, RejectedLoad, HighDeadhead, PaymentIssue)
- ✅ AutomationRule table (threshold-based triggers)
- ✅ Dispatcher workflow (assign/unassign, escalation)
- ✅ Analytics endpoints (read-only, Admin/SuperAdmin only)
- ✅ Fund hold/release logic (tied to load lifecycle)

### Rules for Additions:
1. Must not modify existing working APIs
2. Must not change existing database fields
3. Must add new tables/fields only
4. Must preserve backward compatibility
5. All new features must be toggleable/reversible

---

## 🧪 REGRESSION TEST COVERAGE

**Tests to Add in Sprint 0:**
- [ ] Load posting API (POST /api/loads)
- [ ] Load search by origin/destination (GET /api/loads)
- [ ] Load filtering (truckType, weight, date)
- [ ] Truck posting API (POST /api/truck-postings)
- [ ] Authentication (register, login, logout)
- [ ] Permission checks (CREATE_LOAD, POST_TRUCKS)

**Existing Tests:**
- ✅ Auth tests: 96 passing
- ✅ RBAC tests: 15+ scenarios

---

## 📊 FOUNDATION METRICS

**Database Tables (Active):**
- 28 tables total
- 7 enums defined
- Core tables: User, Organization, Load, TruckPosting, GpsDevice, Account, Transaction

**API Endpoints (Working):**
- 89 routes generated
- Authentication: 4 endpoints
- Loads: 10+ endpoints
- Trucks: 6+ endpoints
- GPS: 5+ endpoints
- Wallet: 3+ endpoints

**Build Status:**
- ✅ TypeScript: No errors
- ✅ Production build: SUCCESS
- ✅ Test suite: 96/106 passing (91%)

---

## 🔐 VERSION CONTROL

**Foundation Tag:** `Foundation-v1.0`
**Release Date:** 2026-01-02
**Git SHA:** [To be added after tagging]

**Change Policy:**
- Any modification to locked features requires version increment
- Breaking changes require Foundation-v2.0
- Additive changes stay in v1.x

---

## 📝 NEXT STEPS

After Foundation Freeze:
1. ✅ Sprint 1: Fix role system (consolidate to 5 roles)
2. ✅ Sprint 2: Add user verification workflow
3. ✅ Sprint 3: Complete load lifecycle state machine
4. ✅ Sprint 4: Build dispatcher workflow
5. ✅ Sprint 5: Add exception system
6. ✅ Sprint 6: Enhance DH-O/DH-D filtering
7. ✅ Sprint 7: Build automation rules engine
8. ✅ Sprint 8: Complete wallet fund hold/release
9. ✅ Sprint 9: Add analytics dashboards
10. ✅ Sprint 10: System validation & testing
11. ✅ Sprint 11: Final architecture freeze

---

**END OF FOUNDATION DOCUMENTATION**

All developers must read and acknowledge this document before making any changes.
