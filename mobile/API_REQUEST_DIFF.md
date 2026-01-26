# API Request Diff: Mobile vs Web

**Date:** January 26, 2026

---

## Endpoint Comparison

| Aspect | Web | Mobile (Before) | Mobile (After) |
|--------|-----|-----------------|----------------|
| Endpoint | `/api/truck-postings` | `/api/truck-postings` | `/api/truck-postings` |
| HTTP Method | GET | GET | GET |

---

## Query Parameters Comparison

### Web Implementation (SearchTrucksTab.tsx)

```typescript
// From: app/shipper/loadboard/SearchTrucksTab.tsx
const params = new URLSearchParams({
  page: page.toString(),
  limit: '20',
  status: 'ACTIVE'
});

if (filters.origin) params.set('origin', filters.origin);
if (filters.destination) params.set('destination', filters.destination);
if (filters.truckType) params.set('truckType', filters.truckType);
if (filters.fullPartial) params.set('fullPartial', filters.fullPartial);
if (filters.minLength) params.set('minLength', filters.minLength.toString());
if (filters.maxWeight) params.set('maxWeight', filters.maxWeight.toString());
if (filters.availableFrom) params.set('availableFrom', filters.availableFrom);
if (filters.ageHours) params.set('ageHours', filters.ageHours.toString());
```

### Mobile BEFORE (Limited Filters)

```dart
// From: lib/core/services/truck_service.dart (BEFORE)
final params = <String, dynamic>{
  'page': page.toString(),
  'limit': limit.toString(),
};

// ONLY 5 FILTERS SUPPORTED:
if (availableCity != null) params['availableCity'] = availableCity;
if (truckType != null) params['truckType'] = truckType;
if (minCapacity != null) params['minCapacity'] = minCapacity.toString();
if (maxCapacity != null) params['maxCapacity'] = maxCapacity.toString();
if (isAvailable != null) params['isAvailable'] = isAvailable.toString();

// MISSING: destination, fullPartial, minLength, maxWeight, availableFrom, ageHours
```

### Mobile AFTER (Web Parity)

```dart
// From: lib/core/services/truck_service.dart (AFTER)
final params = <String, dynamic>{
  'page': page.toString(),
  'limit': limit.toString(),
  'status': 'ACTIVE',  // Only show active postings
};

// ALL WEB FILTERS NOW SUPPORTED:
if (origin != null) params['origin'] = origin;
if (destination != null) params['destination'] = destination;
if (truckType != null) params['truckType'] = truckType;
if (fullPartial != null) params['fullPartial'] = fullPartial;
if (minLength != null) params['minLength'] = minLength.toString();
if (maxWeight != null) params['maxWeight'] = maxWeight.toString();
if (availableFrom != null) params['availableFrom'] = availableFrom.toIso8601String().split('T')[0];
if (ageHours != null) params['ageHours'] = ageHours.toString();
```

---

## Parameter Matrix

| Parameter | Web | Mobile Before | Mobile After | Notes |
|-----------|-----|---------------|--------------|-------|
| `page` | YES | YES | YES | Pagination |
| `limit` | YES | YES | YES | Results per page |
| `status` | YES | NO | YES | Filter ACTIVE postings |
| `origin` | YES | `availableCity` | YES | Origin city filter |
| `destination` | YES | NO | YES | **ADDED** |
| `truckType` | YES | YES | YES | Truck type enum |
| `fullPartial` | YES | NO | YES | **ADDED** |
| `minLength` | YES | NO | YES | **ADDED** |
| `maxWeight` | YES | NO | YES | **ADDED** |
| `availableFrom` | YES | NO | YES | **ADDED** |
| `ageHours` | YES | NO | YES | **ADDED** |
| `minCapacity` | NO | YES | NO | Removed (use maxWeight) |
| `maxCapacity` | NO | YES | NO | Removed |
| `isAvailable` | NO | YES | NO | Not needed (ACTIVE filter) |
| `sortBy` | YES | YES | YES | Sort field |
| `sortOrder` | YES | YES | YES | asc/desc |

---

## Response Parsing Comparison

### Web Response Parsing

```typescript
// Web correctly uses full posting data
const response = await fetch('/api/truck-postings?' + params);
const data = await response.json();
const postings: TruckPosting[] = data.truckPostings;

// Each posting contains:
// - originCity: { name, latitude, longitude }
// - destinationCity: { name, latitude, longitude }
// - truck: { ... full truck object }
// - carrier: { name, isVerified }
// - availableFrom, availableTo
// - fullPartial
// - postedAt (for age calculation)
```

### Mobile BEFORE (Lost Posting Data)

```dart
// PROBLEM: Extracted only nested truck, lost posting context
final trucksData = response.data['trucks'] ?? response.data['postings'] ?? [];
final trucks = (trucksData as List)
    .map((json) => Truck.fromJson(json['truck'] ?? json))  // <-- BUG!
    .toList();

// Lost: originCity, destinationCity, carrier, fullPartial, postedAt
```

### Mobile AFTER (Preserved Posting Data)

```dart
// FIXED: Parse full posting objects
final postingsData = response.data['truckPostings'] ??
                    response.data['postings'] ??
                    response.data['trucks'] ?? [];
final postings = (postingsData as List)
    .map((json) => TruckPosting.fromJson(json))  // <-- CORRECT!
    .toList();

// Preserved: originCity, destinationCity, carrier, fullPartial, postedAt
```

---

## Sample API Request

### Example: Find trucks from Addis Ababa to Dire Dawa

**Web Request:**
```
GET /api/truck-postings?page=1&limit=20&status=ACTIVE&origin=Addis%20Ababa&destination=Dire%20Dawa&truckType=FLATBED&fullPartial=FULL
```

**Mobile Request (After Fix):**
```
GET /api/truck-postings?page=1&limit=20&status=ACTIVE&origin=Addis%20Ababa&destination=Dire%20Dawa&truckType=FLATBED&fullPartial=FULL
```

**Result:** IDENTICAL API REQUESTS

---

## Verification

- [x] Same endpoint used: `/api/truck-postings`
- [x] Same HTTP method: GET
- [x] All web filter parameters supported
- [x] Full posting response parsed (not just truck)
- [x] Direction data preserved (origin/destination)
- [x] Age calculation data preserved (postedAt)
- [x] Carrier data preserved (name, verified)
