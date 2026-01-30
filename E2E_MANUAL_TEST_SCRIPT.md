# E2E MANUAL TEST SCRIPT - Freight Platform

## Test Environment Setup

### Pre-requisites:
- [ ] Mobile app running (`cd mobile && flutter run`)
- [ ] Web app running (`cd web && npm run dev`)
- [ ] Database seeded with test data
- [ ] Test accounts ready:
  - Shipper: shipper@test.com / password
  - Carrier: carrier@test.com / password
  - Admin: admin@test.com / password

### Test Corridors (Admin should have set these):
| Route | Distance | Rate (ETB/km) | Expected Fee |
|-------|----------|---------------|--------------|
| Addis → Dire Dawa | 453 km | 2.50 | 1,133 ETB |
| Addis → Djibouti | 910 km | 3.00 | 2,730 ETB |
| Addis → Mekelle | 783 km | 2.50 | 1,958 ETB |

---

# PART 1: UI/UX TESTS

## TEST 1.1: Shipper Posts Load (No Price Fields)

**Login as: SHIPPER**

| Step | Action | Expected Result | ✅/❌ |
|------|--------|-----------------|-------|
| 1 | Open app, login as shipper | See Shipper Home Dashboard | |
| 2 | Tap "Post Load" | See multi-step form | |
| 3 | Select Pickup: Addis Ababa | City selected | |
| 4 | Select Delivery: Dire Dawa | City selected | |
| 5 | **CHECK: NO price/rate input field** | ❌ Should NOT see any price input | |
| 6 | **CHECK: NO baseFareEtb field** | ❌ Should NOT exist | |
| 7 | **CHECK: NO perKmEtb field** | ❌ Should NOT exist | |
| 8 | **CHECK: Service fee info box visible** | ✅ Should see "Fee = Distance × Corridor Rate" | |
| 9 | Fill cargo details (weight, type, truck type) | Form accepts input | |
| 10 | Submit load | Load posted successfully | |
| 11 | **RECORD: Load ID** | Load ID: _____________ | |

---

## TEST 1.2: Carrier Views Loadboard

**Login as: CARRIER**

| Step | Action | Expected Result | ✅/❌ |
|------|--------|-----------------|-------|
| 1 | Open app, login as carrier | See Carrier Home Dashboard | |
| 2 | Tap "Find Loads" (Loadboard) | See list of posted loads | |
| 3 | Find load from Test 1.1 | Load card visible | |
| 4 | **CHECK: Service fee displayed** | ✅ "Est. Fee: ~1,133 ETB" | |
| 5 | **CHECK: Distance displayed** | ✅ "453 km" | |
| 6 | **CHECK: Trust badge displayed** | ✅ "⭐X.X • X loads • 🥈 Badge" | |
| 7 | **CHECK: NO negotiated price shown** | ❌ Should NOT see load price | |

---

## TEST 1.3: Carrier Requests Load (No Price Input)

| Step | Action | Expected Result | ✅/❌ |
|------|--------|-----------------|-------|
| 1 | Tap "Request Load" on card | Request modal opens | |
| 2 | **CHECK: NO proposedRate input** | ❌ Should NOT see rate input | |
| 3 | **CHECK: NO price input of any kind** | ❌ No price fields | |
| 4 | **CHECK: Service fee info visible** | ✅ Fee info shown | |
| 5 | Select truck to use | Truck selected | |
| 6 | Add message (optional) | Message entered | |
| 7 | Submit request | Request sent successfully | |
| 8 | **RECORD: Request ID** | Request ID: _____________ | |

---

## TEST 1.4: Shipper Approves & Contact to Negotiate

**Login as: SHIPPER**

| Step | Action | Expected Result | ✅/❌ |
|------|--------|-----------------|-------|
| 1 | Go to "Load Requests" | See pending request | |
| 2 | **CHECK: NO proposed price shown** | ❌ No price on request | |
| 3 | Tap "Approve" | Request approved | |
| 4 | **CHECK: Contact to Negotiate box** | ✅ Should see: | |
| | | "🤝 Contact to Negotiate" | |
| | | Carrier company name | |
| | | Phone number | |
| | | [📞 Call] [💬 Message] buttons | |
| 5 | Tap "Call" button | Phone dialer opens | |
| 6 | Tap "Message" button | SMS app opens | |

---

## TEST 1.5: Carrier Sees Approved + Contact Info

**Login as: CARRIER**

| Step | Action | Expected Result | ✅/❌ |
|------|--------|-----------------|-------|
| 1 | Go to "Load Requests" | See approved request | |
| 2 | **CHECK: Contact to Negotiate box** | ✅ Should see shipper contact | |

---

## TEST 1.6: Truck Posting (No Price Fields)

**Login as: CARRIER**

| Step | Action | Expected Result | ✅/❌ |
|------|--------|-----------------|-------|
| 1 | Go to "Post Trucks" | See truck list | |
| 2 | Select truck, tap "Post" | Post modal opens | |
| 3 | **CHECK: NO expectedRate input** | ❌ Should NOT exist | |
| 4 | **CHECK: NO price fields** | ❌ No price inputs | |
| 5 | Select dates, location | Form filled | |
| 6 | Submit | Truck posted | |

---

## TEST 1.7: Shipper Views Truckboard

**Login as: SHIPPER**

| Step | Action | Expected Result | ✅/❌ |
|------|--------|-----------------|-------|
| 1 | Go to "Find Trucks" | See posted trucks | |
| 2 | **CHECK: Trust badge on cards** | ✅ "⭐X.X • X trips • 🥇 Badge" | |
| 3 | **CHECK: Service fee info** | ✅ "Service fee calculated on booking" | |
| 4 | **CHECK: NO carrier rate shown** | ❌ No expected rate | |

---

## TEST 1.8: Shipper Requests Truck (No Price Input)

| Step | Action | Expected Result | ✅/❌ |
|------|--------|-----------------|-------|
| 1 | Tap "Request Truck" | Modal opens | |
| 2 | **CHECK: NO offeredRate input** | ❌ Should NOT exist | |
| 3 | **CHECK: NO price input** | ❌ No price fields | |
| 4 | Select load to assign | Load selected | |
| 5 | Submit request | Request sent | |

---

# PART 2: SOURCE OF TRUTH TESTS

## TEST 2.1: Load Data Consistency

| Check | Web App | Mobile App | Database | Match? |
|-------|---------|------------|----------|--------|
| Load status | | | | |
| Pickup location | | | | |
| Delivery location | | | | |
| Weight | | | | |
| Distance | | | | |
| Service fee | | | | |

**Steps:**
1. Create load via mobile
2. Check load appears in web with same data
3. Query database directly: `SELECT * FROM Load WHERE id = 'xxx'`
4. All three should match exactly

---

## TEST 2.2: Request Data Consistency

| Check | Web App | Mobile App | Database | Match? |
|-------|---------|------------|----------|--------|
| Request status | | | | |
| Shipper org | | | | |
| Carrier org | | | | |
| Load reference | | | | |
| Truck reference | | | | |

---

## TEST 2.3: Trip Data Consistency

| Check | Web App | Mobile App | Database | Match? |
|-------|---------|------------|----------|--------|
| Trip status | | | | |
| Load reference | | | | |
| Truck reference | | | | |
| Distance | | | | |
| Route history | | | | |

---

## TEST 2.4: User/Organization Data

| Check | Web App | Mobile App | Database | Match? |
|-------|---------|------------|----------|--------|
| User role | | | | |
| Organization name | | | | |
| Trust rating | | | | |
| Completed count | | | | |
| Wallet balance | | | | |

---

# PART 3: GPS & DISTANCE TESTS

## TEST 3.1: GPS Tracking Setup

**Login as: CARRIER (with active trip)**

| Step | Action | Expected Result | ✅/❌ |
|------|--------|-----------------|-------|
| 1 | Start a trip | Trip status → IN_TRANSIT | |
| 2 | **CHECK: GPS permission requested** | App asks for location | |
| 3 | Grant GPS permission | Permission granted | |
| 4 | **CHECK: Location tracking active** | GPS icon visible / tracking indicator | |

---

## TEST 3.2: GPS Position Updates

| Step | Action | Expected Result | ✅/❌ |
|------|--------|-----------------|-------|
| 1 | Move device (or use mock location) | Position should update | |
| 2 | **CHECK: Database updated** | Query: `SELECT currentLocationLat, currentLocationLng FROM Truck WHERE id = 'xxx'` | |
| 3 | **CHECK: Web shows updated position** | Map/position updates | |
| 4 | **CHECK: Trip routeHistory updated** | New coordinates added to route | |

---

## TEST 3.3: Distance Calculation Accuracy

| Route | Expected Distance | Calculated Distance | Difference | Acceptable? |
|-------|-------------------|---------------------|------------|-------------|
| Addis → Dire Dawa | ~453 km | | | < 5% diff |
| Addis → Djibouti | ~910 km | | | < 5% diff |
| Addis → Mekelle | ~783 km | | | < 5% diff |

**How to verify:**
1. Check corridor distance in admin panel
2. Compare with Google Maps distance
3. Check calculated service fee uses correct distance

---

## TEST 3.4: Service Fee Calculation from Distance

| Check | Value | Correct? |
|-------|-------|----------|
| Corridor: Addis → Dire Dawa | | |
| Distance in system | _____ km | |
| Rate per km | _____ ETB/km | |
| Calculated shipper fee | _____ ETB | |
| Calculated carrier fee | _____ ETB | |
| Formula matches: Distance × Rate | | ✅/❌ |

---

# PART 4: REVENUE & FINANCIAL TESTS

## TEST 4.1: Service Fee Deduction on Trip Completion

**Pre-requisite:** Complete a full trip cycle

### Before Trip Completion:
| Account | Balance |
|---------|---------|
| Shipper wallet | _______ ETB |
| Carrier wallet | _______ ETB |
| Platform revenue account | _______ ETB |

### Trip Details:
| Field | Value |
|-------|-------|
| Trip ID | |
| Route | → |
| Distance | km |
| Corridor rate | ETB/km |
| Expected shipper fee | ETB |
| Expected carrier fee | ETB |
| Expected platform revenue | ETB |

### After Trip Completion:
| Account | Balance | Change | Expected Change | Match? |
|---------|---------|--------|-----------------|--------|
| Shipper wallet | | | -shipper_fee | |
| Carrier wallet | | | -carrier_fee | |
| Platform revenue | | | +total_fee | |

---

## TEST 4.2: Journal Entry Verification

**Query database after trip completion:**

```sql
SELECT * FROM JournalEntry
WHERE tripId = 'xxx'
ORDER BY createdAt DESC;
```

| Expected Entry | Found? | Amount | Correct? |
|----------------|--------|--------|----------|
| SHIPPER_SERVICE_FEE (debit from shipper) | | | |
| CARRIER_SERVICE_FEE (debit from carrier) | | | |
| PLATFORM_REVENUE (credit to platform) | | | |

---

## TEST 4.3: Financial Account Balances

**Query database:**

```sql
SELECT type, balance FROM FinancialAccount
WHERE organizationId IN ('shipper_org_id', 'carrier_org_id', 'platform_org_id');
```

| Account Type | Organization | Balance | Updated After Trip? |
|--------------|--------------|---------|---------------------|
| WALLET | Shipper | | |
| WALLET | Carrier | | |
| PLATFORM_REVENUE | Platform | | |

---

## TEST 4.4: Revenue Not Collected if Trip Cancelled

| Step | Action | Expected Result | ✅/❌ |
|------|--------|-----------------|-------|
| 1 | Create load, request, approve | Trip created | |
| 2 | Record wallet balances | Before: _______ | |
| 3 | Cancel trip | Trip status → CANCELLED | |
| 4 | **CHECK: No fees deducted** | Balances unchanged | |
| 5 | **CHECK: No journal entries** | No fee entries created | |

---

# PART 5: ANALYTICS & DASHBOARD TESTS

## TEST 5.1: Shipper Dashboard Stats

**Login as: SHIPPER**

| Stat | Dashboard Value | Database Query | Match? |
|------|-----------------|----------------|--------|
| Active Loads | | `SELECT COUNT(*) FROM Load WHERE shipperId='x' AND status='POSTED'` | |
| In Transit | | `SELECT COUNT(*) FROM Load WHERE shipperId='x' AND status='IN_TRANSIT'` | |
| Completed | | `SELECT COUNT(*) FROM Load WHERE shipperId='x' AND status='COMPLETED'` | |
| Total Spent (fees) | | `SELECT SUM(amount) FROM JournalEntry WHERE type='SHIPPER_SERVICE_FEE' AND orgId='x'` | |

---

## TEST 5.2: Carrier Dashboard Stats

**Login as: CARRIER**

| Stat | Dashboard Value | Database Query | Match? |
|------|-----------------|----------------|--------|
| Total Trucks | | `SELECT COUNT(*) FROM Truck WHERE carrierId='x'` | |
| Active Trucks | | `SELECT COUNT(*) FROM Truck WHERE carrierId='x' AND status='ACTIVE'` | |
| In Transit | | `SELECT COUNT(*) FROM Trip WHERE carrierId='x' AND status='IN_TRANSIT'` | |
| Completed Trips | | `SELECT COUNT(*) FROM Trip WHERE carrierId='x' AND status='COMPLETED'` | |
| Wallet Balance | | `SELECT balance FROM FinancialAccount WHERE orgId='x' AND type='WALLET'` | |

---

## TEST 5.3: Admin Dashboard Stats

**Login as: ADMIN**

| Stat | Dashboard Value | Database Query | Match? |
|------|-----------------|----------------|--------|
| Total Users | | `SELECT COUNT(*) FROM User` | |
| Total Loads | | `SELECT COUNT(*) FROM Load` | |
| Total Trips | | `SELECT COUNT(*) FROM Trip` | |
| Platform Revenue | | `SELECT balance FROM FinancialAccount WHERE type='PLATFORM_REVENUE'` | |
| Active Corridors | | `SELECT COUNT(*) FROM Corridor WHERE isActive=true` | |

---

## TEST 5.4: Analytics Page Accuracy

**Web: /shipper/analytics or /carrier/analytics**

| Metric | Analytics Value | Calculated from DB | Match? |
|--------|-----------------|-------------------|--------|
| Loads this month | | | |
| Trips completed | | | |
| Fees paid | | | |
| Completion rate | | | |

---

# PART 6: ADMIN CORRIDOR MANAGEMENT

## TEST 6.1: Admin Sets Corridor Rate

**Login as: ADMIN**

| Step | Action | Expected Result | ✅/❌ |
|------|--------|-----------------|-------|
| 1 | Go to /admin/corridors | See corridor list | |
| 2 | Edit "Addis → Dire Dawa" | Edit form opens | |
| 3 | Set rate: 3.00 ETB/km | Rate updated | |
| 4 | Save | Success message | |
| 5 | **CHECK: New rate applies to new loads** | | |

---

## TEST 6.2: Promotional Rate

| Step | Action | Expected Result | ✅/❌ |
|------|--------|-----------------|-------|
| 1 | Add promo: 50% off | Promo saved | |
| 2 | **CHECK: New loads use promo rate** | Fee = Distance × (Rate × 50%) | |
| 3 | **CHECK: Promo badge shown** | "🏷️ Promo" visible | |

---

# PART 7: COMPLETE TRIP CYCLE TEST

## Full E2E Flow

| Step | Actor | Action | Verify | ✅/❌ |
|------|-------|--------|--------|-------|
| 1 | Admin | Set corridor: Addis→Dire Dawa = 2.50 ETB/km | Rate saved | |
| 2 | Shipper | Post load (Addis → Dire Dawa, 15000kg) | No price input, fee info shown | |
| 3 | Carrier | Find load on loadboard | Fee displayed: ~1,133 ETB | |
| 4 | Carrier | Request load | No price input | |
| 5 | Shipper | Approve request | Contact to negotiate shown | |
| 6 | System | Trip created | Trip status = ASSIGNED | |
| 7 | Carrier | Start trip | Status → PICKUP_PENDING | |
| 8 | Carrier | Confirm pickup | Status → IN_TRANSIT, GPS tracking | |
| 9 | Carrier | Drive (GPS updates) | Route history populated | |
| 10 | Carrier | Arrive, upload POD | POD saved | |
| 11 | Shipper | Confirm delivery | Status → COMPLETED | |
| 12 | System | Deduct fees | Shipper: -566 ETB, Carrier: -567 ETB | |
| 13 | System | Credit platform | Platform: +1,133 ETB | |
| 14 | Dashboard | Stats updated | All counts +1 | |
| 15 | Analytics | Revenue updated | Total revenue increased | |

---

# CRITICAL CHECKS SUMMARY

## ❌ Should NOT Exist (Business Model Violations)

| Item | Location | Found? (Should be NO) |
|------|----------|----------------------|
| Price input in load posting | Post Load form | |
| Price input in truck posting | Post Truck form | |
| proposedRate in load request | Request modal | |
| offeredRate in truck request | Request modal | |
| Any price negotiation UI | Anywhere | |

## ✅ Should Exist

| Item | Location | Found? |
|------|----------|--------|
| Service fee info | Load posting, cards, modals | |
| Trust badges | Load cards, truck cards | |
| Contact to negotiate | Approved requests | |
| Distance display | Load cards | |
| Corridor rate (admin) | Admin panel | |

## 💰 Revenue Collection

| Check | Working? |
|-------|----------|
| Shipper fee deducted on completion | |
| Carrier fee deducted on completion | |
| Platform revenue credited | |
| Journal entries created | |
| Wallet balances updated | |

## 📍 GPS & Distance

| Check | Working? |
|-------|----------|
| GPS permission requested | |
| Location tracking during trip | |
| Route history saved | |
| Distance calculation accurate | |
| Fee based on correct distance | |

## 📊 Analytics Accuracy

| Check | Accurate? |
|-------|-----------|
| Shipper dashboard stats | |
| Carrier dashboard stats | |
| Admin dashboard stats | |
| Analytics page metrics | |

---

# TEST RESULTS SIGN-OFF

| Tester | Date | Result |
|--------|------|--------|
| | | PASS / FAIL |

## Issues Found:
1.
2.
3.

## Notes:
