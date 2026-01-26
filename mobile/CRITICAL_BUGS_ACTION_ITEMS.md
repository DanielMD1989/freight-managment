# Critical Bugs - Immediate Action Items

**Date:** January 26, 2026
**Priority:** MUST FIX BEFORE PRODUCTION

---

## Summary

| Bug | Severity | Impact | Effort |
|-----|----------|--------|--------|
| P0-001: CSRF blocking mobile | CRITICAL | Carrier workflow broken | 5 min |
| P0-002: Race condition | CRITICAL | Data corruption possible | 30 min |
| P0-003: Non-atomic trip | CRITICAL | Orphaned loads | 30 min |

---

## P0-001: CSRF Blocking Mobile LoadRequest

### File to Fix
`app/api/load-requests/route.ts`

### Current Code (lines 46-50)
```typescript
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    // CSRF protection for state-changing operation
    const csrfError = await requireCSRF(request);  // <- REMOVE THIS
    if (csrfError) {
      return csrfError;
    }
```

### Fix
Remove the duplicate CSRF check. The middleware already handles CSRF and exempts Bearer tokens:

```typescript
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    // CSRF validation handled by middleware (exempts Bearer token requests)

    // Only carriers can request loads
    if (session.role !== 'CARRIER') {
```

### Why This Works
- Middleware (`middleware.ts` line 186) already validates CSRF
- Middleware exempts requests with Bearer token (mobile)
- The route's `requireCSRF()` doesn't have this exemption
- Removing it lets the middleware's logic apply correctly

---

## P0-002: Race Condition in Load Assignment

### Files to Fix
1. `app/api/truck-requests/[id]/respond/route.ts`
2. `app/api/load-requests/[id]/respond/route.ts`

### Current Code Pattern (WRONG)
```typescript
// Check OUTSIDE transaction - RACE CONDITION
if (loadRequest.load.assignedTruckId) {
  return NextResponse.json({ error: 'Already assigned' }, { status: 400 });
}

// Later...
const result = await db.$transaction(async (tx) => {
  // Assign load - but check above could be stale!
});
```

### Fix
Move the check inside the transaction:

```typescript
const result = await db.$transaction(async (tx) => {
  // Fresh check with row lock
  const freshLoad = await tx.load.findUnique({
    where: { id: loadRequest.loadId },
    select: { status: true, assignedTruckId: true },
  });

  if (freshLoad?.assignedTruckId) {
    throw new Error('LOAD_ALREADY_ASSIGNED');
  }

  const availableStatuses = ['POSTED', 'SEARCHING', 'OFFERED'];
  if (!availableStatuses.includes(freshLoad?.status || '')) {
    throw new Error('LOAD_NOT_AVAILABLE');
  }

  // Now safe to proceed with assignment
  const updatedRequest = await tx.truckRequest.update({...});
  const updatedLoad = await tx.load.update({
    where: { id: loadRequest.loadId },
    data: {
      assignedTruckId: loadRequest.truckId,
      assignedAt: new Date(),
      status: 'ASSIGNED',
    },
  });

  // ... rest of transaction
});
```

### Add Error Handling
```typescript
} catch (error: any) {
  if (error.message === 'LOAD_ALREADY_ASSIGNED') {
    return NextResponse.json(
      { error: 'Load has already been assigned to another truck' },
      { status: 409 }
    );
  }
  if (error.message === 'LOAD_NOT_AVAILABLE') {
    return NextResponse.json(
      { error: 'Load is no longer available' },
      { status: 400 }
    );
  }
  // ... existing error handling
}
```

---

## P0-003: Non-Atomic Trip Creation

### Files to Fix
1. `app/api/truck-requests/[id]/respond/route.ts`
2. `app/api/load-requests/[id]/respond/route.ts`

### Current Code Pattern (WRONG)
```typescript
const result = await db.$transaction(async (tx) => {
  // Update request and load
  return { request: updatedRequest, load: updatedLoad };
});  // Transaction ENDS here

// Trip creation OUTSIDE transaction - can fail silently
let trip = null;
try {
  trip = await createTripForLoad(loadRequest.loadId, ...);
} catch (error) {
  console.error('Failed to create trip:', error);
  // Load is ASSIGNED but NO TRIP = ORPHANED
}
```

### Fix Option 1: Create Trip Inside Transaction

Modify `createTripForLoad` to accept a transaction client, or inline the trip creation:

```typescript
const result = await db.$transaction(async (tx) => {
  // Update request
  const updatedRequest = await tx.truckRequest.update({...});

  // Assign load
  const updatedLoad = await tx.load.update({...});

  // Create trip INSIDE transaction
  const trip = await tx.trip.create({
    data: {
      loadId: loadRequest.loadId,
      truckId: loadRequest.truckId,
      carrierId: loadRequest.truck.carrierId,
      shipperId: loadRequest.shipperId,
      status: 'PENDING',
      createdById: session.userId,
      trackingToken: crypto.randomUUID(),
    },
  });

  // Create load events INSIDE transaction
  await tx.loadEvent.create({...});

  // Cancel other requests INSIDE transaction
  await tx.truckRequest.updateMany({...});

  return { request: updatedRequest, load: updatedLoad, trip };
});

// Only GPS tracking (non-critical) outside transaction
if (result.trip && loadRequest.truck.imei) {
  enableTrackingForLoad(loadRequest.loadId, loadRequest.truckId)
    .catch(err => console.error('GPS tracking setup failed:', err));
}
```

### Fix Option 2: Modify createTripForLoad to Accept Transaction

```typescript
// In lib/tripManagement.ts
export async function createTripForLoad(
  loadId: string,
  truckId: string,
  userId: string,
  tx?: Prisma.TransactionClient  // Optional transaction client
) {
  const client = tx || db;  // Use transaction if provided, else standalone

  const trip = await client.trip.create({
    data: {
      loadId,
      truckId,
      status: 'PENDING',
      createdById: userId,
      trackingToken: crypto.randomUUID(),
    },
  });

  return trip;
}

// Then in route handler:
const result = await db.$transaction(async (tx) => {
  // ... other updates ...
  const trip = await createTripForLoad(loadRequest.loadId, loadRequest.truckId, session.userId, tx);
  return { request, load, trip };
});
```

---

## Testing Verification

After applying fixes, verify:

### P0-001 Test
```bash
# Mobile carrier creates load request (should succeed)
curl -X POST https://api.example.com/api/load-requests \
  -H "Authorization: Bearer <mobile_token>" \
  -H "Content-Type: application/json" \
  -d '{"loadId": "...", "truckId": "..."}'
# Expected: 201 Created (not 403 CSRF error)
```

### P0-002 Test
```bash
# Simulate concurrent requests
for i in {1..5}; do
  curl -X POST https://api.example.com/api/truck-requests/$REQUEST_ID/respond \
    -H "Authorization: Bearer <token>" \
    -d '{"action": "APPROVE"}' &
done
wait
# Expected: Only ONE request succeeds, others get 409 Conflict
```

### P0-003 Test
```bash
# Approve request and verify trip exists
curl -X POST https://api.example.com/api/truck-requests/$REQUEST_ID/respond \
  -H "Authorization: Bearer <token>" \
  -d '{"action": "APPROVE"}'

# Check load has trip
curl https://api.example.com/api/loads/$LOAD_ID
# Expected: Load has assignedTruckId AND associated trip record
```

---

## Deployment Checklist

- [ ] Fix P0-001: Remove duplicate CSRF in load-requests route
- [ ] Fix P0-002: Move availability check inside transaction (both files)
- [ ] Fix P0-003: Move trip creation inside transaction (both files)
- [ ] Run test suite
- [ ] Manual E2E test: Mobile carrier requests load
- [ ] Manual E2E test: Concurrent approval attempts
- [ ] Manual E2E test: Verify trip created on approval
- [ ] Deploy to staging
- [ ] Smoke test staging
- [ ] Deploy to production

---

**Estimated Total Fix Time:** 1-2 hours
**Risk if Not Fixed:** Data corruption, broken mobile workflow, orphaned loads
