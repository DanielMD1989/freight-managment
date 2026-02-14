# 05 - Truck Management & Postings (TRUCK-xxx)

> **Total Tests:** 24
> **Priority Breakdown:** P0: 4 | P1: 10 | P2: 8 | P3: 2
> **API Endpoints:** `/api/trucks/*`, `/api/truck-postings/*`
> **Source Files:** `app/api/trucks/*/route.ts`, `app/api/truck-postings/*/route.ts`

---

## A. Truck CRUD (TRUCK-001 to TRUCK-008)

### TRUCK-001: Create truck

| Field               | Value                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                                          |
| **Preconditions**   | Logged in as carrier with verified org                                                                                      |
| **Steps**           | 1. `POST /api/trucks` with `{ truckType: "FLATBED", licensePlate: "AA-12345", capacity: 20000, contactName, contactPhone }` |
| **Expected Result** | 201 Created. Truck with `approvalStatus: PENDING`, `carrierId` = caller's org, `isAvailable: true`.                         |
| **Status**          |                                                                                                                             |
| **Actual Result**   |                                                                                                                             |

### TRUCK-002: View truck details

| Field               | Value                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| **Priority**        | P1                                                                                               |
| **Preconditions**   | Truck exists                                                                                     |
| **Steps**           | 1. `GET /api/trucks/{id}`                                                                        |
| **Expected Result** | 200 OK. Full truck details: type, capacity, license plate, GPS info, approval status, documents. |
| **Status**          |                                                                                                  |
| **Actual Result**   |                                                                                                  |

### TRUCK-003: List carrier's trucks

| Field               | Value                                           |
| ------------------- | ----------------------------------------------- |
| **Priority**        | P1                                              |
| **Preconditions**   | Carrier has trucks                              |
| **Steps**           | 1. `GET /api/trucks` as carrier                 |
| **Expected Result** | 200 OK. Paginated list of carrier's own trucks. |
| **Status**          |                                                 |
| **Actual Result**   |                                                 |

### TRUCK-004: Update truck details

| Field               | Value                                                                            |
| ------------------- | -------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                               |
| **Preconditions**   | Own truck, carrier role                                                          |
| **Steps**           | 1. `PUT /api/trucks/{id}` with `{ capacity: 25000, currentCity: "Addis Ababa" }` |
| **Expected Result** | 200 OK. Fields updated.                                                          |
| **Status**          |                                                                                  |
| **Actual Result**   |                                                                                  |

### TRUCK-005: Delete truck

| Field               | Value                                                                         |
| ------------------- | ----------------------------------------------------------------------------- |
| **Priority**        | P1                                                                            |
| **Preconditions**   | Own truck, not assigned to active load                                        |
| **Steps**           | 1. `DELETE /api/trucks/{id}`                                                  |
| **Expected Result** | 200 OK. Truck deleted. Related postings, proposals, requests cascade-deleted. |
| **Status**          |                                                                               |
| **Actual Result**   |                                                                               |

### TRUCK-006: Cannot delete truck assigned to load

| Field               | Value                                                        |
| ------------------- | ------------------------------------------------------------ |
| **Priority**        | P1                                                           |
| **Preconditions**   | Truck assigned to active load                                |
| **Steps**           | 1. `DELETE /api/trucks/{id}`                                 |
| **Expected Result** | 400 Bad Request. Cannot delete truck with active assignment. |
| **Status**          |                                                              |
| **Actual Result**   |                                                              |

### TRUCK-007: Duplicate license plate rejected

| Field               | Value                                              |
| ------------------- | -------------------------------------------------- |
| **Priority**        | P1                                                 |
| **Preconditions**   | Truck with same plate exists                       |
| **Steps**           | 1. `POST /api/trucks` with existing `licensePlate` |
| **Expected Result** | 409 Conflict. License plate already registered.    |
| **Status**          |                                                    |
| **Actual Result**   |                                                    |

### TRUCK-008: Update truck location

| Field               | Value                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P2                                                                                                               |
| **Preconditions**   | Own truck, carrier role                                                                                          |
| **Steps**           | 1. `PUT /api/trucks/{id}/location` with `{ lat, lng, city, region }`                                             |
| **Expected Result** | 200 OK. `currentLocationLat`, `currentLocationLon`, `currentCity`, `currentRegion`, `locationUpdatedAt` updated. |
| **Status**          |                                                                                                                  |
| **Actual Result**   |                                                                                                                  |

---

## B. Truck Approval (TRUCK-009 to TRUCK-012)

### TRUCK-009: Admin approves truck

| Field               | Value                                                                         |
| ------------------- | ----------------------------------------------------------------------------- |
| **Priority**        | P0                                                                            |
| **Preconditions**   | Admin logged in, PENDING truck exists                                         |
| **Steps**           | 1. `PUT /api/trucks/{id}/approve` with `{ action: "approve" }`                |
| **Expected Result** | 200 OK. `approvalStatus: APPROVED`, `approvedAt` set, `approvedById` = admin. |
| **Status**          |                                                                               |
| **Actual Result**   |                                                                               |

### TRUCK-010: Admin rejects truck

| Field               | Value                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------ |
| **Priority**        | P1                                                                                         |
| **Preconditions**   | Admin logged in, PENDING truck                                                             |
| **Steps**           | 1. `PUT /api/trucks/{id}/approve` with `{ action: "reject", reason: "Missing documents" }` |
| **Expected Result** | 200 OK. `approvalStatus: REJECTED`, `rejectionReason` stored.                              |
| **Status**          |                                                                                            |
| **Actual Result**   |                                                                                            |

### TRUCK-011: Pending truck cannot be posted

| Field               | Value                                                   |
| ------------------- | ------------------------------------------------------- |
| **Priority**        | P1                                                      |
| **Preconditions**   | PENDING approval truck                                  |
| **Steps**           | 1. Attempt to create TruckPosting for unapproved truck  |
| **Expected Result** | 400 Bad Request. Truck must be approved before posting. |
| **Status**          |                                                         |
| **Actual Result**   |                                                         |

### TRUCK-012: View pending trucks (admin)

| Field               | Value                                                                          |
| ------------------- | ------------------------------------------------------------------------------ |
| **Priority**        | P1                                                                             |
| **Preconditions**   | Admin logged in                                                                |
| **Steps**           | 1. `GET /api/trucks?approvalStatus=PENDING` or visit admin/trucks/pending page |
| **Expected Result** | 200 OK. List of trucks pending approval.                                       |
| **Status**          |                                                                                |
| **Actual Result**   |                                                                                |

---

## C. Truck Postings (TRUCK-013 to TRUCK-020)

### TRUCK-013: Create truck posting

| Field               | Value                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                       |
| **Preconditions**   | Approved truck, carrier role                                                                             |
| **Steps**           | 1. `POST /api/truck-postings` with `{ truckId, originCityId, availableFrom, contactName, contactPhone }` |
| **Expected Result** | 201 Created. TruckPosting with `status: ACTIVE`.                                                         |
| **Status**          |                                                                                                          |
| **Actual Result**   |                                                                                                          |

### TRUCK-014: List truck postings

| Field               | Value                                                        |
| ------------------- | ------------------------------------------------------------ |
| **Priority**        | P1                                                           |
| **Preconditions**   | Active postings exist                                        |
| **Steps**           | 1. `GET /api/truck-postings?originCityId={id}&status=ACTIVE` |
| **Expected Result** | 200 OK. Filtered list of active truck postings.              |
| **Status**          |                                                              |
| **Actual Result**   |                                                              |

### TRUCK-015: Update truck posting

| Field               | Value                                                             |
| ------------------- | ----------------------------------------------------------------- |
| **Priority**        | P2                                                                |
| **Preconditions**   | Own posting, carrier role                                         |
| **Steps**           | 1. `PUT /api/truck-postings/{id}` with updated availability dates |
| **Expected Result** | 200 OK. Posting updated.                                          |
| **Status**          |                                                                   |
| **Actual Result**   |                                                                   |

### TRUCK-016: Cancel truck posting

| Field               | Value                                                            |
| ------------------- | ---------------------------------------------------------------- |
| **Priority**        | P1                                                               |
| **Preconditions**   | Active posting                                                   |
| **Steps**           | 1. `PUT /api/truck-postings/{id}` with `{ status: "CANCELLED" }` |
| **Expected Result** | 200 OK. Status → CANCELLED. No longer appears in searches.       |
| **Status**          |                                                                  |
| **Actual Result**   |                                                                  |

### TRUCK-017: Duplicate truck posting

| Field               | Value                                              |
| ------------------- | -------------------------------------------------- |
| **Priority**        | P3                                                 |
| **Preconditions**   | Existing posting                                   |
| **Steps**           | 1. `POST /api/truck-postings/{id}/duplicate`       |
| **Expected Result** | 201 Created. New ACTIVE posting with same details. |
| **Status**          |                                                    |
| **Actual Result**   |                                                    |

### TRUCK-018: View matching loads for posting

| Field               | Value                                                      |
| ------------------- | ---------------------------------------------------------- |
| **Priority**        | P1                                                         |
| **Preconditions**   | Active posting, compatible loads exist                     |
| **Steps**           | 1. `GET /api/truck-postings/{id}/matching-loads`           |
| **Expected Result** | 200 OK. List of compatible POSTED loads with match scores. |
| **Status**          |                                                            |
| **Actual Result**   |                                                            |

### TRUCK-019: Posting rate limiting

| Field               | Value                                               |
| ------------------- | --------------------------------------------------- |
| **Priority**        | P2                                                  |
| **Preconditions**   | SystemSettings `rateLimitTruckPosting: 100` per day |
| **Steps**           | 1. Create 101 postings in one day                   |
| **Expected Result** | 101st returns 429 Too Many Requests.                |
| **Status**          |                                                     |
| **Actual Result**   |                                                     |

### TRUCK-020: Posting expiry

| Field               | Value                                                                    |
| ------------------- | ------------------------------------------------------------------------ |
| **Priority**        | P2                                                                       |
| **Preconditions**   | Posting with past `expiresAt`                                            |
| **Steps**           | 1. Create posting with short expiry 2. Wait for cron job or check status |
| **Expected Result** | Posting status → EXPIRED automatically.                                  |
| **Status**          |                                                                          |
| **Actual Result**   |                                                                          |

---

## D. Nearby & Search (TRUCK-021 to TRUCK-024)

### TRUCK-021: Find nearby loads for truck

| Field               | Value                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| **Priority**        | P1                                                                      |
| **Preconditions**   | Truck with current location, POSTED loads nearby                        |
| **Steps**           | 1. `GET /api/trucks/{id}/nearby-loads`                                  |
| **Expected Result** | 200 OK. List of loads sorted by distance from truck's current location. |
| **Status**          |                                                                         |
| **Actual Result**   |                                                                         |

### TRUCK-022: Truck position update

| Field               | Value                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| **Priority**        | P2                                                                      |
| **Preconditions**   | Truck with GPS device                                                   |
| **Steps**           | 1. `POST /api/trucks/{id}/position` with `{ lat, lng, speed, heading }` |
| **Expected Result** | 200 OK. Position stored as GpsPosition. Truck location updated.         |
| **Status**          |                                                                         |
| **Actual Result**   |                                                                         |

### TRUCK-023: Truck history

| Field               | Value                                                |
| ------------------- | ---------------------------------------------------- |
| **Priority**        | P2                                                   |
| **Preconditions**   | Truck with completed trips                           |
| **Steps**           | 1. `GET /api/trucks/{id}/history`                    |
| **Expected Result** | 200 OK. List of past trips and loads for this truck. |
| **Status**          |                                                      |
| **Actual Result**   |                                                      |

### TRUCK-024: All truck types searchable

| Field               | Value                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P3                                                                                                             |
| **Preconditions**   | Trucks of various types exist                                                                                  |
| **Steps**           | 1. Search for each TruckType: FLATBED, REFRIGERATED, TANKER, CONTAINER, DRY_VAN, LOWBOY, DUMP_TRUCK, BOX_TRUCK |
| **Expected Result** | All 8 truck types return results when trucks of that type exist.                                               |
| **Status**          |                                                                                                                |
| **Actual Result**   |                                                                                                                |
