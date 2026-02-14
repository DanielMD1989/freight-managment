# 16 - Edge Cases (EDGE-xxx)

> **Total Tests:** 20
> **Priority Breakdown:** P0: 4 | P1: 8 | P2: 6 | P3: 2
> **Description:** Boundary values, invalid inputs, race conditions, and unusual scenarios

---

## A. Invalid Inputs (EDGE-001 to EDGE-006)

### EDGE-001: Create load with past pickup date

| Field               | Value                                               |
| ------------------- | --------------------------------------------------- |
| **Priority**        | P1                                                  |
| **Preconditions**   | Logged in as shipper                                |
| **Steps**           | 1. `POST /api/loads` with `pickupDate` in the past  |
| **Expected Result** | 400 Bad Request. Pickup date must be in the future. |
| **Status**          |                                                     |
| **Actual Result**   |                                                     |

### EDGE-002: Create load with delivery before pickup

| Field               | Value                                                     |
| ------------------- | --------------------------------------------------------- |
| **Priority**        | P1                                                        |
| **Preconditions**   | None                                                      |
| **Steps**           | 1. `POST /api/loads` with `deliveryDate` < `pickupDate`   |
| **Expected Result** | 400 Bad Request. Delivery date must be after pickup date. |
| **Status**          |                                                           |
| **Actual Result**   |                                                           |

### EDGE-003: Negative weight

| Field               | Value                                     |
| ------------------- | ----------------------------------------- |
| **Priority**        | P1                                        |
| **Preconditions**   | None                                      |
| **Steps**           | 1. `POST /api/loads` with `weight: -500`  |
| **Expected Result** | 400 Bad Request. Weight must be positive. |
| **Status**          |                                           |
| **Actual Result**   |                                           |

### EDGE-004: Zero distance corridor fee

| Field               | Value                                                                      |
| ------------------- | -------------------------------------------------------------------------- |
| **Priority**        | P2                                                                         |
| **Preconditions**   | None                                                                       |
| **Steps**           | 1. Calculate fee with `distanceKm: 0`                                      |
| **Expected Result** | Returns zero fee (per `calculatePartyFee` validation). No division errors. |
| **Status**          |                                                                            |
| **Actual Result**   |                                                                            |

### EDGE-005: Extremely large weight value

| Field               | Value                                                                  |
| ------------------- | ---------------------------------------------------------------------- |
| **Priority**        | P2                                                                     |
| **Preconditions**   | None                                                                   |
| **Steps**           | 1. `POST /api/loads` with `weight: 999999999`                          |
| **Expected Result** | Either accepted (Decimal handles it) or validation error. No overflow. |
| **Status**          |                                                                        |
| **Actual Result**   |                                                                        |

### EDGE-006: Unicode/special characters in text fields

| Field               | Value                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------- |
| **Priority**        | P2                                                                                        |
| **Preconditions**   | None                                                                                      |
| **Steps**           | 1. Create load with `cargoDescription` containing Amharic text, emojis, and special chars |
| **Expected Result** | Accepted and stored correctly. UTF-8 support throughout.                                  |
| **Status**          |                                                                                           |
| **Actual Result**   |                                                                                           |

---

## B. Race Conditions (EDGE-007 to EDGE-012)

### EDGE-007: Concurrent load assignment

| Field               | Value                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                 |
| **Preconditions**   | POSTED load, two carriers trying to accept                                                         |
| **Steps**           | 1. Two simultaneous `PUT /api/loads/{id}/assign` requests with different trucks                    |
| **Expected Result** | Only one succeeds. Second gets 409 Conflict (load already assigned). `assignedTruckId` is @unique. |
| **Status**          |                                                                                                    |
| **Actual Result**   |                                                                                                    |

### EDGE-008: Concurrent wallet deduction

| Field               | Value                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                                                    |
| **Preconditions**   | Shipper wallet with 1000 ETB, two loads completing simultaneously each requiring 800 ETB                                              |
| **Steps**           | 1. Two trips complete at same time, both try to deduct                                                                                |
| **Expected Result** | Transaction isolation prevents double-deduct. One succeeds, other fails with "Insufficient balance" (re-verified inside transaction). |
| **Status**          |                                                                                                                                       |
| **Actual Result**   |                                                                                                                                       |

### EDGE-009: Concurrent status updates on same load

| Field               | Value                                                                         |
| ------------------- | ----------------------------------------------------------------------------- |
| **Priority**        | P1                                                                            |
| **Preconditions**   | Load in ASSIGNED status                                                       |
| **Steps**           | 1. Carrier sends PICKUP_PENDING 2. Admin sends CANCELLED at same time         |
| **Expected Result** | One succeeds based on DB transaction ordering. Second gets stale state error. |
| **Status**          |                                                                               |
| **Actual Result**   |                                                                               |

### EDGE-010: Double POD upload

| Field               | Value                                                                          |
| ------------------- | ------------------------------------------------------------------------------ |
| **Priority**        | P1                                                                             |
| **Preconditions**   | DELIVERED trip                                                                 |
| **Steps**           | 1. Upload POD twice rapidly                                                    |
| **Expected Result** | Both POD records created (multiple PODs allowed per trip). No data corruption. |
| **Status**          |                                                                                |
| **Actual Result**   |                                                                                |

### EDGE-011: Accept proposal after load cancelled

| Field               | Value                                                       |
| ------------------- | ----------------------------------------------------------- |
| **Priority**        | P1                                                          |
| **Preconditions**   | Pending proposal, load then cancelled                       |
| **Steps**           | 1. Shipper cancels load 2. Carrier tries to accept proposal |
| **Expected Result** | 400 Bad Request. Load is no longer in assignable state.     |
| **Status**          |                                                             |
| **Actual Result**   |                                                             |

### EDGE-012: Update truck while assigned to load

| Field               | Value                                                                                |
| ------------------- | ------------------------------------------------------------------------------------ |
| **Priority**        | P2                                                                                   |
| **Preconditions**   | Truck assigned to active load                                                        |
| **Steps**           | 1. `PUT /api/trucks/{id}` to change truckType while assigned                         |
| **Expected Result** | Either blocked or allowed for non-critical fields only. Cannot change type mid-trip. |
| **Status**          |                                                                                      |
| **Actual Result**   |                                                                                      |

---

## C. Boundary Values (EDGE-013 to EDGE-016)

### EDGE-013: Maximum file upload size

| Field               | Value                                      |
| ------------------- | ------------------------------------------ |
| **Priority**        | P1                                         |
| **Preconditions**   | `maxFileUploadSizeMb: 10`                  |
| **Steps**           | 1. Upload 9.9MB file 2. Upload 10.1MB file |
| **Expected Result** | 9.9MB succeeds. 10.1MB rejected.           |
| **Status**          |                                            |
| **Actual Result**   |                                            |

### EDGE-014: Maximum documents per entity

| Field               | Value                                        |
| ------------------- | -------------------------------------------- |
| **Priority**        | P2                                           |
| **Preconditions**   | `maxDocumentsPerEntity: 20`                  |
| **Steps**           | 1. Upload 21 documents for same organization |
| **Expected Result** | 21st upload rejected. Limit enforced.        |
| **Status**          |                                              |
| **Actual Result**   |                                              |

### EDGE-015: Pagination boundaries

| Field               | Value                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                           |
| **Preconditions**   | 100+ loads exist                                                                             |
| **Steps**           | 1. `GET /api/loads?page=1&limit=10` 2. `GET /api/loads?page=999` 3. `GET /api/loads?limit=0` |
| **Expected Result** | Page 1: 10 results. Page 999: empty array (not error). Limit 0: validation error or default. |
| **Status**          |                                                                                              |
| **Actual Result**   |                                                                                              |

### EDGE-016: Decimal precision in financial calculations

| Field               | Value                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                                        |
| **Preconditions**   | Corridor with `distanceKm: 333.33`, `pricePerKm: 2.777`                                                                   |
| **Steps**           | 1. Calculate fee                                                                                                          |
| **Expected Result** | Result rounded to 2 decimal places (Decimal.js). No floating point errors. `baseFee = 925.54` (333.33 \* 2.777 = 925.54). |
| **Status**          |                                                                                                                           |
| **Actual Result**   |                                                                                                                           |

---

## D. Unusual Scenarios (EDGE-017 to EDGE-020)

### EDGE-017: Load with no pickup/delivery location

| Field               | Value                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                    |
| **Preconditions**   | None                                                                                  |
| **Steps**           | 1. Create load with null `pickupCityId` and null `pickupCity`                         |
| **Expected Result** | Validation error or handled gracefully. Corridor matching returns null (fees waived). |
| **Status**          |                                                                                       |
| **Actual Result**   |                                                                                       |

### EDGE-018: Truck with no carrier organization

| Field               | Value                                                     |
| ------------------- | --------------------------------------------------------- |
| **Priority**        | P2                                                        |
| **Preconditions**   | None                                                      |
| **Steps**           | 1. Attempt to create truck without valid `carrierId`      |
| **Expected Result** | FK constraint error. Truck requires carrier organization. |
| **Status**          |                                                           |
| **Actual Result**   |                                                           |

### EDGE-019: Complete load without trip

| Field               | Value                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                      |
| **Preconditions**   | Load reaches ASSIGNED without Trip record                                               |
| **Steps**           | 1. Check data integrity: every ASSIGNED load should have a Trip                         |
| **Expected Result** | System ensures Trip is always created on assignment. If missing, status change blocked. |
| **Status**          |                                                                                         |
| **Actual Result**   |                                                                                         |

### EDGE-020: Expired posting still shows in search

| Field               | Value                                                                               |
| ------------------- | ----------------------------------------------------------------------------------- |
| **Priority**        | P3                                                                                  |
| **Preconditions**   | Truck posting past expiresAt, cron hasn't run                                       |
| **Steps**           | 1. Search for truck postings                                                        |
| **Expected Result** | Expired postings should be filtered out in search results (status filter on query). |
| **Status**          |                                                                                     |
| **Actual Result**   |                                                                                     |
