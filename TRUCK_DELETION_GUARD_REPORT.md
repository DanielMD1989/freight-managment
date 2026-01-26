# Truck Deletion Guard Report

**Date:** 2026-01-23
**Implementer:** Claude Opus 4.5
**Severity Fixed:** HIGH (Data Integrity)

---

## Executive Summary

Added middleware guard to `DELETE /api/trucks/{id}` that rejects deletion requests when the truck has an active trip. Returns HTTP 409 Conflict with detailed error information.

| Scenario | Before | After |
|----------|--------|-------|
| Truck with active trip | Foreign key error (500) | 409 Conflict with details |
| Truck with completed trips | Success | Success |
| Truck with no trips | Success | Success |

---

## Implementation Details

### File Modified

`app/api/trucks/[id]/route.ts`

### Guard Logic

```typescript
// Active trip = any trip NOT in COMPLETED or CANCELLED status
const ACTIVE_TRIP_STATUSES = ['ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT', 'DELIVERED'];

const activeTrip = await db.trip.findFirst({
  where: {
    truckId: id,
    status: {
      in: ACTIVE_TRIP_STATUSES,
    },
  },
  select: {
    id: true,
    status: true,
    load: {
      select: {
        id: true,
        pickupCity: true,
        deliveryCity: true,
      },
    },
  },
});

if (activeTrip) {
  return NextResponse.json(
    {
      error: "Cannot delete truck with active trip",
      code: "TRUCK_HAS_ACTIVE_TRIP",
      message: `This truck is currently assigned to an active trip (${activeTrip.status}). Complete or cancel the trip before deleting the truck.`,
      details: {
        tripId: activeTrip.id,
        tripStatus: activeTrip.status,
        loadId: activeTrip.load?.id,
        route: activeTrip.load
          ? `${activeTrip.load.pickupCity} → ${activeTrip.load.deliveryCity}`
          : undefined,
      },
    },
    { status: 409 }
  );
}
```

---

## Trip Status Classification

### Active Statuses (Block Deletion)

| Status | Description |
|--------|-------------|
| `ASSIGNED` | Trip created, truck assigned to load |
| `PICKUP_PENDING` | Carrier en route to pickup location |
| `IN_TRANSIT` | Load picked up, in transit to destination |
| `DELIVERED` | Load delivered, awaiting POD confirmation |

### Terminal Statuses (Allow Deletion)

| Status | Description |
|--------|-------------|
| `COMPLETED` | POD confirmed, payment processed |
| `CANCELLED` | Trip cancelled |

---

## API Response Format

### 409 Conflict Response

```json
{
  "error": "Cannot delete truck with active trip",
  "code": "TRUCK_HAS_ACTIVE_TRIP",
  "message": "This truck is currently assigned to an active trip (IN_TRANSIT). Complete or cancel the trip before deleting the truck.",
  "details": {
    "tripId": "trip_abc123",
    "tripStatus": "IN_TRANSIT",
    "loadId": "load_xyz789",
    "route": "Addis Ababa → Dire Dawa"
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `error` | string | Human-readable error message |
| `code` | string | Machine-readable error code |
| `message` | string | Detailed explanation with current trip status |
| `details.tripId` | string | ID of the blocking trip |
| `details.tripStatus` | string | Current status of the trip |
| `details.loadId` | string | ID of the associated load |
| `details.route` | string | Pickup → Delivery route |

---

## Request Flow

```
DELETE /api/trucks/{id}
        │
        ▼
┌───────────────────┐
│  Authentication   │
│   requireAuth()   │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│   Authorization   │
│ requirePermission │
│ (DELETE_TRUCKS)   │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│   Find Truck      │
│   (404 if not     │
│    found)         │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Ownership Check  │
│  (403 if not      │
│   owner)          │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐     ┌───────────────────┐
│  ACTIVE TRIP      │ YES │   409 Conflict    │
│  GUARD (NEW)      │────▶│  with trip info   │
└─────────┬─────────┘     └───────────────────┘
          │ NO
          ▼
┌───────────────────┐
│  Delete Truck     │
│  (catch FK error) │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  200 Success      │
└───────────────────┘
```

---

## Validation Order

1. **Authentication** - User must be logged in
2. **Authorization** - User must have `DELETE_TRUCKS` permission
3. **Existence** - Truck must exist (404 if not)
4. **Ownership** - User must own truck or be SUPER_ADMIN (403 if not)
5. **Active Trip Guard** - Truck must not have active trip (409 if has) ← **NEW**
6. **Foreign Key Check** - Handle other FK constraints (409 if fails)

---

## Error Codes

| HTTP Status | Error Code | Condition |
|-------------|------------|-----------|
| 401 | - | Not authenticated |
| 403 | - | Not authorized (no permission or not owner) |
| 404 | - | Truck not found |
| **409** | **TRUCK_HAS_ACTIVE_TRIP** | **Truck has active trip (NEW)** |
| 409 | - | Foreign key constraint (active postings) |
| 500 | - | Internal server error |

---

## Client Handling Example

### TypeScript/React

```typescript
const deleteTruck = async (truckId: string) => {
  try {
    const response = await fetch(`/api/trucks/${truckId}`, {
      method: 'DELETE',
    });

    if (response.status === 409) {
      const error = await response.json();

      if (error.code === 'TRUCK_HAS_ACTIVE_TRIP') {
        // Show specific error with trip details
        toast.error(
          `Cannot delete truck: Active trip on route ${error.details.route}`,
          { description: `Trip status: ${error.details.tripStatus}` }
        );
        return;
      }

      // Other 409 errors (active postings, etc.)
      toast.error(error.message);
      return;
    }

    if (!response.ok) {
      throw new Error('Failed to delete truck');
    }

    toast.success('Truck deleted successfully');
  } catch (error) {
    toast.error('Failed to delete truck');
  }
};
```

### Dart/Flutter

```dart
Future<void> deleteTruck(String truckId) async {
  final response = await apiClient.delete('/api/trucks/$truckId');

  if (response.statusCode == 409) {
    final error = response.data;

    if (error['code'] == 'TRUCK_HAS_ACTIVE_TRIP') {
      throw TruckHasActiveTripException(
        tripId: error['details']['tripId'],
        tripStatus: error['details']['tripStatus'],
        route: error['details']['route'],
      );
    }

    throw ConflictException(error['message']);
  }

  if (response.statusCode != 200) {
    throw DeleteTruckException(response.data['error']);
  }
}
```

---

## Testing Scenarios

### Test 1: Delete Truck with ASSIGNED Trip

```bash
# Setup: Truck with ASSIGNED trip
DELETE /api/trucks/truck_123

# Expected: 409 Conflict
{
  "error": "Cannot delete truck with active trip",
  "code": "TRUCK_HAS_ACTIVE_TRIP",
  "details": {
    "tripStatus": "ASSIGNED"
  }
}
```

### Test 2: Delete Truck with IN_TRANSIT Trip

```bash
# Setup: Truck currently delivering a load
DELETE /api/trucks/truck_456

# Expected: 409 Conflict
{
  "error": "Cannot delete truck with active trip",
  "code": "TRUCK_HAS_ACTIVE_TRIP",
  "details": {
    "tripStatus": "IN_TRANSIT",
    "route": "Addis Ababa → Hawassa"
  }
}
```

### Test 3: Delete Truck with COMPLETED Trip Only

```bash
# Setup: Truck has only completed trips
DELETE /api/trucks/truck_789

# Expected: 200 OK
{
  "success": true,
  "message": "Truck deleted successfully"
}
```

### Test 4: Delete Truck with No Trips

```bash
# Setup: Truck has never been assigned to a trip
DELETE /api/trucks/truck_new

# Expected: 200 OK
{
  "success": true,
  "message": "Truck deleted successfully"
}
```

---

## Business Rules Enforced

1. **Data Integrity**: Prevents orphaned trip records
2. **Operational Safety**: Ensures active deliveries are not disrupted
3. **Clear Feedback**: Provides actionable error messages with trip details
4. **Graceful Handling**: Returns conflict rather than server error

---

## Files Changed

| File | Lines Added | Description |
|------|-------------|-------------|
| `app/api/trucks/[id]/route.ts` | +35 | Added active trip guard before deletion |

---

## Conclusion

The truck deletion endpoint now includes a proactive guard that:

1. **Checks for active trips** before attempting deletion
2. **Returns 409 Conflict** with detailed trip information
3. **Provides actionable error messages** including route and status
4. **Includes error code** (`TRUCK_HAS_ACTIVE_TRIP`) for client handling

This prevents data integrity issues and provides clear feedback when deletion is blocked.

---

**Report Generated:** 2026-01-23
**Implementer:** Claude Opus 4.5
**Status:** IMPLEMENTED
