# 06 - Matching Engine & Proposals (MATCH-xxx)

> **Total Tests:** 20
> **Priority Breakdown:** P0: 4 | P1: 8 | P2: 6 | P3: 2
> **API Endpoints:** `/api/match-proposals/*`, `/api/truck-requests/*`, `/api/load-requests/*`
> **Source Files:** `app/api/match-proposals/*/route.ts`, `app/api/truck-requests/*/route.ts`, `app/api/load-requests/*/route.ts`

---

## Foundation Rules

- **DISPATCHER_COORDINATION_ONLY:** Dispatchers can only propose matches; they cannot directly assign loads.
- **CARRIER_FINAL_AUTHORITY:** Carriers must approve any match before a load is assigned to their truck.

---

## A. Dispatcher Match Proposals (MATCH-001 to MATCH-006)

### MATCH-001: Create match proposal

| Field               | Value                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                   |
| **Preconditions**   | Dispatcher logged in, POSTED load and available truck exist                                          |
| **Steps**           | 1. `POST /api/match-proposals` with `{ loadId, truckId, carrierId, notes, proposedRate, expiresAt }` |
| **Expected Result** | 201 Created. MatchProposal with `status: PENDING`, `proposedById` = dispatcher.                      |
| **Status**          |                                                                                                      |
| **Actual Result**   |                                                                                                      |

### MATCH-002: Carrier accepts proposal

| Field               | Value                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------ |
| **Priority**        | P0                                                                                         |
| **Preconditions**   | Pending proposal, carrier logged in                                                        |
| **Steps**           | 1. `PUT /api/match-proposals/{id}/respond` with `{ action: "accept", responseNotes }`      |
| **Expected Result** | 200 OK. Proposal `status: ACCEPTED`. Load status → ASSIGNED. Truck assigned. Trip created. |
| **Status**          |                                                                                            |
| **Actual Result**   |                                                                                            |

### MATCH-003: Carrier rejects proposal

| Field               | Value                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                                         |
| **Preconditions**   | Pending proposal, carrier logged in                                                                        |
| **Steps**           | 1. `PUT /api/match-proposals/{id}/respond` with `{ action: "reject", responseNotes: "Truck unavailable" }` |
| **Expected Result** | 200 OK. Proposal `status: REJECTED`. Load stays in current status.                                         |
| **Status**          |                                                                                                            |
| **Actual Result**   |                                                                                                            |

### MATCH-004: Proposal expires

| Field               | Value                                                |
| ------------------- | ---------------------------------------------------- |
| **Priority**        | P1                                                   |
| **Preconditions**   | Proposal with past `expiresAt`                       |
| **Steps**           | 1. Attempt to respond to expired proposal            |
| **Expected Result** | 400 Bad Request. Proposal expired. Status → EXPIRED. |
| **Status**          |                                                      |
| **Actual Result**   |                                                      |

### MATCH-005: List proposals for carrier

| Field               | Value                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                    |
| **Preconditions**   | Carrier has pending proposals                                                         |
| **Steps**           | 1. `GET /api/match-proposals?carrierId={id}&status=PENDING`                           |
| **Expected Result** | 200 OK. List of pending proposals with load details, proposed rate, dispatcher notes. |
| **Status**          |                                                                                       |
| **Actual Result**   |                                                                                       |

### MATCH-006: Dispatcher cannot directly assign load

| Field               | Value                                                                      |
| ------------------- | -------------------------------------------------------------------------- |
| **Priority**        | P0                                                                         |
| **Preconditions**   | Dispatcher logged in                                                       |
| **Steps**           | 1. `PUT /api/loads/{id}/assign` with `{ truckId }` as dispatcher           |
| **Expected Result** | 403 Forbidden. Dispatcher must use match-proposals, not direct assignment. |
| **Status**          |                                                                            |
| **Actual Result**   |                                                                            |

---

## B. Shipper Truck Requests (MATCH-007 to MATCH-012)

### MATCH-007: Shipper requests specific truck

| Field               | Value                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                 |
| **Preconditions**   | Shipper logged in, posted load, posted truck visible                                               |
| **Steps**           | 1. `POST /api/truck-requests` with `{ loadId, truckId, carrierId, notes, offeredRate, expiresAt }` |
| **Expected Result** | 201 Created. TruckRequest with `status: PENDING`, `shipperId` = caller's org.                      |
| **Status**          |                                                                                                    |
| **Actual Result**   |                                                                                                    |

### MATCH-008: Carrier approves truck request

| Field               | Value                                                                         |
| ------------------- | ----------------------------------------------------------------------------- |
| **Priority**        | P1                                                                            |
| **Preconditions**   | Pending truck request, carrier logged in                                      |
| **Steps**           | 1. `PUT /api/truck-requests/{id}/respond` with `{ action: "approve" }`        |
| **Expected Result** | 200 OK. Request `status: APPROVED`. Load → ASSIGNED with truck. Trip created. |
| **Status**          |                                                                               |
| **Actual Result**   |                                                                               |

### MATCH-009: Carrier rejects truck request

| Field               | Value                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| **Priority**        | P1                                                                    |
| **Preconditions**   | Pending truck request                                                 |
| **Steps**           | 1. `PUT /api/truck-requests/{id}/respond` with `{ action: "reject" }` |
| **Expected Result** | 200 OK. Request `status: REJECTED`.                                   |
| **Status**          |                                                                       |
| **Actual Result**   |                                                                       |

### MATCH-010: Shipper cancels truck request

| Field               | Value                                    |
| ------------------- | ---------------------------------------- |
| **Priority**        | P2                                       |
| **Preconditions**   | Pending request, shipper role            |
| **Steps**           | 1. `PUT /api/truck-requests/{id}/cancel` |
| **Expected Result** | 200 OK. Request `status: CANCELLED`.     |
| **Status**          |                                          |
| **Actual Result**   |                                          |

### MATCH-011: List truck requests for carrier

| Field               | Value                                                        |
| ------------------- | ------------------------------------------------------------ |
| **Priority**        | P2                                                           |
| **Preconditions**   | Carrier has incoming requests                                |
| **Steps**           | 1. `GET /api/truck-requests?carrierId={id}`                  |
| **Expected Result** | 200 OK. List of requests with load details and offered rate. |
| **Status**          |                                                              |
| **Actual Result**   |                                                              |

### MATCH-012: Truck request expires

| Field               | Value                           |
| ------------------- | ------------------------------- |
| **Priority**        | P2                              |
| **Preconditions**   | Request past `expiresAt`        |
| **Steps**           | 1. Check expired request status |
| **Expected Result** | Request `status: EXPIRED`.      |
| **Status**          |                                 |
| **Actual Result**   |                                 |

---

## C. Carrier Load Requests (MATCH-013 to MATCH-017)

### MATCH-013: Carrier requests load

| Field               | Value                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                      |
| **Preconditions**   | Carrier logged in, POSTED load, approved truck                                          |
| **Steps**           | 1. `POST /api/load-requests` with `{ loadId, truckId, notes, proposedRate, expiresAt }` |
| **Expected Result** | 201 Created. LoadRequest with `status: PENDING`, `carrierId` = caller's org.            |
| **Status**          |                                                                                         |
| **Actual Result**   |                                                                                         |

### MATCH-014: Shipper approves load request

| Field               | Value                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| **Priority**        | P1                                                                    |
| **Preconditions**   | Pending load request, shipper logged in                               |
| **Steps**           | 1. `PUT /api/load-requests/{id}/respond` with `{ action: "approve" }` |
| **Expected Result** | 200 OK. Load → ASSIGNED with carrier's truck. Trip created.           |
| **Status**          |                                                                       |
| **Actual Result**   |                                                                       |

### MATCH-015: Shipper rejects load request

| Field               | Value                                                                |
| ------------------- | -------------------------------------------------------------------- |
| **Priority**        | P2                                                                   |
| **Preconditions**   | Pending load request                                                 |
| **Steps**           | 1. `PUT /api/load-requests/{id}/respond` with `{ action: "reject" }` |
| **Expected Result** | 200 OK. Request `status: REJECTED`.                                  |
| **Status**          |                                                                      |
| **Actual Result**   |                                                                      |

### MATCH-016: List load requests for shipper

| Field               | Value                                                 |
| ------------------- | ----------------------------------------------------- |
| **Priority**        | P2                                                    |
| **Preconditions**   | Shipper has incoming requests                         |
| **Steps**           | 1. `GET /api/load-requests?shipperId={id}`            |
| **Expected Result** | 200 OK. List of carrier requests for shipper's loads. |
| **Status**          |                                                       |
| **Actual Result**   |                                                       |

### MATCH-017: Duplicate request prevention

| Field               | Value                                             |
| ------------------- | ------------------------------------------------- |
| **Priority**        | P1                                                |
| **Preconditions**   | Pending request exists for same load+truck        |
| **Steps**           | 1. Submit another request for same load and truck |
| **Expected Result** | 400/409. Duplicate request prevented.             |
| **Status**          |                                                   |
| **Actual Result**   |                                                   |

---

## D. Match Scoring & Edge Cases (MATCH-018 to MATCH-020)

### MATCH-018: Match score calculation

| Field               | Value                                                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                                                                                          |
| **Preconditions**   | Load and truck postings exist                                                                                                                               |
| **Steps**           | 1. `GET /api/loads/{id}/matching-trucks` or `GET /api/truck-postings/{id}/matching-loads`                                                                   |
| **Expected Result** | Match scores calculated based on: truck type compatibility, location proximity, capacity, deadhead distance. Scores above `matchScoreMinimum` (default 40). |
| **Status**          |                                                                                                                                                             |
| **Actual Result**   |                                                                                                                                                             |

### MATCH-019: Race condition - two carriers accept same load

| Field               | Value                                                                           |
| ------------------- | ------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                              |
| **Preconditions**   | Two proposals for same load, both pending                                       |
| **Steps**           | 1. Carrier A accepts proposal 2. Carrier B accepts proposal (near-simultaneous) |
| **Expected Result** | First acceptance succeeds. Second gets 400/409 error (load already assigned).   |
| **Status**          |                                                                                 |
| **Actual Result**   |                                                                                 |

### MATCH-020: Cascade deletion on load/truck delete

| Field               | Value                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| **Priority**        | P3                                                                                                       |
| **Preconditions**   | Load with pending proposals/requests                                                                     |
| **Steps**           | 1. Delete the load 2. Check that related MatchProposals, TruckRequests, LoadRequests are cascade-deleted |
| **Expected Result** | All related proposals and requests deleted (per Prisma `onDelete: Cascade`).                             |
| **Status**          |                                                                                                          |
| **Actual Result**   |                                                                                                          |
