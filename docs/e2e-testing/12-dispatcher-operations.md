# 12 - Dispatcher Operations (DISP-xxx)

> **Total Tests:** 14
> **Priority Breakdown:** P0: 2 | P1: 6 | P2: 4 | P3: 2
> **API Endpoints:** `/api/dispatcher/*`, `/api/dispatch/*`, `/api/escalations/*`, `/api/match-proposals/*`
> **Web Pages:** `/dispatcher/*` (8 pages)

---

## Dispatcher Pages Reference

| Page        | Path                      |
| ----------- | ------------------------- |
| Home        | `/dispatcher`             |
| Dashboard   | `/dispatcher/dashboard`   |
| Loads       | `/dispatcher/loads`       |
| Trucks      | `/dispatcher/trucks`      |
| Trips       | `/dispatcher/trips`       |
| Escalations | `/dispatcher/escalations` |
| Proposals   | `/dispatcher/proposals`   |
| Map         | `/dispatcher/map`         |

---

## A. Dispatcher Dashboard (DISP-001 to DISP-003)

### DISP-001: Dispatcher dashboard

| Field               | Value                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                    |
| **Preconditions**   | Logged in as dispatcher                                                               |
| **Steps**           | 1. `GET /api/dispatcher/dashboard`                                                    |
| **Expected Result** | 200 OK. Metrics: unassigned loads, active trips, pending proposals, open escalations. |
| **Status**          |                                                                                       |
| **Actual Result**   |                                                                                       |

### DISP-002: View dispatch queue

| Field               | Value                                                                            |
| ------------------- | -------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                               |
| **Preconditions**   | Dispatcher logged in, unassigned loads exist                                     |
| **Steps**           | 1. `GET /api/dispatch`                                                           |
| **Expected Result** | 200 OK. List of POSTED/SEARCHING loads needing dispatch. Sorted by priority/age. |
| **Status**          |                                                                                  |
| **Actual Result**   |                                                                                  |

### DISP-003: All dispatcher pages accessible

| Field               | Value                                         |
| ------------------- | --------------------------------------------- |
| **Priority**        | P1                                            |
| **Preconditions**   | Dispatcher logged in                          |
| **Steps**           | 1. Navigate to each of the 8 dispatcher pages |
| **Expected Result** | All pages render without error.               |
| **Status**          |                                               |
| **Actual Result**   |                                               |

---

## B. Proposals & Matching (DISP-004 to DISP-007)

### DISP-004: Create match proposal from dispatch queue

| Field               | Value                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                      |
| **Preconditions**   | Dispatcher logged in, unassigned load and available truck                               |
| **Steps**           | 1. View dispatch queue 2. Select load and matching truck 3. `POST /api/match-proposals` |
| **Expected Result** | Proposal created. Load shows in proposals list. Carrier notified.                       |
| **Status**          |                                                                                         |
| **Actual Result**   |                                                                                         |

### DISP-005: View proposals page

| Field               | Value                                                                                |
| ------------------- | ------------------------------------------------------------------------------------ |
| **Priority**        | P1                                                                                   |
| **Preconditions**   | Dispatcher logged in, proposals exist                                                |
| **Steps**           | 1. Visit `/dispatcher/proposals`                                                     |
| **Expected Result** | All proposals by this dispatcher: PENDING, ACCEPTED, REJECTED with response details. |
| **Status**          |                                                                                      |
| **Actual Result**   |                                                                                      |

### DISP-006: Dispatcher views all loads

| Field               | Value                                                    |
| ------------------- | -------------------------------------------------------- |
| **Priority**        | P1                                                       |
| **Preconditions**   | Dispatcher logged in                                     |
| **Steps**           | 1. `GET /api/loads` as dispatcher (has `VIEW_ALL_LOADS`) |
| **Expected Result** | 200 OK. All loads visible (not just own).                |
| **Status**          |                                                          |
| **Actual Result**   |                                                          |

### DISP-007: Dispatcher views all trucks

| Field               | Value                                                      |
| ------------------- | ---------------------------------------------------------- |
| **Priority**        | P1                                                         |
| **Preconditions**   | Dispatcher logged in                                       |
| **Steps**           | 1. `GET /api/trucks` as dispatcher (has `VIEW_ALL_TRUCKS`) |
| **Expected Result** | 200 OK. All trucks visible for coordination.               |
| **Status**          |                                                            |
| **Actual Result**   |                                                            |

---

## C. Escalations (DISP-008 to DISP-011)

### DISP-008: Create escalation

| Field               | Value                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                                                |
| **Preconditions**   | Dispatcher logged in, active load with issue                                                                      |
| **Steps**           | 1. `POST /api/escalations` with `{ loadId, escalationType: "LATE_PICKUP", priority: "HIGH", title, description }` |
| **Expected Result** | 201 Created. LoadEscalation with `status: OPEN`. Admin notified.                                                  |
| **Status**          |                                                                                                                   |
| **Actual Result**   |                                                                                                                   |

### DISP-009: View escalations page

| Field               | Value                                                               |
| ------------------- | ------------------------------------------------------------------- |
| **Priority**        | P1                                                                  |
| **Preconditions**   | Dispatcher logged in                                                |
| **Steps**           | 1. Visit `/dispatcher/escalations` or `GET /api/escalations`        |
| **Expected Result** | All escalations visible with status, priority, assigned dispatcher. |
| **Status**          |                                                                     |
| **Actual Result**   |                                                                     |

### DISP-010: Update escalation

| Field               | Value                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------- |
| **Priority**        | P2                                                                                           |
| **Preconditions**   | Open escalation                                                                              |
| **Steps**           | 1. `PUT /api/escalations/{id}` with `{ status: "IN_PROGRESS", notes: "Contacting carrier" }` |
| **Expected Result** | 200 OK. Escalation status updated.                                                           |
| **Status**          |                                                                                              |
| **Actual Result**   |                                                                                              |

### DISP-011: Escalate to admin

| Field               | Value                                                         |
| ------------------- | ------------------------------------------------------------- |
| **Priority**        | P2                                                            |
| **Preconditions**   | Dispatcher has `ESCALATE_TO_ADMIN` permission                 |
| **Steps**           | 1. `PUT /api/escalations/{id}` with `{ status: "ESCALATED" }` |
| **Expected Result** | 200 OK. Status → ESCALATED. Admin receives notification.      |
| **Status**          |                                                               |
| **Actual Result**   |                                                               |

---

## D. Dispatcher Map & Monitoring (DISP-012 to DISP-014)

### DISP-012: Dispatcher map view

| Field               | Value                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| **Priority**        | P2                                                                      |
| **Preconditions**   | Dispatcher logged in                                                    |
| **Steps**           | 1. Visit `/dispatcher/map`                                              |
| **Expected Result** | Map shows active trips, vehicle positions, load pickup/delivery points. |
| **Status**          |                                                                         |
| **Actual Result**   |                                                                         |

### DISP-013: Dispatcher audit logs

| Field               | Value                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------- |
| **Priority**        | P3                                                                                       |
| **Preconditions**   | Dispatcher logged in                                                                     |
| **Steps**           | 1. `GET /api/audit-logs/dispatcher`                                                      |
| **Expected Result** | 200 OK. Dispatcher-specific audit trail: proposals created, escalations, status changes. |
| **Status**          |                                                                                          |
| **Actual Result**   |                                                                                          |

### DISP-014: Dispatcher exception monitoring

| Field               | Value                                          |
| ------------------- | ---------------------------------------------- |
| **Priority**        | P2                                             |
| **Preconditions**   | Dispatcher logged in                           |
| **Steps**           | 1. `GET /api/exceptions/monitor`               |
| **Expected Result** | 200 OK. Active exceptions requiring attention. |
| **Status**          |                                                |
| **Actual Result**   |                                                |
