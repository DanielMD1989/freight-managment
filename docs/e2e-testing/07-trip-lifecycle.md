# 07 - Trip Lifecycle & State Machine (TRIP-xxx)

> **Total Tests:** 28
> **Priority Breakdown:** P0: 6 | P1: 12 | P2: 8 | P3: 2
> **API Endpoints:** `/api/trips/*`
> **Source Files:** `lib/tripStateMachine.ts`, `app/api/trips/*/route.ts`

---

## State Machine Reference

**6 States:** ASSIGNED, PICKUP_PENDING, IN_TRANSIT, DELIVERED, COMPLETED, CANCELLED

**Valid Transitions (from `lib/tripStateMachine.ts`):**

| From           | To (valid)                |
| -------------- | ------------------------- |
| ASSIGNED       | PICKUP_PENDING, CANCELLED |
| PICKUP_PENDING | IN_TRANSIT, CANCELLED     |
| IN_TRANSIT     | DELIVERED, CANCELLED      |
| DELIVERED      | COMPLETED, CANCELLED      |
| COMPLETED      | _(terminal)_              |
| CANCELLED      | _(terminal)_              |

**Role Permissions:**

- **CARRIER:** PICKUP_PENDING, IN_TRANSIT, DELIVERED
- **DISPATCHER:** ASSIGNED, CANCELLED
- **ADMIN/SUPER_ADMIN:** All statuses

---

## A. Trip Creation (TRIP-001 to TRIP-003)

### TRIP-001: Trip auto-created on load assignment

| Field               | Value                                                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                                                      |
| **Preconditions**   | Load gets ASSIGNED status with a truck                                                                                                  |
| **Steps**           | 1. Assign load to truck (via proposal acceptance or direct)                                                                             |
| **Expected Result** | Trip record created with `status: ASSIGNED`, `loadId`, `truckId`, `carrierId`, `shipperId`. Pickup/delivery locations copied from load. |
| **Status**          |                                                                                                                                         |
| **Actual Result**   |                                                                                                                                         |

### TRIP-002: View trip details

| Field               | Value                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                    |
| **Preconditions**   | Trip exists                                                                                           |
| **Steps**           | 1. `GET /api/trips/{tripId}`                                                                          |
| **Expected Result** | 200 OK. Full trip: status, locations, timestamps, tracking info, POD documents, carrier/shipper orgs. |
| **Status**          |                                                                                                       |
| **Actual Result**   |                                                                                                       |

### TRIP-003: List trips with filters

| Field               | Value                                                |
| ------------------- | ---------------------------------------------------- |
| **Priority**        | P1                                                   |
| **Preconditions**   | Multiple trips exist                                 |
| **Steps**           | 1. `GET /api/trips?status=IN_TRANSIT&carrierId={id}` |
| **Expected Result** | 200 OK. Paginated, filtered list of trips.           |
| **Status**          |                                                      |
| **Actual Result**   |                                                      |

---

## B. Valid State Transitions (TRIP-004 to TRIP-009)

### TRIP-004: ASSIGNED -> PICKUP_PENDING

| Field               | Value                                                                       |
| ------------------- | --------------------------------------------------------------------------- |
| **Priority**        | P0                                                                          |
| **Preconditions**   | ASSIGNED trip, carrier role                                                 |
| **Steps**           | 1. `PUT /api/trips/{tripId}` with `{ status: "PICKUP_PENDING" }`            |
| **Expected Result** | 200 OK. Status → PICKUP_PENDING. `startedAt` set. Load status also updated. |
| **Status**          |                                                                             |
| **Actual Result**   |                                                                             |

### TRIP-005: PICKUP_PENDING -> IN_TRANSIT

| Field               | Value                                                                  |
| ------------------- | ---------------------------------------------------------------------- |
| **Priority**        | P0                                                                     |
| **Preconditions**   | PICKUP_PENDING trip, carrier role                                      |
| **Steps**           | 1. `PUT /api/trips/{tripId}` with `{ status: "IN_TRANSIT" }`           |
| **Expected Result** | 200 OK. Status → IN_TRANSIT. `pickedUpAt` set. GPS tracking activates. |
| **Status**          |                                                                        |
| **Actual Result**   |                                                                        |

### TRIP-006: IN_TRANSIT -> DELIVERED

| Field               | Value                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                          |
| **Preconditions**   | IN_TRANSIT trip, carrier role                                                                               |
| **Steps**           | 1. `PUT /api/trips/{tripId}` with `{ status: "DELIVERED", receiverName: "John", receiverPhone: "+251..." }` |
| **Expected Result** | 200 OK. Status → DELIVERED. `deliveredAt` set. Receiver info stored.                                        |
| **Status**          |                                                                                                             |
| **Actual Result**   |                                                                                                             |

### TRIP-007: DELIVERED -> COMPLETED (after POD)

| Field               | Value                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                 |
| **Preconditions**   | DELIVERED trip, POD uploaded                                                                       |
| **Steps**           | 1. Upload POD via `POST /api/trips/{tripId}/pod` 2. Confirm via `POST /api/trips/{tripId}/confirm` |
| **Expected Result** | Status → COMPLETED. `completedAt` set. Service fees deducted. Load also marked COMPLETED.          |
| **Status**          |                                                                                                    |
| **Actual Result**   |                                                                                                    |

### TRIP-008: Cancel trip (various states)

| Field               | Value                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                                               |
| **Preconditions**   | Active trip (ASSIGNED, PICKUP_PENDING, IN_TRANSIT, or DELIVERED)                                                 |
| **Steps**           | 1. `POST /api/trips/{tripId}/cancel` with `{ reason: "..." }`                                                    |
| **Expected Result** | 200 OK. Status → CANCELLED. `cancelledAt`, `cancelledBy`, `cancelReason` set. Load returns to appropriate state. |
| **Status**          |                                                                                                                  |
| **Actual Result**   |                                                                                                                  |

### TRIP-009: Terminal state - completed trip cannot change

| Field               | Value                                                           |
| ------------------- | --------------------------------------------------------------- |
| **Priority**        | P1                                                              |
| **Preconditions**   | COMPLETED trip                                                  |
| **Steps**           | 1. Attempt to set any other status                              |
| **Expected Result** | 400 Bad Request. COMPLETED is terminal, no further transitions. |
| **Status**          |                                                                 |
| **Actual Result**   |                                                                 |

---

## C. Invalid State Transitions (TRIP-010 to TRIP-015)

### TRIP-010: ASSIGNED -> IN_TRANSIT (skip PICKUP_PENDING)

| Field               | Value                                                  |
| ------------------- | ------------------------------------------------------ |
| **Priority**        | P1                                                     |
| **Preconditions**   | ASSIGNED trip                                          |
| **Steps**           | 1. Attempt ASSIGNED -> IN_TRANSIT                      |
| **Expected Result** | 400 Bad Request. Must go through PICKUP_PENDING first. |
| **Status**          |                                                        |
| **Actual Result**   |                                                        |

### TRIP-011: ASSIGNED -> DELIVERED (invalid)

| Field               | Value                            |
| ------------------- | -------------------------------- |
| **Priority**        | P1                               |
| **Preconditions**   | ASSIGNED trip                    |
| **Steps**           | 1. Attempt ASSIGNED -> DELIVERED |
| **Expected Result** | 400 Bad Request.                 |
| **Status**          |                                  |
| **Actual Result**   |                                  |

### TRIP-012: PICKUP_PENDING -> DELIVERED (invalid)

| Field               | Value                                        |
| ------------------- | -------------------------------------------- |
| **Priority**        | P1                                           |
| **Preconditions**   | PICKUP_PENDING trip                          |
| **Steps**           | 1. Attempt to skip to DELIVERED              |
| **Expected Result** | 400 Bad Request. Must go through IN_TRANSIT. |
| **Status**          |                                              |
| **Actual Result**   |                                              |

### TRIP-013: IN_TRANSIT -> COMPLETED (skip DELIVERED)

| Field               | Value                                                     |
| ------------------- | --------------------------------------------------------- |
| **Priority**        | P1                                                        |
| **Preconditions**   | IN_TRANSIT trip                                           |
| **Steps**           | 1. Attempt IN_TRANSIT -> COMPLETED                        |
| **Expected Result** | 400 Bad Request. Must be DELIVERED first, then COMPLETED. |
| **Status**          |                                                           |
| **Actual Result**   |                                                           |

### TRIP-014: CANCELLED -> any state (invalid)

| Field               | Value                                   |
| ------------------- | --------------------------------------- |
| **Priority**        | P1                                      |
| **Preconditions**   | CANCELLED trip                          |
| **Steps**           | 1. Attempt CANCELLED -> ASSIGNED        |
| **Expected Result** | 400 Bad Request. CANCELLED is terminal. |
| **Status**          |                                         |
| **Actual Result**   |                                         |

### TRIP-015: DELIVERED -> IN_TRANSIT (backward invalid)

| Field               | Value                               |
| ------------------- | ----------------------------------- |
| **Priority**        | P2                                  |
| **Preconditions**   | DELIVERED trip                      |
| **Steps**           | 1. Attempt to go back to IN_TRANSIT |
| **Expected Result** | 400 Bad Request.                    |
| **Status**          |                                     |
| **Actual Result**   |                                     |

---

## D. Role-Based Trip Permissions (TRIP-016 to TRIP-020)

### TRIP-016: Carrier can set PICKUP_PENDING

| Field               | Value                                              |
| ------------------- | -------------------------------------------------- |
| **Priority**        | P1                                                 |
| **Preconditions**   | ASSIGNED trip, carrier role                        |
| **Steps**           | 1. Set PICKUP_PENDING as carrier                   |
| **Expected Result** | 200 OK. Carrier has permission for PICKUP_PENDING. |
| **Status**          |                                                    |
| **Actual Result**   |                                                    |

### TRIP-017: Carrier cannot set CANCELLED

| Field               | Value                                                  |
| ------------------- | ------------------------------------------------------ |
| **Priority**        | P1                                                     |
| **Preconditions**   | Active trip, carrier role                              |
| **Steps**           | 1. Attempt CANCELLED as carrier                        |
| **Expected Result** | 403 Forbidden. Only DISPATCHER/ADMIN can cancel trips. |
| **Status**          |                                                        |
| **Actual Result**   |                                                        |

### TRIP-018: Dispatcher can cancel trip

| Field               | Value                                              |
| ------------------- | -------------------------------------------------- |
| **Priority**        | P1                                                 |
| **Preconditions**   | Active trip, dispatcher role                       |
| **Steps**           | 1. `POST /api/trips/{tripId}/cancel` as dispatcher |
| **Expected Result** | 200 OK. Dispatcher has CANCELLED permission.       |
| **Status**          |                                                    |
| **Actual Result**   |                                                    |

### TRIP-019: Shipper cannot change trip status

| Field               | Value                                                         |
| ------------------- | ------------------------------------------------------------- |
| **Priority**        | P2                                                            |
| **Preconditions**   | Active trip, shipper role                                     |
| **Steps**           | 1. Attempt any status change as shipper                       |
| **Expected Result** | 403 Forbidden. Shippers observe trips but don't control them. |
| **Status**          |                                                               |
| **Actual Result**   |                                                               |

### TRIP-020: Admin can set any trip status

| Field               | Value                                                           |
| ------------------- | --------------------------------------------------------------- |
| **Priority**        | P2                                                              |
| **Preconditions**   | Any trip, admin role                                            |
| **Steps**           | 1. Set various statuses as admin                                |
| **Expected Result** | 200 OK for valid transitions. Admin bypasses role restrictions. |
| **Status**          |                                                                 |
| **Actual Result**   |                                                                 |

---

## E. POD & Completion (TRIP-021 to TRIP-025)

### TRIP-021: Upload POD document

| Field               | Value                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                    |
| **Preconditions**   | DELIVERED trip, carrier role                                                          |
| **Steps**           | 1. `POST /api/trips/{tripId}/pod` with multipart form (image/PDF)                     |
| **Expected Result** | 201 Created. TripPod record created. Load `podSubmitted: true`, `podSubmittedAt` set. |
| **Status**          |                                                                                       |
| **Actual Result**   |                                                                                       |

### TRIP-022: Upload multiple POD documents

| Field               | Value                                       |
| ------------------- | ------------------------------------------- |
| **Priority**        | P2                                          |
| **Preconditions**   | DELIVERED trip                              |
| **Steps**           | 1. Upload first POD 2. Upload second POD    |
| **Expected Result** | Both TripPod records created for same trip. |
| **Status**          |                                             |
| **Actual Result**   |                                             |

### TRIP-023: Shipper confirms delivery

| Field               | Value                                                                         |
| ------------------- | ----------------------------------------------------------------------------- |
| **Priority**        | P1                                                                            |
| **Preconditions**   | DELIVERED trip with POD, shipper role                                         |
| **Steps**           | 1. `POST /api/trips/{tripId}/confirm` as shipper                              |
| **Expected Result** | 200 OK. `shipperConfirmed: true`, `shipperConfirmedAt` set. Trip → COMPLETED. |
| **Status**          |                                                                               |
| **Actual Result**   |                                                                               |

### TRIP-024: Auto-verify POD after timeout

| Field               | Value                                                                    |
| ------------------- | ------------------------------------------------------------------------ |
| **Priority**        | P2                                                                       |
| **Preconditions**   | SystemSettings `autoVerifyPodTimeoutHours: 24`, POD uploaded 24+ hrs ago |
| **Steps**           | 1. Wait for auto-settle cron or manually trigger                         |
| **Expected Result** | POD auto-verified. Trip → COMPLETED. Service fees deducted.              |
| **Status**          |                                                                          |
| **Actual Result**   |                                                                          |

### TRIP-025: Cannot upload POD before DELIVERED

| Field               | Value                                                          |
| ------------------- | -------------------------------------------------------------- |
| **Priority**        | P1                                                             |
| **Preconditions**   | Trip in IN_TRANSIT                                             |
| **Steps**           | 1. `POST /api/trips/{tripId}/pod` while IN_TRANSIT             |
| **Expected Result** | 400 Bad Request. POD can only be uploaded in DELIVERED status. |
| **Status**          |                                                                |
| **Actual Result**   |                                                                |

---

## F. Trip Tracking & GPS (TRIP-026 to TRIP-028)

### TRIP-026: View trip GPS route

| Field               | Value                                                      |
| ------------------- | ---------------------------------------------------------- |
| **Priority**        | P1                                                         |
| **Preconditions**   | Trip with GPS data                                         |
| **Steps**           | 1. `GET /api/trips/{tripId}/gps`                           |
| **Expected Result** | 200 OK. GPS positions linked to trip, sorted by timestamp. |
| **Status**          |                                                            |
| **Actual Result**   |                                                            |

### TRIP-027: View trip live tracking

| Field               | Value                                          |
| ------------------- | ---------------------------------------------- |
| **Priority**        | P1                                             |
| **Preconditions**   | Active trip (IN_TRANSIT)                       |
| **Steps**           | 1. `GET /api/trips/{tripId}/live`              |
| **Expected Result** | 200 OK. Current position, speed, heading, ETA. |
| **Status**          |                                                |
| **Actual Result**   |                                                |

### TRIP-028: View trip history

| Field               | Value                                                                             |
| ------------------- | --------------------------------------------------------------------------------- |
| **Priority**        | P2                                                                                |
| **Preconditions**   | Completed trip                                                                    |
| **Steps**           | 1. `GET /api/trips/{tripId}/history`                                              |
| **Expected Result** | 200 OK. Full timeline: timestamps for each status change, GPS route, POD uploads. |
| **Status**          |                                                                                   |
| **Actual Result**   |                                                                                   |
