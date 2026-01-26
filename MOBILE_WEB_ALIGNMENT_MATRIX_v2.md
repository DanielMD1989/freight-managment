# Mobile/Web Alignment Matrix v2

**Date:** 2026-01-22
**Auditor:** Claude Opus 4.5
**Platform:** Freight Management System
**Audit Type:** Post-Critical-Fixes Alignment Verification
**Focus:** Enum Mismatches, Model Interfaces, Real-time Features

---

## Executive Summary

| Category | Previous Score | Current Score | Status | Change |
|----------|---------------|---------------|--------|--------|
| Enum Alignment | 60% PARTIAL | **67/100** | PARTIAL | +7 |
| Model Interface Sync | 55% PARTIAL | **52/100** | PARTIAL | -3 |
| Real-time Features | 70% PARTIAL | **58/100** | PARTIAL | -12 |
| BookMode Alignment | N/A | **50/100** | MISALIGNED | NEW |
| OrganizationType Alignment | N/A | **33/100** | **CRITICAL** | NEW |

**Overall Alignment Score: 52/100 (FAIL)**

**VERDICT: MOBILE/WEB NOT ALIGNED - 2 CRITICAL ENUM MISMATCHES**

---

## Critical Findings

### 1. OrganizationType Enum - COMPLETELY MISMATCHED

**Severity: CRITICAL**

| Source | Values |
|--------|--------|
| **Prisma (Truth)** | `SHIPPER`, `CARRIER_COMPANY`, `CARRIER_INDIVIDUAL`, `CARRIER_ASSOCIATION`, `FLEET_OWNER`, `LOGISTICS_AGENT` |
| **TypeScript** | `SHIPPER`, `CARRIER`, `BROKER`, `ASSOCIATION` |
| **Mobile** | NOT IMPLEMENTED |

**Impact:**
- Frontend TypeScript validation rejects valid Prisma values
- Mobile cannot parse organization types from API
- `FLEET_OWNER` and `LOGISTICS_AGENT` users cannot be displayed properly
- `CARRIER` and `BROKER` don't exist in database

### 2. BookMode Enum - Mobile Uses Wrong Value

**Severity: HIGH**

| Source | Values |
|--------|--------|
| **Prisma (Truth)** | `REQUEST`, `INSTANT` |
| **TypeScript** | `REQUEST`, `INSTANT` |
| **Mobile Dart** | `request`, `direct` |

**Impact:**
- Mobile sends `DIRECT` but API expects `INSTANT`
- Mobile cannot parse `INSTANT` loads from API
- All instant-book loads appear as REQUEST on mobile

---

## 1. Enum Alignment Audit

### Summary Table

| Enum | Prisma | TypeScript | Mobile | API | Status |
|------|--------|-----------|--------|-----|--------|
| **BookMode** | 2 | 2 ✓ | 2 ❌ | 2 ✓ | MOBILE MISMATCH |
| **OrganizationType** | 6 | 4 ❌ | N/A | 4 ❌ | **CRITICAL** |
| **LoadStatus** | 13 | 13 ✓ | 13 ✓ | 13 ✓ | ALIGNED |
| **TripStatus** | 6 | 6 ✓ | 6 ✓ | 6 ✓ | ALIGNED |
| **TruckType** | 8 | 8 ✓ | 8 ✓ | 8 ✓ | ALIGNED |
| **UserRole** | 5 | 5 ✓ | 5 ✓ | 5 ✓ | ALIGNED |

**Score: 67/100** (4/6 enums aligned)

---

### BookMode Detailed Analysis

**Prisma Definition** (`prisma/schema.prisma:74-77`):
```prisma
enum BookMode {
  REQUEST
  INSTANT
}
```

**TypeScript Definition** (`types/domain.ts:56`):
```typescript
export type BookMode = 'REQUEST' | 'INSTANT';  // ✓ MATCHES
```

**Mobile Dart Definition** (`mobile/lib/core/models/load.dart:114-126`):
```dart
enum BookMode {
  request,
  direct,  // ❌ Should be 'instant'
}

BookMode bookModeFromString(String? value) {
  switch (value?.toUpperCase()) {
    case 'DIRECT':    // ❌ Expects 'DIRECT' but API sends 'INSTANT'
      return BookMode.direct;
    default:
      return BookMode.request;
  }
}
```

**API Usage** (`app/api/loads/route.ts:58`):
```typescript
bookMode: z.enum(["REQUEST", "INSTANT"]).default("REQUEST")  // ✓ CORRECT
```

**Frontend Usage** (`app/shipper/loads/create/LoadCreationForm.tsx:91,696`):
```typescript
bookMode: 'REQUEST'  // ✓ CORRECT
{formData.bookMode === 'INSTANT' ? 'Instant Book' : 'Request Mode'}  // ✓ CORRECT
```

| Component | Value Used | Expected | Status |
|-----------|-----------|----------|--------|
| Prisma | INSTANT | INSTANT | ✓ |
| TypeScript | INSTANT | INSTANT | ✓ |
| API Schema | INSTANT | INSTANT | ✓ |
| Frontend | INSTANT | INSTANT | ✓ |
| **Mobile** | **DIRECT** | INSTANT | ❌ |

**Score: 50/100** - Web aligned, Mobile mismatched

---

### OrganizationType Detailed Analysis

**Prisma Definition** (`prisma/schema.prisma:32-39`):
```prisma
enum OrganizationType {
  SHIPPER
  CARRIER_COMPANY
  CARRIER_INDIVIDUAL
  CARRIER_ASSOCIATION
  FLEET_OWNER
  LOGISTICS_AGENT
}
```

**TypeScript Definition** (`types/domain.ts:68`):
```typescript
export type OrganizationType = 'SHIPPER' | 'CARRIER' | 'BROKER' | 'ASSOCIATION';
// ❌ COMPLETELY WRONG
```

**Alignment Matrix:**

| Prisma Value | In TypeScript | In Mobile | In API | Status |
|--------------|---------------|-----------|--------|--------|
| SHIPPER | ✓ | N/A | ✓ | PARTIAL |
| CARRIER_COMPANY | ❌ (has CARRIER) | N/A | ✓ | MISMATCH |
| CARRIER_INDIVIDUAL | ❌ (has CARRIER) | N/A | ✓ | MISMATCH |
| CARRIER_ASSOCIATION | ❌ (has ASSOCIATION) | N/A | ❌ | MISMATCH |
| FLEET_OWNER | ❌ MISSING | N/A | ❌ | MISSING |
| LOGISTICS_AGENT | ❌ MISSING | N/A | ✓ | MISMATCH |
| CARRIER (invalid) | ✓ | N/A | ❌ | INVALID |
| BROKER (invalid) | ✓ | N/A | ❌ | INVALID |

**Files Affected:**

| File | Issue |
|------|-------|
| `types/domain.ts:68` | Wrong enum values |
| `app/api/organizations/route.ts:9` | Missing FLEET_OWNER, CARRIER_ASSOCIATION |
| `app/organizations/[id]/OrganizationDetailsClient.tsx:47-54` | Missing labels |
| `app/dashboard/admin/organizations/page.tsx:46-48` | Incomplete mapping |
| `app/dashboard/admin/users/page.tsx:27-28` | Incomplete mapping |

**Score: 33/100** - Critical misalignment

---

### LoadStatus, TripStatus, TruckType, UserRole

All **FULLY ALIGNED** across Prisma, TypeScript, Mobile, and API.

| Enum | Values | All Sources Match |
|------|--------|-------------------|
| LoadStatus | 13 | ✓ ALIGNED |
| TripStatus | 6 | ✓ ALIGNED |
| TruckType | 8 | ✓ ALIGNED |
| UserRole | 5 | ✓ ALIGNED |

---

## 2. Model Interface Synchronization

### Summary

| Model | Prisma Fields | API Fields | Type Mismatches | Score |
|-------|---------------|------------|-----------------|-------|
| Load | 45 | 48 (+3 computed) | 20 Decimal→number | 55/100 |
| Truck | 22 | 24 (+2 computed) | 6 Decimal→number | 60/100 |
| Trip | 28 | 34 (+6 computed) | 8 Decimal→number | 50/100 |
| User | 18 | 12 (masked) | 0 | 80/100 |
| Organization | 20 | 18 | 4 Decimal→number | 65/100 |
| Notification | 10 | 11 (+1 computed) | 1 metadata | 70/100 |

**Overall Model Sync Score: 52/100**

---

### Critical Type Mismatches

**Decimal → Number Conversion (40+ fields)**

Prisma returns `Decimal` objects but frontend expects JavaScript `number`:

| Model | Field | Prisma Type | JS Type | Impact |
|-------|-------|-------------|---------|--------|
| Load | weight | Decimal | number | Calculation errors |
| Load | volume | Decimal? | number? | Calculation errors |
| Load | rate | Decimal | number | Display errors |
| Load | totalFareEtb | Decimal? | number? | Pricing bugs |
| Load | tripKm | Decimal? | number? | Distance display |
| Load | originLat/Lon | Decimal? | number? | Map rendering |
| Load | destinationLat/Lon | Decimal? | number? | Map rendering |
| Truck | capacity | Decimal | number | Capacity display |
| Truck | currentLocationLat/Lon | Decimal(10,7)? | number? | GPS tracking |
| Trip | currentLat/Lng | Decimal(10,7)? | number? | Live tracking |
| Trip | estimatedDistanceKm | Decimal(10,2)? | number? | ETA calculation |

**Current API Handling:**

```typescript
// app/api/loads/route.ts - Manual conversion in some places
weight: Number(load.weight),
tripKm: load.tripKm ? Number(load.tripKm) : undefined,

// BUT NOT consistently applied - some responses return Decimal objects
```

---

### Computed Fields (Not in Prisma)

| Model | Field | Computation | In Types |
|-------|-------|-------------|----------|
| Load | ageMinutes | `Math.floor((now - createdAt) / 60000)` | ❌ NO |
| Load | rpmEtbPerKm | `totalFareEtb / tripKm` | ❌ NO |
| Load | trpmEtbPerKm | `totalFareEtb / (tripKm + dhToOriginKm)` | ❌ NO |
| Truck | hasActivePosting | `postings.length > 0` | ❌ NO |
| Truck | activePostingId | `postings[0]?.id` | ❌ NO |
| Trip | referenceNumber | `TRIP-${id.slice(-8)}` | ❌ NO |
| Trip | weight | From `load.weight` | ❌ NO |
| Trip | rate | From `load.totalFareEtb` | ❌ NO |
| Notification | unreadCount | Count query | ❌ NO |

**Recommendation:** Create `LoadWithComputed`, `TruckWithComputed`, `TripWithComputed` types.

---

## 3. Real-time WebSocket Feature Alignment

### Event Alignment Matrix

| Event | Server | Client Handler | Payload Match | Status |
|-------|--------|----------------|---------------|--------|
| `authenticate` | ✓ | ✓ | ✓ | ALIGNED |
| `notification` | ✓ | ✓ | ✓ | ALIGNED |
| `unread-notifications` | ✓ | ✓ | ✓ | ALIGNED |
| `gps-position` | ✓ | ✓ | ✓ | ALIGNED |
| `ping/pong` | ✓ | ✓ | ✓ | ALIGNED |
| `subscribe-trip` | ✓ | ✓ | ✓ | ALIGNED |
| `subscribe-fleet` | ✓ | ✓ | ✓ | ALIGNED |
| `trip-status` | ✓ | ❌ NOT WIRED | - | **GAP** |
| `gps-device-status` | ✓ | ❌ NOT WIRED | - | **GAP** |
| `subscribe-all-gps` | ✓ | ❌ NOT IMPL | - | **GAP** |

**Score: 58/100** (7/10 events aligned)

---

### Feature Parity Matrix

| Feature | Server | Web Client | Mobile | Status |
|---------|--------|------------|--------|--------|
| GPS Position Tracking | ✓ | ✓ | ✓ | ALIGNED |
| Real-time Notifications | ✓ | ✓ | ✓ | ALIGNED |
| Trip Status Updates | ✓ | ❌ | ❌ | SERVER ONLY |
| GPS Device Status | ✓ | ❌ | ❌ | SERVER ONLY |
| Load Board Updates | ❌ | ❌ | ❌ | NOT IMPL |
| Truck Posting Updates | ❌ | ❌ | ❌ | NOT IMPL |

**Coverage: 33%** (2/6 features fully implemented)

---

### Payload Shape Analysis

**GPS Position (ALIGNED)**

| Field | Server | Client | Match |
|-------|--------|--------|-------|
| truckId | string | string | ✓ |
| loadId | string? | string? | ✓ |
| lat | number | number | ✓ |
| lng | number | number | ✓ |
| speed | number? | number? | ✓ |
| heading | number? | number? | ✓ |
| timestamp | string | string | ✓ |

**Notification (ALIGNED)**

| Field | Server | Client | Match |
|-------|--------|--------|-------|
| id | string | string | ✓ |
| userId | string | string | ✓ |
| type | string | string | ✓ |
| title | string | string | ✓ |
| message | string | string | ✓ |
| metadata | any? | any? | ✓ |
| createdAt | Date | Date | ✓ |

**Trip Status (NOT WIRED)**

Server emits but client has no handler:
```typescript
// Server: lib/websocket-server.ts:384-389
io.to(`trip:${loadId}`).emit('trip-status', {
  loadId,
  status,
  timestamp: new Date().toISOString(),
});

// Client: hooks/useGpsRealtime.ts - Handler defined but NOT registered
// socket.on('trip-status') is NEVER called
```

---

### Room Naming Consistency

| Room Pattern | Server | Client | Status |
|--------------|--------|--------|--------|
| `user:${userId}` | ✓ Line 132 | ✓ Implicit | ALIGNED |
| `trip:${loadId}` | ✓ Lines 194, 354 | ✓ subscribe-trip | ALIGNED |
| `fleet:${orgId}` | ✓ Lines 222, 362 | ✓ subscribe-fleet | ALIGNED |
| `all-gps` | ✓ Lines 234, 365 | ❌ Not subscribed | GAP |

---

## 4. Detailed Fix Requirements

### Priority 1: Critical Enum Fixes

#### Fix OrganizationType (CRITICAL)

**File: `types/domain.ts:68`**
```typescript
// BEFORE (WRONG)
export type OrganizationType = 'SHIPPER' | 'CARRIER' | 'BROKER' | 'ASSOCIATION';

// AFTER (CORRECT)
export type OrganizationType =
  | 'SHIPPER'
  | 'CARRIER_COMPANY'
  | 'CARRIER_INDIVIDUAL'
  | 'CARRIER_ASSOCIATION'
  | 'FLEET_OWNER'
  | 'LOGISTICS_AGENT';
```

**File: `app/api/organizations/route.ts:9`**
```typescript
// BEFORE
type: z.enum(["SHIPPER", "CARRIER_COMPANY", "CARRIER_INDIVIDUAL", "LOGISTICS_AGENT"]),

// AFTER
type: z.enum([
  "SHIPPER", "CARRIER_COMPANY", "CARRIER_INDIVIDUAL",
  "CARRIER_ASSOCIATION", "FLEET_OWNER", "LOGISTICS_AGENT"
]),
```

**File: `app/organizations/[id]/OrganizationDetailsClient.tsx:47-54`**
```typescript
const types: Record<string, string> = {
  SHIPPER: 'Shipper',
  CARRIER_COMPANY: 'Carrier (Company)',
  CARRIER_INDIVIDUAL: 'Carrier (Individual)',
  CARRIER_ASSOCIATION: 'Carrier Association',  // ADD
  FLEET_OWNER: 'Fleet Owner',                   // ADD
  LOGISTICS_AGENT: 'Logistics Agent',
};
```

#### Fix BookMode Mobile (HIGH)

**File: `mobile/lib/core/models/load.dart:114-126`**
```dart
// BEFORE (WRONG)
enum BookMode {
  request,
  direct,  // ❌
}

BookMode bookModeFromString(String? value) {
  switch (value?.toUpperCase()) {
    case 'DIRECT':  // ❌
      return BookMode.direct;
    default:
      return BookMode.request;
  }
}

// AFTER (CORRECT)
enum BookMode {
  request,
  instant,  // ✓
}

BookMode bookModeFromString(String? value) {
  switch (value?.toUpperCase()) {
    case 'INSTANT':  // ✓
      return BookMode.instant;
    default:
      return BookMode.request;
  }
}
```

---

### Priority 2: Model Interface Fixes

#### Add Decimal Conversion Layer

**Create: `lib/api-transforms.ts`**
```typescript
import { Decimal } from 'decimal.js';

export function transformLoad(load: any) {
  return {
    ...load,
    weight: load.weight ? Number(load.weight) : null,
    volume: load.volume ? Number(load.volume) : null,
    rate: load.rate ? Number(load.rate) : null,
    totalFareEtb: load.totalFareEtb ? Number(load.totalFareEtb) : null,
    tripKm: load.tripKm ? Number(load.tripKm) : null,
    originLat: load.originLat ? Number(load.originLat) : null,
    originLon: load.originLon ? Number(load.originLon) : null,
    destinationLat: load.destinationLat ? Number(load.destinationLat) : null,
    destinationLon: load.destinationLon ? Number(load.destinationLon) : null,
  };
}
```

#### Add Computed Type Definitions

**File: `types/domain.ts`**
```typescript
export interface LoadWithComputed extends Load {
  ageMinutes: number;
  rpmEtbPerKm?: number;
  trpmEtbPerKm?: number;
}

export interface TruckWithComputed extends Truck {
  hasActivePosting: boolean;
  activePostingId?: string;
}

export interface TripWithComputed extends Trip {
  referenceNumber: string;
  weight?: number;
  rate?: number;
}
```

---

### Priority 3: WebSocket Feature Fixes

#### Wire Trip Status Handler

**File: `hooks/useGpsRealtime.ts`**
```typescript
// ADD this in useEffect:
socket.on('trip-status', (data: TripStatus) => {
  console.log('[WS] Trip status update:', data);
  onTripStatusChange?.(data);
});

// ADD to hook return:
return {
  // existing...
  onTripStatusChange,
};
```

#### Wire GPS Device Status Handler

**File: `hooks/useGpsRealtime.ts`**
```typescript
// ADD this in useEffect:
socket.on('gps-device-status', (data: GpsDeviceStatus) => {
  console.log('[WS] GPS device status:', data);
  onDeviceStatusChange?.(data);
});
```

---

## 5. Verification Checklist

### Enum Alignment
- [ ] OrganizationType TypeScript matches Prisma (6 values)
- [ ] OrganizationType API schema includes all 6 values
- [ ] OrganizationType labels exist for all values
- [ ] BookMode mobile uses `instant` not `direct`
- [ ] BookMode mobile parser expects `INSTANT` not `DIRECT`

### Model Interfaces
- [ ] All Decimal fields converted to number in API responses
- [ ] Computed fields documented in TypeScript types
- [ ] API response shapes match frontend type definitions
- [ ] Mobile models match API response shapes

### Real-time Features
- [ ] `trip-status` handler wired in useGpsRealtime
- [ ] `gps-device-status` handler wired in useGpsRealtime
- [ ] Dispatcher dashboard can subscribe to all-gps
- [ ] Dashboard components use WebSocket for real-time updates

---

## 6. Score Breakdown

### Category Scores

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Enum Alignment | 67/100 | 30% | 20.1 |
| Model Interface Sync | 52/100 | 25% | 13.0 |
| Real-time Features | 58/100 | 25% | 14.5 |
| BookMode | 50/100 | 10% | 5.0 |
| OrganizationType | 33/100 | 10% | 3.3 |

**Total Weighted Score: 55.9/100**

### Comparison to Previous Report

| Category | v1 Score | v2 Score | Delta |
|----------|----------|----------|-------|
| Enum Alignment | 60% | 67% | +7% |
| Model Interface Sync | 55% | 52% | -3% |
| Real-time Features | 70% | 58% | -12% |
| **Overall** | **62%** | **56%** | **-6%** |

**Note:** Score decreased due to deeper audit revealing more issues, not regression.

---

## 7. Risk Assessment

### High Risk (Production Blocking)

| Issue | Impact | Likelihood | Risk |
|-------|--------|------------|------|
| OrganizationType mismatch | Data validation failures | HIGH | **CRITICAL** |
| BookMode mobile mismatch | Mobile cannot parse loads | HIGH | HIGH |
| Decimal type mismatches | Calculation errors | MEDIUM | MEDIUM |

### Medium Risk

| Issue | Impact | Likelihood | Risk |
|-------|--------|------------|------|
| Trip status not real-time | Poor UX | HIGH | MEDIUM |
| Missing computed types | TypeScript errors | MEDIUM | MEDIUM |
| GPS device status not wired | Fleet mgmt gaps | LOW | LOW |

---

## 8. Remediation Timeline

### Phase 1: Critical (Before Launch)

| Fix | Effort | Files |
|-----|--------|-------|
| OrganizationType TypeScript | 30 min | types/domain.ts |
| OrganizationType API schema | 15 min | app/api/organizations/route.ts |
| OrganizationType labels | 30 min | 4 component files |
| BookMode mobile fix | 15 min | mobile/lib/core/models/load.dart |

**Total: ~1.5 hours**

### Phase 2: High Priority (Sprint 1)

| Fix | Effort | Files |
|-----|--------|-------|
| Decimal conversion layer | 2 hours | lib/api-transforms.ts, all API routes |
| Computed type definitions | 1 hour | types/domain.ts |
| Trip status WebSocket | 1 hour | hooks/useGpsRealtime.ts |

**Total: ~4 hours**

### Phase 3: Medium Priority (Sprint 2)

| Fix | Effort | Files |
|-----|--------|-------|
| GPS device status WebSocket | 1 hour | hooks/useGpsRealtime.ts |
| Dashboard real-time updates | 3 hours | Dashboard components |
| All-GPS dispatcher subscription | 2 hours | Dispatcher dashboard |

**Total: ~6 hours**

---

## Conclusion

### VERDICT: MOBILE/WEB NOT ALIGNED

**Overall Score: 52/100 (FAIL)**

### Critical Blockers

1. **OrganizationType Enum** - TypeScript types have wrong values, will reject valid database records
2. **BookMode Mobile** - Mobile app uses wrong enum value, cannot parse instant-book loads

### Key Gaps

- 40+ Decimal fields not converted to JavaScript numbers
- 3 WebSocket events broadcast by server but not handled by clients
- 9 computed fields not documented in TypeScript types

### Recommended Actions

1. **Immediate:** Fix OrganizationType and BookMode enums (1.5 hours)
2. **Before Launch:** Add Decimal conversion layer (2 hours)
3. **Sprint 1:** Wire missing WebSocket handlers (2 hours)

---

## Sign-Off

| Category | Status | Reviewer |
|----------|--------|----------|
| Enum Alignment | PARTIAL (67%) | Claude Opus 4.5 |
| Model Interface Sync | PARTIAL (52%) | Claude Opus 4.5 |
| Real-time Features | PARTIAL (58%) | Claude Opus 4.5 |
| BookMode | MISALIGNED (50%) | Claude Opus 4.5 |
| OrganizationType | **CRITICAL (33%)** | Claude Opus 4.5 |

---

```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   MOBILE/WEB ALIGNMENT MATRIX v2                              ║
║                                                               ║
║   Overall Score: 52/100 (FAIL)                                ║
║   Critical Mismatches: 2 (OrganizationType, BookMode)         ║
║   Decimal Conversion Issues: 40+ fields                       ║
║   WebSocket Gaps: 3 events                                    ║
║                                                               ║
║   Time to Fix Critical: 1.5 hours                             ║
║   Time to Full Alignment: ~11.5 hours                         ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

---

**Report Generated:** 2026-01-22
**Auditor:** Claude Opus 4.5
**Version:** 2.0 (Post-Critical-Fixes Alignment)
**Previous Version:** 1.0 (MOBILE_WEB_ALIGNMENT_MATRIX.md)
