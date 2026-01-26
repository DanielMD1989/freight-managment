# Mobile/Web Alignment Matrix v3

**Date:** 2026-01-23
**Auditor:** Claude Opus 4.5
**Scope:** OrganizationType, BookMode, Decimal Conversion, WebSocket Events

---

## Executive Summary

| Component | Status | Score | Critical Issues |
|-----------|--------|-------|-----------------|
| OrganizationType | ✅ ALIGNED | 100% | 0 |
| BookMode | ✅ ALIGNED | 100% | 0 |
| Decimal Conversion | ⚠️ PARTIAL | 40% | 2 |
| WebSocket Events | ❌ MISSING | 0% | 1 (Architecture) |

**Overall Alignment Score: 60/100**

---

## 1. ORGANIZATIONTYPE ALIGNMENT

### 1.1 Value Matrix

| Prisma (Source) | TypeScript | Dart Enum | Dart .value | Status |
|-----------------|------------|-----------|-------------|--------|
| `SHIPPER` | `'SHIPPER'` | `shipper` | `'SHIPPER'` | ✅ |
| `CARRIER_COMPANY` | `'CARRIER_COMPANY'` | `carrierCompany` | `'CARRIER_COMPANY'` | ✅ |
| `CARRIER_INDIVIDUAL` | `'CARRIER_INDIVIDUAL'` | `carrierIndividual` | `'CARRIER_INDIVIDUAL'` | ✅ |
| `CARRIER_ASSOCIATION` | `'CARRIER_ASSOCIATION'` | `carrierAssociation` | `'CARRIER_ASSOCIATION'` | ✅ |
| `FLEET_OWNER` | `'FLEET_OWNER'` | `fleetOwner` | `'FLEET_OWNER'` | ✅ |
| `LOGISTICS_AGENT` | `'LOGISTICS_AGENT'` | `logisticsAgent` | `'LOGISTICS_AGENT'` | ✅ |

### 1.2 Implementation Details

| Platform | File | Lines | Implementation |
|----------|------|-------|----------------|
| Prisma | `prisma/schema.prisma` | 32-39 | Enum definition |
| TypeScript | `types/domain.ts` | 68-74 | Union type |
| Dart | `mobile/lib/core/models/user.dart` | 2-72 | Enum + Extension |

### 1.3 Dart Serialization

```dart
extension OrganizationTypeExtension on OrganizationType {
  String get value { ... }           // → 'CARRIER_COMPANY'
  String get displayName { ... }     // → 'Carrier Company'
  static OrganizationType fromString(String value) { ... }
  bool get isCarrierType { ... }     // Helper
}
```

### 1.4 Assessment

| Check | Result |
|-------|--------|
| Value count matches | ✅ 6/6 |
| SCREAMING_CASE format | ✅ Consistent |
| Serialization correct | ✅ `.value` returns correct format |
| Deserialization correct | ✅ `fromString()` handles all cases |
| Default value | ✅ `shipper` / `'SHIPPER'` |

**Status: ✅ FULLY ALIGNED (100%)**

---

## 2. BOOKMODE ALIGNMENT

### 2.1 Value Matrix

| Prisma (Source) | TypeScript | Dart Enum | Dart .value | Status |
|-----------------|------------|-----------|-------------|--------|
| `REQUEST` | `'REQUEST'` | `request` | `'REQUEST'` | ✅ |
| `INSTANT` | `'INSTANT'` | `instant` | `'INSTANT'` | ✅ |

### 2.2 Implementation Details

| Platform | File | Lines | Implementation |
|----------|------|-------|----------------|
| Prisma | `prisma/schema.prisma` | 74-77 | Enum definition |
| TypeScript | `types/domain.ts` | 56 | Union type |
| Dart | `mobile/lib/core/models/load.dart` | 113-157 | Enum + Extension |

### 2.3 Dart Serialization

```dart
extension BookModeExtension on BookMode {
  String get value { ... }           // → 'REQUEST' or 'INSTANT'
  String get displayName { ... }     // → 'Request' or 'Instant'
  static BookMode fromString(String? value) { ... }
}
```

### 2.4 Legacy Value Check

| Legacy Value | Found In Code | Status |
|--------------|---------------|--------|
| `'direct'` | ❌ Not found | ✅ Clean |
| `'DIRECT'` | ❌ Not found | ✅ Clean |
| `BookMode.direct` | ❌ Not found | ✅ Clean |

### 2.5 Assessment

| Check | Result |
|-------|--------|
| Value count matches | ✅ 2/2 |
| SCREAMING_CASE format | ✅ Consistent |
| Serialization correct | ✅ `.value` returns correct format |
| Deserialization correct | ✅ `fromString()` case-insensitive |
| Default value | ✅ `request` / `'REQUEST'` |
| Legacy values removed | ✅ No `direct`/`DIRECT` in code |

**Status: ✅ FULLY ALIGNED (100%)**

---

## 3. DECIMAL CONVERSION LAYER

### 3.1 Field Inventory

#### Money Fields (Precision: 10,2)

| Field | Prisma Type | TS API Response | Dart Type | Risk |
|-------|-------------|-----------------|-----------|------|
| `baseFareEtb` | `Decimal(10,2)` | `number` | `double` | LOW |
| `perKmEtb` | `Decimal(10,2)` | `number` | `double` | LOW |
| `totalFareEtb` | `Decimal(10,2)` | `number` | `double` | LOW |
| `rate` | `Decimal` | `number` | `double` | LOW |
| `shipperServiceFee` | `Decimal(10,2)` | `number` | `double` | LOW |
| `carrierServiceFee` | `Decimal(10,2)` | `number` | `double` | LOW |
| `balance` | `Decimal(12,2)` | `number` | `double` | LOW |
| `amount` | `Decimal(12,2)` | `number` | `double` | LOW |

#### GPS/Distance Fields (Precision: 10,7)

| Field | Prisma Type | TS API Response | Dart Type | Risk |
|-------|-------------|-----------------|-----------|------|
| `currentLocationLat` | `Decimal(10,7)` | `number` | `double` | MEDIUM |
| `currentLocationLng` | `Decimal(10,7)` | `number` | `double` | MEDIUM |
| `pickupLat` | `Decimal(10,7)` | `number` | `double` | MEDIUM |
| `pickupLng` | `Decimal(10,7)` | `number` | `double` | MEDIUM |
| `deliveryLat` | `Decimal(10,7)` | `number` | `double` | MEDIUM |
| `deliveryLng` | `Decimal(10,7)` | `number` | `double` | MEDIUM |

#### Corridor Pricing (Precision: 10,4)

| Field | Prisma Type | TS API Response | Dart Type | Risk |
|-------|-------------|-----------------|-----------|------|
| `shipperPricePerKm` | `Decimal(10,4)` | `number` | `double` | MEDIUM |
| `carrierPricePerKm` | `Decimal(10,4)` | `number` | `double` | MEDIUM |

### 3.2 Conversion Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  PostgreSQL     │     │  TypeScript API  │     │  Dart Mobile    │
│  Decimal(10,2)  │ ──► │  .toNumber()     │ ──► │  double         │
│  123.45         │     │  123.45 (number) │     │  123.45         │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### 3.3 TypeScript Conversion Pattern

```typescript
// lib/pricingCalculation.ts - CORRECT
import Decimal from 'decimal.js';
const result = baseFare.add(perKm.mul(tripKm));
return result.toDecimalPlaces(2).toNumber();

// app/api/loads/route.ts - OUTPUT
NextResponse.json({
  totalFareEtb: totalFareEtb.toNumber(),  // Returns number
});
```

### 3.4 Dart Parsing Pattern

```dart
// mobile/lib/core/models/load.dart
double? parseDoubleOrNull(dynamic value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}
```

### 3.5 Precision Loss Analysis

| Scenario | API Value | Dart double | Precision Lost |
|----------|-----------|-------------|----------------|
| Money (2 decimals) | `123.45` | `123.45` | ❌ None |
| Money (edge case) | `99999999.99` | `99999999.99` | ❌ None |
| GPS (7 decimals) | `9.0319437` | `9.0319437` | ⚠️ Possible |
| Corridor (4 decimals) | `12.5025` | `12.5025` | ⚠️ Minor |

### 3.6 Critical Issues

#### ISSUE DC-1: NO DECIMAL LIBRARY IN DART (HIGH)
```
Problem: Mobile uses double for all numeric fields
Impact: Cannot perform precise financial calculations
Location: mobile/lib/core/models/*.dart
Fix: Add decimal package (decimal: ^2.1.0)
```

#### ISSUE DC-2: API RETURNS NUMBERS, NOT STRINGS (MEDIUM)
```
Problem: API returns float64 numbers in JSON
Impact: Precision context lost (2 decimals vs 4 decimals)
Location: app/api/*/route.ts
Fix: Consider returning strings for financial fields
```

### 3.7 Assessment Matrix

| Aspect | TypeScript | Dart | Aligned |
|--------|------------|------|---------|
| Decimal library | ✅ decimal.js | ❌ None | ❌ |
| Calculations | ✅ Decimal | ❌ double | ❌ |
| Money storage | ✅ Decimal | ⚠️ double | ⚠️ |
| GPS storage | ✅ Decimal | ⚠️ double | ⚠️ |
| Serialization | ✅ .toNumber() | ✅ toDouble() | ✅ |
| Deserialization | ✅ new Decimal() | ⚠️ double.parse | ⚠️ |

**Status: ⚠️ PARTIAL ALIGNMENT (40%)**

---

## 4. WEBSOCKET EVENT HANDLERS

### 4.1 Architecture Overview

| Platform | Implementation | Library |
|----------|---------------|---------|
| Server | ✅ Complete | Socket.io |
| Web Client | ✅ Complete | Socket.io-client |
| Mobile Client | ❌ MISSING | None |

### 4.2 Server Events Inventory

#### Emitted Events (Server → Client)

| Event | Payload | Web Listens | Mobile Listens |
|-------|---------|-------------|----------------|
| `notification` | `{id, userId, type, title, message, metadata, createdAt}` | ✅ | ❌ |
| `unread-notifications` | `NotificationPayload[]` | ✅ | ❌ |
| `gps-position` | `{truckId, loadId?, lat, lng, speed?, heading?, timestamp}` | ✅ | ❌ |
| `trip-status` | `{loadId, status, timestamp, ...metadata}` | ✅ | ❌ |
| `gps-device-status` | `{truckId, gpsStatus, timestamp}` | ✅ | ❌ |
| `error` | `{code, message}` | ✅ | ❌ |
| `pong` | (none) | ✅ | ❌ |

#### Listened Events (Client → Server)

| Event | Payload | Web Emits | Mobile Emits |
|-------|---------|-----------|--------------|
| `authenticate` | `userId: string` | ✅ | ❌ |
| `ping` | (none) | ✅ | ❌ |
| `subscribe-trip` | `loadId: string` | ✅ | ❌ |
| `unsubscribe-trip` | `loadId: string` | ✅ | ❌ |
| `subscribe-fleet` | `organizationId: string` | ✅ | ❌ |
| `unsubscribe-fleet` | `organizationId: string` | ✅ | ❌ |
| `subscribe-all-gps` | (none) | ✅ | ❌ |
| `unsubscribe-all-gps` | (none) | ✅ | ❌ |

### 4.3 Mobile Current Approach

| Feature | Expected (WebSocket) | Actual (Mobile) |
|---------|---------------------|-----------------|
| Notifications | Real-time via WS | Firebase FCM |
| GPS Updates | subscribe-trip | HTTP polling |
| Trip Status | trip-status event | REST API fetch |
| Device Status | gps-device-status | Not implemented |
| Authentication | authenticate event | REST API only |

### 4.4 Critical Issue

#### ISSUE WS-1: MOBILE LACKS WEBSOCKET CLIENT (CRITICAL)
```
Problem: Mobile app has NO WebSocket implementation
Impact:
  - No real-time GPS tracking for shippers
  - No instant notifications (30s+ delay via FCM)
  - No trip status updates
  - No device status alerts
Location: mobile/lib/core/services/
Fix: Implement Socket.io client for Dart
```

### 4.5 Event Name Alignment

| Event Name | Format | Server | Web | Aligned |
|------------|--------|--------|-----|---------|
| `authenticate` | lowercase | ✅ | ✅ | ✅ |
| `notification` | lowercase | ✅ | ✅ | ✅ |
| `gps-position` | kebab-case | ✅ | ✅ | ✅ |
| `trip-status` | kebab-case | ✅ | ✅ | ✅ |
| `subscribe-trip` | kebab-case | ✅ | ✅ | ✅ |

**Note:** Event names are consistent between server and web. Mobile needs to use same names.

### 4.6 Payload Structure Compatibility

| Event | Server Payload | Web Receives | Compatible |
|-------|---------------|--------------|------------|
| `gps-position` | `{truckId, lat, lng, ...}` | Same structure | ✅ |
| `trip-status` | `{loadId, status, timestamp}` | Same structure | ✅ |
| `notification` | Full notification object | Same structure | ✅ |

### 4.7 Assessment

| Aspect | Server ↔ Web | Server ↔ Mobile | Status |
|--------|--------------|-----------------|--------|
| Event names | ✅ Match | N/A | - |
| Payload structure | ✅ Match | N/A | - |
| Authentication | ✅ Implemented | ❌ Missing | ❌ |
| GPS subscriptions | ✅ Implemented | ❌ Missing | ❌ |
| Notifications | ✅ Implemented | ❌ Missing | ❌ |
| Health checks | ✅ Implemented | ❌ Missing | ❌ |

**Status: ❌ NOT ALIGNED (0% - Mobile Missing)**

---

## 5. ALIGNMENT SUMMARY MATRIX

| Component | Prisma | TypeScript | Dart | Score |
|-----------|--------|------------|------|-------|
| **OrganizationType** | ✅ | ✅ | ✅ | 100% |
| **BookMode** | ✅ | ✅ | ✅ | 100% |
| **Decimal Fields** | ✅ | ✅ | ⚠️ | 40% |
| **WebSocket Events** | - | ✅ | ❌ | 0% |

---

## 6. CRITICAL ISSUES SUMMARY

| ID | Component | Severity | Description |
|----|-----------|----------|-------------|
| WS-1 | WebSocket | CRITICAL | Mobile has no WebSocket client |
| DC-1 | Decimal | HIGH | Mobile uses double, no Decimal library |
| DC-2 | Decimal | MEDIUM | API returns numbers, not strings for money |

---

## 7. RECOMMENDATIONS

### Priority 1: Critical (Block Release)

#### 7.1 Implement WebSocket Client in Mobile
```yaml
# pubspec.yaml
dependencies:
  socket_io_client: ^2.0.3
```

```dart
// mobile/lib/core/services/websocket_service.dart
class WebSocketService {
  late IO.Socket socket;

  void connect(String userId) {
    socket = IO.io(apiUrl, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': true,
    });

    socket.on('connect', (_) => socket.emit('authenticate', userId));
    socket.on('notification', (data) => _handleNotification(data));
    socket.on('gps-position', (data) => _handleGpsPosition(data));
    socket.on('trip-status', (data) => _handleTripStatus(data));
  }
}
```

### Priority 2: High (Within Sprint)

#### 7.2 Add Decimal Library to Dart
```yaml
# pubspec.yaml
dependencies:
  decimal: ^2.1.0
```

```dart
// mobile/lib/core/models/money.dart
import 'package:decimal/decimal.dart';

class Money {
  static Decimal fromApi(dynamic value) {
    if (value == null) return Decimal.zero;
    return Decimal.parse(value.toString());
  }
}
```

#### 7.3 Update Load Model to Use Decimal
```dart
// Before
final double? baseFareEtb;

// After
final Decimal? baseFareEtb;
```

### Priority 3: Medium (Technical Debt)

#### 7.4 Consider String Serialization for Money
```typescript
// API Response Option
NextResponse.json({
  baseFareEtb: baseFareEtb?.toFixed(2),  // "123.45" as string
});
```

---

## 8. TEST CHECKLIST

### OrganizationType Tests
- [x] All 6 values parse correctly from API
- [x] `.value` returns SCREAMING_CASE
- [x] `fromString()` handles all cases
- [x] Default to `shipper` on invalid input

### BookMode Tests
- [x] Both values parse correctly
- [x] No legacy `direct` values in code
- [x] `.value` returns SCREAMING_CASE
- [x] `fromString()` case-insensitive

### Decimal Tests
- [ ] Money values round-trip correctly
- [ ] GPS coordinates preserve 7 decimal places
- [ ] Corridor pricing preserves 4 decimal places
- [ ] Large values (99,999,999.99) handled

### WebSocket Tests
- [ ] authenticate event works
- [ ] notification event received
- [ ] gps-position event received
- [ ] trip-status event received
- [ ] Reconnection handles re-subscription

---

## 9. FILES REFERENCE

### Enum Definitions

| Component | Prisma | TypeScript | Dart |
|-----------|--------|------------|------|
| OrganizationType | schema.prisma:32-39 | domain.ts:68-74 | user.dart:2-72 |
| BookMode | schema.prisma:74-77 | domain.ts:56 | load.dart:113-157 |

### Decimal Handling

| Platform | File | Purpose |
|----------|------|---------|
| TypeScript | lib/pricingCalculation.ts | Decimal math |
| TypeScript | lib/serviceFeeCalculation.ts | Fee calculations |
| Dart | models/load.dart:340-345 | parseDoubleOrNull |

### WebSocket

| Platform | File | Purpose |
|----------|------|---------|
| Server | lib/websocket-server.ts | Socket.io server |
| Web | hooks/useWebSocket.ts | Client hook |
| Web | hooks/useGpsRealtime.ts | GPS subscriptions |
| Mobile | ❌ NOT IMPLEMENTED | - |

---

## 10. CONCLUSION

The freight management platform has achieved **full alignment on enum types** (OrganizationType, BookMode) with proper serialization/deserialization in both web and mobile.

However, two significant gaps remain:

1. **Decimal Handling (40% aligned)**: Mobile uses IEEE 754 double instead of proper Decimal type, risking precision loss in financial calculations and GPS coordinates.

2. **WebSocket Integration (0% aligned)**: Mobile app completely lacks WebSocket support, falling back to HTTP polling and Firebase FCM, which creates significant UX disparity with the web app's real-time features.

**Recommended Action:**
- Block mobile release until WebSocket client is implemented
- Add Decimal library before financial features go live

---

**Report Generated:** 2026-01-23
**Auditor:** Claude Opus 4.5
**Version:** 3.0

