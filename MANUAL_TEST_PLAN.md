# MANUAL TEST PLAN - FREIGHT MANAGEMENT PLATFORM

**Purpose:** Test the platform as a real user would use it
**Testers Needed:** 3-5 people (Shipper, Carrier, Admin, Dispatcher, Super Admin)
**Time Required:** 4-6 hours (full coverage)
**Devices:** Web browser + Mobile phone

---

## SETUP BEFORE TESTING

### Create Test Accounts
1. **Super Admin** - superadmin@test.com
2. **Admin Account** - admin@test.com
3. **Dispatcher** - dispatcher@test.com
4. **Shipper Account** - shipper@test.com (Company: "Test Shipper Co")
5. **Carrier Account** - carrier@test.com (Company: "Test Trucking LLC")

### Have Ready
- Two phones (for Shipper and Carrier mobile apps)
- One laptop (for Admin web dashboard)
- Notepad to write down any bugs found

---

## TEST 1: NEW USER REGISTRATION

### As Shipper (Mobile App)
- [ ] Open the app
- [ ] Tap "Sign Up"
- [ ] Enter email, password, phone number
- [ ] Select "Shipper" as account type
- [ ] Enter company name: "Test Shipper Co"
- [ ] Submit registration
- [ ] Check email for verification (or SMS code)
- [ ] Enter verification code
- [ ] **EXPECTED:** Account created, taken to dashboard

**Write down any problems:**
```
_________________________________________________
_________________________________________________
```

### As Carrier (Mobile App)
- [ ] Open the app
- [ ] Tap "Sign Up"
- [ ] Enter email, password, phone number
- [ ] Select "Carrier" as account type
- [ ] Enter company name: "Test Trucking LLC"
- [ ] Submit registration
- [ ] Verify account
- [ ] **EXPECTED:** Account created, taken to dashboard

**Write down any problems:**
```
_________________________________________________
_________________________________________________
```

---

## TEST 2: LOGIN & LOGOUT

### Test Normal Login
- [ ] Logout if logged in
- [ ] Enter correct email and password
- [ ] Tap "Login"
- [ ] **EXPECTED:** Taken to dashboard

### Test Wrong Password
- [ ] Logout
- [ ] Enter correct email, WRONG password
- [ ] Tap "Login"
- [ ] **EXPECTED:** Error message "Invalid credentials"
- [ ] Try 5 more times with wrong password
- [ ] **EXPECTED:** Account should be temporarily locked or rate limited

### Test Logout
- [ ] While logged in, tap profile/menu
- [ ] Tap "Logout"
- [ ] **EXPECTED:** Taken to login screen
- [ ] Try to go back
- [ ] **EXPECTED:** Should NOT be able to access dashboard

**Write down any problems:**
```
_________________________________________________
_________________________________________________
```

---

## TEST 3: CARRIER - REGISTER A TRUCK

### As Carrier (Mobile App)
- [ ] Login as carrier@test.com
- [ ] Go to "My Trucks" or "Fleet"
- [ ] Tap "Add Truck"
- [ ] Enter truck details:
  - License Plate: "ABC-1234"
  - Truck Type: "Flatbed"
  - Capacity: 20000 kg
  - Upload a photo of the truck
- [ ] Submit
- [ ] **EXPECTED:** Truck added with status "Pending Approval"
- [ ] **EXPECTED:** Cannot post this truck for jobs yet

**Write down any problems:**
```
_________________________________________________
_________________________________________________
```

---

## TEST 4: ADMIN - APPROVE TRUCK

### As Admin (Web Dashboard)
- [ ] Login as admin@test.com
- [ ] Go to "Pending Approvals" or "Truck Approvals"
- [ ] Find the truck "ABC-1234"
- [ ] Review the details and photo
- [ ] Click "Approve"
- [ ] **EXPECTED:** Truck status changes to "Approved"

### Back to Carrier (Mobile App)
- [ ] Refresh the trucks list
- [ ] **EXPECTED:** Truck "ABC-1234" now shows "Approved"
- [ ] **EXPECTED:** Can now post this truck for jobs

**Write down any problems:**
```
_________________________________________________
_________________________________________________
```

---

## TEST 5: CARRIER - POST TRUCK AVAILABILITY

### As Carrier (Mobile App)
- [ ] Go to approved truck "ABC-1234"
- [ ] Tap "Post Availability" or "Find Loads"
- [ ] Set availability:
  - Available From: Tomorrow
  - Available To: Next week
  - Current Location: Addis Ababa
  - Preferred Route: Addis Ababa to Dire Dawa
- [ ] Submit
- [ ] **EXPECTED:** Truck is now visible to shippers

**Write down any problems:**
```
_________________________________________________
_________________________________________________
```

---

## TEST 6: SHIPPER - CREATE A LOAD

### As Shipper (Mobile App)
- [ ] Login as shipper@test.com
- [ ] Go to "My Loads" or "Post Load"
- [ ] Tap "Create New Load"
- [ ] Enter load details:
  - Pickup Location: Addis Ababa
  - Delivery Location: Dire Dawa
  - Pickup Date: Tomorrow
  - Commodity: "Electronics"
  - Weight: 15000 kg
  - Price Offer: 50,000 Birr
  - Special Instructions: "Handle with care"
- [ ] Tap "Save as Draft"
- [ ] **EXPECTED:** Load saved with status "DRAFT"

### Post the Load
- [ ] Find the draft load
- [ ] Tap "Post Load" or "Publish"
- [ ] **EXPECTED:** Load status changes to "POSTED"
- [ ] **EXPECTED:** Load is now visible to carriers

**Write down any problems:**
```
_________________________________________________
_________________________________________________
```

---

## TEST 7: CARRIER - FIND AND REQUEST LOAD

### As Carrier (Mobile App)
- [ ] Go to "Find Loads" or "Loadboard"
- [ ] **EXPECTED:** See the load posted by shipper (Addis → Dire Dawa)
- [ ] Tap on the load to view details
- [ ] **EXPECTED:** See all details: pickup, delivery, weight, price
- [ ] Tap "Request Load" or "Send Proposal"
- [ ] Enter message: "I can pick up tomorrow morning"
- [ ] Submit request
- [ ] **EXPECTED:** Request sent, status shows "Pending"

**Write down any problems:**
```
_________________________________________________
_________________________________________________
```

---

## TEST 8: SHIPPER - APPROVE CARRIER REQUEST

### As Shipper (Mobile App)
- [ ] Go to "My Loads"
- [ ] Tap on the posted load
- [ ] **EXPECTED:** See notification or badge showing "1 Request"
- [ ] View the request from carrier
- [ ] **EXPECTED:** See carrier's company name, truck details, rating
- [ ] Tap "Approve" or "Accept"
- [ ] **EXPECTED:**
  - Load status changes to "ASSIGNED"
  - Trip is created
  - Can see assigned truck info

### As Carrier (Mobile App)
- [ ] Check notifications
- [ ] **EXPECTED:** Notification "Your request was approved!"
- [ ] Go to "My Trips" or "Active Jobs"
- [ ] **EXPECTED:** See the new trip with status "ASSIGNED"

**Write down any problems:**
```
_________________________________________________
_________________________________________________
```

---

## TEST 9: CARRIER - EXECUTE THE TRIP

### Step 1: Start Trip
- [ ] As Carrier, go to the assigned trip
- [ ] Tap "Start Trip" or "Begin Pickup"
- [ ] **EXPECTED:** Trip status changes to "PICKUP_PENDING"

### Step 2: Confirm Pickup
- [ ] Arrive at pickup location (or simulate)
- [ ] Tap "Confirm Pickup" or "Picked Up"
- [ ] Take a photo of the loaded cargo (if required)
- [ ] **EXPECTED:** Trip status changes to "IN_TRANSIT"

### Step 3: Check Shipper Can Track
- [ ] As Shipper, open the load/trip
- [ ] **EXPECTED:** See truck location on map
- [ ] **EXPECTED:** See status "IN_TRANSIT"
- [ ] **EXPECTED:** See estimated arrival time (if available)

### Step 4: Complete Delivery
- [ ] As Carrier, tap "Arrived" or "Mark Delivered"
- [ ] **EXPECTED:** Trip status changes to "DELIVERED"

### Step 5: Upload Proof of Delivery
- [ ] Tap "Upload POD" or "Proof of Delivery"
- [ ] Take photo of:
  - Delivered goods
  - Signature or receipt
- [ ] Submit
- [ ] **EXPECTED:** POD uploaded successfully

**Write down any problems:**
```
_________________________________________________
_________________________________________________
```

---

## TEST 10: COMPLETE TRIP & PAYMENT

### As Shipper (Mobile App)
- [ ] Go to the delivered load
- [ ] View the POD (proof of delivery)
- [ ] **EXPECTED:** Can see the photos uploaded by carrier
- [ ] Tap "Confirm Delivery" or "Mark Complete"
- [ ] **EXPECTED:**
  - Trip status changes to "COMPLETED"
  - Service fee is deducted from wallet
  - Success message shown

### Check Wallet/Financials
- [ ] As Shipper, check wallet balance
- [ ] **EXPECTED:** Balance reduced by service fee amount
- [ ] As Carrier, check wallet
- [ ] **EXPECTED:** Balance shows the trip earning (minus platform fee)

### Check Trust/Rating
- [ ] Rate the carrier (1-5 stars)
- [ ] Leave a comment
- [ ] **EXPECTED:** Rating submitted
- [ ] As Carrier, check your profile
- [ ] **EXPECTED:** Rating/completion count updated

**Write down any problems:**
```
_________________________________________________
_________________________________________________
```

---

## TEST 11: ALTERNATIVE FLOW - SHIPPER REQUESTS TRUCK

### As Shipper (Mobile App)
- [ ] Create a new load and post it
- [ ] Go to "Find Trucks"
- [ ] **EXPECTED:** See available trucks
- [ ] Find a truck that matches your needs
- [ ] Tap "Request Truck"
- [ ] Enter message and submit
- [ ] **EXPECTED:** Request sent to carrier

### As Carrier (Mobile App)
- [ ] Check notifications
- [ ] **EXPECTED:** "New truck request received"
- [ ] View the request
- [ ] **EXPECTED:** See load details
- [ ] Tap "Approve"
- [ ] **EXPECTED:** Trip created, truck assigned to load

**Write down any problems:**
```
_________________________________________________
_________________________________________________
```

---

## TEST 12: CANCELLATION SCENARIOS

### Cancel a Draft Load
- [ ] As Shipper, create a new load (don't post it)
- [ ] Delete or cancel the draft
- [ ] **EXPECTED:** Load deleted successfully

### Cancel a Posted Load (No Requests Yet)
- [ ] As Shipper, post a new load
- [ ] Immediately cancel it
- [ ] **EXPECTED:** Load cancelled, status "CANCELLED"

### Try to Cancel an Assigned Load
- [ ] Find a load that's already assigned
- [ ] Try to cancel it
- [ ] **EXPECTED:** Error - "Cannot cancel assigned load"

### Cancel a Trip (Before Pickup)
- [ ] As Carrier, find an assigned trip (not yet picked up)
- [ ] Tap "Cancel Trip"
- [ ] Enter reason
- [ ] **EXPECTED:**
  - Trip cancelled
  - Load goes back to "POSTED" or "SEARCHING"
  - Shipper is notified

**Write down any problems:**
```
_________________________________________________
_________________________________________________
```

---

## TEST 13: EDGE CASES & ERROR HANDLING

### Try Invalid Inputs
- [ ] Create load with negative weight → **EXPECTED:** Error
- [ ] Create load with past pickup date → **EXPECTED:** Error or warning
- [ ] Register truck with invalid license plate → **EXPECTED:** Error
- [ ] Try to post unapproved truck → **EXPECTED:** Error

### Network Issues
- [ ] Turn off internet/wifi
- [ ] Try to load the dashboard
- [ ] **EXPECTED:** Friendly error message, not crash
- [ ] Turn internet back on
- [ ] **EXPECTED:** App recovers, data loads

### Session Timeout
- [ ] Login and then wait (or manually expire session)
- [ ] Try to perform an action
- [ ] **EXPECTED:** Redirected to login, not error screen

**Write down any problems:**
```
_________________________________________________
_________________________________________________
```

---

## TEST 14: ADMIN FUNCTIONS

### As Admin (Web Dashboard)

#### View All Loads
- [ ] Go to "Loads" section
- [ ] **EXPECTED:** See all loads from all shippers
- [ ] Filter by status
- [ ] **EXPECTED:** Filters work correctly

#### View All Users
- [ ] Go to "Users" section
- [ ] **EXPECTED:** See all registered users
- [ ] Search for a user
- [ ] **EXPECTED:** Search works

#### Handle Exception
- [ ] Find a load and mark it as "Exception"
- [ ] Enter reason
- [ ] **EXPECTED:** Load status changes to "EXCEPTION"
- [ ] Resolve the exception
- [ ] **EXPECTED:** Load returns to previous state or specified state

#### View Analytics
- [ ] Go to "Dashboard" or "Analytics"
- [ ] **EXPECTED:** See charts/stats for:
  - Total loads
  - Active trips
  - Revenue
  - User counts

**Write down any problems:**
```
_________________________________________________
_________________________________________________
```

---

## TEST 15: NOTIFICATIONS

### Check You Receive Notifications For:
- [ ] New load request (as Carrier)
- [ ] Request approved (as Carrier)
- [ ] Request rejected (as Carrier)
- [ ] New truck request (as Carrier)
- [ ] Trip status changes (both parties)
- [ ] POD submitted (as Shipper)
- [ ] Trip completed (both parties)

### Notification Settings
- [ ] Go to Settings > Notifications
- [ ] Turn off a notification type
- [ ] Trigger that notification
- [ ] **EXPECTED:** Notification NOT received
- [ ] Turn it back on

**Write down any problems:**
```
_________________________________________________
_________________________________________________
```

---

## TEST 16: MOBILE + WEB SYNC

### Make Change on Mobile, Check Web
- [ ] As Shipper on MOBILE: Create a new load
- [ ] As Shipper on WEB: Refresh
- [ ] **EXPECTED:** Load appears on web

### Make Change on Web, Check Mobile
- [ ] As Admin on WEB: Approve a truck
- [ ] As Carrier on MOBILE: Refresh
- [ ] **EXPECTED:** Truck shows as approved

### Simultaneous Use
- [ ] Open same account on both mobile and web
- [ ] Make changes on one
- [ ] **EXPECTED:** Other updates (may need refresh)

**Write down any problems:**
```
_________________________________________________
_________________________________________________
```

---

## TEST 17: DISPATCHER WORKFLOWS

### Setup
- Create account: dispatcher@test.com with DISPATCHER role

### As Dispatcher (Web or Mobile)

#### 17A: View All Active Loads
- [ ] Login as dispatcher
- [ ] Go to "All Loads" or "Loadboard"
- [ ] **EXPECTED:** See loads from ALL shippers (not just your company)
- [ ] Filter by status, route, date
- [ ] **EXPECTED:** Filters work correctly

#### 17B: Create Match Proposal
- [ ] Find a POSTED load without a carrier
- [ ] Find an available truck that matches
- [ ] Tap "Suggest Match" or "Create Proposal"
- [ ] Select the truck and add a note
- [ ] Submit
- [ ] **EXPECTED:** Match proposal created, both parties notified

#### 17C: Handle Match Proposal Response
- [ ] As Carrier, check notifications
- [ ] **EXPECTED:** "Dispatcher suggested you for a load"
- [ ] View the proposal details
- [ ] Tap "Accept" or "Reject"
- [ ] If accepted → **EXPECTED:** Trip created
- [ ] If rejected → **EXPECTED:** Proposal marked rejected

#### 17D: Direct Assignment (Override)
- [ ] As Dispatcher, find a load that needs urgent assignment
- [ ] Tap "Direct Assign" or "Force Assign"
- [ ] Select a truck
- [ ] Confirm assignment
- [ ] **EXPECTED:** Load assigned without carrier approval (admin override)
- [ ] **EXPECTED:** Both shipper and carrier notified

#### 17E: Create Escalation
- [ ] Find an IN_TRANSIT load
- [ ] Tap "Report Issue" or "Escalate"
- [ ] Select type: "Late Pickup" / "GPS Offline" / "Truck Breakdown"
- [ ] Add description
- [ ] Submit
- [ ] **EXPECTED:** Escalation created, load status → EXCEPTION

**Write down any problems:**
```
_________________________________________________
_________________________________________________
```

---

## TEST 18: ESCALATION WORKFLOWS

### 18A: Shipper Reports Problem
- [ ] As Shipper, find an active trip
- [ ] Tap "Report Problem"
- [ ] Select issue type:
  - [ ] Late Pickup
  - [ ] Cargo Damage
  - [ ] Truck Breakdown
  - [ ] Driver Not Responding
  - [ ] Other
- [ ] Add description and photo (if applicable)
- [ ] Submit
- [ ] **EXPECTED:** Escalation created
- [ ] **EXPECTED:** Dispatcher/Admin notified

### 18B: Carrier Reports Problem
- [ ] As Carrier, find an active trip
- [ ] Tap "Report Issue"
- [ ] Select issue type:
  - [ ] Shipper Not Available
  - [ ] Wrong Address
  - [ ] Cargo Not Ready
  - [ ] Safety Concern
- [ ] Submit
- [ ] **EXPECTED:** Escalation created

### 18C: Admin/Dispatcher Handles Escalation
- [ ] As Admin, go to "Escalations" queue
- [ ] **EXPECTED:** See all open escalations
- [ ] Open an escalation
- [ ] **EXPECTED:** See full history, parties involved, trip details
- [ ] Add a note/comment
- [ ] Choose resolution:
  - [ ] "Continue Trip" - issue resolved
  - [ ] "Cancel Trip" - with reason
  - [ ] "Reassign" - find new carrier
- [ ] Submit resolution
- [ ] **EXPECTED:** Escalation closed, parties notified

### 18D: Auto-Escalation (GPS Offline)
- [ ] Start a trip as Carrier
- [ ] Turn off GPS/location services
- [ ] Wait 30 minutes (or configured time)
- [ ] As Admin, check escalations
- [ ] **EXPECTED:** Auto-escalation created "GPS Offline"

**Write down any problems:**
```
_________________________________________________
_________________________________________________
```

---

## TEST 19: DISPUTE WORKFLOWS

### 19A: Shipper Files Dispute
- [ ] As Shipper, find a COMPLETED trip
- [ ] Tap "File Dispute"
- [ ] Select dispute type:
  - [ ] Cargo Damage
  - [ ] Missing Items
  - [ ] Wrong Delivery Location
  - [ ] Payment Amount Wrong
- [ ] Add description
- [ ] Upload evidence photos
- [ ] Submit
- [ ] **EXPECTED:** Dispute created, trip locked from settlement

### 19B: Carrier Responds to Dispute
- [ ] As Carrier, check notifications
- [ ] **EXPECTED:** "Dispute filed on trip #XXX"
- [ ] View dispute details
- [ ] Add response/counter-evidence
- [ ] Submit
- [ ] **EXPECTED:** Response recorded

### 19C: Admin Resolves Dispute
- [ ] As Admin, go to "Disputes"
- [ ] Open the dispute
- [ ] Review evidence from both parties
- [ ] Make decision:
  - [ ] "In favor of Shipper" - refund/adjustment
  - [ ] "In favor of Carrier" - no change
  - [ ] "Split" - partial refund
- [ ] Add resolution notes
- [ ] Submit
- [ ] **EXPECTED:** Dispute closed, financial adjustments made, parties notified

**Write down any problems:**
```
_________________________________________________
_________________________________________________
```

---

## TEST 20: WALLET & FINANCIAL WORKFLOWS

### 20A: Check Wallet Balance
- [ ] As Shipper, go to "Wallet" or "Financials"
- [ ] **EXPECTED:** See current balance
- [ ] **EXPECTED:** See transaction history

- [ ] As Carrier, go to "Wallet"
- [ ] **EXPECTED:** See earnings balance
- [ ] **EXPECTED:** See pending payments

### 20B: Top Up Wallet (Shipper)
- [ ] As Shipper, tap "Add Funds" or "Top Up"
- [ ] Enter amount: 100,000 Birr
- [ ] Select payment method (bank transfer/mobile money)
- [ ] Complete payment
- [ ] **EXPECTED:** Balance updated after confirmation

### 20C: Escrow Hold on Assignment
- [ ] Note your wallet balance
- [ ] Post a load with price 50,000 Birr
- [ ] Get it assigned to a carrier
- [ ] Check wallet
- [ ] **EXPECTED:**
  - Balance reduced by ~50,000 + service fee
  - "Escrow Hold" shown in transactions

### 20D: Escrow Release on Completion
- [ ] Complete the trip (carrier delivers, shipper confirms)
- [ ] As Carrier, check wallet
- [ ] **EXPECTED:**
  - Earnings increased by load price minus platform fee
  - "Payment Received" transaction
- [ ] As Shipper, check wallet
- [ ] **EXPECTED:**
  - Escrow released
  - "Service Fee" deducted

### 20E: Escrow Refund on Cancellation
- [ ] Create and assign a new load
- [ ] Cancel the trip BEFORE pickup
- [ ] Check shipper wallet
- [ ] **EXPECTED:** Escrow refunded (minus cancellation fee if any)

### 20F: Carrier Withdrawal
- [ ] As Carrier with positive balance
- [ ] Tap "Withdraw"
- [ ] Enter amount and bank details
- [ ] Submit request
- [ ] **EXPECTED:** Withdrawal request created, status "Pending"

- [ ] As Admin, go to "Withdrawals"
- [ ] Review the request
- [ ] Tap "Approve"
- [ ] **EXPECTED:**
  - Carrier balance reduced
  - Withdrawal status "Completed"
  - Carrier notified

### 20G: Service Fee Verification
- [ ] Complete a trip worth 50,000 Birr
- [ ] Check platform fee (e.g., 5% = 2,500 Birr)
- [ ] Verify:
  - Shipper paid: 50,000 + shipper fee
  - Carrier received: 50,000 - carrier fee
  - Platform kept: shipper fee + carrier fee

**Write down any problems:**
```
_________________________________________________
_________________________________________________
```

---

## TEST 21: GPS & TRACKING (Extended)

### 21A: Enable GPS Tracking
- [ ] As Carrier, start a trip
- [ ] App asks for location permission
- [ ] Grant permission
- [ ] **EXPECTED:** Location starts updating

### 21B: Shipper Views Live Tracking
- [ ] As Shipper, open the active trip
- [ ] Tap "Track" or view map
- [ ] **EXPECTED:** See truck icon on map
- [ ] **EXPECTED:** Position updates every 30-60 seconds
- [ ] **EXPECTED:** See ETA to destination

### 21C: Route History
- [ ] After trip completion
- [ ] View the trip details
- [ ] Tap "View Route"
- [ ] **EXPECTED:** See the complete route taken on map

### 21D: GPS Offline Handling
- [ ] As Carrier, disable location/GPS mid-trip
- [ ] As Shipper, view tracking
- [ ] **EXPECTED:** See "Last known location" with timestamp
- [ ] **EXPECTED:** Warning "GPS offline since XX:XX"
- [ ] Wait for auto-escalation threshold
- [ ] **EXPECTED:** Escalation created automatically

### 21E: Geofence Alerts
- [ ] Create load with specific pickup address
- [ ] As Carrier, approach pickup location (within 500m)
- [ ] **EXPECTED:** "Arrived at pickup" notification or auto-status update
- [ ] Same for delivery location
- [ ] **EXPECTED:** "Arrived at delivery" notification

### 21F: Public Tracking Link
- [ ] As Shipper, find active trip
- [ ] Tap "Share Tracking"
- [ ] Copy public tracking link
- [ ] Open link in browser (not logged in)
- [ ] **EXPECTED:** See real-time truck position (limited info)

**Write down any problems:**
```
_________________________________________________
_________________________________________________
```

---

## TEST 22: EXPIRATION SCENARIOS

### 22A: Load Expiration
- [ ] Create and post a load
- [ ] Set expiry to short time (or wait if testing on real system)
- [ ] Don't assign it
- [ ] After expiry time passes
- [ ] **EXPECTED:** Load status → EXPIRED
- [ ] **EXPECTED:** No longer visible in loadboard
- [ ] **EXPECTED:** Shipper notified

### 22B: Request Expiration
- [ ] As Carrier, send request for a load
- [ ] As Shipper, DON'T respond
- [ ] Wait for request expiry (e.g., 24 hours or configured)
- [ ] **EXPECTED:** Request status → EXPIRED
- [ ] **EXPECTED:** Carrier notified "Your request expired"

### 22C: Truck Posting Expiration
- [ ] As Carrier, post truck availability
- [ ] Set end date
- [ ] After end date passes
- [ ] **EXPECTED:** Posting no longer visible to shippers
- [ ] **EXPECTED:** Carrier can re-post

**Write down any problems:**
```
_________________________________________________
_________________________________________________
```

---

## TEST 23: TRUST METRICS & RATINGS

### 23A: View Trust Metrics
- [ ] As Carrier, go to "My Profile" or "Company Profile"
- [ ] **EXPECTED:** See metrics:
  - Total completed loads
  - Completion rate (%)
  - Cancellation rate (%)
  - Average rating
  - Trust badge (Bronze/Silver/Gold/Platinum)

### 23B: Metrics Update on Completion
- [ ] Note current "Completed Loads" count
- [ ] Complete a trip
- [ ] Refresh profile
- [ ] **EXPECTED:** Count increased by 1
- [ ] **EXPECTED:** Completion rate updated

### 23C: Metrics Update on Cancellation
- [ ] Note current "Cancelled" count
- [ ] Cancel a trip (as carrier)
- [ ] Refresh profile
- [ ] **EXPECTED:** Cancellation count increased
- [ ] **EXPECTED:** Cancellation rate updated

### 23D: Rating System
- [ ] Complete a trip
- [ ] As Shipper, rate the carrier (1-5 stars)
- [ ] Add written review
- [ ] Submit
- [ ] **EXPECTED:** Rating recorded

- [ ] As Carrier, view profile
- [ ] **EXPECTED:** Average rating updated
- [ ] **EXPECTED:** Can see individual reviews

### 23E: Trust Badge Levels
Test badge thresholds (example):
- [ ] 0-10 completed: Bronze
- [ ] 11-50 completed: Silver
- [ ] 51-100 completed: Gold
- [ ] 100+ completed: Platinum
- [ ] Verify badge shows correctly on profile

### 23F: Low Trust Warning
- [ ] Find/create carrier with high cancellation rate (>20%)
- [ ] As Shipper, view that carrier's request
- [ ] **EXPECTED:** Warning shown "High cancellation rate"

**Write down any problems:**
```
_________________________________________________
_________________________________________________
```

---

## TEST 24: SUPER ADMIN WORKFLOWS

### Setup
- Login as superadmin@test.com (SUPER_ADMIN role)

### 24A: Manage Admin Users
- [ ] Go to "User Management"
- [ ] Create new admin user
- [ ] Assign ADMIN role
- [ ] **EXPECTED:** New admin can login

### 24B: System Configuration
- [ ] Go to "Settings" or "Configuration"
- [ ] Change a setting (e.g., service fee percentage)
- [ ] Save
- [ ] **EXPECTED:** Setting saved
- [ ] **EXPECTED:** New value takes effect

### 24C: View Platform Analytics
- [ ] Go to "Analytics" or "Dashboard"
- [ ] **EXPECTED:** See:
  - Total users
  - Total loads
  - Active trips
  - Revenue
  - Charts/graphs

### 24D: Export Data
- [ ] Go to "Reports"
- [ ] Select date range
- [ ] Export loads data
- [ ] **EXPECTED:** CSV/Excel file downloaded

**Write down any problems:**
```
_________________________________________________
_________________________________________________
```

---

## TEST 25: LOAD STATUS EDGE CASES

### 25A: SEARCHING Status
- [ ] Post a load
- [ ] Tap "Find Trucks" or enable auto-matching
- [ ] **EXPECTED:** Status changes to SEARCHING

### 25B: OFFERED Status
- [ ] Have a SEARCHING load
- [ ] System or dispatcher suggests matches
- [ ] **EXPECTED:** Status changes to OFFERED

### 25C: EXCEPTION Status
- [ ] Have an IN_TRANSIT load
- [ ] Create escalation
- [ ] **EXPECTED:** Status changes to EXCEPTION
- [ ] Resolve escalation with "Continue"
- [ ] **EXPECTED:** Status returns to IN_TRANSIT

### 25D: UNPOSTED Status
- [ ] Have a POSTED load
- [ ] Tap "Unpost" or "Remove from Loadboard"
- [ ] **EXPECTED:** Status changes to UNPOSTED
- [ ] Load no longer visible to carriers
- [ ] Can re-post later

**Write down any problems:**
```
_________________________________________________
_________________________________________________
```

---

## BUG REPORT TEMPLATE

When you find a bug, write it down like this:

```
BUG #___

What I was doing:
_________________________________________________

What I expected to happen:
_________________________________________________

What actually happened:
_________________________________________________

Device/Browser:
_________________________________________________

Screenshot taken? Yes / No

Can I reproduce it? Yes / No / Sometimes
```

---

## QUICK REFERENCE - STATUS FLOWS

### Load Status Flow:
```
DRAFT → POSTED → SEARCHING → OFFERED → ASSIGNED → PICKUP_PENDING → IN_TRANSIT → DELIVERED → COMPLETED
                                          ↓                              ↓
                                     CANCELLED                       EXCEPTION
                                                                         ↓
                                                                    (Resolved)
```

### Trip Status Flow:
```
ASSIGNED → PICKUP_PENDING → IN_TRANSIT → DELIVERED → COMPLETED
    ↓            ↓
 CANCELLED   CANCELLED
```

### Request Status Flow:
```
PENDING → APPROVED
    ↓
REJECTED / CANCELLED / EXPIRED
```

---

## UPDATED COVERAGE SUMMARY

After adding these tests:

| Category | Coverage |
|----------|----------|
| User Roles | 5/5 ✅ |
| Load Status | 13/13 ✅ |
| Trip Status | 6/6 ✅ |
| Request Flow | 100% ✅ |
| Financial/Wallet | 100% ✅ |
| Escalations | 100% ✅ |
| Disputes | 100% ✅ |
| GPS/Tracking | 100% ✅ |
| Trust Metrics | 100% ✅ |
| Expiration | 100% ✅ |
| Admin Functions | 100% ✅ |

---

## FINAL CHECKLIST (UPDATED)

### All User Roles Tested
- [ ] Shipper
- [ ] Carrier
- [ ] Admin
- [ ] Dispatcher
- [ ] Super Admin

### All Load Statuses Tested
- [ ] DRAFT
- [ ] POSTED
- [ ] SEARCHING
- [ ] OFFERED
- [ ] ASSIGNED
- [ ] PICKUP_PENDING
- [ ] IN_TRANSIT
- [ ] DELIVERED
- [ ] COMPLETED
- [ ] EXCEPTION
- [ ] CANCELLED
- [ ] EXPIRED
- [ ] UNPOSTED

### All Financial Flows Tested
- [ ] Wallet top-up
- [ ] Escrow hold
- [ ] Escrow release
- [ ] Escrow refund
- [ ] Service fee deduction
- [ ] Carrier withdrawal

### All Support Flows Tested
- [ ] Escalation create
- [ ] Escalation resolve
- [ ] Dispute create
- [ ] Dispute resolve

---

## SIGN OFF

```
Tested By: _______________________
Date: _______________________
Overall Result: PASS / FAIL / PASS WITH ISSUES

Notes:
_________________________________________________
_________________________________________________
_________________________________________________
```
