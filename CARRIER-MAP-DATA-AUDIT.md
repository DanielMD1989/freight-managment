# CARRIER MAP DATA AUDIT

**Date:** 2026-02-09
**Error:** `TypeError: Cannot read properties of undefined (reading 'replace')`
**File:** `app/carrier/map/page.tsx:123`
**Status:** ROOT CAUSE FIXED

---

## 1. DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW TRACE                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌────────────────────┐     ┌──────────────────────────┐
│   Database   │────▶│   API Endpoint     │────▶│   Frontend Component     │
│              │     │                    │     │                          │
│ Truck Model  │     │ /api/map/vehicles  │     │ app/carrier/map/page.tsx │
│              │     │                    │     │                          │
│ - isAvailable│     │ RETURNED:          │     │ EXPECTED:                │
│ - gpsStatus  │     │ - truckAvailability│     │ - status ❌              │
│              │     │ - gpsStatus        │     │ - gpsStatus              │
│              │     │   (INACTIVE,       │     │   (OFFLINE, NO_DEVICE) ❌│
│              │     │    SIGNAL_LOST)    │     │                          │
└──────────────┘     └────────────────────┘     └──────────────────────────┘
                              │
                              │ MISMATCH!
                              ▼
                     ┌────────────────────┐
                     │ vehicle.status is  │
                     │ UNDEFINED at       │
                     │ runtime            │
                     └────────────────────┘
```

---

## 2. ROOT CAUSE ANALYSIS

### The Error
```tsx
// app/carrier/map/page.tsx:123
{vehicle.truckType} - {vehicle.status.replace(/_/g, ' ')}
//                     ^^^^^^^^^^^^^^ UNDEFINED!
```

### Where The Gap Was Found

**Location:** API endpoint `app/api/map/vehicles/route.ts` lines 119-137

The API was returning different field names and enum values than the frontend expected:

| Layer | Field Name | Enum Values |
|-------|------------|-------------|
| **Database** | `isAvailable` (boolean) | `true`/`false` |
| **API Response** | `truckAvailability` | `'available'`/`'busy'` |
| **Frontend Expected** | `status` | `'AVAILABLE'`/`'IN_TRANSIT'` |

| Layer | Field Name | Enum Values |
|-------|------------|-------------|
| **Database** | `gpsStatus` | `ACTIVE`, `INACTIVE`, `SIGNAL_LOST`, `MAINTENANCE` |
| **API Response** | `gpsStatus` | `'ACTIVE'`, `'INACTIVE'`, `'SIGNAL_LOST'` |
| **Frontend Expected** | `gpsStatus` | `'ACTIVE'`, `'OFFLINE'`, `'NO_DEVICE'` |

### Stats Field Mismatch

| API Returned | Frontend Expected |
|--------------|-------------------|
| `gpsActive` | `active` |
| `gpsSignalLost` | `offline` |
| `gpsInactive` | `noDevice` |
| `busy` | `inTransit` |

---

## 3. ROOT CAUSE FIX

### File: `app/api/map/vehicles/route.ts`

### Before (lines 104-152)
```typescript
const vehicles = trucks.map((truck) => {
  let computedGpsStatus: 'ACTIVE' | 'INACTIVE' | 'SIGNAL_LOST' = 'INACTIVE';
  // ...
  return {
    // ...
    truckAvailability: truck.isAvailable ? 'available' : 'busy',  // ❌ Wrong field name
    gpsStatus: computedGpsStatus,  // ❌ Wrong enum values
    // ...
  };
});

return NextResponse.json({
  vehicles,
  stats: {
    gpsActive: ...,      // ❌ Wrong field name
    gpsSignalLost: ...,  // ❌ Wrong field name
    gpsInactive: ...,    // ❌ Wrong field name
    busy: ...,           // ❌ Wrong field name
  },
});
```

### After (lines 104-155)
```typescript
const vehicles = trucks.map((truck) => {
  // Map GPS status to frontend-expected values
  let computedGpsStatus: 'ACTIVE' | 'OFFLINE' | 'NO_DEVICE' = 'NO_DEVICE';

  if (truck.currentLocationLat && truck.currentLocationLon) {
    if (truck.locationUpdatedAt) {
      const lastUpdate = new Date(truck.locationUpdatedAt);
      const timeDiff = now.getTime() - lastUpdate.getTime();
      computedGpsStatus = timeDiff < OFFLINE_THRESHOLD_MS ? 'ACTIVE' : 'OFFLINE';
    } else {
      computedGpsStatus = 'OFFLINE';
    }
  }

  // Map truck status to frontend-expected values
  const truckStatus = truck.isAvailable ? 'AVAILABLE' : 'IN_TRANSIT';

  return {
    // ...
    status: truckStatus,           // ✅ Correct field name
    gpsStatus: computedGpsStatus,  // ✅ Correct enum values
    // ...
  };
});

return NextResponse.json({
  vehicles,
  stats: {
    active: ...,     // ✅ Correct field name
    offline: ...,    // ✅ Correct field name
    noDevice: ...,   // ✅ Correct field name
    inTransit: ...,  // ✅ Correct field name
  },
});
```

---

## 4. TYPE SAFETY IMPROVEMENTS

### Frontend Vehicle Interface
`app/carrier/map/page.tsx` lines 15-36

```typescript
interface Vehicle {
  id: string;
  plateNumber: string;
  truckType: string;
  capacity: number;
  status: string;                                    // ✅ Matches API
  gpsStatus: 'ACTIVE' | 'OFFLINE' | 'NO_DEVICE';    // ✅ Matches API
  currentLocation: {
    lat: number;
    lng: number;
    updatedAt?: string;
  } | null;
  carrier: {
    id: string;
    name: string;
  };
  driver?: {
    name: string;
    phone?: string;
  };
}
```

### Frontend Stats Interface
`app/carrier/map/page.tsx` lines 68-75

```typescript
interface Stats {
  total: number;
  active: number;      // ✅ Matches API stats.active
  offline: number;     // ✅ Matches API stats.offline
  noDevice: number;    // ✅ Matches API stats.noDevice
  available: number;   // ✅ Matches API stats.available
  inTransit: number;   // ✅ Matches API stats.inTransit
}
```

### API Response Shape (now aligned)
```typescript
// Response from GET /api/map/vehicles
{
  vehicles: Array<{
    id: string;
    plateNumber: string;
    truckType: string;
    capacity: number;
    status: 'AVAILABLE' | 'IN_TRANSIT';
    isAvailable: boolean;
    gpsStatus: 'ACTIVE' | 'OFFLINE' | 'NO_DEVICE';
    currentLocation: { lat: number; lng: number; updatedAt?: string } | null;
    carrier: { id: string; name: string };
  }>;
  total: number;
  stats: {
    total: number;
    active: number;
    offline: number;
    noDevice: number;
    available: number;
    inTransit: number;
  };
}
```

---

## 5. DEFENSIVE UI CHECKS (Safety Net)

Even with the API fix, defensive checks were added to prevent future issues:

### File: `app/carrier/map/page.tsx`

| Line | Before | After |
|------|--------|-------|
| 120 | `{vehicle.plateNumber}` | `{vehicle.plateNumber ?? 'No Plate'}` |
| 123 | `{vehicle.status.replace(...)}` | `{vehicle.status?.replace(...) ?? 'Unknown'}` |
| 152 | `{vehicle.truckType}` | `{vehicle.truckType ?? 'Unknown'}` |
| 160 | `{vehicle.status}` | `{vehicle.status ?? 'Unknown'}` |
| 168 | `{vehicle.gpsStatus}` | `{vehicle.gpsStatus ?? 'Unknown'}` |
| 282 | `vehicle.plateNumber.toLowerCase()` | `vehicle.plateNumber?.toLowerCase()` |
| 425 | `title: vehicle.plateNumber` | `title: vehicle.plateNumber ?? 'Unknown'` |
| 545 | `title: vehicle.plateNumber` | `title: vehicle.plateNumber ?? 'Unknown'` |

---

## 6. VERIFICATION

### TypeScript Compilation
```bash
npx tsc --noEmit
# Exit code: 0
```

### Data Contract
The API and Frontend now use identical field names and enum values:

| Field | API Returns | Frontend Expects | Match |
|-------|-------------|------------------|-------|
| `status` | `'AVAILABLE' \| 'IN_TRANSIT'` | `string` | ✅ |
| `gpsStatus` | `'ACTIVE' \| 'OFFLINE' \| 'NO_DEVICE'` | `'ACTIVE' \| 'OFFLINE' \| 'NO_DEVICE'` | ✅ |
| `stats.active` | `number` | `number` | ✅ |
| `stats.offline` | `number` | `number` | ✅ |
| `stats.noDevice` | `number` | `number` | ✅ |
| `stats.inTransit` | `number` | `number` | ✅ |

---

## 7. FILES CHANGED

| File | Lines | Change Type |
|------|-------|-------------|
| `app/api/map/vehicles/route.ts` | 99-155 | Root cause fix - aligned field names and enum values |
| `app/carrier/map/page.tsx` | Multiple | Defensive null checks (safety net) |

---

## 8. SUMMARY

| Item | Status |
|------|--------|
| Root cause identified | ✅ API/Frontend field name mismatch |
| API fixed | ✅ Returns `status` instead of `truckAvailability` |
| Enum values aligned | ✅ `OFFLINE`/`NO_DEVICE` instead of `INACTIVE`/`SIGNAL_LOST` |
| Stats fields aligned | ✅ `active`/`offline`/`noDevice`/`inTransit` |
| Type safety | ✅ Interfaces match API response |
| Defensive checks | ✅ Added as safety net |
| TypeScript compilation | ✅ Exit code 0 |

---

*Audit completed: 2026-02-09*
*Root cause: API returned `truckAvailability`, frontend expected `status`*
*Fix location: `app/api/map/vehicles/route.ts:104-155`*
