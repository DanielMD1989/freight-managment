# 08 - GPS & Tracking (GPS-xxx)

> **Total Tests:** 22
> **Priority Breakdown:** P0: 4 | P1: 10 | P2: 6 | P3: 2
> **API Endpoints:** `/api/gps/*`, `/api/tracking/*`, `/api/carrier/gps`
> **Source Files:** `app/api/gps/*/route.ts`, `app/api/tracking/*/route.ts`

---

## A. GPS Position Ingestion (GPS-001 to GPS-006)

### GPS-001: Submit single GPS position

| Field               | Value                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                                |
| **Preconditions**   | Truck with GPS device, active trip                                                                                |
| **Steps**           | 1. `POST /api/gps/position` with `{ truckId, deviceId, latitude, longitude, speed, heading, altitude, accuracy }` |
| **Expected Result** | 201 Created. GpsPosition record stored. Truck `currentLocationLat/Lon` updated. Trip `currentLat/Lng` updated.    |
| **Status**          |                                                                                                                   |
| **Actual Result**   |                                                                                                                   |

### GPS-002: Submit batch GPS positions

| Field               | Value                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                          |
| **Preconditions**   | Truck with GPS device                                                                       |
| **Steps**           | 1. `POST /api/gps/batch` with array of `[{ truckId, latitude, longitude, timestamp }, ...]` |
| **Expected Result** | 200 OK. All positions stored. Useful for catching up after offline periods.                 |
| **Status**          |                                                                                             |
| **Actual Result**   |                                                                                             |

### GPS-003: GPS position with invalid coordinates

| Field               | Value                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| **Priority**        | P1                                                                    |
| **Preconditions**   | None                                                                  |
| **Steps**           | 1. `POST /api/gps/position` with `{ latitude: 999, longitude: -999 }` |
| **Expected Result** | 400 Bad Request. Coordinates validation error.                        |
| **Status**          |                                                                       |
| **Actual Result**   |                                                                       |

### GPS-004: GPS position updates trip progress

| Field               | Value                                                         |
| ------------------- | ------------------------------------------------------------- |
| **Priority**        | P1                                                            |
| **Preconditions**   | IN_TRANSIT trip with known destination                        |
| **Steps**           | 1. Submit GPS position closer to destination                  |
| **Expected Result** | Load `tripProgressPercent` and `remainingDistanceKm` updated. |
| **Status**          |                                                               |
| **Actual Result**   |                                                               |

### GPS-005: GPS position links to active trip

| Field               | Value                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| **Priority**        | P1                                                                      |
| **Preconditions**   | Truck with active trip                                                  |
| **Steps**           | 1. Submit GPS position for truck                                        |
| **Expected Result** | GpsPosition `tripId` set to active trip. `loadId` set to assigned load. |
| **Status**          |                                                                         |
| **Actual Result**   |                                                                         |

### GPS-006: GPS positions stored after trip completion

| Field               | Value                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| **Priority**        | P2                                                                                                      |
| **Preconditions**   | Trip with GPS history, trip then deleted                                                                |
| **Steps**           | 1. Complete trip 2. Verify GPS positions still exist 3. If trip deleted, `tripId` set to null (SetNull) |
| **Expected Result** | GPS data preserved. Trip reference cleared (onDelete: SetNull).                                         |
| **Status**          |                                                                                                         |
| **Actual Result**   |                                                                                                         |

---

## B. GPS Devices (GPS-007 to GPS-011)

### GPS-007: Register GPS device

| Field               | Value                                                         |
| ------------------- | ------------------------------------------------------------- |
| **Priority**        | P0                                                            |
| **Preconditions**   | Admin role                                                    |
| **Steps**           | 1. `POST /api/gps/devices` with `{ imei: "123456789012345" }` |
| **Expected Result** | 201 Created. GpsDevice with `status: ACTIVE`, unique `imei`.  |
| **Status**          |                                                               |
| **Actual Result**   |                                                               |

### GPS-008: Assign GPS device to truck

| Field               | Value                                                  |
| ------------------- | ------------------------------------------------------ |
| **Priority**        | P1                                                     |
| **Preconditions**   | GPS device exists, truck exists                        |
| **Steps**           | 1. `PUT /api/trucks/{id}` with `{ gpsDeviceId, imei }` |
| **Expected Result** | Truck linked to GPS device. `gpsStatus: ACTIVE`.       |
| **Status**          |                                                        |
| **Actual Result**   |                                                        |

### GPS-009: Verify GPS device

| Field               | Value                                                  |
| ------------------- | ------------------------------------------------------ |
| **Priority**        | P1                                                     |
| **Preconditions**   | Truck with GPS device                                  |
| **Steps**           | 1. `POST /api/gps/devices/{id}/verify`                 |
| **Expected Result** | 200 OK. Device verified. `gpsVerifiedAt` set on truck. |
| **Status**          |                                                        |
| **Actual Result**   |                                                        |

### GPS-010: List GPS devices

| Field               | Value                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| **Priority**        | P2                                                                    |
| **Preconditions**   | Admin role, devices exist                                             |
| **Steps**           | 1. `GET /api/gps/devices`                                             |
| **Expected Result** | 200 OK. List of all GPS devices with status, last seen, linked truck. |
| **Status**          |                                                                       |
| **Actual Result**   |                                                                       |

### GPS-011: Duplicate IMEI rejected

| Field               | Value                                         |
| ------------------- | --------------------------------------------- |
| **Priority**        | P1                                            |
| **Preconditions**   | Device with same IMEI exists                  |
| **Steps**           | 1. `POST /api/gps/devices` with existing IMEI |
| **Expected Result** | 409 Conflict. IMEI must be unique.            |
| **Status**          |                                               |
| **Actual Result**   |                                               |

---

## C. Live Tracking (GPS-012 to GPS-016)

### GPS-012: Get live position for truck

| Field               | Value                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                     |
| **Preconditions**   | Truck with recent GPS data, active trip                                                |
| **Steps**           | 1. `GET /api/gps/live?truckId={id}`                                                    |
| **Expected Result** | 200 OK. Latest position with `latitude`, `longitude`, `speed`, `heading`, `timestamp`. |
| **Status**          |                                                                                        |
| **Actual Result**   |                                                                                        |

### GPS-013: Get GPS history for date range

| Field               | Value                                                              |
| ------------------- | ------------------------------------------------------------------ |
| **Priority**        | P1                                                                 |
| **Preconditions**   | Truck with GPS positions                                           |
| **Steps**           | 1. `GET /api/gps/history?truckId={id}&from={date}&to={date}`       |
| **Expected Result** | 200 OK. Array of positions within date range, sorted by timestamp. |
| **Status**          |                                                                    |
| **Actual Result**   |                                                                    |

### GPS-014: Get ETA for active trip

| Field               | Value                                                                       |
| ------------------- | --------------------------------------------------------------------------- |
| **Priority**        | P1                                                                          |
| **Preconditions**   | IN_TRANSIT trip with current position                                       |
| **Steps**           | 1. `GET /api/gps/eta?truckId={id}&destLat={lat}&destLng={lng}`              |
| **Expected Result** | 200 OK. Estimated arrival time based on current position, speed, and route. |
| **Status**          |                                                                             |
| **Actual Result**   |                                                                             |

### GPS-015: Public tracking URL

| Field               | Value                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                                                      |
| **Preconditions**   | Load with `trackingUrl` set and `trackingEnabled: true`                                                                 |
| **Steps**           | 1. `GET /api/tracking/{trackingId}` (no auth required)                                                                  |
| **Expected Result** | 200 OK. Public tracking data: current position, pickup/delivery cities, status. No sensitive data (no carrier details). |
| **Status**          |                                                                                                                         |
| **Actual Result**   |                                                                                                                         |

### GPS-016: Public tracking disabled

| Field               | Value                                                 |
| ------------------- | ----------------------------------------------------- |
| **Priority**        | P2                                                    |
| **Preconditions**   | Load with `trackingEnabled: false`                    |
| **Steps**           | 1. `GET /api/tracking/{trackingId}`                   |
| **Expected Result** | 403 or limited info. Tracking disabled for this load. |
| **Status**          |                                                       |
| **Actual Result**   |                                                       |

---

## D. GPS Monitoring & Status (GPS-017 to GPS-022)

### GPS-017: GPS offline detection

| Field               | Value                                                    |
| ------------------- | -------------------------------------------------------- |
| **Priority**        | P1                                                       |
| **Preconditions**   | Truck with GPS that hasn't reported in >30 min           |
| **Steps**           | 1. Run `/api/cron/gps-monitor` or check truck GPS status |
| **Expected Result** | Truck `gpsStatus: SIGNAL_LOST`. Notification created.    |
| **Status**          |                                                          |
| **Actual Result**   |                                                          |

### GPS-018: GPS positions list by truck

| Field               | Value                                    |
| ------------------- | ---------------------------------------- |
| **Priority**        | P2                                       |
| **Preconditions**   | Truck with positions                     |
| **Steps**           | 1. `GET /api/gps/positions?truckId={id}` |
| **Expected Result** | 200 OK. Paginated positions for truck.   |
| **Status**          |                                          |
| **Actual Result**   |                                          |

### GPS-019: Carrier GPS dashboard

| Field               | Value                                                                              |
| ------------------- | ---------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                 |
| **Preconditions**   | Carrier with multiple trucks                                                       |
| **Steps**           | 1. `GET /api/carrier/gps`                                                          |
| **Expected Result** | 200 OK. All carrier's trucks with current positions, GPS status, active trip info. |
| **Status**          |                                                                                    |
| **Actual Result**   |                                                                                    |

### GPS-020: Geofence detection

| Field               | Value                                                          |
| ------------------- | -------------------------------------------------------------- |
| **Priority**        | P2                                                             |
| **Preconditions**   | IN_TRANSIT load near destination                               |
| **Steps**           | 1. Submit GPS position within destination geofence radius      |
| **Expected Result** | Load `enteredDestGeofence: true`, `enteredDestGeofenceAt` set. |
| **Status**          |                                                                |
| **Actual Result**   |                                                                |

### GPS-021: Map view - all vehicles

| Field               | Value                                                      |
| ------------------- | ---------------------------------------------------------- |
| **Priority**        | P2                                                         |
| **Preconditions**   | Admin/dispatcher role, trucks with positions               |
| **Steps**           | 1. `GET /api/map/vehicles`                                 |
| **Expected Result** | 200 OK. All trucks with current positions for map display. |
| **Status**          |                                                            |
| **Actual Result**   |                                                            |

### GPS-022: GPS data cleanup cron

| Field               | Value                                                                           |
| ------------------- | ------------------------------------------------------------------------------- |
| **Priority**        | P3                                                                              |
| **Preconditions**   | Old GPS positions exist                                                         |
| **Steps**           | 1. Run `/api/cron/gps-cleanup`                                                  |
| **Expected Result** | Old GPS positions archived/deleted per retention policy. Recent data preserved. |
| **Status**          |                                                                                 |
| **Actual Result**   |                                                                                 |
