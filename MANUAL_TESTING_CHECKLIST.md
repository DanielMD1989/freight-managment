# 🧪 Manual Testing Checklist - Sprint 7 Final Validation

**Status:** Ready for Testing
**Server:** http://localhost:3000
**Remaining Tests:** 4/4 (0% Complete)

---

## 📋 Pre-Testing Setup

### Step 1: Register Test Users

#### Shipper Account
- [ ] Navigate to http://localhost:3000/register
- [ ] Register with these details:
  ```
  Email: shipper@test.com
  Password: Test123!
  Organization Type: Shipper
  Company Name: ABC Logistics
  ```
- [ ] Verify registration successful
- [ ] Login with shipper credentials

#### Carrier Account
- [ ] Navigate to http://localhost:3000/register (in new incognito window or logout first)
- [ ] Register with these details:
  ```
  Email: carrier@test.com
  Password: Test123!
  Organization Type: Carrier Company
  Company Name: XYZ Transport
  ```
- [ ] Verify registration successful
- [ ] Login with carrier credentials

#### Admin/Ops Account (Optional)
- [ ] Register a third account with role PLATFORM_OPS or ADMIN
- [ ] Or manually update an existing user's role in the database:
  ```sql
  UPDATE "User" SET role = 'PLATFORM_OPS' WHERE email = 'ops@test.com';
  ```

### Step 2: Create Test Loads

Login as **shipper@test.com** and create these test loads:

#### Load 1: Full Load - Posted (For general testing)
- [ ] Navigate to `/dashboard/loads/new`
- [ ] Fill in all fields:
  ```
  Pickup City: Addis Ababa
  Pickup Address: Bole District, Main Road
  Pickup Date: [2 days from now]
  Pickup Dock Hours: 8:00 AM - 5:00 PM
  Appointment Required: Yes

  Delivery City: Dire Dawa
  Delivery Address: Industrial Zone
  Delivery Date: [3 days from now]
  Delivery Dock Hours: 9:00 AM - 6:00 PM

  Truck Type: Flatbed
  Weight: 15000 kg
  Cargo Description: Construction materials - Steel beams

  Trip Distance: 515 km
  Deadhead to Origin: 25 km
  Deadhead after Delivery: 30 km

  Load Type: Full Load
  Booking Mode: Request

  Cargo Length: 12.5 m
  Cases Count: 50

  Rate: 25000 ETB

  Contact Name: Ahmed Hassan
  Contact Phone: +251911234567

  DTP Reference: DTP-2025-001
  Factor Rating: A+

  Safety Notes: Heavy load - requires proper securing

  Anonymous: No (unchecked)
  Status: POSTED ✓
  ```
- [ ] Save and verify load created
- [ ] Note the Load ID: _______________

#### Load 2: Anonymous Shipper - Posted
- [ ] Create another load with same details but:
  ```
  Pickup: Hawassa
  Delivery: Mekelle
  Trip Distance: 780 km
  Rate: 45000 ETB
  Anonymous: Yes ✓
  Status: POSTED
  ```
- [ ] Save and verify load created
- [ ] Note the Load ID: _______________

#### Load 3: Draft Load (Not Posted)
- [ ] Create a third load:
  ```
  Pickup: Bahir Dar
  Delivery: Gondar
  Trip Distance: [Leave blank - testing draft without tripKm]
  Rate: 8500 ETB
  Status: DRAFT
  ```
- [ ] Verify it saves successfully without tripKm
- [ ] Note the Load ID: _______________

---

## 🧪 Manual Integration Tests

### Test 1: Full Create → Post → Search → View Details Flow

**Objective:** Verify complete user journey from load creation to viewing

**Steps:**
- [ ] **As Shipper:**
  - [ ] Navigate to `/dashboard/loads/new`
  - [ ] Create a new load (use Load 1 template above)
  - [ ] Save as DRAFT first
  - [ ] Verify load appears in "My Loads" (`/dashboard/loads`)
  - [ ] Click "Edit" on the draft load
  - [ ] Change status to POSTED
  - [ ] Verify validation requires tripKm to be filled
  - [ ] Fill tripKm and save
  - [ ] Verify postedAt timestamp is set (check load details page)

- [ ] **As Carrier:**
  - [ ] Logout and login as carrier@test.com
  - [ ] Navigate to "Find Loads" (`/dashboard/loads/search`)
  - [ ] Verify the posted load appears in the grid
  - [ ] Verify all 20 DAT columns are visible
  - [ ] Click "View" on the load
  - [ ] Verify load details page shows all information
  - [ ] Verify contact information is HIDDEN (load not assigned yet)

**Expected Results:**
- ✅ Load creation succeeds
- ✅ Draft load can be saved without tripKm
- ✅ Posting requires tripKm validation
- ✅ Load appears in marketplace after posting
- ✅ postedAt timestamp set automatically
- ✅ All DAT columns visible in grid
- ✅ Contact info hidden for unassigned loads

**Actual Results:**
```
[Document your findings here]
```

**Status:** [ ] PASS / [ ] FAIL / [ ] BLOCKED

---

### Test 2: Grid Sorting, Filtering, and Pagination

**Objective:** Verify all grid features work correctly

**Prerequisites:** Have at least 5 posted loads in the system

**Steps:**

#### Sorting Tests
- [ ] **As Carrier on Find Loads page:**
  - [ ] Click "Age" header → verify sorts by posted time
  - [ ] Click again → verify toggles ascending/descending (↑/↓ indicator)
  - [ ] Click "Pickup" header → verify sorts by pickup date
  - [ ] Click "Trip" header → verify sorts by distance
  - [ ] Click "Rate" header → verify sorts by rate
  - [ ] Click "RPM" header → verify sorts by rate per km
  - [ ] Click "tRPM" header → verify sorts by total rate per km

#### Filtering Tests
- [ ] Open filter panel
- [ ] Filter by Origin City: "Addis Ababa"
  - [ ] Verify only matching loads shown
- [ ] Clear filters
- [ ] Filter by Truck Type: "Flatbed"
  - [ ] Verify only flatbed loads shown
- [ ] Clear filters
- [ ] Filter by Load Type: "Full"
  - [ ] Verify only full loads shown
- [ ] Clear filters
- [ ] Filter by Trip Distance: Min 200, Max 600
  - [ ] Verify only loads in range shown
- [ ] Clear filters
- [ ] Filter by Rate: Min 10000, Max 50000
  - [ ] Verify only loads in range shown
- [ ] Test multiple filters together:
  - [ ] Origin: "Addis Ababa" + Truck Type: "Flatbed"
  - [ ] Verify results match all criteria

#### Pagination Tests
- [ ] Verify "Showing X of Y loads" message displays correctly
- [ ] Click "Next" button
  - [ ] Verify shows next page
  - [ ] Verify page counter increments
- [ ] Click "Previous" button
  - [ ] Verify goes back
  - [ ] Verify page counter decrements
- [ ] Navigate to last page
  - [ ] Verify "Next" disabled when on last page
- [ ] Navigate to first page
  - [ ] Verify "Previous" disabled when on first page

**Expected Results:**
- ✅ All sortable columns sort correctly
- ✅ Sort direction indicator (↑/↓) shows correctly
- ✅ All filters work independently
- ✅ Multiple filters work together (AND logic)
- ✅ Clear filters resets to all loads
- ✅ Pagination shows correct page counts
- ✅ Navigation buttons work correctly
- ✅ Buttons disabled appropriately at boundaries

**Actual Results:**
```
Sorting:

Filtering:

Pagination:
```

**Status:** [ ] PASS / [ ] FAIL / [ ] BLOCKED

---

### Test 3: Contact Fields Visible After Assignment to Carrier

**Objective:** Verify contact information reveals after load assignment

**Prerequisites:**
- Have a posted load (Load 1)
- Have a truck registered for the carrier

**Steps:**

1. **Setup - Register a Truck (As Carrier):**
   - [ ] Login as carrier@test.com
   - [ ] Navigate to `/dashboard/trucks` (if exists) or use database:
     ```sql
     INSERT INTO "Truck" (
       "plateNumber", "truckType", "carrierId", "createdById"
     ) VALUES (
       'AA-12345', 'FLATBED',
       (SELECT id FROM "Organization" WHERE name = 'XYZ Transport'),
       (SELECT id FROM "User" WHERE email = 'carrier@test.com')
     );
     ```
   - [ ] Note the Truck ID: _______________

2. **Assign Load to Truck:**
   - [ ] Use database to assign load:
     ```sql
     UPDATE "Load"
     SET "assignedTruckId" = '[TRUCK_ID_FROM_ABOVE]',
         "status" = 'ASSIGNED'
     WHERE id = '[LOAD_1_ID]';
     ```
   - [ ] Or use UI if assignment feature exists

3. **Test Contact Visibility:**
   - [ ] **As Carrier (XYZ Transport):**
     - [ ] Navigate to load details (`/dashboard/loads/[LOAD_ID]`)
     - [ ] Verify contact information IS NOW VISIBLE:
       - [ ] Contact Name: "Ahmed Hassan"
       - [ ] Contact Phone: "+251911234567"

   - [ ] **As Different Carrier (create new account or use different org):**
     - [ ] Login as a different carrier organization
     - [ ] Navigate to same load details
     - [ ] Verify contact information is STILL HIDDEN
     - [ ] (Load assigned to different carrier)

**Expected Results:**
- ✅ Contact hidden before assignment
- ✅ Contact visible to assigned carrier organization
- ✅ Contact still hidden to other carriers
- ✅ Assignment status updates correctly

**Actual Results:**
```
[Document your findings here]
```

**Status:** [ ] PASS / [ ] FAIL / [ ] BLOCKED

---

### Test 4: Contact Fields Visible to Ops/Admin Users

**Objective:** Verify Ops and Admin roles can always see contact info

**Prerequisites:**
- Have a posted load with contact info
- Have an Ops or Admin user account

**Steps:**

1. **Setup - Create Ops User:**
   - [ ] Register new account: ops@test.com
   - [ ] Update role in database:
     ```sql
     UPDATE "User"
     SET role = 'PLATFORM_OPS'
     WHERE email = 'ops@test.com';
     ```

2. **Test Ops Access:**
   - [ ] Login as ops@test.com
   - [ ] Navigate to any load details page (posted, unassigned load)
   - [ ] Verify contact information IS VISIBLE:
     - [ ] Contact Name shown
     - [ ] Contact Phone shown
   - [ ] Test with multiple loads (assigned and unassigned)
   - [ ] Verify contact always visible regardless of assignment

3. **Test Admin Access (Optional):**
   - [ ] Create ADMIN role user
   - [ ] Repeat test above
   - [ ] Verify same behavior

4. **Verify in Load List API:**
   - [ ] Open browser DevTools → Network tab
   - [ ] Navigate to Find Loads page
   - [ ] Check GET /api/loads response
   - [ ] As regular carrier: Verify contact fields are NULL
   - [ ] As Ops user: Contact fields should still be NULL in list (privacy)
   - [ ] As Ops user: Contact visible only on individual load details

**Expected Results:**
- ✅ PLATFORM_OPS can see contact on load details page
- ✅ ADMIN can see contact on load details page
- ✅ Contact visible regardless of assignment status
- ✅ Regular carriers cannot see contact on unassigned loads
- ✅ List API still masks contact (only visible in details endpoint)

**Actual Results:**
```
[Document your findings here]
```

**Status:** [ ] PASS / [ ] FAIL / [ ] BLOCKED

---

## 📊 Additional Validation Checks

### Privacy & Masking
- [ ] Anonymous loads show "Anonymous Shipper" in company column
- [ ] Verified company badge (✓) displays for verified organizations
- [ ] Contact info never appears in load list (only in details when authorized)

### Computed Metrics
- [ ] Age displays correctly ("5m", "2h 30m", "3d" format)
- [ ] RPM calculation: Verify rate ÷ tripKm = displayed RPM
- [ ] tRPM calculation: Verify rate ÷ (trip + deadheads) = displayed tRPM
- [ ] Null values display as "—" in grid

### UI/UX
- [ ] Grid is responsive (test on different screen sizes)
- [ ] Hover effects work on table rows
- [ ] Loading states display during API calls
- [ ] Empty state shows when no loads found
- [ ] Error messages display for validation failures

### Data Validation
- [ ] Cannot post load without tripKm
- [ ] Cannot post load with rate ≤ 0
- [ ] Cannot post load with tripKm ≤ 0
- [ ] Draft loads save successfully without tripKm
- [ ] Form shows appropriate error messages

---

## ✅ Test Summary

### Results Overview
```
Test 1: Create → Post → Search → View     [ ] PASS  [ ] FAIL
Test 2: Grid Sorting/Filtering/Pagination [ ] PASS  [ ] FAIL
Test 3: Contact Visible After Assignment   [ ] PASS  [ ] FAIL
Test 4: Contact Visible to Ops/Admin       [ ] PASS  [ ] FAIL

Total Tests: 4
Passed: ___
Failed: ___
Blocked: ___

Overall Status: [ ] ALL PASS  [ ] ISSUES FOUND
```

### Issues Found
```
List any bugs, issues, or unexpected behavior here:

1.

2.

3.
```

### Recommendations
```
Based on testing, note any improvements or changes needed:

1.

2.

3.
```

---

## 🚀 After Testing Complete

- [ ] Update USER_STORIES_AND_TASKS.md to mark manual tests complete
- [ ] Update REMAINING_TASKS.md with final status
- [ ] Commit test results documentation
- [ ] Consider Sprint 7 complete (100%)
- [ ] Plan next sprint or deploy to production

---

**Testing Started:** ________________
**Testing Completed:** ________________
**Tester:** ________________
**Sprint 7 Final Status:** ___% Complete
