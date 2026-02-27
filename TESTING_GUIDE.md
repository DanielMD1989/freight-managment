# 🧪 DAT-Style Load Board Testing Guide

## ✅ What's Been Built

- **Complete DAT-style grid** with all 20 columns
- **Advanced filtering** (city, truck type, load type, distance, rate)
- **Column sorting** (age, pickup, trip, rate, RPM, tRPM)
- **Pagination** (20 loads per page)
- **Zero code duplication** (clean architecture)

## 📍 Where to Access

### Shipper View

- **My Loads**: `/dashboard/loads`
  - Shows YOUR loads with DAT grid
  - Actions: View, Edit, Delete
  - Status filters: All, DRAFT, POSTED, etc.

### Carrier View

- **Find Loads**: `/dashboard/loads/search`
  - Shows ALL posted loads (marketplace)
  - Full DAT-style grid with 20 columns
  - Advanced filters + sorting + pagination

## 🚀 Quick Start Testing

### Step 1: Register Users

1. **Register as Shipper:**

   ```
   Email: shipper@test.com
   Password: Test123!
   Organization Type: Shipper
   Company Name: ABC Logistics
   ```

2. **Register as Carrier:**
   ```
   Email: carrier@test.com
   Password: Test123!
   Organization Type: Carrier Company
   Company Name: XYZ Transport
   ```

### Step 2: Create Test Loads (as Shipper)

Login as `shipper@test.com` and create loads with these varied scenarios:

#### Load 1: Short Haul - Full Load

```
Pickup: Addis Ababa → Delivery: Dire Dawa
Pickup Date: 2 days from now
Truck Type: Flatbed
Trip Distance: 515 km
Deadhead to Origin: 25 km
Deadhead after Delivery: 30 km
Weight: 15,000 kg
Length: 12.5 m
Cases: 50
Load Type: Full Load
Book Mode: Request
Rate: 25,000 ETB
Pickup Dock Hours: 8:00 AM - 5:00 PM
Delivery Dock Hours: 9:00 AM - 6:00 PM
Appointment Required: Yes
Contact Name: Ahmed Hassan
Contact Phone: +251911234567
Safety Notes: "Heavy load - requires proper securing"
DTP Reference: DTP-2025-001
Factor Rating: A+
Status: POSTED (must post to appear in marketplace!)
```

#### Load 2: Long Haul - Refrigerated

```
Pickup: Hawassa → Delivery: Mekelle
Trip Distance: 780 km
Truck Type: Refrigerated
Weight: 12,000 kg
Load Type: Full Load
Book Mode: Instant Book
Rate: 45,000 ETB
Requires Refrigeration: Yes
Fragile: Yes
Safety Notes: "Maintain -18°C throughout journey"
Status: POSTED
```

#### Load 3: Partial Load

```
Pickup: Bahir Dar → Delivery: Gondar
Trip Distance: 180 km
Truck Type: Dry Van
Weight: 5,000 kg
Load Type: Partial Load
Book Mode: Request
Rate: 8,500 ETB
Anonymous: Yes (test anonymous shipper feature)
Status: POSTED
```

#### Load 4: Tanker - Hazmat

```
Pickup: Adama → Delivery: Jimma
Trip Distance: 335 km
Truck Type: Tanker
Weight: 25,000 kg
Book Mode: Instant Book
Rate: 35,000 ETB
Safety Notes: "HAZMAT: Diesel fuel. Certified drivers only"
Status: POSTED
```

#### Load 5: Container

```
Pickup: Modjo → Delivery: Addis Ababa
Trip Distance: 75 km
Truck Type: Container
Weight: 18,000 kg
Cases: 200
Rate: 12,000 ETB
Status: POSTED
```

### Step 3: Test the DAT-Style Grid (as Carrier)

1. **Login as** `carrier@test.com`
2. **Click** "Find Loads" in navigation
3. **See** the full DAT-style grid with all 20 columns

## 🧪 Features to Test

### ✅ All 20 DAT Columns Visible

- [ ] Age (formatted: 5m, 2h 30m, 3d)
- [ ] Pickup (short date)
- [ ] Truck (type)
- [ ] F/P (Full/Partial)
- [ ] DH-O (deadhead to origin)
- [ ] Origin (city)
- [ ] Trip (distance in km)
- [ ] Destination (city)
- [ ] DH-D (deadhead after delivery)
- [ ] Company (with ✓ for verified)
- [ ] Length (cargo length)
- [ ] Weight (in kg)
- [ ] Cs (cases count)
- [ ] DTP (reference)
- [ ] Factor (rating)
- [ ] Rate (in ETB)
- [ ] Book (REQUEST/INSTANT badge)
- [ ] RPM (computed: rate ÷ trip)
- [ ] tRPM (computed: rate ÷ total km)
- [ ] Actions (View link)

### ✅ Sorting (Click Headers)

- [ ] Click "Age" → sorts by posted time
- [ ] Click "Pickup" → sorts by pickup date
- [ ] Click "Trip" → sorts by distance
- [ ] Click "Rate" → sorts by rate
- [ ] Click "RPM" → sorts by rate per km
- [ ] Click "tRPM" → sorts by total rate per km
- [ ] Click again → toggles asc/desc (↑/↓)

### ✅ Filtering

- [ ] Filter by Origin City (e.g., "Addis Ababa")
- [ ] Filter by Destination City (e.g., "Dire Dawa")
- [ ] Filter by Truck Type (e.g., "Flatbed")
- [ ] Filter by Load Type (Full/Partial)
- [ ] Filter by Book Mode (Request/Instant)
- [ ] Filter by Trip Distance (Min: 100, Max: 500)
- [ ] Filter by Rate (Min: 10000, Max: 50000)
- [ ] Click "Apply Filters"
- [ ] Click "Clear" to reset

### ✅ Pagination

- [ ] Shows "Showing X of Y loads"
- [ ] Next/Previous buttons work
- [ ] Page counter displays correctly

### ✅ Privacy Features

- [ ] Anonymous loads show "Anonymous Shipper" (not company name)
- [ ] Contact info hidden in grid (only visible after assignment)
- [ ] Verification badges (✓) show for verified companies

### ✅ Visual Features

- [ ] Hover over rows → gray background
- [ ] Book Mode badges → Green for INSTANT, Gray for REQUEST
- [ ] Sortable headers → Show ↑/↓ indicators
- [ ] Responsive → Horizontal scroll on narrow screens
- [ ] Loading state → Shows "Loading loads..."
- [ ] Empty state → Shows "No loads found"

### ✅ Data Accuracy

- [ ] RPM calculated correctly (Rate ÷ Trip Distance)
- [ ] tRPM calculated correctly (Rate ÷ Total Distance including deadhead)
- [ ] Age updates in real-time (minutes → hours → days)
- [ ] Null values show "—" instead of blank

## 🔧 Advanced Testing

### Test Sorting Combinations

```
1. Sort by Rate (desc) → highest paying loads first
2. Sort by Trip (asc) → shortest trips first
3. Sort by RPM (desc) → best rate per km first
4. Sort by Age (asc) → newest loads first
```

### Test Filter Combinations

```
1. Origin: "Addis Ababa" + Truck Type: "Flatbed"
2. Trip Distance: 200-600 km + Book Mode: "Instant"
3. Rate: 20000-50000 + Load Type: "Full"
```

### Test Edge Cases

- [ ] Create load without trip distance → should fail to post
- [ ] Create load with 0 trip distance → should fail
- [ ] Post then unpost → should disappear from marketplace
- [ ] Edit posted load → verify changes reflect
- [ ] Delete draft load → should be removed

## 📊 Performance Testing

- [ ] Load board with 20+ loads → should load in < 2 seconds
- [ ] Filtering with multiple criteria → instant results
- [ ] Sorting large datasets → smooth transitions
- [ ] Pagination between pages → no lag

## 🎯 User Flows to Test

### Flow 1: Shipper Posts Load

1. Login as shipper
2. Click "My Loads" → "+ Create New Load"
3. Fill all fields (use template above)
4. Save as DRAFT first
5. Edit the draft
6. Change status to POSTED
7. Verify appears in carrier's "Find Loads"

### Flow 2: Carrier Browses & Accepts

1. Login as carrier
2. Click "Find Loads"
3. Use filters to find suitable load
4. Sort by RPM to find best rates
5. Click "View" on a load
6. Review full details
7. (Future: Accept the load)

### Flow 3: Anonymous Posting

1. Login as shipper
2. Create load with "Anonymous" checked
3. Post the load
4. Login as carrier
5. Verify company shows as "Anonymous Shipper"
6. Contact info is hidden

## 🐛 Known Limitations (MVP)

- ✗ No inline editing in grid
- ✗ No bulk actions
- ✗ No export to CSV
- ✗ No saved filters/views
- ✗ Contact info API masking needs testing after assignment

## ✅ Success Criteria

You should be able to:

1. ✓ See all 20 DAT-style columns
2. ✓ Sort by any sortable column
3. ✓ Filter by multiple criteria
4. ✓ Navigate pages smoothly
5. ✓ View accurate computed metrics (RPM, tRPM)
6. ✓ See anonymous shippers masked
7. ✓ No duplicate pages or navigation links
8. ✓ Clean, professional Excel-like interface

## 🚀 Next Steps After Testing

1. Test load creation form enhancements (add all new fields to UI)
2. Test load details page enhancements
3. Integration testing with carrier acceptance
4. GPS tracking integration
5. Financial escrow flow

---

**Happy Testing! 🎉**

If you find any bugs or have feedback, note them down for the next iteration.
