# 🚛 Sprint 8: TRD Amendments - Truck Posting + Matching System

**Date:** 2025-12-24
**Status:** Planning Phase
**Priority:** P0 (Critical - Major Feature Addition)

---

## 📋 Executive Summary

### New Capabilities Being Added
1. **Truck Posting** - Carriers can post available trucks
2. **Matching Engine** - Auto-match trucks ↔ loads bidirectionally
3. **Ethiopian Locations** - Dropdown-based location selection
4. **Map Integration** - Auto-calculate trip distance from map
5. **Single-Page Experience** - Post + Find on same page
6. **Document Verification** - Upload docs for company/truck verification
7. **Simplified Pricing** - Remove market pricing, use per-km pricing
8. **UI Improvements** - Readability fixes, Excel-like grids

### System Changes Required
- **Database:** 5 new tables, 3 models enhanced, 2 enums added
- **API:** 12 new endpoints, 4 enhanced endpoints
- **UI:** 8 new pages/components, 5 enhanced pages
- **Testing:** ~60 new tasks

### Estimated Effort
- **Database & Backend:** 3-4 days
- **UI Components:** 4-5 days
- **Matching Algorithm:** 2-3 days
- **Testing & Integration:** 2-3 days
- **Total:** 11-15 days (2-3 weeks)

---

## 🔍 Current System Verification

### ✅ What Already Exists

**Database Models:**
- ✅ `Truck` model (basic structure)
- ✅ `Load` model (comprehensive with Sprint 7 fields)
- ✅ `Organization` model (with verification fields)
- ✅ `Document` model (for load documents)
- ✅ `TruckType` enum
- ✅ `LoadType` enum (FULL/PARTIAL)

**Features:**
- ✅ Load posting with all DAT-style fields
- ✅ Load marketplace with filtering/sorting
- ✅ Privacy masking and role-based access
- ✅ Company registration and basic verification

### ❌ What Needs to Be Built

**Database:**
- ❌ `TruckPosting` model (availability, preferences, contact)
- ❌ `EthiopianLocation` model (cities/towns with lat/lon)
- ❌ `CompanyDocument` model (verification documents)
- ❌ `TruckDocument` model (truck-specific documents)
- ❌ `VerificationStatus` enum
- ❌ Truck posting fields (DH preferences, availability window)
- ❌ Enhanced Truck model (owner, length, weight capacity details)

**API:**
- ❌ POST /api/truck-postings (create truck posting)
- ❌ GET /api/truck-postings (list with filtering)
- ❌ GET /api/truck-postings/[id]/matching-loads (matching algorithm)
- ❌ POST /api/loads with auto-match trucks
- ❌ GET /api/locations (Ethiopian cities)
- ❌ POST /api/locations/distance (map-based distance calc)
- ❌ POST /api/documents/upload (company/truck docs)
- ❌ GET /api/documents/verify (back office verification)

**UI:**
- ❌ Truck posting form
- ❌ Matching loads grid (after truck post)
- ❌ Matching trucks grid (after load post)
- ❌ Single-page post + find layout
- ❌ Location dropdowns (searchable)
- ❌ Date/time dropdowns (Ethiopian timezone)
- ❌ Document upload UI
- ❌ Back office verification dashboard

**Business Logic:**
- ❌ Matching algorithm (trucks ↔ loads)
- ❌ DH preference filtering
- ❌ Time window matching
- ❌ Map routing integration
- ❌ Per-km pricing calculator

---

## 📊 Gap Analysis: Requirements vs Current System

### EPIC A: Truck Posting

| Requirement | Exists? | Gap | Priority |
|------------|---------|-----|----------|
| Truck posting form UI | ❌ No | Build entire form | P0 |
| Contact field | ⚠️ Partial | Truck model has no contact | P0 |
| Availability (Avail) field | ❌ No | Add availability window | P0 |
| Owner field | ⚠️ Partial | carrierId exists, need explicit owner | P1 |
| Origin/Destination | ❌ No | Add to TruckPosting model | P0 |
| F/P (Full/Partial) | ❌ No | Add to TruckPosting | P0 |
| Length/Weight | ⚠️ Partial | Truck has capacity/volume, need length | P0 |
| Multiple truck postings | ❌ No | Need TruckPosting table | P0 |
| DH-O / DH-D preferences | ❌ No | Add optional filter fields | P1 |

### EPIC B: Matching Loads After Posting Truck

| Requirement | Exists? | Gap | Priority |
|------------|---------|-----|----------|
| Auto-filter matching loads | ❌ No | Build matching algorithm | P0 |
| Matching loads grid | ⚠️ Partial | Reuse DAT grid, new endpoint | P0 |
| Excel-like UI | ✅ Yes | Sprint 7 built this | ✅ Done |
| DH-O/DH-D in results only | ⚠️ Partial | Need to hide from load posting | P0 |
| All 20 columns display | ✅ Yes | Sprint 7 built this | ✅ Done |

### EPIC C: Posting Loads

| Requirement | Exists? | Gap | Priority |
|------------|---------|-----|----------|
| Load posting form | ✅ Yes | Sprint 7 built this | ✅ Done |
| Map-based trip distance | ❌ No | Integrate map API | P0 |
| Auto-calculate from map | ❌ No | Build calculation logic | P0 |
| Show matching trucks nearby | ❌ No | Build reverse matching | P0 |

### EPIC D: Ethiopian Locations + Date/Time

| Requirement | Exists? | Gap | Priority |
|------------|---------|-----|----------|
| Locations dropdown | ❌ No | Build EthiopianLocation table | P0 |
| Major cities & towns data | ❌ No | Seed location data | P0 |
| Search-as-you-type | ❌ No | Build autocomplete UI | P1 |
| Store lat/lon | ❌ No | Add to location model | P0 |
| Date/time dropdown | ❌ No | Build time picker | P0 |
| Ethiopian timezone (EAT) | ❌ No | Configure timezone | P0 |
| Time window support | ❌ No | Add from/to fields | P1 |

### EPIC E: DH-O / DH-D Rules

| Requirement | Exists? | Gap | Priority |
|------------|---------|-----|----------|
| Remove DH from load posting | ⚠️ Partial | Fields exist, need to hide | P0 |
| DH visible in search only | ⚠️ Partial | Update UI conditionally | P0 |

### EPIC F: Pricing Simplification

| Requirement | Exists? | Gap | Priority |
|------------|---------|-----|----------|
| Remove lane makers | ✅ N/A | Never implemented | ✅ Done |
| Remove DTP reference | ⚠️ Partial | Field exists, need to remove | P0 |
| Remove factor rating | ⚠️ Partial | Field exists, need to remove | P0 |
| Per-km pricing | ⚠️ Partial | rate exists, enhance logic | P1 |

### EPIC G: One-Page Experience

| Requirement | Exists? | Gap | Priority |
|------------|---------|-----|----------|
| Single page layout | ❌ No | Build split/tabbed layout | P0 |
| Post + Find same screen | ❌ No | Redesign page structure | P0 |
| Live filter updates | ⚠️ Partial | Enhance existing filters | P1 |

### EPIC H: UI Readability

| Requirement | Exists? | Gap | Priority |
|------------|---------|-----|----------|
| Fix text color/contrast | ⚠️ Unknown | Audit current UI | P1 |
| Bold/readable inputs | ⚠️ Unknown | Update CSS | P1 |
| Accessibility compliance | ❌ No | Add WCAG compliance | P2 |

### EPIC I: Document Verification

| Requirement | Exists? | Gap | Priority |
|------------|---------|-----|----------|
| Document upload UI | ❌ No | Build upload component | P0 |
| Company License upload | ❌ No | Add to registration | P0 |
| TIN upload | ⚠️ Partial | taxId field exists | P0 |
| Business Registration | ⚠️ Partial | Field exists, need upload | P0 |
| Truck title deeds | ❌ No | New document type | P0 |
| Driver license (optional) | ❌ No | New document type | P1 |
| Back office verification | ❌ No | Build admin dashboard | P0 |
| Verification status | ❌ No | Add status enum + workflow | P0 |

---

## 🗄️ Database Changes Required

### New Models to Create

#### 1. TruckPosting
```prisma
model TruckPosting {
  id                    String      @id @default(cuid())
  status                PostingStatus @default(ACTIVE)

  // Availability
  availableFrom         DateTime    // Start of availability window
  availableTo           DateTime?   // End of availability window (optional)

  // Location
  originCityId          String
  originCity            EthiopianLocation @relation("OriginCity", fields: [originCityId], references: [id])
  destinationCityId     String?     // Optional - flexible routing
  destinationCity       EthiopianLocation? @relation("DestinationCity", fields: [destinationCityId], references: [id])

  // Truck Details
  truckId               String
  truck                 Truck       @relation(fields: [truckId], references: [id])
  fullPartial           LoadType    // FULL or PARTIAL

  // Capacity
  availableLength       Decimal?    // Available length in meters
  availableWeight       Decimal?    // Available weight capacity in kg

  // Deadhead Preferences (OPTIONAL - for filtering only)
  preferredDhToOriginKm     Decimal?    // Max acceptable DH-O
  preferredDhAfterDeliveryKm Decimal?   // Max acceptable DH-D

  // Contact
  contactName           String
  contactPhone          String

  // Owner
  ownerName             String?     // Explicit owner if different from carrier

  // Metadata
  notes                 String?
  postedAt              DateTime    @default(now())
  expiresAt             DateTime?
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt

  // Relations
  carrierId             String
  carrier               Organization @relation(fields: [carrierId], references: [id])
  createdById           String

  @@index([status])
  @@index([originCityId])
  @@index([destinationCityId])
  @@index([availableFrom])
  @@index([carrierId])
  @@map("truck_postings")
}
```

#### 2. EthiopianLocation
```prisma
model EthiopianLocation {
  id          String   @id @default(cuid())
  name        String   // "Addis Ababa"
  nameEthiopic String? // Amharic name
  region      String   // "Addis Ababa" (admin region)
  zone        String?  // Sub-region
  latitude    Decimal  @db.Decimal(10, 7)
  longitude   Decimal  @db.Decimal(10, 7)
  type        LocationType @default(CITY) // CITY, TOWN, VILLAGE
  population  Int?
  aliases     String[] // Alternative spellings for search
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  loadsPickup         Load[] @relation("PickupLocation")
  loadsDelivery       Load[] @relation("DeliveryLocation")
  truckPostingsOrigin TruckPosting[] @relation("OriginCity")
  truckPostingsDest   TruckPosting[] @relation("DestinationCity")

  @@unique([name, region])
  @@index([name])
  @@index([region])
  @@map("ethiopian_locations")
}
```

#### 3. CompanyDocument
```prisma
model CompanyDocument {
  id                String              @id @default(cuid())
  type              CompanyDocumentType
  fileName          String
  fileUrl           String
  fileSize          Int                 // bytes
  mimeType          String

  // Verification
  verificationStatus VerificationStatus @default(PENDING)
  verifiedById      String?
  verifiedAt        DateTime?
  rejectionReason   String?

  // Metadata
  uploadedAt        DateTime            @default(now())
  expiresAt         DateTime?           // License expiration

  // Relations
  organizationId    String
  organization      Organization        @relation(fields: [organizationId], references: [id])
  uploadedById      String

  @@index([organizationId])
  @@index([verificationStatus])
  @@map("company_documents")
}
```

#### 4. TruckDocument
```prisma
model TruckDocument {
  id                String              @id @default(cuid())
  type              TruckDocumentType
  fileName          String
  fileUrl           String
  fileSize          Int
  mimeType          String

  // Verification
  verificationStatus VerificationStatus @default(PENDING)
  verifiedById      String?
  verifiedAt        DateTime?
  rejectionReason   String?

  // Metadata
  uploadedAt        DateTime            @default(now())
  expiresAt         DateTime?

  // Relations
  truckId           String
  truck             Truck               @relation(fields: [truckId], references: [id])
  uploadedById      String

  @@index([truckId])
  @@index([verificationStatus])
  @@map("truck_documents")
}
```

### Enums to Add

```prisma
enum PostingStatus {
  ACTIVE
  EXPIRED
  CANCELLED
  MATCHED
}

enum LocationType {
  CITY
  TOWN
  VILLAGE
  LANDMARK
}

enum VerificationStatus {
  PENDING
  APPROVED
  REJECTED
  EXPIRED
}

enum CompanyDocumentType {
  COMPANY_LICENSE
  TIN_CERTIFICATE
  BUSINESS_REGISTRATION
  TRADE_LICENSE
  VAT_CERTIFICATE
  OTHER
}

enum TruckDocumentType {
  TITLE_DEED
  REGISTRATION
  INSURANCE
  ROAD_WORTHINESS
  DRIVER_LICENSE
  OTHER
}
```

### Models to Enhance

#### Truck Model Enhancements
```prisma
model Truck {
  // ... existing fields ...

  // ADD THESE FIELDS:
  lengthM              Decimal?    // Truck bed length in meters
  ownerName            String?     // Explicit owner name
  contactName          String?     // Primary contact
  contactPhone         String?     // Primary contact phone

  // Relations - ADD:
  postings             TruckPosting[]
  documents            TruckDocument[]
}
```

#### Load Model Changes
```prisma
model Load {
  // ... existing fields ...

  // MODIFY THESE FIELDS:
  pickupCity           String?     // Make nullable, add relation
  pickupCityId         String?     // ADD - FK to EthiopianLocation
  pickupCityLocation   EthiopianLocation? @relation("PickupLocation", fields: [pickupCityId], references: [id])

  deliveryCity         String?     // Make nullable, add relation
  deliveryCityId       String?     // ADD - FK to EthiopianLocation
  deliveryCityLocation EthiopianLocation? @relation("DeliveryLocation", fields: [deliveryCityId], references: [id])

  // REMOVE THESE FIELDS (per EPIC F):
  // dtpReference       String?     // ❌ REMOVE
  // factorRating       String?     // ❌ REMOVE

  // HIDE THESE IN UI (per EPIC E) - Keep in DB, hide in load posting form:
  dhToOriginKm         Decimal?    // Keep for search results only
  dhAfterDeliveryKm    Decimal?    // Keep for search results only
}
```

#### Organization Model Enhancements
```prisma
model Organization {
  // ... existing fields ...

  // ADD:
  documents            CompanyDocument[]
  truckPostings        TruckPosting[]
}
```

---

## 🔧 API Endpoints Required

### New Endpoints

#### Truck Posting APIs
```
POST   /api/truck-postings              Create truck posting
GET    /api/truck-postings              List truck postings (with filters)
GET    /api/truck-postings/[id]         Get single truck posting
PATCH  /api/truck-postings/[id]         Update truck posting
DELETE /api/truck-postings/[id]         Cancel truck posting
GET    /api/truck-postings/[id]/matching-loads  Get matching loads for this truck
```

#### Location APIs
```
GET    /api/locations                   List Ethiopian locations (with search)
GET    /api/locations/[id]              Get location details
POST   /api/locations/distance          Calculate distance between two locations (map API)
GET    /api/locations/route             Get routing info between two points
```

#### Document APIs
```
POST   /api/documents/upload            Upload company/truck documents
GET    /api/documents                   List documents (filtered)
PATCH  /api/documents/[id]/verify       Verify/reject document (admin only)
DELETE /api/documents/[id]              Delete document
```

#### Enhanced Load APIs
```
POST   /api/loads                       ENHANCE: Auto-calculate trip distance from map
                                        ENHANCE: Remove DH fields from request body
                                        ENHANCE: Use location IDs instead of strings
GET    /api/loads/[id]/matching-trucks  NEW: Get matching trucks for this load
```

### Backend Services/Utils

```typescript
// lib/matchingEngine.ts
- findMatchingLoadsForTruck(truckPosting)
- findMatchingTrucksForLoad(load)
- calculateMatchScore(truck, load)
- filterByDeadheadPreference(loads, dhPref)

// lib/mapService.ts
- calculateTripDistance(originId, destinationId)
- getRoute(originId, destinationId)
- getDeadheadDistance(truckLocation, loadOrigin)

// lib/locationService.ts
- searchLocations(query)
- getNearbyLocations(locationId, radiusKm)
- validateLocation(locationId)

// lib/documentService.ts
- uploadDocument(file, type, entityId)
- verifyDocument(documentId, status, reason)
- getDocumentsByEntity(entityId, entityType)
```

---

## 🎨 UI Components & Pages

### New Pages

#### 1. Post Truck Page
```
/dashboard/trucks/post
- Truck posting form (split view)
- Left: Post form
- Right: Matching loads grid (live updates)
```

#### 2. Post & Find Combined Page (EPIC G)
```
/dashboard/marketplace
- Unified page with tabs/sections:
  - Tab 1: Post Truck → See Matching Loads
  - Tab 2: Post Load → See Matching Trucks
  - Tab 3: Find Loads (carrier view)
  - Tab 4: Find Trucks (shipper view)
```

#### 3. Document Upload Pages
```
/dashboard/settings/documents
- Upload company documents
- View verification status
```

```
/dashboard/trucks/[id]/documents
- Upload truck-specific documents
- View verification status per truck
```

#### 4. Back Office Verification Dashboard
```
/admin/verification
- Queue of pending document verifications
- Review documents
- Approve/reject with notes
```

### Enhanced Pages

#### 1. Load Posting Form (`/dashboard/loads/new`)
**Changes:**
- ❌ Remove DH-O / DH-D fields from form
- ✅ Add Ethiopian location dropdowns (origin/destination)
- ✅ Add date/time dropdowns
- ✅ Auto-calculate trip distance from map when locations selected
- ✅ Show matching trucks grid below form after posting
- ❌ Remove DTP reference field
- ❌ Remove factor rating field

#### 2. Load Search/Marketplace (`/dashboard/loads/search`)
**Changes:**
- ✅ Keep all 20 DAT columns
- ✅ DH-O / DH-D visible in results (unchanged)
- ✅ Add location-based filtering
- ✅ Add time window filtering

#### 3. Registration Page (`/register`)
**Changes:**
- ✅ Add document upload section
- ✅ Upload company license, TIN, business registration
- ✅ Show verification pending status after registration

### New UI Components

```typescript
// components/LocationDropdown.tsx
- Searchable dropdown for Ethiopian locations
- Autocomplete with debounce
- Display: "City Name, Region"

// components/TimeWindowPicker.tsx
- Date/time range picker
- Ethiopian timezone aware
- "Available from / to" or "Pickup earliest / latest"

// components/TruckPostingForm.tsx
- All truck posting fields
- Validation
- Submit handler

// components/MatchingResultsGrid.tsx
- Reusable grid for showing matching loads OR trucks
- Excel-like layout (reuse Sprint 7 grid)
- Sort/filter capability

// components/DocumentUploadWidget.tsx
- Multi-file upload
- File type validation
- Progress indicator
- Preview uploaded docs

// components/VerificationBadge.tsx
- Shows verification status (Pending/Approved/Rejected)
- Color-coded
- Tooltip with details

// components/SplitViewLayout.tsx
- Side-by-side or top/bottom split
- Left: Form, Right: Results
- Responsive (stacks on mobile)
```

---

## 🧪 Testing Tasks Breakdown

### Database Tests (15 tasks)
- [ ] TruckPosting model CRUD operations
- [ ] EthiopianLocation model + search
- [ ] CompanyDocument upload + storage
- [ ] TruckDocument upload + storage
- [ ] Verification status workflow
- [ ] Location relations (loads, trucks)
- [ ] Truck enhancements (length, owner, contact)
- [ ] Load location FK constraints
- [ ] Document expiration handling
- [ ] Posting status transitions
- [ ] Multiple truck postings per carrier
- [ ] Location uniqueness constraints
- [ ] Document file size limits
- [ ] Cascade deletes
- [ ] Indexes performance

### API Tests (20 tasks)
- [ ] POST /api/truck-postings validation
- [ ] GET /api/truck-postings filtering
- [ ] GET /api/truck-postings/[id]/matching-loads algorithm
- [ ] POST /api/loads with location IDs
- [ ] POST /api/loads auto-calculates trip distance
- [ ] GET /api/loads/[id]/matching-trucks algorithm
- [ ] GET /api/locations search
- [ ] POST /api/locations/distance calculation
- [ ] POST /api/documents/upload
- [ ] PATCH /api/documents/[id]/verify authorization
- [ ] Matching algorithm: route match
- [ ] Matching algorithm: time window overlap
- [ ] Matching algorithm: capacity constraints
- [ ] Matching algorithm: DH preference filtering
- [ ] Matching algorithm: truck type match
- [ ] Matching algorithm: F/P match
- [ ] DH fields removed from load POST body
- [ ] Market pricing fields removed from responses
- [ ] Location validation
- [ ] Ethiopian timezone handling

### UI Tests (25 tasks)
- [ ] Truck posting form validation
- [ ] Truck posting form submission
- [ ] Matching loads grid displays correctly
- [ ] Matching trucks grid displays correctly
- [ ] Location dropdown search works
- [ ] Location dropdown selection updates map
- [ ] Time window picker validation
- [ ] Date/time dropdown Ethiopian timezone
- [ ] Trip distance auto-calculated on location select
- [ ] DH fields hidden in load posting form
- [ ] DH fields visible in search results
- [ ] Market pricing fields removed from UI
- [ ] Document upload widget file validation
- [ ] Document upload progress indicator
- [ ] Document verification badge colors
- [ ] Split view layout responsive
- [ ] Single-page experience tab switching
- [ ] Matching results live update
- [ ] Multiple truck postings displayed
- [ ] Back office verification queue
- [ ] Back office approve/reject workflow
- [ ] Registration with document uploads
- [ ] Text readability / contrast
- [ ] Accessibility (keyboard navigation)
- [ ] Mobile responsiveness

---

## 📅 Implementation Plan (Recommended Order)

### Phase 1: Foundation (Days 1-3)
**Goal:** Database, locations, basic APIs

**Tasks:**
1. Create database migrations
   - Add new enums
   - Create TruckPosting model
   - Create EthiopianLocation model
   - Create CompanyDocument model
   - Create TruckDocument model
   - Enhance Truck model
   - Modify Load model (add location FKs)
   - Enhance Organization model

2. Seed Ethiopian locations data
   - Compile list of major Ethiopian cities/towns
   - Add lat/lon coordinates
   - Create seed script
   - Run seed

3. Build location APIs
   - GET /api/locations (with search)
   - GET /api/locations/[id]
   - Location service utility

**Deliverables:**
- ✅ Database schema updated
- ✅ Migrations applied
- ✅ ~50 Ethiopian locations seeded
- ✅ Location API working

---

### Phase 2: Map Integration (Days 3-4)
**Goal:** Trip distance calculation

**Tasks:**
1. Choose map provider (Google Maps, Mapbox, OpenStreetMap)
2. Implement map service
   - POST /api/locations/distance
   - GET /api/locations/route
   - Distance calculation logic
   - Route fetching
   - Fallback to straight-line if routing fails

3. Integrate into load posting
   - Modify POST /api/loads
   - Auto-calculate tripKm from location IDs
   - Store calculated distance

**Deliverables:**
- ✅ Map API integrated
- ✅ Distance calculation working
- ✅ Load posting uses map for trip distance

---

### Phase 3: Truck Posting (Days 4-6)
**Goal:** Complete truck posting feature

**Tasks:**
1. Build truck posting APIs
   - POST /api/truck-postings
   - GET /api/truck-postings
   - GET /api/truck-postings/[id]
   - PATCH /api/truck-postings/[id]
   - DELETE /api/truck-postings/[id]

2. Build truck posting form UI
   - TruckPostingForm component
   - Location dropdowns
   - Time window picker
   - Validation
   - Submit handler

3. Create truck posting page
   - /dashboard/trucks/post
   - Form + results split view
   - Submit and display posting

**Deliverables:**
- ✅ Truck posting API complete
- ✅ Truck posting UI complete
- ✅ Can create and view truck postings

---

### Phase 4: Matching Engine (Days 6-8)
**Goal:** Auto-match trucks ↔ loads

**Tasks:**
1. Build matching algorithm
   - lib/matchingEngine.ts
   - findMatchingLoadsForTruck()
   - findMatchingTrucksForLoad()
   - Scoring logic (route, time, capacity, F/P)
   - DH preference filtering

2. Create matching endpoints
   - GET /api/truck-postings/[id]/matching-loads
   - GET /api/loads/[id]/matching-trucks

3. Build matching results UI
   - MatchingResultsGrid component
   - Display below posting form
   - Real-time updates
   - Sort/filter capability

**Deliverables:**
- ✅ Matching algorithm working
- ✅ Matching APIs returning results
- ✅ Matching grids displaying correctly

---

### Phase 5: Document Verification (Days 8-10)
**Goal:** Upload and verify company/truck documents

**Tasks:**
1. Build document APIs
   - POST /api/documents/upload
   - GET /api/documents
   - PATCH /api/documents/[id]/verify
   - DELETE /api/documents/[id]

2. File upload infrastructure
   - File storage (local/S3)
   - File validation
   - Size limits
   - Allowed MIME types

3. Document upload UI
   - DocumentUploadWidget component
   - Multi-file upload
   - Progress indicators
   - Preview uploaded files

4. Registration enhancement
   - Add document upload to registration
   - Company license, TIN, business reg

5. Back office verification
   - /admin/verification dashboard
   - Queue of pending documents
   - Approve/reject workflow
   - Add notes/reasons

**Deliverables:**
- ✅ Document upload working
- ✅ Registration includes documents
- ✅ Back office can verify documents
- ✅ Verification status displayed

---

### Phase 6: UI Refinements (Days 10-12)
**Goal:** Single-page experience, remove market pricing, improve readability

**Tasks:**
1. Remove market pricing
   - Remove dtpReference from schema (migration)
   - Remove factorRating from schema (migration)
   - Remove from all UI forms
   - Remove from API responses
   - Update tests

2. Hide DH fields in load posting
   - Update load posting form
   - Hide dhToOriginKm input
   - Hide dhAfterDeliveryKm input
   - Keep fields visible in search results

3. Create single-page marketplace
   - /dashboard/marketplace
   - Tabbed interface
   - Post Truck tab
   - Post Load tab
   - Find Loads tab
   - Find Trucks tab

4. UI readability improvements
   - Audit text colors/contrast
   - Bold input text
   - Improve label readability
   - WCAG compliance (optional)

5. Location dropdown enhancements
   - Search-as-you-type
   - Autocomplete
   - Display format: "City, Region"
   - Loading states

6. Time window UI
   - Ethiopian timezone (EAT)
   - From/to pickers
   - Validation (from < to)

**Deliverables:**
- ✅ Market pricing removed
- ✅ DH hidden in load posting
- ✅ Single-page experience built
- ✅ UI readability improved
- ✅ Location dropdowns polished
- ✅ Time pickers working

---

### Phase 7: Testing & Integration (Days 12-15)
**Goal:** Full testing, bug fixes, documentation

**Tasks:**
1. Unit tests
   - Matching algorithm
   - Distance calculation
   - Validation logic
   - Document upload

2. API integration tests
   - All new endpoints
   - Matching endpoints
   - Document verification workflow

3. UI/E2E tests
   - Truck posting flow
   - Load posting with map
   - Matching results display
   - Document upload flow
   - Back office verification

4. Manual testing
   - Create truck postings
   - Verify matching works correctly
   - Test with real Ethiopian locations
   - Test document verification workflow

5. Bug fixes and polish
   - Address test failures
   - Fix edge cases
   - Performance optimization

6. Documentation
   - Update user guides
   - API documentation
   - Admin documentation

**Deliverables:**
- ✅ All automated tests passing
- ✅ Manual testing complete
- ✅ Bugs fixed
- ✅ Documentation updated

---

## 🎯 Sprint 8 Task Checklist

### Database Tasks (27 tasks)

#### Schema Design & Migration
- [ ] Create VerificationStatus enum
- [ ] Create PostingStatus enum
- [ ] Create LocationType enum
- [ ] Create CompanyDocumentType enum
- [ ] Create TruckDocumentType enum
- [ ] Create TruckPosting model
- [ ] Create EthiopianLocation model
- [ ] Create CompanyDocument model
- [ ] Create TruckDocument model
- [ ] Enhance Truck model (lengthM, ownerName, contactName, contactPhone)
- [ ] Modify Load model (add pickupCityId FK, deliveryCityId FK)
- [ ] Remove dtpReference from Load model
- [ ] Remove factorRating from Load model
- [ ] Enhance Organization model (add relations)
- [ ] Generate Prisma migration
- [ ] Run migration on database
- [ ] Generate Prisma client

#### Data Seeding
- [ ] Compile Ethiopian cities/towns data (50-100 locations)
- [ ] Add lat/lon coordinates for each location
- [ ] Add region/zone data
- [ ] Add alternative spellings/aliases
- [ ] Create location seed script
- [ ] Run seed script
- [ ] Verify location data

#### Validation
- [ ] Test TruckPosting CRUD
- [ ] Test Location search and relations
- [ ] Test Document upload and verification workflow
- [ ] Test cascade deletes

---

### API Backend Tasks (35 tasks)

#### Location APIs
- [ ] GET /api/locations - List with search/filter
- [ ] GET /api/locations/[id] - Get single location
- [ ] POST /api/locations/distance - Calculate distance (map API)
- [ ] GET /api/locations/route - Get routing info
- [ ] lib/locationService.ts - Location utilities
- [ ] lib/mapService.ts - Map integration (Google/Mapbox)

#### Truck Posting APIs
- [ ] POST /api/truck-postings - Create posting
- [ ] GET /api/truck-postings - List postings (with filters)
- [ ] GET /api/truck-postings/[id] - Get single posting
- [ ] PATCH /api/truck-postings/[id] - Update posting
- [ ] DELETE /api/truck-postings/[id] - Cancel posting
- [ ] GET /api/truck-postings/[id]/matching-loads - Matching algorithm
- [ ] Validation schema for truck posting
- [ ] Authorization checks (carrier role)

#### Document APIs
- [ ] POST /api/documents/upload - Upload files
- [ ] GET /api/documents - List documents (filtered by entity)
- [ ] GET /api/documents/[id] - Get single document
- [ ] PATCH /api/documents/[id]/verify - Verify/reject (admin only)
- [ ] DELETE /api/documents/[id] - Delete document
- [ ] File storage setup (local/S3/cloud)
- [ ] File validation (type, size)
- [ ] Authorization checks (admin for verification)

#### Enhanced Load APIs
- [ ] POST /api/loads - Add auto trip distance calculation
- [ ] POST /api/loads - Use location IDs instead of strings
- [ ] POST /api/loads - Remove DH fields from request validation
- [ ] GET /api/loads/[id]/matching-trucks - Reverse matching
- [ ] Update validation schema

#### Matching Engine
- [ ] lib/matchingEngine.ts - Core matching logic
- [ ] findMatchingLoadsForTruck() - Algorithm
- [ ] findMatchingTrucksForLoad() - Reverse algorithm
- [ ] calculateMatchScore() - Scoring logic
- [ ] filterByDeadheadPreference() - DH filtering
- [ ] filterByTimeWindow() - Time overlap check
- [ ] filterByCapacity() - Weight/length constraints
- [ ] filterByRoute() - Origin/destination match
- [ ] filterByTruckType() - Truck type match
- [ ] filterByFullPartial() - F/P match

---

### UI Components & Pages (45 tasks)

#### New Components
- [ ] LocationDropdown.tsx - Searchable location picker
- [ ] TimeWindowPicker.tsx - Date/time range picker
- [ ] TruckPostingForm.tsx - Truck posting form
- [ ] MatchingResultsGrid.tsx - Reusable results grid
- [ ] DocumentUploadWidget.tsx - File upload component
- [ ] VerificationBadge.tsx - Status badge
- [ ] SplitViewLayout.tsx - Split layout wrapper

#### New Pages
- [ ] /dashboard/trucks/post - Truck posting page
- [ ] /dashboard/marketplace - Unified post + find page
- [ ] /dashboard/settings/documents - Company documents
- [ ] /dashboard/trucks/[id]/documents - Truck documents
- [ ] /admin/verification - Back office verification dashboard

#### Enhanced Pages
- [ ] /dashboard/loads/new - Add location dropdowns
- [ ] /dashboard/loads/new - Add time window picker
- [ ] /dashboard/loads/new - Auto-calculate trip distance
- [ ] /dashboard/loads/new - Hide DH-O / DH-D fields
- [ ] /dashboard/loads/new - Remove DTP reference field
- [ ] /dashboard/loads/new - Remove factor rating field
- [ ] /dashboard/loads/new - Show matching trucks after posting
- [ ] /register - Add document upload section
- [ ] /dashboard/loads/search - Keep DH visible in results
- [ ] /dashboard/loads - Update to use location dropdowns

#### Form Validation
- [ ] Truck posting form client-side validation
- [ ] Location selection required validation
- [ ] Time window validation (from < to)
- [ ] Document upload file type validation
- [ ] Document upload file size validation (max 10MB)

#### UI Polish
- [ ] Text color/contrast audit
- [ ] Bold input text styling
- [ ] Label readability improvements
- [ ] Accessibility compliance (WCAG 2.1 AA)
- [ ] Mobile responsiveness for new components
- [ ] Loading states for all forms
- [ ] Error states and messages
- [ ] Success feedback (toasts/notifications)

#### Truck Posting Flow
- [ ] Implement truck posting form submission
- [ ] Display matching loads grid after posting
- [ ] Live update matching results on filter change
- [ ] Handle multiple truck postings UI
- [ ] Implement DH preference optional fields

#### Document Upload Flow
- [ ] Implement file upload to server
- [ ] Display upload progress
- [ ] Show uploaded documents list
- [ ] Display verification status
- [ ] Allow document deletion (if pending)

#### Back Office Verification
- [ ] Display pending documents queue
- [ ] Document preview/view functionality
- [ ] Approve button with confirmation
- [ ] Reject button with reason textarea
- [ ] Update verification status UI
- [ ] Send notifications (optional)

---

### Testing Tasks (60 tasks)

#### Unit Tests (20 tasks)
- [ ] Matching algorithm: exact route match
- [ ] Matching algorithm: time window overlap
- [ ] Matching algorithm: capacity constraints (weight)
- [ ] Matching algorithm: capacity constraints (length)
- [ ] Matching algorithm: truck type match
- [ ] Matching algorithm: F/P match
- [ ] Matching algorithm: DH preference filtering
- [ ] Matching algorithm: scoring calculation
- [ ] Distance calculation: map API success
- [ ] Distance calculation: map API fallback
- [ ] Location search: by name
- [ ] Location search: by alias
- [ ] Location validation: valid ID
- [ ] Location validation: invalid ID
- [ ] Document upload: valid file types
- [ ] Document upload: file size limits
- [ ] Verification workflow: pending → approved
- [ ] Verification workflow: pending → rejected
- [ ] Time window: overlap detection
- [ ] Time window: Ethiopian timezone conversion

#### API Integration Tests (25 tasks)
- [ ] POST /api/truck-postings - Success
- [ ] POST /api/truck-postings - Validation errors
- [ ] GET /api/truck-postings - Filtering works
- [ ] GET /api/truck-postings - Pagination
- [ ] GET /api/truck-postings/[id]/matching-loads - Returns matches
- [ ] GET /api/truck-postings/[id]/matching-loads - No matches
- [ ] GET /api/truck-postings/[id]/matching-loads - DH filtering
- [ ] POST /api/loads - Auto-calculates tripKm
- [ ] POST /api/loads - Requires location IDs
- [ ] POST /api/loads - Rejects DH fields in body
- [ ] GET /api/loads/[id]/matching-trucks - Returns matches
- [ ] GET /api/locations - Search by name
- [ ] GET /api/locations - Returns lat/lon
- [ ] POST /api/locations/distance - Calculates correctly
- [ ] POST /api/documents/upload - Success
- [ ] POST /api/documents/upload - File validation
- [ ] POST /api/documents/upload - Authorization check
- [ ] PATCH /api/documents/[id]/verify - Approve works
- [ ] PATCH /api/documents/[id]/verify - Reject works
- [ ] PATCH /api/documents/[id]/verify - Admin only
- [ ] Market pricing fields absent in responses
- [ ] DH fields present in GET /api/loads responses
- [ ] DH fields absent in POST /api/loads requests
- [ ] Multiple truck postings per carrier
- [ ] Ethiopian timezone handled correctly

#### UI/E2E Tests (15 tasks)
- [ ] Truck posting form submission E2E
- [ ] Matching loads display after truck post
- [ ] Load posting with location selection
- [ ] Trip distance auto-calculated on map
- [ ] DH fields hidden in load posting form
- [ ] DH fields visible in search results
- [ ] Market pricing fields absent from UI
- [ ] Document upload E2E flow
- [ ] Document verification by admin E2E
- [ ] Registration with documents E2E
- [ ] Single-page marketplace tab switching
- [ ] Location dropdown search works
- [ ] Time window picker validation
- [ ] Multiple truck postings UI
- [ ] Mobile responsiveness

---

## 🚨 Critical Dependencies

### External Services
1. **Map/Routing API** (choose one):
   - Option A: Google Maps API (paid, reliable)
   - Option B: Mapbox (paid, good for Africa)
   - Option C: OpenRouteService (open source, may need self-hosting)
   - Option D: GraphHopper (open source, Ethiopia support varies)

2. **File Storage** (choose one):
   - Option A: Local filesystem (dev only)
   - Option B: AWS S3
   - Option C: Azure Blob Storage
   - Option D: Cloudinary

3. **Ethiopian Location Data Sources**:
   - Option A: Manual compilation from government data
   - Option B: OpenStreetMap data
   - Option C: GeoNames database
   - Option D: Purchase commercial dataset

### Technical Decisions Needed
- [ ] Choose map/routing provider
- [ ] Choose file storage solution
- [ ] Decide on location data source
- [ ] Define matching algorithm scoring weights
- [ ] Set DH preference defaults (if any)
- [ ] Define document file size limits
- [ ] Choose time window granularity (hours? 30-min blocks?)

---

## 📊 Success Criteria

### Sprint 8 Complete When:
- [ ] Carriers can post trucks with all required fields
- [ ] Matching loads display automatically after truck post
- [ ] Shippers can post loads using Ethiopian location dropdowns
- [ ] Trip distance auto-calculates from map
- [ ] Matching trucks display after load post
- [ ] DH fields hidden in load posting, visible in results
- [ ] Market pricing fields removed from entire system
- [ ] Companies can upload verification documents
- [ ] Back office can approve/reject documents
- [ ] Single-page marketplace experience works
- [ ] All automated tests passing (60 tests)
- [ ] Manual testing complete
- [ ] Documentation updated

### User Acceptance
- [ ] Carrier can successfully post a truck and see relevant loads
- [ ] Shipper can successfully post a load and see relevant trucks
- [ ] Matching results are accurate and useful
- [ ] Ethiopian locations are easy to select
- [ ] Trip distances are calculated correctly
- [ ] Document upload is straightforward
- [ ] Verification status is clear

---

## 🎓 Recommendations (from TRD)

### Implement in Sprint 8
- [ ] R1: Matching logic transparency - Add "Why matched" tooltips
- [ ] R2: Time window instead of single time - Use from/to fields
- [ ] R4: Performance - Server-side pagination, debounced filters
- [ ] R5: Location dataset ownership - Curated Ethiopian cities table
- [ ] R6: Map provider fallback - Straight-line distance fallback
- [ ] R7: Verification workflow - Back office dashboard

### Defer to Future Sprints
- [ ] R3: Saved filters + presets - Sprint 9 feature
- [ ] Advanced analytics - Future
- [ ] Real-time notifications - Future

---

## 📅 Estimated Timeline

### Sprint 8 Duration: **11-15 days (2-3 weeks)**

**Week 1:**
- Days 1-3: Database, locations, basic APIs
- Days 4-6: Map integration, truck posting

**Week 2:**
- Days 7-9: Matching engine, document verification
- Days 10-12: UI refinements, single-page experience

**Week 3 (Buffer):**
- Days 13-15: Testing, bug fixes, documentation

### Parallel Tracks (Optional - if multiple developers)
- **Track A:** Database + Backend (1 developer)
- **Track B:** UI Components (1 developer)
- **Track C:** Matching Algorithm (1 developer)
- **Duration with parallelization:** 7-10 days

---

## 🔄 Next Steps

1. **Review this plan** with stakeholders
2. **Make technical decisions**:
   - Map provider
   - File storage
   - Location data source
3. **Prioritize tasks** (if need to cut scope)
4. **Set up development environment** (API keys, etc.)
5. **Begin Phase 1** (Database foundation)

---

**Status:** 📋 Plan Ready - Awaiting Approval
**Total Tasks:** ~167 tasks
**Total Automated Tests:** 60 tests
**Estimated Effort:** 11-15 developer-days

