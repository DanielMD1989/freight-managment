# 🚀 SPRINT 16: GPS TRACKING & COMMISSION SYSTEM - SUMMARY

**Duration:** Week 17-20 (4 weeks)
**Total Tasks:** 164 tasks
**Status:** 0% Complete (0/164 tasks)
**Priority:** P0-P2 (Mix of Critical and High Priority)

---

## 📊 OVERVIEW

Sprint 16 implements a comprehensive freight marketplace with:
- **GPS Integration**: Vehicle tracking with IMEI registration
- **Commission System**: Two-sided revenue model (5% shipper + 5% carrier)
- **Base + Per-KM Pricing**: Transparent pricing breakdown
- **Dispatcher System**: Company-owned MVP for fleet management
- **Trust Features**: Verification badges, completion rates, POD requirements
- **Anti-Bypass Detection**: Pattern tracking and platform incentives

---

## 📋 USER STORIES BREAKDOWN

### **Story 16.1: Base + Per-KM Pricing Model**
**Priority:** P0 (Blocker)
**Effort:** 3 days
**Tasks:** 17

**Description:**
Implement load pricing using base fare + per-km rates for transparent and scalable pricing.

**Key Tasks:**
- Update Load model with `baseFareEtb`, `perKmEtb`, `estimatedTripKm`, `actualTripKm`
- Create pricing calculation utility (`lib/pricingCalculation.ts`)
- Update load creation/editing APIs to calculate `totalFareEtb` automatically
- Update PostLoadsTab UI with base fare and per-km inputs
- Display RPM (Revenue Per Mile) and RPK (Revenue Per KM) metrics
- Add pricing guidance helper with market average suggestions

**Technical Notes:**
- Use Prisma Decimal type for financial precision
- Formula: `totalFareEtb = baseFareEtb + (estimatedTripKm × perKmEtb)`
- Phase 2: Use GPS-computed `actualTripKm` for final billing

---

### **Story 16.2: Vehicle Registration with GPS IMEI**
**Priority:** P0 (Blocker)
**Effort:** 4 days
**Tasks:** 19

**Description:**
Enable carriers to register vehicles with GPS IMEI for tracking and GPS-equipped badges.

**Key Tasks:**
- Update Truck model with `imei`, `gpsProvider`, `gpsLastSeenAt`, `gpsStatus`, `gpsVerifiedAt`
- Create GPS verification utility (`lib/gpsVerification.ts`)
- Update truck registration API to accept and verify IMEI
- Create GPS background monitoring service (30-second polling)
- Add GPS-equipped badge to truck displays
- Show GPS freshness indicator ("last seen X min ago")

**Technical Notes:**
- IMEI: 15-digit identifier for GPS devices
- GPS Status: ACTIVE, INACTIVE, SIGNAL_LOST
- Background monitoring starts at registration
- GPS data collected for verification, not exposed until load assignment

**GPS Freshness Thresholds:**
- <5 min: Green (online)
- 5-30 min: Yellow (stale)
- >30 min: Red (offline/signal lost)

---

### **Story 16.3: GPS Live Tracking for Assigned Loads**
**Priority:** P0 (Blocker)
**Effort:** 5 days
**Tasks:** 21

**Description:**
Provide real-time GPS tracking for loads after truck assignment.

**Key Tasks:**
- Update Load model with `trackingUrl`, `trackingEnabled`, `trackingStartedAt`
- Create GPS tracking page (`/app/loads/[id]/tracking`)
- Implement real-time position updates (WebSocket or SSE)
- Add geofence alerts (500m radius for arrival/departure)
- Create carrier tracking view (`/app/carrier/loads/[id]/tracking`)
- Show ETA calculation based on current position
- Display tracking history timeline

**Technical Notes:**
- GPS updates: 10-30 second intervals
- Use WebSocket or Server-Sent Events for real-time updates
- Geofence radius: 500m for arrival detection
- Store position history for replay (time-series data)

**Tracking Access Control:**
- Shipper: Full access after assignment
- Carrier: Own truck tracking
- Dispatcher: All company trucks
- Admin: All trucks (for support)

---

### **Story 16.4: Dispatcher System (MVP)**
**Priority:** P1 (High)
**Effort:** 3 days
**Tasks:** 13

**Description:**
Implement company-owned dispatcher role with full fleet management access.

**Key Tasks:**
- Add DISPATCHER role to User model
- Create dispatcher dashboard (`/app/dispatcher`)
- Implement assignment controls (assign truck to load)
- Add dispatcher permissions (view/edit all company loads and trucks)
- Create dispatcher assignment API (`POST /api/assignments`)
- Show dispatcher view in carrier portal
- Add dispatcher management in organization settings

**Technical Notes:**
- Dispatcher is owned by organization (carrier)
- Full access to all company loads, trucks, and assignments
- Can assign any company truck to any load
- No commission - internal role

**Dispatcher Permissions:**
- View all company loads and trucks
- Assign trucks to loads
- Update load/truck status
- View GPS tracking for all company trucks
- Access driver contact info

---

### **Story 16.5: Trust & Reliability Features**
**Priority:** P1 (High)
**Effort:** 4 days
**Tasks:** 19

**Description:**
Build trust indicators including verified badges, completion rates, and POD requirements.

**Key Tasks:**
- Update Organization model with `completionRate`, `cancellationRate`, `disputeRate`
- Add `totalLoadsCompleted`, `totalLoadsCancelled`, `totalDisputes` counters
- Create verified badge component (`DatVerifiedBadge`)
- Display completion/cancellation rates in company profiles
- Implement POD upload requirement (`POST /api/loads/[id]/pod`)
- Create POD verification workflow
- Add GPS online/offline indicator badges
- Show carrier/shipper reliability scores

**Technical Notes:**
- Verified badge: Green checkmark for verified orgs
- GPS indicator: Green dot if last seen <5 min, yellow if 5-30 min, red if >30 min
- Completion rate: `completedLoads / (completedLoads + cancelledLoads) × 100`
- POD required before settlement

**Reliability Metrics:**
- Excellent: >95% completion, <5% cancellation
- Good: 85-95% completion, 5-15% cancellation
- Fair: 70-85% completion, 15-30% cancellation
- Poor: <70% completion, >30% cancellation

---

### **Story 16.6: Anti-Bypass Detection**
**Priority:** P2 (Medium)
**Effort:** 3 days
**Tasks:** 18

**Description:**
Detect and discourage users from bypassing the platform after viewing contact info.

**Key Tasks:**
- Track contact info views (`Load.contactViewedAt`, `TruckPosting.contactViewedAt`)
- Add cancellation tracking after contact view
- Create bypass detection rules (`lib/bypassDetection.ts`)
- Flag suspicious patterns (view contact → cancel within 24h)
- Update Organization model with bypass tracking fields
- Create admin bypass review dashboard
- Add platform benefits section to encourage in-app transactions
- Implement gentle warnings (not punitive)

**Technical Notes:**
- Contact info visible but tracking encourages platform use
- Suspicious pattern: View contact → Cancel load → Book externally
- Detection threshold: 3+ cancellations after contact view
- Approach: Incentivize, not punish

**Platform Benefits to Highlight:**
- GPS tracking and transparency
- Escrow/payment protection (Phase 2)
- Dispute resolution
- Insurance/liability coverage
- Rating and reputation system
- Automated documentation

---

### **Story 16.7: Commission Calculation & Revenue**
**Priority:** P0 (Blocker)
**Effort:** 5 days
**Tasks:** 23

**Description:**
Implement two-sided commission model with settlement workflow.

**Key Tasks:**
- Update Load model with commission fields
  - `shipperCommissionRate` (default 5%)
  - `carrierCommissionRate` (default 5%)
  - `shipperCommissionAmount`, `carrierCommissionAmount`
  - `platformRevenue`, `settlementStatus`
- Create commission calculation utility (`lib/commissionCalculation.ts`)
- Create settlement workflow (`POST /api/loads/[id]/settle`)
- Implement wallet system (Organization model with `walletBalance`)
- Add POD requirement before settlement
- Create settlement history page
- Display commission breakdown in load details
- Implement auto-settle 24h after POD (if no dispute)

**Technical Notes:**
- Default commission: 5% shipper + 5% carrier = 10% total
- Commission based on `totalFareEtb` (base + km)
- No escrow - commissions deducted at settlement
- POD required before settlement can proceed
- Auto-verify POD after 24 hours if shipper doesn't respond

**Commission Calculation:**
```
shipperCommission = totalFareEtb × shipperCommissionRate
carrierCommission = totalFareEtb × carrierCommissionRate
platformRevenue = shipperCommission + carrierCommission
carrierPayout = totalFareEtb - carrierCommission
```

**Settlement Status:**
- PENDING: Load completed, awaiting POD
- POD_SUBMITTED: POD uploaded, awaiting verification
- VERIFIED: POD verified, ready to settle
- SETTLED: Payment processed, commissions deducted
- DISPUTED: Issue raised, requires admin review

---

### **Story 16.8: GPS Data Storage & Management**
**Priority:** P2 (Medium)
**Effort:** 3 days
**Tasks:** 14

**Description:**
Implement time-series GPS position storage and data retention policies.

**Key Tasks:**
- Create GpsPosition model (time-series data)
  - `truckId`, `latitude`, `longitude`, `timestamp`, `speed`, `heading`
- Create GPS data collection cron job
- Implement data retention policy (90 days active, 1 year archive)
- Create GPS data query API (`GET /api/trucks/[id]/positions`)
- Implement position history replay
- Add GPS data export for compliance
- Create data cleanup job (remove old positions)

**Technical Notes:**
- Store position every 30 seconds for active trucks
- Time-series optimized schema for query performance
- Retention: 90 days full data, then aggregate to hourly snapshots
- Archive 1 year for compliance, then delete

**GpsPosition Model:**
```prisma
model GpsPosition {
  id          String   @id @default(cuid())
  truckId     String
  truck       Truck    @relation(fields: [truckId], references: [id])
  latitude    Decimal  @db.Decimal(10, 8)
  longitude   Decimal  @db.Decimal(11, 8)
  speed       Decimal? // km/h
  heading     Decimal? // degrees (0-360)
  altitude    Decimal? // meters
  timestamp   DateTime @default(now())

  @@index([truckId, timestamp])
  @@index([timestamp])
}
```

---

### **Story 16.9: Admin GPS & Commission Tools**
**Priority:** P2 (Medium)
**Effort:** 2 days
**Tasks:** 9

**Description:**
Build admin tools for GPS monitoring and commission management.

**Key Tasks:**
- Create GPS management page (`/app/admin/gps`)
- Show all trucks with GPS status
- Add GPS device verification tools
- Create commission settings page (`/app/admin/settings/commission`)
- Allow admin to configure commission rates
- Add bypass review dashboard (`/app/admin/bypass-review`)
- Show flagged organizations with suspicious patterns
- Create settlement override tools (for disputes)

**Technical Notes:**
- Admin can override commission rates per organization
- Admin can manually verify/reject POD
- Admin can flag/unflag organizations
- Bypass review is informational, not punitive

---

### **Story 16.10: User Notifications & Alerts**
**Priority:** P2 (Medium)
**Effort:** 2 days
**Tasks:** 11

**Description:**
Notify users of GPS events, settlements, and bypass warnings.

**Key Tasks:**
- Create notification system (`lib/notifications.ts`)
- Send GPS event notifications
  - Truck goes offline (>30 min)
  - Truck arrives at pickup/delivery (geofence)
  - Truck deviates from route (Phase 2)
- Send settlement notifications
  - POD submitted
  - POD verified
  - Settlement completed
  - Commission deducted
- Send bypass warnings (gentle reminders about platform benefits)
- Add in-app notification center
- Email notifications (Phase 2)

**Notification Types:**
- GPS_OFFLINE: "Your truck {{truckId}} went offline"
- GEOFENCE_ENTER: "Truck arrived at {{location}}"
- POD_SUBMITTED: "POD uploaded for Load #{{loadId}}"
- SETTLEMENT_COMPLETE: "Settlement processed: {{amount}} ETB"
- BYPASS_WARNING: "We noticed you cancelled after viewing contact info"

---

### **Story 16.11: Driver Mobile App** (DEFERRED TO PHASE 2)
**Priority:** P3 (Low)
**Effort:** 10+ days
**Status:** DEFERRED

**Reason for Deferral:**
MVP uses web dashboard accessible on mobile browsers. Native mobile app with GPS background tracking deferred to Phase 2 to focus on core platform features first.

**Phase 2 Features:**
- React Native mobile app for drivers
- Background GPS tracking (iOS/Android)
- Offline mode for position buffering
- Push notifications
- One-tap POD photo upload
- Navigation integration

---

## 🎯 IMPLEMENTATION PRIORITIES

### Week 17 (P0 - Critical)
1. **Story 16.1** - Base + Per-KM Pricing (3 days)
2. **Story 16.2** - Vehicle GPS Registration (4 days)

### Week 18 (P0 - Critical)
3. **Story 16.3** - GPS Live Tracking (5 days)
4. **Story 16.4** - Dispatcher System (3 days, start mid-week)

### Week 19 (P0-P1)
4. **Story 16.4** - Dispatcher System (complete, 2 days)
5. **Story 16.5** - Trust & Reliability (4 days)
7. **Story 16.7** - Commission & Revenue (start, 2 days)

### Week 20 (P1-P2)
7. **Story 16.7** - Commission & Revenue (complete, 3 days)
6. **Story 16.6** - Anti-Bypass Detection (3 days)
8. **Story 16.8** - GPS Data Storage (2 days)
9. **Story 16.9** - Admin Tools (2 days)
10. **Story 16.10** - Notifications (2 days)

---

## 📊 ESTIMATED EFFORT

| Priority | Stories | Tasks | Days |
|----------|---------|-------|------|
| P0 (Blocker) | 3 | 59 | 13 days |
| P1 (High) | 3 | 55 | 11 days |
| P2 (Medium) | 4 | 50 | 10 days |
| **Total** | **10** | **164** | **~20 days** |

---

## 🔧 TECHNICAL STACK

### Database (Prisma)
- **New Models:** GpsPosition (time-series), Commission fields on Load
- **Updated Models:** Load (pricing, commission, tracking), Truck (GPS fields), Organization (trust metrics, wallet), User (DISPATCHER role)

### APIs (Next.js)
- **New Endpoints:**
  - `POST /api/trucks` (with IMEI verification)
  - `GET /api/trucks/[id]/positions` (GPS history)
  - `GET /api/loads/[id]/tracking` (live tracking)
  - `POST /api/loads/[id]/pod` (POD upload)
  - `POST /api/loads/[id]/settle` (settlement)
  - `POST /api/assignments` (dispatcher)
  - `GET /api/admin/bypass-review`

### Utilities
- `lib/pricingCalculation.ts` - Fare calculations
- `lib/gpsVerification.ts` - IMEI verification
- `lib/gpsMonitoring.ts` - Background polling
- `lib/commissionCalculation.ts` - Commission math
- `lib/bypassDetection.ts` - Pattern detection
- `lib/notifications.ts` - Notification service

### UI Components
- `DatVerifiedBadge` - Trust badge
- `DatGpsIndicator` - Online/offline status
- GPS tracking map page
- Commission breakdown display
- POD upload modal
- Settlement history table

---

## ⚠️ RISKS & MITIGATION

### High Risks
1. **GPS Device Integration**
   - Risk: Different GPS providers, unreliable signals
   - Mitigation: Support generic IMEI, fallback to manual status

2. **Commission Calculation Accuracy**
   - Risk: Rounding errors, edge cases
   - Mitigation: Use Decimal types, comprehensive testing

3. **Bypass Detection False Positives**
   - Risk: Legitimate cancellations flagged as bypass
   - Mitigation: High threshold (3+), review before action

### Medium Risks
1. **Real-time GPS Performance**
   - Risk: High load with many active trucks
   - Mitigation: WebSocket scaling, position throttling

2. **Settlement Disputes**
   - Risk: POD rejection, payment disagreements
   - Mitigation: Clear POD requirements, admin override tools

---

## ✅ ACCEPTANCE CRITERIA (Sprint 16 Complete When...)

- [ ] Loads can be priced with base + per-km rates
- [ ] Trucks can register with GPS IMEI
- [ ] Background GPS monitoring active for all registered trucks
- [ ] Live GPS tracking available for assigned loads
- [ ] Dispatcher can assign trucks to loads
- [ ] Verified badges and completion rates displayed
- [ ] POD upload required before settlement
- [ ] Commission calculated and deducted at settlement
- [ ] Bypass patterns tracked (informational)
- [ ] GPS position data stored with retention policy
- [ ] Admin tools for GPS and commission management
- [ ] Notifications sent for GPS events and settlements

---

## 📝 NOTES

- **No Escrow (MVP):** Commissions deducted at settlement, not held in escrow
- **GPS Policy:** Background monitoring from registration, live tracking only after assignment
- **Driver App:** Deferred to Phase 2, use web dashboard on mobile for MVP
- **Bypass Approach:** Track and incentivize, not punish
- **POD Auto-Verify:** 24-hour auto-approve if shipper doesn't respond

---

**Created:** 2025-12-27
**Status:** Ready for implementation
**Next Step:** Begin Story 16.1 (Base + Per-KM Pricing)
