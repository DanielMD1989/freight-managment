# BookMode Enum Alignment Patch

**Date:** 2026-01-23
**Implementer:** Claude Opus 4.5
**Severity Fixed:** MEDIUM (Mobile/Web Alignment)

---

## Executive Summary

Fixed the `BookMode` enum in the Dart mobile app to match the API expectations (Prisma schema).

| Issue | Before | After |
|-------|--------|-------|
| Enum value | `direct` | `instant` |
| Serialization | None (used `.name`) | SCREAMING_CASE via `.value` |
| Parsing | `'DIRECT'` | `'INSTANT'` |

---

## Source of Truth

### Prisma Schema

```prisma
enum BookMode {
  REQUEST
  INSTANT
}
```

### TypeScript (`types/domain.ts`)

```typescript
export type BookMode = 'REQUEST' | 'INSTANT';
```

---

## Problem Analysis

### Original Dart Code

```dart
enum BookMode {
  request,
  direct,  // WRONG: Should be 'instant'
}

BookMode bookModeFromString(String? value) {
  switch (value?.toUpperCase()) {
    case 'DIRECT':  // WRONG: API sends 'INSTANT'
      return BookMode.direct;
    default:
      return BookMode.request;
  }
}
```

### Issues

1. **Wrong enum value**: `direct` instead of `instant`
2. **Wrong parsing**: Looking for `'DIRECT'` when API sends `'INSTANT'`
3. **No serialization method**: Would serialize as `'direct'` (lowercase) instead of `'INSTANT'`

---

## Implementation

### Updated Dart Code (`mobile/lib/core/models/load.dart`)

```dart
/// Book mode matching Prisma BookMode enum
/// - REQUEST: Shipper requests truck, carrier must approve
/// - INSTANT: Immediate booking, no approval needed
enum BookMode {
  request,
  instant,
}

extension BookModeExtension on BookMode {
  /// Get the API value (SCREAMING_CASE)
  String get value {
    switch (this) {
      case BookMode.request:
        return 'REQUEST';
      case BookMode.instant:
        return 'INSTANT';
    }
  }

  /// Get display name for UI
  String get displayName {
    switch (this) {
      case BookMode.request:
        return 'Request';
      case BookMode.instant:
        return 'Instant';
    }
  }

  /// Parse from API string
  static BookMode fromString(String? value) {
    switch (value?.toUpperCase()) {
      case 'INSTANT':
        return BookMode.instant;
      case 'REQUEST':
      default:
        return BookMode.request;
    }
  }
}

/// Helper function for backward compatibility
BookMode bookModeFromString(String? value) {
  return BookModeExtension.fromString(value);
}
```

---

## Value Mappings

| API Value | Dart Enum | Display Name |
|-----------|-----------|--------------|
| `REQUEST` | `BookMode.request` | "Request" |
| `INSTANT` | `BookMode.instant` | "Instant" |

---

## Usage Examples

### Parsing from API Response

```dart
// API returns: { "bookMode": "INSTANT" }
final load = Load.fromJson(json);
print(load.bookMode);            // BookMode.instant
print(load.bookMode.displayName); // "Instant"
```

### Serializing to API Request

```dart
// When sending to API
final bookMode = BookMode.instant;
final json = {
  'bookMode': bookMode.value,  // "INSTANT"
};
```

### Display in UI

```dart
Text(load.bookMode.displayName)  // Shows "Request" or "Instant"
```

---

## Breaking Changes

### Renamed Enum Value

| Before | After |
|--------|-------|
| `BookMode.direct` | `BookMode.instant` |

Any code using `BookMode.direct` will now get a compile error, prompting developers to use `BookMode.instant` instead.

---

## Backward Compatibility

The `bookModeFromString()` helper function is preserved for backward compatibility:

```dart
// Still works
final mode = bookModeFromString('INSTANT');  // BookMode.instant

// New recommended way
final mode = BookModeExtension.fromString('INSTANT');  // BookMode.instant
```

---

## Files Changed

| File | Change |
|------|--------|
| `mobile/lib/core/models/load.dart` | Updated BookMode enum, added extension with serialization |

---

## Verification

### API Response Parsing

```json
{
  "id": "load_123",
  "bookMode": "INSTANT",
  "status": "POSTED"
}
```

```dart
final load = Load.fromJson(json);
assert(load.bookMode == BookMode.instant);
assert(load.bookMode.value == 'INSTANT');
```

### Serialization

```dart
final bookMode = BookMode.request;
assert(bookMode.value == 'REQUEST');  // SCREAMING_CASE for API

final bookMode2 = BookMode.instant;
assert(bookMode2.value == 'INSTANT');  // SCREAMING_CASE for API
```

---

## Platform Alignment Matrix

| Platform | Enum Values | Serialization |
|----------|-------------|---------------|
| Prisma | `REQUEST`, `INSTANT` | Native |
| TypeScript | `'REQUEST'`, `'INSTANT'` | String literal |
| Dart | `request`, `instant` | `.value` → `'REQUEST'`, `'INSTANT'` |

---

## Conclusion

The `BookMode` enum in the Dart mobile app is now aligned with the API:

1. **Enum value fixed**: `direct` → `instant`
2. **Parsing fixed**: Now correctly handles `'INSTANT'` from API
3. **Serialization added**: `.value` property returns SCREAMING_CASE

**MOBILE_WEB_ALIGNMENT Score: BookMode component fixed**

---

**Report Generated:** 2026-01-23
**Implementer:** Claude Opus 4.5
**Status:** FIXED
