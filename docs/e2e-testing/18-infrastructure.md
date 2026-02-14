# 18 - Infrastructure (INFRA-xxx)

> **Total Tests:** 14
> **Priority Breakdown:** P0: 4 | P1: 6 | P2: 2 | P3: 2
> **API Endpoints:** `/api/health`, `/api/config`, `/api/feature-flags/*`, `/api/queues/*`, `/api/monitoring`, `/api/distance/*`

---

## A. Health & Monitoring (INFRA-001 to INFRA-004)

### INFRA-001: Health check endpoint

| Field               | Value                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                      |
| **Preconditions**   | Server running                                                                          |
| **Steps**           | 1. `GET /api/health`                                                                    |
| **Expected Result** | 200 OK. Returns `{ status: "ok", database: "connected", timestamp }`. No auth required. |
| **Status**          |                                                                                         |
| **Actual Result**   |                                                                                         |

### INFRA-002: Health check with DB down

| Field               | Value                                                        |
| ------------------- | ------------------------------------------------------------ |
| **Priority**        | P0                                                           |
| **Preconditions**   | Database connection dropped                                  |
| **Steps**           | 1. `GET /api/health`                                         |
| **Expected Result** | 503 or degraded status. Indicates database is not connected. |
| **Status**          |                                                              |
| **Actual Result**   |                                                              |

### INFRA-003: Monitoring endpoint

| Field               | Value                                                             |
| ------------------- | ----------------------------------------------------------------- |
| **Priority**        | P1                                                                |
| **Preconditions**   | Server running                                                    |
| **Steps**           | 1. `GET /api/monitoring`                                          |
| **Expected Result** | 200 OK. System metrics: uptime, memory usage, active connections. |
| **Status**          |                                                                   |
| **Actual Result**   |                                                                   |

### INFRA-004: Config endpoint (public)

| Field               | Value                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                                   |
| **Preconditions**   | None                                                                                                 |
| **Steps**           | 1. `GET /api/config`                                                                                 |
| **Expected Result** | 200 OK. Public configuration: feature flags, public settings. No secrets (no DB URL, no JWT secret). |
| **Status**          |                                                                                                      |
| **Actual Result**   |                                                                                                      |

---

## B. Feature Flags (INFRA-005 to INFRA-007)

### INFRA-005: List feature flags

| Field               | Value                                                  |
| ------------------- | ------------------------------------------------------ |
| **Priority**        | P1                                                     |
| **Preconditions**   | Admin logged in                                        |
| **Steps**           | 1. `GET /api/feature-flags`                            |
| **Expected Result** | 200 OK. List of all feature flags with current values. |
| **Status**          |                                                        |
| **Actual Result**   |                                                        |

### INFRA-006: Toggle feature flag

| Field               | Value                                                            |
| ------------------- | ---------------------------------------------------------------- |
| **Priority**        | P1                                                               |
| **Preconditions**   | Admin logged in                                                  |
| **Steps**           | 1. `PUT /api/feature-flags/{key}` with `{ value: false }`        |
| **Expected Result** | 200 OK. Feature disabled. Subsequent requests reflect new state. |
| **Status**          |                                                                  |
| **Actual Result**   |                                                                  |

### INFRA-007: Feature flag affects functionality

| Field               | Value                                                                            |
| ------------------- | -------------------------------------------------------------------------------- |
| **Priority**        | P2                                                                               |
| **Preconditions**   | GPS tracking feature flag exists                                                 |
| **Steps**           | 1. Disable GPS tracking flag 2. `POST /api/gps/position`                         |
| **Expected Result** | Feature gracefully disabled. Request handled appropriately (rejected or queued). |
| **Status**          |                                                                                  |
| **Actual Result**   |                                                                                  |

---

## C. Queue Management (INFRA-008 to INFRA-010)

### INFRA-008: List queues

| Field               | Value                                                                       |
| ------------------- | --------------------------------------------------------------------------- |
| **Priority**        | P1                                                                          |
| **Preconditions**   | Admin logged in, BullMQ running                                             |
| **Steps**           | 1. `GET /api/queues`                                                        |
| **Expected Result** | 200 OK. List of queues with job counts: waiting, active, completed, failed. |
| **Status**          |                                                                             |
| **Actual Result**   |                                                                             |

### INFRA-009: View queue details

| Field               | Value                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| **Priority**        | P2                                                                      |
| **Preconditions**   | Admin logged in                                                         |
| **Steps**           | 1. `GET /api/queues/{queueName}`                                        |
| **Expected Result** | 200 OK. Queue details: pending jobs, recent completions, failure count. |
| **Status**          |                                                                         |
| **Actual Result**   |                                                                         |

### INFRA-010: Redis connection

| Field               | Value                                                              |
| ------------------- | ------------------------------------------------------------------ |
| **Priority**        | P0                                                                 |
| **Preconditions**   | Redis running                                                      |
| **Steps**           | 1. Verify Redis connection via health check or direct test         |
| **Expected Result** | Redis connected. Session caching works. BullMQ queues operational. |
| **Status**          |                                                                    |
| **Actual Result**   |                                                                    |

---

## D. Distance & Route APIs (INFRA-011 to INFRA-014)

### INFRA-011: Calculate road distance

| Field               | Value                                                                          |
| ------------------- | ------------------------------------------------------------------------------ |
| **Priority**        | P1                                                                             |
| **Preconditions**   | Google Routes API key configured                                               |
| **Steps**           | 1. `POST /api/distance/road` with `{ originLat, originLng, destLat, destLng }` |
| **Expected Result** | 200 OK. Returns `distanceKm`, `durationMinutes`. Result cached in RouteCache.  |
| **Status**          |                                                                                |
| **Actual Result**   |                                                                                |

### INFRA-012: Batch distance calculation

| Field               | Value                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| **Priority**        | P1                                                                      |
| **Preconditions**   | API key configured                                                      |
| **Steps**           | 1. `POST /api/distance/batch` with multiple origin-destination pairs    |
| **Expected Result** | 200 OK. Array of distances. Cache hit for previously calculated routes. |
| **Status**          |                                                                         |
| **Actual Result**   |                                                                         |

### INFRA-013: Deadhead distance calculation

| Field               | Value                                                    |
| ------------------- | -------------------------------------------------------- |
| **Priority**        | P3                                                       |
| **Preconditions**   | Truck with current location, load with pickup location   |
| **Steps**           | 1. `POST /api/distance/dh` with truck and load locations |
| **Expected Result** | 200 OK. Deadhead distance to origin calculated.          |
| **Status**          |                                                          |
| **Actual Result**   |                                                          |

### INFRA-014: Route cache hit

| Field               | Value                                                   |
| ------------------- | ------------------------------------------------------- |
| **Priority**        | P3                                                      |
| **Preconditions**   | Previous distance calculation cached                    |
| **Steps**           | 1. Request same route 2. Check if RouteCache entry used |
| **Expected Result** | Cache hit. No external API call. Faster response.       |
| **Status**          |                                                         |
| **Actual Result**   |                                                         |
