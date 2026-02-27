# Load Lifecycle State Machine

**Sprint 3: Load Lifecycle State Machine**

This document describes the complete state machine for load lifecycle management in the freight platform.

## Overview

The load lifecycle state machine ensures that loads follow the correct workflow from creation to completion. It enforces valid state transitions and role-based permissions to maintain data integrity and business logic.

## Load States

The system supports 13 distinct load states:

### 1. DRAFT

**Description**: Load created but not yet posted to marketplace

**Purpose**: Allows shippers to create and save loads without immediately posting them

**Who can set**: SHIPPER, ADMIN, SUPER_ADMIN

**Valid next states**: POSTED, CANCELLED

---

### 2. POSTED

**Description**: Load posted to marketplace, carriers can search and view

**Purpose**: Makes load visible to carriers in the marketplace

**Who can set**: SHIPPER, ADMIN, SUPER_ADMIN

**Valid next states**: SEARCHING, OFFERED, ASSIGNED, UNPOSTED, CANCELLED, EXPIRED

---

### 3. SEARCHING

**Description**: Actively being matched with carriers by dispatcher or automation

**Purpose**: Indicates the platform is actively finding suitable carriers

**Who can set**: DISPATCHER, ADMIN, SUPER_ADMIN

**Valid next states**: OFFERED, ASSIGNED, EXCEPTION, CANCELLED, EXPIRED

---

### 4. OFFERED

**Description**: Load offered to a specific carrier

**Purpose**: Carrier has been selected and offered the load, awaiting acceptance

**Who can set**: DISPATCHER, ADMIN, SUPER_ADMIN

**Valid next states**: ASSIGNED, SEARCHING (if rejected), EXCEPTION, CANCELLED, EXPIRED

---

### 5. ASSIGNED

**Description**: Carrier accepted, load assigned

**Purpose**: Carrier has accepted the load and is committed to transport

**Who can set**: CARRIER, DISPATCHER, ADMIN, SUPER_ADMIN

**Valid next states**: PICKUP_PENDING, IN_TRANSIT, EXCEPTION, CANCELLED

---

### 6. PICKUP_PENDING

**Description**: Waiting for carrier to pick up load

**Purpose**: Load assigned but not yet picked up by carrier

**Who can set**: CARRIER, DISPATCHER, ADMIN, SUPER_ADMIN

**Valid next states**: IN_TRANSIT, EXCEPTION, CANCELLED

---

### 7. IN_TRANSIT

**Description**: Load picked up, in transit to destination

**Purpose**: Active transportation phase, load is on the truck

**Who can set**: CARRIER, ADMIN, SUPER_ADMIN

**Valid next states**: DELIVERED, EXCEPTION

---

### 8. DELIVERED

**Description**: Load delivered to destination

**Purpose**: Carrier has delivered the load, awaiting POD and completion

**Who can set**: CARRIER, ADMIN, SUPER_ADMIN

**Valid next states**: COMPLETED, EXCEPTION

---

### 9. COMPLETED

**Description**: POD uploaded, payment processed

**Purpose**: Final successful state, all paperwork and payment complete

**Who can set**: ADMIN, SUPER_ADMIN

**Valid next states**: EXCEPTION (can still report issues after completion)

---

### 10. EXCEPTION

**Description**: Issue detected (late delivery, damage, rejection, etc.)

**Purpose**: Handles any problems during the load lifecycle

**Who can set**: DISPATCHER, ADMIN, SUPER_ADMIN

**Valid next states**: SEARCHING, ASSIGNED, IN_TRANSIT, PICKUP_PENDING, CANCELLED, COMPLETED

**Notes**: Most flexible state for problem resolution

---

### 11. CANCELLED

**Description**: Load cancelled by shipper or due to unresolvable issue

**Purpose**: Terminal state for cancelled loads

**Who can set**: SHIPPER, ADMIN, SUPER_ADMIN

**Valid next states**: None (terminal state)

---

### 12. EXPIRED

**Description**: Load expired (no carrier found within time limit)

**Purpose**: Automatic expiration when load cannot be matched

**Who can set**: ADMIN, SUPER_ADMIN (typically set by automation)

**Valid next states**: POSTED (repost), CANCELLED

---

### 13. UNPOSTED

**Description**: Load removed from marketplace by shipper

**Purpose**: Shipper wants to temporarily remove load from marketplace

**Who can set**: SHIPPER, ADMIN, SUPER_ADMIN

**Valid next states**: POSTED (repost), CANCELLED

---

## State Transition Diagram

```
DRAFT
  └─→ POSTED ────┬─→ SEARCHING ──┬─→ OFFERED ──┬─→ ASSIGNED ──┬─→ PICKUP_PENDING ─→ IN_TRANSIT ─→ DELIVERED ─→ COMPLETED
     │           │               │             │              │
     │           │               └─────────────┤              │
     │           │                             │              │
     │           └─────────────────────────────┴──────────────┘
     │
     ├─→ UNPOSTED ──┬─→ (back to POSTED)
     │              └─→ CANCELLED
     │
     ├─→ EXPIRED ────┬─→ (back to POSTED)
     │               └─→ CANCELLED
     │
     └─→ CANCELLED (terminal)

EXCEPTION (can transition from/to most states for problem resolution)
  ├─→ SEARCHING
  ├─→ ASSIGNED
  ├─→ IN_TRANSIT
  ├─→ PICKUP_PENDING
  ├─→ CANCELLED
  └─→ COMPLETED
```

## Role Permissions

### SHIPPER

Can only manage draft and posting lifecycle:

- DRAFT - Create new loads
- POSTED - Post loads to marketplace
- UNPOSTED - Remove loads from marketplace
- CANCELLED - Cancel their own loads

**Restriction**: Cannot modify loads once assigned to carrier

---

### CARRIER

Can only update assigned loads during transport:

- ASSIGNED - Accept offered loads
- PICKUP_PENDING - Mark as ready for pickup
- IN_TRANSIT - Mark as picked up and in transit
- DELIVERED - Mark as delivered

**Restriction**: Cannot modify loads before assignment or after delivery

---

### DISPATCHER

Can manage the matching and assignment process:

- SEARCHING - Initiate carrier search
- OFFERED - Offer load to specific carrier
- ASSIGNED - Assign load to carrier
- PICKUP_PENDING - Manage pickup status
- EXCEPTION - Handle exceptions

**Restriction**: Cannot mark as DELIVERED or COMPLETED (carrier's responsibility)

---

### ADMIN / SUPER_ADMIN

Can set any status for exception handling and platform management:

- All 13 states available
- Used for resolving edge cases
- Manual intervention capabilities

---

## Example Workflows

### Happy Path: Shipper → Carrier → Delivery

```
1. Shipper creates load
   DRAFT

2. Shipper posts load to marketplace
   DRAFT → POSTED

3. Dispatcher searches for carrier
   POSTED → SEARCHING

4. Dispatcher offers to carrier
   SEARCHING → OFFERED

5. Carrier accepts load
   OFFERED → ASSIGNED

6. Carrier marks ready for pickup
   ASSIGNED → PICKUP_PENDING

7. Carrier picks up load
   PICKUP_PENDING → IN_TRANSIT

8. Carrier delivers load
   IN_TRANSIT → DELIVERED

9. POD uploaded, payment processed
   DELIVERED → COMPLETED
```

### Carrier Rejection Flow

```
1. Load offered to carrier
   OFFERED

2. Carrier rejects offer
   OFFERED → SEARCHING

3. Dispatcher finds new carrier
   SEARCHING → OFFERED

4. New carrier accepts
   OFFERED → ASSIGNED
```

### Exception Handling Flow

```
1. Load in transit
   IN_TRANSIT

2. Issue detected (e.g., truck breakdown)
   IN_TRANSIT → EXCEPTION

3. Dispatcher resolves by reassigning
   EXCEPTION → SEARCHING → OFFERED → ASSIGNED → IN_TRANSIT
```

### Shipper Cancellation Flow

```
1. Load posted but not yet assigned
   POSTED

2. Shipper cancels load
   POSTED → CANCELLED (terminal)
```

### Load Expiration Flow

```
1. Load posted to marketplace
   POSTED

2. No carrier found within time limit (automated)
   POSTED → EXPIRED

3. Shipper reposts load
   EXPIRED → POSTED
```

### Shipper Unpost/Repost Flow

```
1. Load posted to marketplace
   POSTED

2. Shipper temporarily removes from marketplace
   POSTED → UNPOSTED

3. Shipper reposts load later
   UNPOSTED → POSTED
```

---

## API Endpoints

### Update Load Status

```http
PATCH /api/loads/[id]/status
Content-Type: application/json

{
  "status": "IN_TRANSIT",
  "reason": "Load picked up from warehouse",
  "notes": "Driver confirmed pickup at 10:30 AM"
}
```

**Response**:

```json
{
  "message": "Load status updated to IN_TRANSIT",
  "description": "Load picked up, in transit to destination",
  "load": {
    "id": "load_123",
    "status": "IN_TRANSIT",
    "updatedAt": "2026-01-02T15:30:00Z"
  }
}
```

**Error Response** (invalid transition):

```json
{
  "error": "Invalid transition: DELIVERED → DRAFT. Valid transitions: COMPLETED, EXCEPTION"
}
```

**Error Response** (permission denied):

```json
{
  "error": "Role CARRIER cannot set status to POSTED"
}
```

---

### Get Load Status and Valid Next States

```http
GET /api/loads/[id]/status
```

**Response**:

```json
{
  "currentStatus": "ASSIGNED",
  "description": "Carrier accepted, load assigned",
  "validNextStates": ["PICKUP_PENDING", "IN_TRANSIT", "EXCEPTION", "CANCELLED"]
}
```

---

## Validation Rules

### State Transition Validation

1. **Transition must be in VALID_TRANSITIONS map** - Cannot jump to arbitrary states
2. **Role must have permission for target state** - Role-based access control
3. **Ownership verification** - Shippers can only update their loads, carriers can only update assigned loads

### Example Validation Logic

```typescript
// 1. Check if transition is valid
if (!isValidTransition(currentStatus, newStatus)) {
  return { error: "Invalid transition" };
}

// 2. Check if role can set this status
if (!canRoleSetStatus(userRole, newStatus)) {
  return { error: "Role cannot set this status" };
}

// 3. Check ownership (if not admin/dispatcher)
if (role === "SHIPPER" && load.shipperId !== userId) {
  return { error: "Not authorized" };
}
```

---

## Future Enhancements

### Planned Features (TODOs in code)

1. **LoadStatusHistory model** - Audit trail for all status changes
2. **Automated notifications** - Notify relevant parties on status change
3. **Automation rules** - Trigger workflows based on status (e.g., auto-create invoice on DELIVERED)
4. **Timeout enforcement** - Automatically transition to EXPIRED if no carrier found
5. **Escalation rules** - Auto-escalate to EXCEPTION on certain conditions

### Integration Points

- **Wallet System** (Sprint 8): Hold/release funds based on load status
- **Exception System** (Sprint 5): Auto-generate exceptions on certain transitions
- **Automation Engine** (Sprint 7): Trigger rules on status changes
- **Notifications** (Future): SMS/Email on critical status changes
- **Analytics** (Sprint 9): Track status transition patterns

---

## Implementation Files

- `prisma/schema.prisma` - LoadStatus enum definition
- `lib/loadStateMachine.ts` - State machine logic and validation
- `app/api/loads/[id]/status/route.ts` - API endpoints for status management

---

## Testing Checklist

- [ ] Test all valid transitions for each state
- [ ] Test invalid transitions are rejected
- [ ] Test role permissions are enforced
- [ ] Test ownership verification works
- [ ] Test shipper can only update their own loads
- [ ] Test carrier can only update assigned loads
- [ ] Test admin can update any load
- [ ] Test error messages are descriptive
- [ ] Test GET endpoint returns correct valid next states
- [ ] Test logging captures all status changes
- [ ] Test concurrent updates don't cause race conditions

---

**Last Updated**: Sprint 3 - Load Lifecycle State Machine
**Status**: Implementation Complete, Testing Pending
