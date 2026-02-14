# 04 - Load Management & State Machine (LOAD-xxx)

> **Total Tests:** 52
> **Priority Breakdown:** P0: 10 | P1: 20 | P2: 16 | P3: 6
> **API Endpoints:** `/api/loads/*`
> **Source Files:** `lib/loadStateMachine.ts`, `app/api/loads/*/route.ts`

---

## State Machine Reference

**13 States:** DRAFT, POSTED, SEARCHING, OFFERED, ASSIGNED, PICKUP_PENDING, IN_TRANSIT, DELIVERED, COMPLETED, EXCEPTION, CANCELLED, EXPIRED, UNPOSTED

**Valid Transitions (from `lib/loadStateMachine.ts`):**

| From           | To (valid)                                                            |
| -------------- | --------------------------------------------------------------------- |
| DRAFT          | POSTED, CANCELLED                                                     |
| POSTED         | SEARCHING, OFFERED, ASSIGNED, UNPOSTED, CANCELLED, EXPIRED            |
| SEARCHING      | OFFERED, ASSIGNED, EXCEPTION, CANCELLED, EXPIRED                      |
| OFFERED        | ASSIGNED, SEARCHING, EXCEPTION, CANCELLED, EXPIRED                    |
| ASSIGNED       | PICKUP_PENDING, IN_TRANSIT, EXCEPTION, CANCELLED                      |
| PICKUP_PENDING | IN_TRANSIT, EXCEPTION, CANCELLED                                      |
| IN_TRANSIT     | DELIVERED, EXCEPTION                                                  |
| DELIVERED      | COMPLETED, EXCEPTION                                                  |
| COMPLETED      | EXCEPTION                                                             |
| EXCEPTION      | SEARCHING, ASSIGNED, IN_TRANSIT, PICKUP_PENDING, CANCELLED, COMPLETED |
| CANCELLED      | _(terminal)_                                                          |
| EXPIRED        | POSTED, CANCELLED                                                     |
| UNPOSTED       | POSTED, CANCELLED                                                     |

> **Business rule:** IN_TRANSIT loads cannot be directly cancelled. Must go through EXCEPTION first.

**Role Permissions for Status Changes:**

- **SHIPPER:** DRAFT, POSTED, CANCELLED, UNPOSTED
- **CARRIER:** ASSIGNED, PICKUP_PENDING, IN_TRANSIT, DELIVERED
- **DISPATCHER:** SEARCHING, OFFERED, ASSIGNED, PICKUP_PENDING, EXCEPTION
- **ADMIN/SUPER_ADMIN:** All statuses

---

## A. Load CRUD (LOAD-001 to LOAD-010)

### LOAD-001: Create load (DRAFT)

| Field               | Value                                                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                                                                          |
| **Preconditions**   | Logged in as shipper with verified org                                                                                                                      |
| **Steps**           | 1. `POST /api/loads` with `{ pickupCityId, deliveryCityId, pickupDate, deliveryDate, truckType: "FLATBED", weight: 5000, cargoDescription: "Steel beams" }` |
| **Expected Result** | 201 Created. Load in `DRAFT` status. `shipperId` = caller's org. `createdById` = caller.                                                                    |
| **Status**          |                                                                                                                                                             |
| **Actual Result**   |                                                                                                                                                             |

### LOAD-002: Post load (DRAFT -> POSTED)

| Field               | Value                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                            |
| **Preconditions**   | DRAFT load exists, created by this shipper                                                                    |
| **Steps**           | 1. `PUT /api/loads/{id}/status` with `{ status: "POSTED" }`                                                   |
| **Expected Result** | 200 OK. Status → POSTED. `postedAt` set. Corridor auto-assigned if route matches. LoadEvent `POSTED` created. |
| **Status**          |                                                                                                               |
| **Actual Result**   |                                                                                                               |

### LOAD-003: View load details

| Field               | Value                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                          |
| **Preconditions**   | Load exists                                                                                                 |
| **Steps**           | 1. `GET /api/loads/{id}`                                                                                    |
| **Expected Result** | 200 OK. Full load details including locations, status, assigned truck (if any), corridor, service fee info. |
| **Status**          |                                                                                                             |
| **Actual Result**   |                                                                                                             |

### LOAD-004: List loads with filters

| Field               | Value                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| **Priority**        | P1                                                                      |
| **Preconditions**   | Multiple loads exist                                                    |
| **Steps**           | 1. `GET /api/loads?status=POSTED&truckType=FLATBED&pickupCityId={id}`   |
| **Expected Result** | 200 OK. Paginated list filtered by status, truck type, and pickup city. |
| **Status**          |                                                                         |
| **Actual Result**   |                                                                         |

### LOAD-005: Edit load in DRAFT status

| Field               | Value                                                              |
| ------------------- | ------------------------------------------------------------------ |
| **Priority**        | P1                                                                 |
| **Preconditions**   | DRAFT load, logged in as creating shipper                          |
| **Steps**           | 1. `PUT /api/loads/{id}` with updated `weight`, `cargoDescription` |
| **Expected Result** | 200 OK. Fields updated. LoadEvent `EDITED` created.                |
| **Status**          |                                                                    |
| **Actual Result**   |                                                                    |

### LOAD-006: Edit load in POSTED status

| Field               | Value                                                       |
| ------------------- | ----------------------------------------------------------- |
| **Priority**        | P1                                                          |
| **Preconditions**   | POSTED load                                                 |
| **Steps**           | 1. `PUT /api/loads/{id}` with updated fields                |
| **Expected Result** | 200 OK or restricted to certain fields. LoadEvent recorded. |
| **Status**          |                                                             |
| **Actual Result**   |                                                             |

### LOAD-007: Delete load in DRAFT

| Field               | Value                                                                               |
| ------------------- | ----------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                  |
| **Preconditions**   | DRAFT load, own load                                                                |
| **Steps**           | 1. `DELETE /api/loads/{id}`                                                         |
| **Expected Result** | 200 OK. Load deleted (or soft-deleted). Related proposals/requests cascade-deleted. |
| **Status**          |                                                                                     |
| **Actual Result**   |                                                                                     |

### LOAD-008: Cannot delete assigned load

| Field               | Value                                               |
| ------------------- | --------------------------------------------------- |
| **Priority**        | P1                                                  |
| **Preconditions**   | Load in ASSIGNED status                             |
| **Steps**           | 1. `DELETE /api/loads/{id}`                         |
| **Expected Result** | 400/403. Cannot delete load that has been assigned. |
| **Status**          |                                                     |
| **Actual Result**   |                                                     |

### LOAD-009: Duplicate load

| Field               | Value                                                                            |
| ------------------- | -------------------------------------------------------------------------------- |
| **Priority**        | P2                                                                               |
| **Preconditions**   | Existing load                                                                    |
| **Steps**           | 1. `POST /api/loads/{id}/duplicate`                                              |
| **Expected Result** | 201 Created. New DRAFT load with same details (new ID, no assignment, no truck). |
| **Status**          |                                                                                  |
| **Actual Result**   |                                                                                  |

### LOAD-010: Unpost load (POSTED -> UNPOSTED)

| Field               | Value                                                                      |
| ------------------- | -------------------------------------------------------------------------- |
| **Priority**        | P1                                                                         |
| **Preconditions**   | POSTED load, shipper role                                                  |
| **Steps**           | 1. `PUT /api/loads/{id}/status` with `{ status: "UNPOSTED" }`              |
| **Expected Result** | 200 OK. Status → UNPOSTED. Load no longer visible in marketplace searches. |
| **Status**          |                                                                            |
| **Actual Result**   |                                                                            |

---

## B. Valid State Transitions (LOAD-011 to LOAD-024)

### LOAD-011: POSTED -> SEARCHING

| Field               | Value                                                                        |
| ------------------- | ---------------------------------------------------------------------------- |
| **Priority**        | P1                                                                           |
| **Preconditions**   | POSTED load, dispatcher role                                                 |
| **Steps**           | 1. `PUT /api/loads/{id}/status` with `{ status: "SEARCHING" }` as dispatcher |
| **Expected Result** | 200 OK. Status → SEARCHING.                                                  |
| **Status**          |                                                                              |
| **Actual Result**   |                                                                              |

### LOAD-012: POSTED -> OFFERED

| Field               | Value                                                        |
| ------------------- | ------------------------------------------------------------ |
| **Priority**        | P1                                                           |
| **Preconditions**   | POSTED load, dispatcher role                                 |
| **Steps**           | 1. `PUT /api/loads/{id}/status` with `{ status: "OFFERED" }` |
| **Expected Result** | 200 OK. Status → OFFERED.                                    |
| **Status**          |                                                              |
| **Actual Result**   |                                                              |

### LOAD-013: OFFERED -> ASSIGNED

| Field               | Value                                                                             |
| ------------------- | --------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                |
| **Preconditions**   | OFFERED load, carrier role                                                        |
| **Steps**           | 1. `PUT /api/loads/{id}/assign` with `{ truckId }`                                |
| **Expected Result** | 200 OK. Status → ASSIGNED. `assignedTruckId` set. `assignedAt` set. Trip created. |
| **Status**          |                                                                                   |
| **Actual Result**   |                                                                                   |

### LOAD-014: OFFERED -> SEARCHING (rejection)

| Field               | Value                                                   |
| ------------------- | ------------------------------------------------------- |
| **Priority**        | P1                                                      |
| **Preconditions**   | OFFERED load                                            |
| **Steps**           | 1. Carrier rejects offer, status goes back to SEARCHING |
| **Expected Result** | 200 OK. Status → SEARCHING. Available for re-matching.  |
| **Status**          |                                                         |
| **Actual Result**   |                                                         |

### LOAD-015: ASSIGNED -> PICKUP_PENDING

| Field               | Value                                                                          |
| ------------------- | ------------------------------------------------------------------------------ |
| **Priority**        | P0                                                                             |
| **Preconditions**   | ASSIGNED load, carrier role                                                    |
| **Steps**           | 1. `PUT /api/loads/{id}/status` with `{ status: "PICKUP_PENDING" }` as carrier |
| **Expected Result** | 200 OK. Status → PICKUP_PENDING. Trip status also updated.                     |
| **Status**          |                                                                                |
| **Actual Result**   |                                                                                |

### LOAD-016: PICKUP_PENDING -> IN_TRANSIT

| Field               | Value                                                           |
| ------------------- | --------------------------------------------------------------- |
| **Priority**        | P0                                                              |
| **Preconditions**   | PICKUP_PENDING load, carrier role                               |
| **Steps**           | 1. `PUT /api/loads/{id}/status` with `{ status: "IN_TRANSIT" }` |
| **Expected Result** | 200 OK. Status → IN_TRANSIT. GPS tracking should be active.     |
| **Status**          |                                                                 |
| **Actual Result**   |                                                                 |

### LOAD-017: IN_TRANSIT -> DELIVERED

| Field               | Value                                                          |
| ------------------- | -------------------------------------------------------------- |
| **Priority**        | P0                                                             |
| **Preconditions**   | IN_TRANSIT load, carrier role                                  |
| **Steps**           | 1. `PUT /api/loads/{id}/status` with `{ status: "DELIVERED" }` |
| **Expected Result** | 200 OK. Status → DELIVERED. Ready for POD upload.              |
| **Status**          |                                                                |
| **Actual Result**   |                                                                |

### LOAD-018: DELIVERED -> COMPLETED

| Field               | Value                                                                |
| ------------------- | -------------------------------------------------------------------- |
| **Priority**        | P0                                                                   |
| **Preconditions**   | DELIVERED load, POD uploaded                                         |
| **Steps**           | 1. `PUT /api/loads/{id}/status` with `{ status: "COMPLETED" }`       |
| **Expected Result** | 200 OK. Status → COMPLETED. Service fees deducted from both wallets. |
| **Status**          |                                                                      |
| **Actual Result**   |                                                                      |

### LOAD-019: Any active -> EXCEPTION

| Field               | Value                                                                        |
| ------------------- | ---------------------------------------------------------------------------- |
| **Priority**        | P1                                                                           |
| **Preconditions**   | Load in IN_TRANSIT status                                                    |
| **Steps**           | 1. `PUT /api/loads/{id}/status` with `{ status: "EXCEPTION" }` as dispatcher |
| **Expected Result** | 200 OK. Status → EXCEPTION. Escalation can be created.                       |
| **Status**          |                                                                              |
| **Actual Result**   |                                                                              |

### LOAD-020: EXCEPTION -> SEARCHING (resolved, reassign)

| Field               | Value                                                          |
| ------------------- | -------------------------------------------------------------- |
| **Priority**        | P1                                                             |
| **Preconditions**   | Load in EXCEPTION status, admin role                           |
| **Steps**           | 1. `PUT /api/loads/{id}/status` with `{ status: "SEARCHING" }` |
| **Expected Result** | 200 OK. Status → SEARCHING. Load available for re-matching.    |
| **Status**          |                                                                |
| **Actual Result**   |                                                                |

### LOAD-021: EXCEPTION -> CANCELLED

| Field               | Value                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| **Priority**        | P1                                                                      |
| **Preconditions**   | Load in EXCEPTION, admin role                                           |
| **Steps**           | 1. `PUT /api/loads/{id}/status` with `{ status: "CANCELLED" }`          |
| **Expected Result** | 200 OK. Status → CANCELLED. Service fee refund triggered if applicable. |
| **Status**          |                                                                         |
| **Actual Result**   |                                                                         |

### LOAD-022: EXPIRED -> POSTED (repost)

| Field               | Value                                                       |
| ------------------- | ----------------------------------------------------------- |
| **Priority**        | P1                                                          |
| **Preconditions**   | EXPIRED load, shipper role                                  |
| **Steps**           | 1. `PUT /api/loads/{id}/status` with `{ status: "POSTED" }` |
| **Expected Result** | 200 OK. Status → POSTED. Load re-enters marketplace.        |
| **Status**          |                                                             |
| **Actual Result**   |                                                             |

### LOAD-023: UNPOSTED -> POSTED (repost)

| Field               | Value                                                       |
| ------------------- | ----------------------------------------------------------- |
| **Priority**        | P1                                                          |
| **Preconditions**   | UNPOSTED load, shipper role                                 |
| **Steps**           | 1. `PUT /api/loads/{id}/status` with `{ status: "POSTED" }` |
| **Expected Result** | 200 OK. Status → POSTED.                                    |
| **Status**          |                                                             |
| **Actual Result**   |                                                             |

### LOAD-024: Shipper cancels DRAFT/POSTED load

| Field               | Value                                                          |
| ------------------- | -------------------------------------------------------------- |
| **Priority**        | P0                                                             |
| **Preconditions**   | DRAFT or POSTED load, shipper role                             |
| **Steps**           | 1. `PUT /api/loads/{id}/status` with `{ status: "CANCELLED" }` |
| **Expected Result** | 200 OK. Status → CANCELLED (terminal).                         |
| **Status**          |                                                                |
| **Actual Result**   |                                                                |

---

## C. Invalid State Transitions (LOAD-025 to LOAD-036)

### LOAD-025: DRAFT -> IN_TRANSIT (invalid)

| Field               | Value                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| **Priority**        | P1                                                                                               |
| **Preconditions**   | DRAFT load                                                                                       |
| **Steps**           | 1. `PUT /api/loads/{id}/status` with `{ status: "IN_TRANSIT" }`                                  |
| **Expected Result** | 400 Bad Request. `Invalid transition: DRAFT -> IN_TRANSIT. Valid transitions: POSTED, CANCELLED` |
| **Status**          |                                                                                                  |
| **Actual Result**   |                                                                                                  |

### LOAD-026: IN_TRANSIT -> CANCELLED (invalid)

| Field               | Value                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                                  |
| **Preconditions**   | IN_TRANSIT load                                                                                                     |
| **Steps**           | 1. `PUT /api/loads/{id}/status` with `{ status: "CANCELLED" }`                                                      |
| **Expected Result** | 400 Bad Request. Must go through EXCEPTION first. Business decision: cargo in transit cannot be cancelled directly. |
| **Status**          |                                                                                                                     |
| **Actual Result**   |                                                                                                                     |

### LOAD-027: CANCELLED -> POSTED (invalid, terminal)

| Field               | Value                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| **Priority**        | P1                                                                    |
| **Preconditions**   | CANCELLED load                                                        |
| **Steps**           | 1. `PUT /api/loads/{id}/status` with `{ status: "POSTED" }`           |
| **Expected Result** | 400 Bad Request. CANCELLED is terminal state, no transitions allowed. |
| **Status**          |                                                                       |
| **Actual Result**   |                                                                       |

### LOAD-028: COMPLETED -> POSTED (invalid)

| Field               | Value                                                               |
| ------------------- | ------------------------------------------------------------------- |
| **Priority**        | P1                                                                  |
| **Preconditions**   | COMPLETED load                                                      |
| **Steps**           | 1. `PUT /api/loads/{id}/status` with `{ status: "POSTED" }`         |
| **Expected Result** | 400 Bad Request. Only valid transition from COMPLETED is EXCEPTION. |
| **Status**          |                                                                     |
| **Actual Result**   |                                                                     |

### LOAD-029: DELIVERED -> IN_TRANSIT (invalid)

| Field               | Value                                |
| ------------------- | ------------------------------------ |
| **Priority**        | P2                                   |
| **Preconditions**   | DELIVERED load                       |
| **Steps**           | 1. Attempt to go back to IN_TRANSIT  |
| **Expected Result** | 400 Bad Request. Invalid transition. |
| **Status**          |                                      |
| **Actual Result**   |                                      |

### LOAD-030: DRAFT -> COMPLETED (invalid)

| Field               | Value                         |
| ------------------- | ----------------------------- |
| **Priority**        | P2                            |
| **Preconditions**   | DRAFT load                    |
| **Steps**           | 1. Attempt DRAFT -> COMPLETED |
| **Expected Result** | 400 Bad Request.              |
| **Status**          |                               |
| **Actual Result**   |                               |

### LOAD-031: POSTED -> COMPLETED (invalid)

| Field               | Value                                   |
| ------------------- | --------------------------------------- |
| **Priority**        | P2                                      |
| **Preconditions**   | POSTED load                             |
| **Steps**           | 1. Attempt POSTED -> COMPLETED          |
| **Expected Result** | 400 Bad Request. Must follow lifecycle. |
| **Status**          |                                         |
| **Actual Result**   |                                         |

### LOAD-032: SEARCHING -> COMPLETED (invalid)

| Field               | Value                             |
| ------------------- | --------------------------------- |
| **Priority**        | P2                                |
| **Preconditions**   | SEARCHING load                    |
| **Steps**           | 1. Attempt SEARCHING -> COMPLETED |
| **Expected Result** | 400 Bad Request.                  |
| **Status**          |                                   |
| **Actual Result**   |                                   |

### LOAD-033: IN_TRANSIT -> ASSIGNED (invalid)

| Field               | Value                             |
| ------------------- | --------------------------------- |
| **Priority**        | P2                                |
| **Preconditions**   | IN_TRANSIT load                   |
| **Steps**           | 1. Attempt IN_TRANSIT -> ASSIGNED |
| **Expected Result** | 400 Bad Request.                  |
| **Status**          |                                   |
| **Actual Result**   |                                   |

### LOAD-034: PICKUP_PENDING -> POSTED (invalid)

| Field               | Value                           |
| ------------------- | ------------------------------- |
| **Priority**        | P2                              |
| **Preconditions**   | PICKUP_PENDING load             |
| **Steps**           | 1. Attempt to go back to POSTED |
| **Expected Result** | 400 Bad Request.                |
| **Status**          |                                 |
| **Actual Result**   |                                 |

### LOAD-035: ASSIGNED -> DELIVERED (invalid, skip)

| Field               | Value                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| **Priority**        | P2                                                                        |
| **Preconditions**   | ASSIGNED load                                                             |
| **Steps**           | 1. Attempt ASSIGNED -> DELIVERED (skipping PICKUP_PENDING and IN_TRANSIT) |
| **Expected Result** | 400 Bad Request. Cannot skip lifecycle stages.                            |
| **Status**          |                                                                           |
| **Actual Result**   |                                                                           |

### LOAD-036: EXPIRED -> IN_TRANSIT (invalid)

| Field               | Value                                                    |
| ------------------- | -------------------------------------------------------- |
| **Priority**        | P3                                                       |
| **Preconditions**   | EXPIRED load                                             |
| **Steps**           | 1. Attempt EXPIRED -> IN_TRANSIT                         |
| **Expected Result** | 400 Bad Request. From EXPIRED, only POSTED or CANCELLED. |
| **Status**          |                                                          |
| **Actual Result**   |                                                          |

---

## D. Role-Based Status Permissions (LOAD-037 to LOAD-044)

### LOAD-037: Carrier cannot POST load

| Field               | Value                                                                  |
| ------------------- | ---------------------------------------------------------------------- |
| **Priority**        | P1                                                                     |
| **Preconditions**   | DRAFT load, logged in as carrier                                       |
| **Steps**           | 1. `PUT /api/loads/{id}/status` with `{ status: "POSTED" }` as carrier |
| **Expected Result** | 403 Forbidden. `Role CARRIER cannot set status to POSTED`.             |
| **Status**          |                                                                        |
| **Actual Result**   |                                                                        |

### LOAD-038: Shipper cannot set IN_TRANSIT

| Field               | Value                                                     |
| ------------------- | --------------------------------------------------------- |
| **Priority**        | P1                                                        |
| **Preconditions**   | PICKUP_PENDING load, logged in as shipper                 |
| **Steps**           | 1. Attempt to set IN_TRANSIT as shipper                   |
| **Expected Result** | 403. Shipper cannot set IN_TRANSIT (carrier-only action). |
| **Status**          |                                                           |
| **Actual Result**   |                                                           |

### LOAD-039: Dispatcher cannot set DELIVERED

| Field               | Value                                     |
| ------------------- | ----------------------------------------- |
| **Priority**        | P1                                        |
| **Preconditions**   | IN_TRANSIT load, logged in as dispatcher  |
| **Steps**           | 1. Attempt to set DELIVERED as dispatcher |
| **Expected Result** | 403. Only carrier can mark as delivered.  |
| **Status**          |                                           |
| **Actual Result**   |                                           |

### LOAD-040: Admin can set any status

| Field               | Value                                                               |
| ------------------- | ------------------------------------------------------------------- |
| **Priority**        | P1                                                                  |
| **Preconditions**   | Any load, logged in as admin                                        |
| **Steps**           | 1. Set various statuses as admin (e.g., EXCEPTION -> COMPLETED)     |
| **Expected Result** | 200 OK for all valid transitions. Admin bypasses role restrictions. |
| **Status**          |                                                                     |
| **Actual Result**   |                                                                     |

### LOAD-041: Carrier cannot cancel ASSIGNED load

| Field               | Value                                 |
| ------------------- | ------------------------------------- |
| **Priority**        | P2                                    |
| **Preconditions**   | ASSIGNED load, logged in as carrier   |
| **Steps**           | 1. Attempt CANCELLED as carrier       |
| **Expected Result** | 403. CANCELLED is shipper/admin-only. |
| **Status**          |                                       |
| **Actual Result**   |                                       |

### LOAD-042: Shipper cannot create EXCEPTION

| Field               | Value                                    |
| ------------------- | ---------------------------------------- |
| **Priority**        | P2                                       |
| **Preconditions**   | IN_TRANSIT load, logged in as shipper    |
| **Steps**           | 1. Attempt EXCEPTION as shipper          |
| **Expected Result** | 403. EXCEPTION is dispatcher/admin-only. |
| **Status**          |                                          |
| **Actual Result**   |                                          |

### LOAD-043: Dispatcher can set EXCEPTION

| Field               | Value                                                          |
| ------------------- | -------------------------------------------------------------- |
| **Priority**        | P1                                                             |
| **Preconditions**   | IN_TRANSIT load, logged in as dispatcher                       |
| **Steps**           | 1. `PUT /api/loads/{id}/status` with `{ status: "EXCEPTION" }` |
| **Expected Result** | 200 OK. Dispatcher allowed to flag exceptions.                 |
| **Status**          |                                                                |
| **Actual Result**   |                                                                |

### LOAD-044: Dispatcher can set PICKUP_PENDING

| Field               | Value                                             |
| ------------------- | ------------------------------------------------- |
| **Priority**        | P2                                                |
| **Preconditions**   | ASSIGNED load, dispatcher role                    |
| **Steps**           | 1. Set PICKUP_PENDING as dispatcher               |
| **Expected Result** | 200 OK. Dispatcher has PICKUP_PENDING permission. |
| **Status**          |                                                   |
| **Actual Result**   |                                                   |

---

## E. Load Features (LOAD-045 to LOAD-052)

### LOAD-045: View matching trucks for load

| Field               | Value                                                                         |
| ------------------- | ----------------------------------------------------------------------------- |
| **Priority**        | P1                                                                            |
| **Preconditions**   | POSTED load exists, trucks posted in same area                                |
| **Steps**           | 1. `GET /api/loads/{id}/matching-trucks`                                      |
| **Expected Result** | 200 OK. List of trucks with match scores, distance, truck type compatibility. |
| **Status**          |                                                                               |
| **Actual Result**   |                                                                               |

### LOAD-046: View load service fee

| Field               | Value                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                      |
| **Preconditions**   | Load with corridor assigned                                                             |
| **Steps**           | 1. `GET /api/loads/{id}/service-fee`                                                    |
| **Expected Result** | 200 OK. Returns `shipperFee`, `carrierFee`, `corridorName`, `distanceKm`, `pricePerKm`. |
| **Status**          |                                                                                         |
| **Actual Result**   |                                                                                         |

### LOAD-047: View load GPS history

| Field               | Value                                           |
| ------------------- | ----------------------------------------------- |
| **Priority**        | P2                                              |
| **Preconditions**   | Load has been IN_TRANSIT with GPS data          |
| **Steps**           | 1. `GET /api/loads/{id}/gps-history`            |
| **Expected Result** | 200 OK. Array of GPS positions with timestamps. |
| **Status**          |                                                 |
| **Actual Result**   |                                                 |

### LOAD-048: View load live position

| Field               | Value                                                      |
| ------------------- | ---------------------------------------------------------- |
| **Priority**        | P1                                                         |
| **Preconditions**   | Load is IN_TRANSIT                                         |
| **Steps**           | 1. `GET /api/loads/{id}/live-position`                     |
| **Expected Result** | 200 OK. Current lat/lng, speed, heading, last update time. |
| **Status**          |                                                            |
| **Actual Result**   |                                                            |

### LOAD-049: Load escalation creation

| Field               | Value                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                                                           |
| **Preconditions**   | Active load, dispatcher role                                                                                                 |
| **Steps**           | 1. `POST /api/loads/{id}/escalations` with `{ escalationType: "LATE_PICKUP", priority: "HIGH", title: "Carrier 2hrs late" }` |
| **Expected Result** | 201 Created. LoadEscalation with `status: OPEN`.                                                                             |
| **Status**          |                                                                                                                              |
| **Actual Result**   |                                                                                                                              |

### LOAD-050: Load reference pricing

| Field               | Value                                          |
| ------------------- | ---------------------------------------------- |
| **Priority**        | P3                                             |
| **Preconditions**   | Load with corridor                             |
| **Steps**           | 1. `GET /api/loads/{id}/reference-pricing`     |
| **Expected Result** | 200 OK. Corridor-based pricing reference data. |
| **Status**          |                                                |
| **Actual Result**   |                                                |

### LOAD-051: Report platform bypass

| Field               | Value                                                                         |
| ------------------- | ----------------------------------------------------------------------------- |
| **Priority**        | P2                                                                            |
| **Preconditions**   | Assigned load, contact info viewed                                            |
| **Steps**           | 1. `POST /api/loads/{id}/report-bypass`                                       |
| **Expected Result** | 200 OK. `bypassReported: true` on load. Org `bypassAttemptCount` incremented. |
| **Status**          |                                                                               |
| **Actual Result**   |                                                                               |

### LOAD-052: Next loads suggestion (return loads)

| Field               | Value                                                                       |
| ------------------- | --------------------------------------------------------------------------- |
| **Priority**        | P3                                                                          |
| **Preconditions**   | Load near delivery destination                                              |
| **Steps**           | 1. `GET /api/loads/{id}/next-loads`                                         |
| **Expected Result** | 200 OK. Suggested loads near current delivery destination for return trips. |
| **Status**          |                                                                             |
| **Actual Result**   |                                                                             |
