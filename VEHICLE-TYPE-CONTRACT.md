# VEHICLE TYPE CONTRACT

**Date:** 2026-02-09
**Status:** IMPLEMENTED

---

## OVERVIEW

This document describes the **single source of truth** for vehicle/truck data shapes shared between the API and frontend. This prevents field name mismatches and enum value discrepancies.

---

## TYPE CONTRACT FILE

**Location:** `lib/types/vehicle.ts`

This file defines:
- `VehicleMapData` - Shape of vehicle objects
- `VehicleMapStats` - Shape of statistics
- `VehicleMapResponse` - Complete API response shape
- `GpsDisplayStatus` - GPS status enum for display
- `TruckAvailabilityStatus` - Truck availability enum for display
- Helper functions for mapping database values to display values

---

## DATA FLOW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TYPE CONTRACT ENFORCEMENT                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐     ┌────────────────────────────┐     ┌─────────────────┐
│ Prisma Schema    │     │ lib/types/vehicle.ts       │     │ Frontend        │
│                  │     │ (SINGLE SOURCE OF TRUTH)   │     │                 │
│ Truck {          │     │                            │     │ Uses:           │
│   isAvailable    │────▶│ VehicleMapData {           │────▶│ VehicleMapData  │
│   gpsStatus      │     │   status: AVAILABLE|       │     │ VehicleMapStats │
│   ...            │     │          IN_TRANSIT        │     │ VehicleMapRes   │
│ }                │     │   gpsStatus: ACTIVE|       │     │                 │
│                  │     │             OFFLINE|       │     │                 │
│ GpsDeviceStatus  │     │             NO_DEVICE      │     │                 │
│ {ACTIVE,         │     │   ...                      │     │                 │
│  INACTIVE,       │     │ }                          │     │                 │
│  SIGNAL_LOST...} │     │                            │     │                 │
└──────────────────┘     └────────────────────────────┘     └─────────────────┘
                                    │
                                    │ imports
                                    ▼
                         ┌────────────────────────────┐
                         │ API Endpoint               │
                         │ app/api/map/vehicles/      │
                         │                            │
                         │ Uses:                      │
                         │ - VehicleMapData           │
                         │ - VehicleMapStats          │
                         │ - VehicleMapResponse       │
                         │ - mapGpsStatus()           │
                         │ - mapTruckStatus()         │
                         └────────────────────────────┘
```

---

## TYPE DEFINITIONS

### VehicleMapData

```typescript
export interface VehicleMapData {
  /** Unique truck ID (cuid) */
  id: string;

  /** License plate number */
  plateNumber: string;

  /** Truck type from Prisma enum */
  truckType: TruckType | string;

  /** Cargo capacity in kg */
  capacity: number;

  /** Availability status for display: 'AVAILABLE' | 'IN_TRANSIT' */
  status: TruckAvailabilityStatus;

  /** Whether truck is available (raw boolean from DB) */
  isAvailable: boolean;

  /** GPS status for display: 'ACTIVE' | 'OFFLINE' | 'NO_DEVICE' */
  gpsStatus: GpsDisplayStatus;

  /** Current GPS location, null if no GPS data */
  currentLocation: VehicleLocation | null;

  /** Carrier organization that owns this truck */
  carrier: VehicleCarrier;

  /** Optional driver information */
  driver?: VehicleDriver;

  /** Optional current trip if truck is in transit */
  currentTrip?: VehicleCurrentTrip;
}
```

### VehicleMapStats

```typescript
export interface VehicleMapStats {
  /** Total number of vehicles */
  total: number;

  /** Vehicles with active GPS signal (< 15 min old) */
  active: number;

  /** Vehicles with stale GPS signal (>= 15 min old) */
  offline: number;

  /** Vehicles with no GPS data at all */
  noDevice: number;

  /** Available trucks (isAvailable = true) */
  available: number;

  /** Trucks currently in transit (isAvailable = false) */
  inTransit: number;
}
```

### VehicleMapResponse

```typescript
export interface VehicleMapResponse {
  /** Array of vehicle data for map markers */
  vehicles: VehicleMapData[];

  /** Total count (same as stats.total) */
  total: number;

  /** Aggregated statistics for sidebar display */
  stats: VehicleMapStats;
}
```

---

## ENUM MAPPINGS

### GPS Status

| Database (GpsDeviceStatus) | Display (GpsDisplayStatus) | Meaning |
|---------------------------|---------------------------|---------|
| ACTIVE + recent data | `'ACTIVE'` | GPS sending signals, data < 15 min old |
| ACTIVE + stale data | `'OFFLINE'` | GPS exists but data >= 15 min old |
| INACTIVE | `'NO_DEVICE'` | No GPS location data |
| SIGNAL_LOST | `'OFFLINE'` | GPS signal lost |
| MAINTENANCE | `'OFFLINE'` | GPS under maintenance |
| null | `'NO_DEVICE'` | No GPS configured |

### Truck Availability

| Database (isAvailable) | Display (TruckAvailabilityStatus) | Meaning |
|-----------------------|----------------------------------|---------|
| `true` | `'AVAILABLE'` | Truck available for new loads |
| `false` | `'IN_TRANSIT'` | Truck on active trip |

---

## USAGE

### API Endpoint

```typescript
// app/api/map/vehicles/route.ts
import {
  VehicleMapData,
  VehicleMapStats,
  VehicleMapResponse,
  mapGpsStatus,
  mapTruckStatus,
} from '@/lib/types/vehicle';

// Build typed vehicle data
const vehicleData: VehicleMapData = {
  id: truck.id,
  plateNumber: truck.licensePlate,
  status: mapTruckStatus(truck.isAvailable),
  gpsStatus: mapGpsStatus(truck.gpsStatus, hasLocation, isRecent),
  // ...
};

// Build typed response
const response: VehicleMapResponse = {
  vehicles,
  total: vehicles.length,
  stats,
};

return NextResponse.json(response);
```

### Frontend Component

```typescript
// app/carrier/map/page.tsx
import {
  VehicleMapData,
  VehicleMapStats,
  VehicleMapResponse,
  GpsDisplayStatus,
  TruckAvailabilityStatus,
} from '@/lib/types/vehicle';

// Use type aliases for clarity
type Vehicle = VehicleMapData;
type Stats = VehicleMapStats;

// Type state variables
const [vehicles, setVehicles] = useState<Vehicle[]>([]);
const [stats, setStats] = useState<Stats>({...});

// Type API response
const data: VehicleMapResponse = await response.json();
setVehicles(data.vehicles);
setStats(data.stats);
```

---

## FILES USING THIS CONTRACT

| File | Usage |
|------|-------|
| `lib/types/vehicle.ts` | Type definitions (source of truth) |
| `app/api/map/vehicles/route.ts` | API - produces typed response |
| `app/carrier/map/page.tsx` | Frontend - consumes typed response |

---

## BENEFITS

1. **No more field mismatches**: Both API and frontend use identical type definitions
2. **Compile-time safety**: TypeScript catches mismatches before runtime
3. **Self-documenting**: Types serve as documentation for the data contract
4. **Easy to extend**: Add new fields in one place, get type errors everywhere else
5. **Helper functions**: Centralized mapping logic for database → display values

---

## ADDING NEW FIELDS

1. Add the field to the interface in `lib/types/vehicle.ts`
2. Update the API to populate the field
3. TypeScript will error in the frontend if you try to use an undefined field
4. Update frontend to use the new field

---

## VERIFICATION

```bash
# TypeScript compilation
npx tsc --noEmit
# Exit code: 0

# Both API and frontend use shared types - any mismatch will cause compile error
```

---

*Contract established: 2026-02-09*
*Type file: lib/types/vehicle.ts*
