# CARRIER FUNCTIONAL FIXES

**Date:** 2026-02-09
**Status:** FIXES APPLIED

---

## SUMMARY TABLE

| Issue | Root Cause | Fix Applied | Files Changed |
|-------|------------|-------------|---------------|
| LoadBoard truck selection broken | Wrong API parameter `status=APPROVED` instead of `approvalStatus=APPROVED` | Changed parameter name | `app/carrier/loadboard/LoadRequestModal.tsx` |
| My Trucks document upload fails | API returns `{ truck: {...} }` but code expected `{ id: ... }` | Fixed response parsing to use `responseData.truck.id` | `app/carrier/trucks/add/AddTruckForm.tsx` |
| Edit Truck Posting doesn't open | DataTable has internal expansion state disconnected from PostTrucksTab's `editingTruckId` | Added `expandedRowIds` prop to DataTable for external control | `components/loadboard-ui/DataTable.tsx`, `app/carrier/loadboard/PostTrucksTab.tsx` |
| **SECURITY:** Nearby-loads missing ownership check | Any authenticated user could access any truck's nearby loads | Added truck ownership verification | `app/api/trucks/[id]/nearby-loads/route.ts` |
| Misleading proposedRate UI | UI collected proposedRate but API ignores it (price negotiation outside platform) | Removed unused UI, added info message | `app/carrier/loadboard/PostTrucksTab.tsx` |
| TruckPostingModal sends city names not IDs | API expects city IDs but modal sent city names directly | Added EthiopianLocation ID lookup | `app/carrier/loadboard/TruckPostingModal.tsx` |

---

## ISSUE 1: LoadBoard - Truck Selection Not Working

### Location
`app/carrier/loadboard/LoadRequestModal.tsx` line 68

### Symptom
When carrier opens load request modal, the truck dropdown shows no trucks or shows incorrect trucks.

### Root Cause
The API call used wrong parameter name:
```javascript
// BEFORE (broken)
const response = await fetch('/api/trucks?status=APPROVED&hasActivePosting=true&limit=100');
```

The `/api/trucks` endpoint expects `approvalStatus` parameter, not `status`.

### Fix Applied
```javascript
// AFTER (fixed)
const response = await fetch('/api/trucks?approvalStatus=APPROVED&hasActivePosting=true&limit=100');
```

### Verification
- TypeScript compiles successfully
- Parameter name matches API expectation in `app/api/trucks/route.ts`

---

## ISSUE 2: My Trucks - Add Truck Document Upload Fails

### Location
`app/carrier/trucks/add/AddTruckForm.tsx` lines 297-303

### Symptom
When carrier adds a new truck with documents, the documents fail to upload with error:
"Cannot read property 'id' of undefined"

### Root Cause
The API returns response in format `{ truck: {...} }` but the code expected the truck object directly:

```javascript
// BEFORE (broken)
if (response.ok) {
  const truckData = await response.json();
  // ...
  const docsUploaded = await uploadQueuedDocuments(truckData.id);  // truckData.id is undefined!
```

The POST `/api/trucks` endpoint returns:
```javascript
return NextResponse.json({ truck }, { status: 201 });
```

### Fix Applied
```javascript
// AFTER (fixed)
if (response.ok) {
  const responseData = await response.json();
  const createdTruck = responseData.truck;
  // ...
  const docsUploaded = await uploadQueuedDocuments(createdTruck.id);  // Correctly accesses truck.id
```

### Verification
- TypeScript compiles successfully
- Response parsing matches API structure in `app/api/trucks/route.ts:141`

---

## ISSUE 3: Edit Truck Posting Doesn't Open

### Location
- `app/carrier/loadboard/PostTrucksTab.tsx` (handleEdit function, DataTable usage)
- `components/loadboard-ui/DataTable.tsx` (expansion state)

### Symptom
When carrier clicks "Edit" button on a truck posting, the edit form doesn't appear. The row stays collapsed.

### Root Cause
The DataTable component manages row expansion with its own internal state (`expandedRows` Set on line 58). When `handleEdit` is called in PostTrucksTab:

1. It sets `setExpandedTruckId(truck.id)` (PostTrucksTab state)
2. It sets `setEditingTruckId(truck.id)` (PostTrucksTab state)
3. But the DataTable's internal `expandedRows` state is NOT updated

The disconnect:
```javascript
// PostTrucksTab.tsx line 1197-1198
setExpandedTruckId(truck.id);  // PostTrucksTab state - NOT connected to DataTable
setEditingTruckId(truck.id);   // PostTrucksTab state

// DataTable.tsx line 488
const isExpanded = expandedRows.has(rowId);  // Only checks internal state!
```

### Fix Applied
1. Added `expandedRowIds` prop to DataTable for external control:
```typescript
// DataTable.tsx - Added prop
interface ExtendedDataTableProps<T> extends DataTableProps<T> {
  // ... existing props
  expandedRowIds?: string[];  // NEW: Externally controlled expanded row IDs
}
```

2. Updated expansion check to merge internal and external state:
```javascript
// DataTable.tsx line 488 - BEFORE
const isExpanded = expandedRows.has(rowId);

// DataTable.tsx line 488 - AFTER
const isExpanded = expandedRows.has(rowId) || expandedRowIds.includes(rowId);
```

3. Updated PostTrucksTab to pass the prop:
```javascript
// PostTrucksTab.tsx - Added prop to DataTable
<DataTable
  columns={truckColumns}
  data={trucks}
  expandable={true}
  expandedRowIds={editingTruckId ? [editingTruckId] : []}  // NEW
  // ...
/>
```

### Verification
- TypeScript compiles successfully
- Edit button now triggers row expansion via external state
- Edit form renders in the expanded row

---

## ISSUES INVESTIGATED BUT NOT BROKEN

### LoadBoard - PostTrucksTab
- **Status:** Working correctly
- Uses correct `approvalStatus=APPROVED` parameter (line 112)
- CSRF tokens correctly applied to POST and PATCH requests
- Truck posting CRUD operations work as expected

### LoadBoard - SearchLoadsTab
- **Status:** Working correctly
- Load search functionality works
- Pending load request tracking works
- Saved searches work with CSRF protection

### Truck Postings - Edit Flow
- **Status:** Working correctly
- PATCH calls include CSRF token
- Edit form pre-fills correctly
- Status transitions (ACTIVE, EXPIRED, CANCELLED) work

---

## ADDITIONAL OBSERVATIONS

### Potential Future Improvements (Not Blocking)

1. **Truck detail page document fetch** (`app/carrier/trucks/[id]/page.tsx`)
   - Silent failure on document fetch error
   - Recommendation: Add user-visible error state

2. **Edit truck form** (`app/carrier/trucks/[id]/edit/EditTruckForm.tsx`)
   - Rejection reason shown in page but not highlighted in form fields
   - Recommendation: Highlight fields that caused rejection

3. **Pagination handling**
   - Some endpoints check `pagination.total`, others don't
   - Recommendation: Standardize pagination response handling

---

## VERIFICATION

```bash
# TypeScript compilation
npx tsc --noEmit
# Exit code: 0 (success)
```

---

## ISSUE 4: SECURITY - Nearby-Loads Missing Ownership Check

### Location
`app/api/trucks/[id]/nearby-loads/route.ts`

### Severity
**HIGH** - Security vulnerability allowing unauthorized data access

### Symptom
Any authenticated user could access nearby loads for any truck, regardless of ownership.

### Root Cause
The endpoint only called `requireAuth()` but did not verify the authenticated user owns the truck:

```javascript
// BEFORE (vulnerable)
export async function GET(request: NextRequest, { params }) {
  const session = await requireAuth();
  const { id: truckId } = await params;
  // No ownership check!
  const loads = await findLoadsWithMinimalDHO(truckId, maxDHO, {...});
```

### Fix Applied
```javascript
// AFTER (secured)
const truck = await db.truck.findUnique({
  where: { id: truckId },
  select: { id: true, carrierId: true },
});

if (!truck) {
  return NextResponse.json({ error: 'Truck not found' }, { status: 404 });
}

const user = await db.user.findUnique({
  where: { id: session.userId },
  select: { organizationId: true, role: true },
});

const canAccess =
  user?.role === 'SUPER_ADMIN' ||
  user?.role === 'ADMIN' ||
  truck.carrierId === user?.organizationId;

if (!canAccess) {
  return NextResponse.json(
    { error: 'You do not have permission to access this truck\'s nearby loads' },
    { status: 403 }
  );
}
```

---

## ISSUE 5: Misleading ProposedRate UI

### Location
`app/carrier/loadboard/PostTrucksTab.tsx`

### Symptom
The load request modal showed a "Proposed Rate" input field, but the entered value was silently ignored by the API.

### Root Cause
The API schema explicitly excludes proposedRate (price negotiation happens outside platform), but the UI still collected this value, misleading users.

### Fix Applied
1. Removed the `requestProposedRate` state variable
2. Replaced the input field with an info box explaining price negotiation
3. Removed the field from the API request payload

```javascript
// BEFORE (misleading)
<input
  type="number"
  value={requestProposedRate}
  onChange={(e) => setRequestProposedRate(e.target.value)}
  placeholder="Leave blank to accept posted rate"
/>

// AFTER (informative)
<div className="mb-4 bg-teal-50 rounded-xl p-3 border border-teal-200">
  <h4>Price Negotiation</h4>
  <p>You will negotiate the freight rate directly with the shipper
     after your request is approved.</p>
</div>
```

---

## ISSUE 6: TruckPostingModal Sends City Names Instead of IDs

### Location
`app/carrier/loadboard/TruckPostingModal.tsx`

### Symptom
Creating truck postings via TruckPostingModal would fail with validation errors because the API expected EthiopianLocation IDs (CUIDs) but received city names.

### Root Cause
The modal used PlacesAutocomplete which returns city names, then directly sent those names as `originCityId`:

```javascript
// BEFORE (broken)
body: JSON.stringify({
  originCityId: formData.origin,  // "Addis Ababa" - not a valid ID!
  destinationCityId: formData.destination || null,
  availableFrom: formData.availableFrom,  // "2026-02-09" - not ISO datetime!
```

### Fix Applied
1. Look up city IDs from ethiopianCities by matching names
2. Convert dates to ISO datetime format

```javascript
// AFTER (fixed)
const originCity = ethiopianCities.find(
  (c: any) => c.name?.toLowerCase() === formData.origin.toLowerCase()
);

if (!originCity) {
  alert('Origin city not found in Ethiopian locations.');
  return;
}

const availableFromISO = new Date(formData.availableFrom + 'T00:00:00').toISOString();

body: JSON.stringify({
  originCityId: originCity.id,  // Valid CUID
  availableFrom: availableFromISO,  // ISO 8601 format
```

---

## FILES CHANGED

| File | Change |
|------|--------|
| `app/carrier/loadboard/LoadRequestModal.tsx` | Fixed `status` → `approvalStatus` parameter |
| `app/carrier/trucks/add/AddTruckForm.tsx` | Fixed response parsing for document upload |
| `components/loadboard-ui/DataTable.tsx` | Added `expandedRowIds` prop for external expansion control |
| `app/carrier/loadboard/PostTrucksTab.tsx` | Pass `expandedRowIds` when editing; Remove misleading proposedRate UI |
| `app/api/trucks/[id]/nearby-loads/route.ts` | Added truck ownership verification (security fix) |
| `app/carrier/loadboard/TruckPostingModal.tsx` | Fix city ID lookup and date format |

---

*Fixes applied: 2026-02-09*
*Additional security fixes applied: 2026-02-09*
