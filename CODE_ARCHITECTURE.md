# Code Architecture Discovery

**Generated:** 2026-02-01
**Method:** Direct code inspection (no existing docs referenced)

---

## 1. System Overview

### What is this platform?
An **Ethiopian freight management platform** that connects shippers (businesses with cargo to move) with carriers (trucking companies). The platform handles the full lifecycle from load posting to delivery confirmation.

### User Roles (from `prisma/schema.prisma` lines 16-22)
| Role | Purpose |
|------|---------|
| SHIPPER | Posts loads, searches for trucks, requests truck assignments |
| CARRIER | Posts trucks, searches for loads, manages fleet |
| DISPATCHER | Coordinates matching between loads and trucks (propose only, cannot assign) |
| ADMIN | Verifies users/trucks, manages corridors, handles settlements |
| SUPER_ADMIN | Full platform control, role assignment |

### Business Model (from schema + lib files)
- **Service Fees**: Platform charges per-km fees to both shippers and carriers via the `Corridor` table
- **Escrow**: Shipper funds are held in escrow during transit, released to carrier on delivery
- **Double-entry Accounting**: All financial transactions tracked via `JournalEntry` + `JournalLine`

---

## 2. Database Tables (40 models from schema)

### Core Business Tables
| Table | Purpose | Key Fields |
|-------|---------|------------|
| User | User accounts | email, role, status, organizationId |
| Organization | Companies | name, type (SHIPPER/CARRIER), isVerified |
| Load | Freight postings | pickupCity, deliveryCity, status, rate, truckType |
| Truck | Carrier vehicles | licensePlate, truckType, capacity, approvalStatus |
| Trip | Active shipments | loadId, truckId, status, trackingUrl |
| TruckPosting | Carrier availability | originCityId, destinationCityId, availableFrom |

### Request System Tables
| Table | Purpose | Who Creates | Who Responds |
|-------|---------|-------------|--------------|
| LoadRequest | Carrier requests shipper's load | Carrier | Shipper |
| TruckRequest | Shipper requests carrier's truck | Shipper | Carrier |
| MatchProposal | Dispatcher suggests match | Dispatcher | Carrier |

### Financial Tables
| Table | Purpose |
|-------|---------|
| FinancialAccount | Wallets (SHIPPER_WALLET, CARRIER_WALLET, ESCROW, PLATFORM_REVENUE) |
| JournalEntry | Transaction records |
| JournalLine | Double-entry debit/credit lines |
| Corridor | Route-based service fee pricing |
| WithdrawalRequest | Payout requests |

### GPS & Tracking
| Table | Purpose |
|-------|---------|
| GpsDevice | Hardware GPS trackers |
| GpsPosition | Position history (lat/lng/speed/heading) |
| TripPod | Proof of delivery documents |

### Supporting Tables
| Table | Purpose |
|-------|---------|
| EthiopianLocation | Cities/towns with coordinates |
| Notification | User notifications |
| Session | Auth sessions |
| DeviceToken | Mobile push tokens |
| SavedSearch | User's saved filters |
| LoadEscalation | Dispatcher exception handling |
| AutomationRule | Settlement/exception automation |

---

## 3. Core Business Flows

### Flow 1: Carrier Finds Loads
```
1. Shipper: POST /api/loads → Creates Load (status: DRAFT → POSTED)
2. Carrier: GET /api/loads → Searches available loads
3. Carrier: POST /api/load-requests → Requests a specific load
4. Shipper: POST /api/load-requests/[id]/respond → Approves/Rejects
5. On APPROVE: Trip created atomically
```

### Flow 2: Shipper Finds Trucks
```
1. Carrier: POST /api/truck-postings → Posts truck availability
2. Shipper: GET /api/truck-postings → Searches available trucks
3. Shipper: POST /api/truck-requests → Requests a specific truck
4. Carrier: POST /api/truck-requests/[id]/respond → Approves/Rejects
5. On APPROVE: Trip created atomically
```

### Flow 3: Matching Algorithm (lib/matchingEngine.ts)
```
Weighted scoring (0-100):
- Route compatibility: 40% (origin/destination proximity)
- Time window overlap: 30% (availability dates)
- Capacity match: 20% (weight, length, truck type)
- Deadhead distance: 10% (DH-O cost)

Endpoints:
- GET /api/loads/[id]/matching-trucks
- GET /api/truck-postings/[id]/matching-loads
```

### Flow 4: Trip Lifecycle (lib/tripManagement.ts)
```
Status Flow:
ASSIGNED → PICKUP_PENDING → IN_TRANSIT → DELIVERED → COMPLETED
                 ↓               ↓            ↓           ↓
            startedAt       pickedUpAt   deliveredAt  completedAt

On approval, Trip is created atomically inside a $transaction with:
- Load.status → ASSIGNED
- Load.assignedTruckId → truckId
- Trip record created
- Other pending requests cancelled
```

### Flow 5: Service Fee Calculation (lib/serviceFeeCalculation.ts)
```
1. Find corridor by (originRegion, destinationRegion)
2. Calculate shipper fee: distanceKm × shipperPricePerKm
3. Calculate carrier fee: distanceKm × carrierPricePerKm
4. Apply promo discounts if promoFlag = true
5. Store on Load: shipperServiceFee, carrierServiceFee
```

### Flow 6: Service Fee Deduction (lib/serviceFeeManagement.ts)
```
Triggered when: Load status → COMPLETED (after POD verification)

1. Find corridor pricing
2. Get actual distance (GPS > estimated > corridor default)
3. Debit shipper wallet → Credit PLATFORM_REVENUE
4. Debit carrier wallet → Credit PLATFORM_REVENUE
5. Update Load: shipperFeeStatus/carrierFeeStatus → DEDUCTED
```

### Flow 7: GPS Tracking (lib/gpsIngestion.ts, lib/gpsTracking.ts)
```
Ingestion paths:
- POST /api/gps/position (mobile app - session auth)
- POST /api/gps/positions (hardware device - IMEI auth)
- POST /api/gps/batch (offline sync)

Storage: GpsPosition table with Decimal(10,7) precision
Real-time: WebSocket via lib/websocket-server.ts
```

### Flow 8: POD (Proof of Delivery)
```
1. Carrier marks trip as DELIVERED
2. Carrier: POST /api/trips/[tripId]/pod → Upload POD image
3. TripPod record created
4. Shipper: PUT /api/loads/[id]/pod → Verify POD
5. On verify: releaseFundsFromEscrow() called
6. Trip status → COMPLETED
7. Service fees deducted
```

---

## 4. Data Sources

| Data | DB Table | API Endpoint | Web Page | Mobile Screen |
|------|----------|--------------|----------|---------------|
| Loads | Load | /api/loads | /shipper/loadboard | shipper_loadboard_screen |
| Trucks | Truck | /api/trucks | /carrier/trucks | carrier_trucks_screen |
| Truck Postings | TruckPosting | /api/truck-postings | /carrier/loadboard | carrier_post_trucks_screen |
| Load Requests | LoadRequest | /api/load-requests | /carrier/requests | carrier_load_requests_screen |
| Truck Requests | TruckRequest | /api/truck-requests | /shipper/requests | shipper_truck_requests_screen |
| Trips | Trip | /api/trips | /carrier/trips, /shipper/trips | carrier_trips_screen, shipper_trips_screen |
| GPS Positions | GpsPosition | /api/gps/position | /carrier/map | carrier_map_screen |
| Wallet | FinancialAccount | /api/wallet/balance | /carrier/wallet, /shipper/wallet | wallet_screen |
| Notifications | Notification | /api/notifications | Header bell | notifications_screen |
| Corridors | Corridor | /api/admin/corridors | /admin/corridors | N/A (admin only) |

---

## 5. Fee System

### Service Fees (Corridor-based)
| Fee Type | Source | Calculation | When Deducted |
|----------|--------|-------------|---------------|
| Shipper Service Fee | Corridor.shipperPricePerKm | distanceKm × pricePerKm | On COMPLETED |
| Carrier Service Fee | Corridor.carrierPricePerKm | distanceKm × pricePerKm | On COMPLETED |

### Fee Status Flow
```
PENDING → RESERVED → DEDUCTED
              ↓
          REFUNDED (on cancellation)
              ↓
          WAIVED (admin override)
```

### Escrow System
| Event | Action |
|-------|--------|
| Load Assigned | Shipper wallet → Escrow (total fare amount) |
| POD Verified | Escrow → Carrier wallet |
| Cancellation | Escrow → Shipper wallet (refund) |

---

## 6. Roles & Permissions

| Role | Can Create | Can Approve | Special Access |
|------|------------|-------------|----------------|
| SHIPPER | Loads, TruckRequests | LoadRequests | View assigned carrier contact |
| CARRIER | Trucks, TruckPostings, LoadRequests | TruckRequests, MatchProposals | GPS tracking |
| DISPATCHER | MatchProposals | None (propose only) | View all loads/trucks |
| ADMIN | Corridors, Users | Trucks, Users, Settlements | All dashboards |
| SUPER_ADMIN | Everything | Everything | Role management |

### Foundation Rules (lib/foundation-rules.ts)
- `DISPATCHER_COORDINATION_ONLY`: Dispatchers can propose matches but cannot assign
- `CARRIER_FINAL_AUTHORITY`: Only carriers can approve assignments to their trucks

---

## 7. API Endpoint Count

| Category | Count | Key Endpoints |
|----------|-------|---------------|
| Auth | 7 | login, register, logout, me, forgot-password, reset-password, verify-mfa |
| Loads | 15 | CRUD, status, assign, matching-trucks, service-fee, pod |
| Trucks | 8 | CRUD, approve, nearby-loads, location |
| Truck Postings | 5 | CRUD, matching-loads, duplicate |
| Requests | 6 | load-requests, truck-requests, respond, cancel |
| Trips | 8 | CRUD, confirm, cancel, pod, live, history |
| GPS | 8 | position, positions, batch, live, history, devices |
| Admin | 20+ | dashboard, users, organizations, corridors, settlements |
| Financial | 4 | wallet/balance, wallet/transactions, withdraw |

**Total: ~100+ API endpoints**

---

## 8. Web Pages by Portal

### Carrier Portal (/carrier/*)
| Page | Purpose |
|------|---------|
| dashboard | Stats overview |
| loadboard | Post trucks, search loads (tabs) |
| trucks | Fleet management |
| trips | Active shipments |
| trip-history | Completed trips |
| requests | Incoming/outgoing requests |
| wallet | Balance & transactions |
| map | Live fleet map |
| gps | GPS device management |

### Shipper Portal (/shipper/*)
| Page | Purpose |
|------|---------|
| dashboard | Stats overview |
| loadboard | Post loads, search trucks (tabs) |
| loads | My loads list |
| trips | Active shipments |
| requests | Incoming/outgoing requests |
| wallet | Balance & transactions |
| map | Shipment tracking map |

### Admin Portal (/admin/*)
| Page | Purpose |
|------|---------|
| (dashboard) | Platform overview |
| users | User management |
| organizations | Company management |
| verification | Pending verifications |
| trucks/pending | Truck approval queue |
| corridors | Route pricing |
| settlement | Payment processing |
| audit-logs | Activity trail |

---

## 9. Mobile Screens (33 screens)

### Carrier Screens
- carrier_home_screen, carrier_loadboard_screen
- carrier_post_trucks_screen, carrier_trucks_screen
- carrier_trips_screen, carrier_trip_details_screen
- carrier_load_requests_screen, carrier_truck_requests_screen
- carrier_map_screen, load_details_screen, pod_upload_screen
- add_truck_screen, edit_truck_screen, truck_details_screen

### Shipper Screens
- shipper_home_screen, shipper_truckboard_screen
- shipper_loads_screen, shipper_load_details_screen
- shipper_trips_screen, shipper_trip_details_screen
- shipper_load_requests_screen, shipper_truck_requests_screen
- shipper_map_screen, shipper_trucks_screen, post_load_screen

### Shared Screens
- login_screen, register_screen, onboarding_screen
- profile_screen, notifications_screen, wallet_screen

---

## 10. Business Logic Files (72 files in lib/)

### Core Business Logic
| File | Purpose |
|------|---------|
| matchingEngine.ts | Truck/load matching algorithm |
| tripManagement.ts | Trip creation and status management |
| serviceFeeCalculation.ts | Corridor-based fee calculation |
| serviceFeeManagement.ts | Fee deduction and refunds |
| escrowManagement.ts | Fund hold/release |
| gpsIngestion.ts | GPS data storage |
| gpsTracking.ts | Live tracking |

### Supporting Logic
| File | Purpose |
|------|---------|
| auth.ts | Authentication & sessions |
| notifications.ts | Push/email/SMS notifications |
| cache.ts | Redis caching & invalidation |
| automationRules.ts | Settlement automation |
| bypassDetection.ts | Anti-bypass (off-platform) detection |
| trustMetrics.ts | Organization reliability scores |

---

## 11. Issues or Inconsistencies Found

### Duplicate Pages
| Primary | Duplicate | Status |
|---------|-----------|--------|
| /carrier/loadboard | /carrier/postings | Postings not in sidebar navigation |
| /dashboard/* | Legacy pages | Not in navigation, appear unused |

### Naming Inconsistencies
| Code | Actual Pattern |
|------|----------------|
| serviceFeeEtb (legacy) | shipperServiceFee, carrierServiceFee (new) |
| rate (deprecated) | totalFareEtb (new) |
| pricePerKm (legacy) | shipperPricePerKm, carrierPricePerKm (new) |

### Mobile vs Web Parity
- Mobile calls same API endpoints (verified from grep)
- All mobile screens have web equivalents
- GPS tracking: Mobile uses Geolocator package, posts to `/api/tracking/ingest`

### Potential Dead Code
- `/dashboard/*` routes exist but not in any navigation
- `/driver/*` page exists (single page, purpose unclear)
- `/ops/*` page exists (single page, purpose unclear)

---

## 12. Architecture Patterns

### API Design
- REST API with Next.js App Router
- Zod validation on all endpoints
- requireAuth() middleware for authentication
- Atomic transactions ($transaction) for multi-table updates

### Caching Strategy
- Redis for API response caching
- CacheInvalidation utility for cache busting on writes
- Keys: `loads:*`, `trucks:*`, `matching:*`

### Error Handling
- Idempotent request handling (check current state before action)
- Race condition protection (fresh re-fetch inside transactions)
- Unique constraint error handling (P2002)

### Real-time
- WebSocket for GPS live tracking
- FCM/APNs for mobile push notifications
- Database polling for web notifications

---

## Summary

This is a production-ready Ethiopian freight management platform with:
- **40 database tables** for comprehensive data modeling
- **100+ API endpoints** for full functionality
- **~100 web pages** across 4 portals (carrier, shipper, admin, auth)
- **33 mobile screens** with feature parity to web
- **72 business logic modules** in lib/
- **Corridor-based service fees** charged to both parties
- **Escrow system** for payment security
- **GPS tracking** with real-time WebSocket updates
- **Request-based matching** with carrier final authority

The codebase follows modern patterns: Next.js App Router, Prisma ORM, atomic transactions, and comprehensive API validation.

---

*Discovered from direct code inspection on 2026-02-01*
