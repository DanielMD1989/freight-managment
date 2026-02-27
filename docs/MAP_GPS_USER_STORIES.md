# MAP + GPS Implementation - User Stories & Plan

## Overview

This document defines the complete MAP + GPS implementation for the freight management platform. All map functionality is **trip-centric** - data is tied to `tripId`.

---

## Core Data Model

### Trip Object

```typescript
interface Trip {
  tripId: string;
  carrierId: string;
  shipperId: string;
  truckId: string;
  loadId: string;
  status:
    | "ASSIGNED"
    | "PICKUP_PENDING"
    | "IN_TRANSIT"
    | "DELIVERED"
    | "COMPLETED";
  currentLocation: { lat: number; lng: number } | null;
  routeHistory: GpsPosition[]; // For history playback
  pickupLocation: { lat: number; lng: number; address: string };
  deliveryLocation: { lat: number; lng: number; address: string };
  startedAt: Date | null;
  completedAt: Date | null;
}
```

### GPS Rules (Global)

- GPS updates come **only from carrier side** (driver/truck)
- GPS is **active** when: Trip status = `IN_TRANSIT`
- GPS **stops** when: Trip status = `COMPLETED`

---

## User Stories by Role

### Epic 1: Super Admin / Admin Map Access

#### Story 1.1: Global Trip Overview

**As a** Super Admin/Admin
**I want to** view all active and historical trips on a map
**So that** I can monitor platform-wide operations

**Acceptance Criteria:**

- [ ] See all active trips with live GPS positions
- [ ] Filter by carrier, shipper, status, date range
- [ ] Click trip to see details (carrier, shipper, load info)
- [ ] Toggle between active and historical view
- [ ] See trip statistics (count, avg duration, etc.)

#### Story 1.2: Fleet Overview

**As a** Super Admin/Admin
**I want to** view all registered vehicles on a map
**So that** I can see fleet distribution and availability

**Acceptance Criteria:**

- [ ] See all trucks with GPS devices
- [ ] Color-coded by status (available, in-transit, offline)
- [ ] Click truck to see details and current trip if any
- [ ] Filter by carrier, truck type, GPS status

#### Story 1.3: Historical Trip Playback

**As a** Super Admin/Admin
**I want to** replay historical trip routes
**So that** I can audit trip execution and resolve disputes

**Acceptance Criteria:**

- [ ] Select completed trip from list
- [ ] Play route animation on map
- [ ] See timestamps at each position
- [ ] Speed controls (1x, 2x, 5x)
- [ ] Export route data

---

### Epic 2: Dispatcher Map Access

#### Story 2.1: Dispatch Map Dashboard

**As a** Dispatcher
**I want to** view all vehicles and trips on a single map
**So that** I can coordinate load assignments effectively

**Acceptance Criteria:**

- [ ] See all trucks (posted availability)
- [ ] See all active trips
- [ ] Click truck to see availability details
- [ ] Click trip to see progress
- [ ] Filter by region, status, truck type

#### Story 2.2: Load-Truck Matching Map

**As a** Dispatcher
**I want to** see loads and available trucks on map
**So that** I can visually match loads with nearby trucks

**Acceptance Criteria:**

- [ ] Show posted loads as markers (pickup location)
- [ ] Show available trucks as markers (current location)
- [ ] Calculate and display DH-O (deadhead to origin) distance
- [ ] Click to propose match
- [ ] Filter by truck type, weight capacity

#### Story 2.3: Trip Monitoring

**As a** Dispatcher
**I want to** monitor all active trip progress
**So that** I can identify delays and escalate issues

**Acceptance Criteria:**

- [ ] Real-time position updates
- [ ] ETA calculations
- [ ] Delay alerts (behind schedule)
- [ ] GPS signal status indicators
- [ ] Cannot start/stop trips (view only)

---

### Epic 3: Carrier Map Access

#### Story 3.1: My Trucks Map View

**As a** Carrier
**I want to** see all my trucks on a map
**So that** I can track my fleet location

**Acceptance Criteria:**

- [ ] See only my organization's trucks
- [ ] Color-coded by status (available, on-trip, offline)
- [ ] Click truck to see details
- [ ] GPS status indicator per truck

#### Story 3.2: Active Trips Map

**As a** Carrier
**I want to** track my active trips on a map
**So that** I can monitor delivery progress

**Acceptance Criteria:**

- [ ] See all my active trips (IN_TRANSIT)
- [ ] Live truck position on route
- [ ] Pickup and delivery markers
- [ ] Route line visualization
- [ ] Real-time updates (WebSocket)

#### Story 3.3: Trip History Map

**As a** Carrier
**I want to** view historical trip routes
**So that** I can review past deliveries

**Acceptance Criteria:**

- [ ] List of completed trips
- [ ] Click to view route on map
- [ ] See full route taken
- [ ] Start/end timestamps
- [ ] Distance traveled

#### Story 3.4: GPS Data Ownership

**As a** Carrier
**I am** the only source of GPS updates
**So that** location data is accurate and controlled

**Acceptance Criteria:**

- [ ] Only carrier can update GPS position
- [ ] GPS writes validated against carrierId
- [ ] Trip must belong to carrier to update
- [ ] GPS stops automatically on trip completion

---

### Epic 4: Shipper Map Access

#### Story 4.1: Track My Shipment

**As a** Shipper
**I want to** track my assigned load on a map
**So that** I can monitor delivery progress

**Acceptance Criteria:**

- [ ] Map access only after carrier approves load
- [ ] Map visible only when trip is IN_TRANSIT
- [ ] See current truck location
- [ ] See route (pickup → delivery)
- [ ] Cannot see other vehicles or trips

#### Story 4.2: Trip History (Read-Only)

**As a** Shipper
**I want to** view completed trip routes
**So that** I can verify delivery execution

**Acceptance Criteria:**

- [ ] List of my completed trips
- [ ] View route on map (read-only)
- [ ] See delivery confirmation location
- [ ] Cannot see other shippers' trips

#### Story 4.3: Access Control

**As a** Shipper
**My map access** requires:

- Load must be approved by carrier
- Trip must be created
- Trip status must be IN_TRANSIT (for live tracking)

---

### Epic 5: Google Maps Integration

#### Story 5.1: Replace Leaflet with Google Maps

**As a** Developer
**I want to** use Google Maps instead of Leaflet
**So that** we have advanced features (routing, traffic, etc.)

**Acceptance Criteria:**

- [ ] Google Maps JS API integrated
- [ ] Map renders with Google Maps tiles
- [ ] Custom markers for trucks, loads
- [ ] Route polylines
- [ ] InfoWindows for details

#### Story 5.2: Road Distance Calculation

**As a** System
**I want to** calculate road distances using Google Routes API
**So that** DH-O and DH-D are accurate (not straight-line)

**Acceptance Criteria:**

- [ ] Calculate DH-O (truck origin → load pickup)
- [ ] Calculate DH-D (load delivery → truck destination)
- [ ] Cache distance calculations
- [ ] Fallback to Haversine if API fails
- [ ] Display road distance in load matching

#### Story 5.3: Route Display

**As a** User viewing map
**I want to** see actual road routes (not straight lines)
**So that** I understand the real path

**Acceptance Criteria:**

- [ ] Show driving route between points
- [ ] Route follows actual roads
- [ ] Display distance and estimated time
- [ ] Update route on position change

---

### Epic 6: Real-Time WebSocket Updates

#### Story 6.1: WebSocket GPS Broadcasting

**As a** System
**I want to** broadcast GPS updates via WebSocket
**So that** map updates are instant (no polling)

**Acceptance Criteria:**

- [ ] WebSocket server for GPS events
- [ ] Subscribe by tripId
- [ ] Role-based subscription filtering
- [ ] Broadcast on GPS position update
- [ ] Heartbeat for connection health

#### Story 6.2: Live Map Updates

**As a** User viewing active trip
**I want to** see position updates in real-time
**So that** I have accurate current location

**Acceptance Criteria:**

- [ ] Map updates without page refresh
- [ ] Sub-second latency
- [ ] Smooth marker animation
- [ ] Connection status indicator
- [ ] Auto-reconnect on disconnect

---

### Epic 7: Menu & Navigation

#### Story 7.1: Carrier Menu Structure

```
Carrier Side Menu:
├── Dashboard
├── Map                    ← Standalone (Fleet + Active Trips)
├── My Trucks
├── Loads
│   ├── Search Loads
│   └── Post Trucks
├── Trips
│   ├── Active Trips
│   └── Trip History
└── Settings
```

#### Story 7.2: Shipper Menu Structure

```
Shipper Side Menu:
├── Dashboard
├── Map                    ← Standalone (My Active Trip tracking)
├── My Loads
│   ├── Create Load
│   └── Posted Loads
├── Trips
│   ├── Active Trip
│   └── Trip History (read-only)
└── Settings
```

#### Story 7.3: Dispatcher Menu Structure

```
Dispatcher Side Menu:
├── Dashboard
├── Map                    ← Standalone (All Vehicles + Trips + Matching)
├── Loads
├── Trucks
├── Match Proposals
└── Settings
```

#### Story 7.4: Admin / Super Admin Menu Structure

```
Admin Side Menu:
├── Dashboard
├── Map                    ← Standalone (Global Overview - All Trips/Vehicles)
├── Users
├── Organizations
├── Loads
├── Trucks
├── GPS Devices
├── Reports
└── Settings
```

---

## Permission Matrix

| Action              | Super Admin | Admin | Dispatcher | Carrier  | Shipper  |
| ------------------- | ----------- | ----- | ---------- | -------- | -------- |
| View all trips      | ✅          | ✅    | ✅         | ❌       | ❌       |
| View own trips      | ✅          | ✅    | ✅         | ✅       | ✅\*     |
| View all vehicles   | ✅          | ✅    | ✅         | ❌       | ❌       |
| View own vehicles   | ✅          | ✅    | ✅         | ✅       | ❌       |
| Write GPS data      | ❌          | ❌    | ❌         | ✅       | ❌       |
| Start/Stop trips    | ❌          | ❌    | ❌         | ✅       | ❌       |
| Historical playback | ✅          | ✅    | ✅         | ✅ (own) | ✅ (own) |
| Load matching map   | ✅          | ✅    | ✅         | ❌       | ❌       |

\*Shipper: Only when trip IN_TRANSIT and load approved

---

## API Endpoints

### GPS Endpoints

```
POST   /api/trips/[tripId]/gps          - Update GPS position (Carrier only)
GET    /api/trips/[tripId]/live         - Get live position
GET    /api/trips/[tripId]/history      - Get route history
```

### Map Data Endpoints

```
GET    /api/map/trips                   - Get trips for map (role-filtered)
GET    /api/map/vehicles                - Get vehicles for map (role-filtered)
GET    /api/map/loads                   - Get posted loads for matching map
```

### Distance Calculation

```
GET    /api/distance?origin=lat,lng&dest=lat,lng  - Calculate road distance
POST   /api/distance/batch              - Batch distance calculation
```

### WebSocket Events

```
connect    → { tripId: string, role: string }
position   → { tripId, lat, lng, timestamp, speed }
disconnect → cleanup subscription
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)

- [ ] Google Maps component (replace Leaflet)
- [ ] Trip GPS model updates
- [ ] Basic map rendering
- [ ] Role-based access middleware

### Phase 2: Core Features (Week 2)

- [ ] Active trip tracking (Carrier/Shipper)
- [ ] Fleet map (Carrier)
- [ ] GPS position API
- [ ] Route visualization

### Phase 3: Advanced Features (Week 3)

- [ ] Google Routes API integration (road distances)
- [ ] WebSocket real-time updates
- [ ] Trip history playback
- [ ] Admin/Dispatcher dashboards

### Phase 4: Polish (Week 4)

- [ ] Load matching map
- [ ] Performance optimization
- [ ] Mobile responsiveness
- [ ] Error handling & edge cases

---

## Done Criteria

- [ ] All trips have tripId
- [ ] Map loads data by tripId
- [ ] Role-based map visibility enforced
- [ ] Carrier & Shipper have "Trips" menu with map
- [ ] Google Maps integrated (Leaflet removed)
- [ ] Real-time WebSocket updates working
- [ ] Road distance calculations accurate
- [ ] GPS writes restricted to carrier only
- [ ] Historical trip playback functional

---

## Technical Notes

### Google Maps API Keys Required

- Maps JavaScript API
- Routes API (for directions)
- Geocoding API (optional)

### WebSocket Implementation

- Use Socket.io (already installed)
- Room-based subscriptions by tripId
- JWT authentication for connections

### Caching Strategy

- Cache road distances (origin-dest pairs)
- Cache geocoding results
- TTL: 24 hours for distances

### Mobile Considerations

- Touch-friendly markers
- Responsive map container
- Reduced update frequency on mobile
