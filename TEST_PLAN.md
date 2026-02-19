# Comprehensive Test Plan — Freight Management Platform

## Current State

**Existing Coverage**: 23 test suites, 660 passing tests, 10 skipped
**Framework**: Jest (node + jsdom) for web, Flutter test for mobile
**Mobile Tests**: 3 files (models_test.dart, widget_test.dart, functional_mobile_test.dart) — minimal

---

## Existing Test Inventory

| #   | File                                    | Module               | Tests | Coverage Quality              |
| --- | --------------------------------------- | -------------------- | ----- | ----------------------------- |
| 1   | `lib/geo.test.ts`                       | Haversine distance   | 16    | Excellent — full edge cases   |
| 2   | `lib/loadStateMachine.test.ts`          | Load state machine   | 35+   | Excellent — all transitions   |
| 3   | `lib/tripStateMachine.test.ts`          | Trip state machine   | 30+   | Excellent — all transitions   |
| 4   | `lib/serviceFeeCalculation.test.ts`     | Fee calculation      | 20+   | Excellent — all formulas      |
| 5   | `lib/serviceFeeManagement.test.ts`      | Fee deduction/refund | 25+   | Excellent — full lifecycle    |
| 6   | `lib/matchingEngine.test.ts`            | Truck-load matching  | 25+   | Excellent — scoring + filters |
| 7   | `lib/rounding.test.ts`                  | Rounding strategies  | 20+   | Excellent — all types         |
| 8   | `components/DataTable.test.tsx`         | DataTable component  | 30+   | Excellent — all interactions  |
| 9   | `components/LoginPage.test.tsx`         | Login form           | 24    | Good — includes MFA flow      |
| 10  | `components/StatusUpdateModal.test.tsx` | Status modal         | 15+   | Good — happy + error paths    |
| 11  | `components/SearchLoadsTab.test.tsx`    | Load search UI       | 18+   | Good — filters + API calls    |
| 12  | `auth.test.ts`                          | Auth functions       | 15+   | Good — hash/verify/JWT        |
| 13  | `authorization.test.ts`                 | Access control       | 10+   | Good — role checks            |
| 14  | `rbac.test.ts`                          | RBAC permissions     | 20+   | Good — all roles              |
| 15  | `security.test.ts`                      | Security features    | 20+   | Good — CSRF, headers, XSS     |
| 16  | `e2e-core-flows.test.ts`                | E2E business flows   | 20+   | Good — DB-level               |
| 17  | `foundation/marketplace.test.ts`        | Marketplace rules    | 15+   | Good — frozen rules           |
| 18  | `foundation/phase2-authority.test.ts`   | Authority rules      | 20+   | Good — frozen rules           |
| 19  | `notification-preferences.test.ts`      | Notification prefs   | 18    | Good — all permutations       |
| 20  | `queue-ready.test.ts`                   | Queue health         | 15+   | Moderate — mocked Redis       |
| 21  | `functional-web.test.ts`                | Web functional       | 20+   | Moderate — structural checks  |
| 22  | `behavior-snapshots.test.ts`            | Regression guards    | 15+   | Moderate — snapshot values    |
| 23  | `fileAccess.test.ts`                    | File access control  | 14    | Low — most tests skipped      |

---

## Gap Analysis

### A. Untested Backend Libraries (HIGH priority)

| Library                   | Functions                                                                                                                                                                                                                                            | Why Critical                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `lib/validation.ts`       | `validateEmail`, `validatePhoneNumber`, `validatePassword`, `sanitizeText`, `validateFileName`, `validateNumericRange`, `validateDateRange`, `validateFutureDate`, `sanitizeRejectionReason`, `validateUUID`, `validateIdFormat`, `validateFileSize` | Input boundary — XSS/injection prevention |
| `lib/security.ts`         | `getClientIP`, `isIPBlocked`, `isBlockedByBruteForce`, `blockIP`, `recordFailedAttempt`, `resetFailedAttempts`, `logSecurityEvent`                                                                                                                   | Security enforcement                      |
| `lib/rateLimit.ts`        | `checkRateLimit`, `checkRpsLimit`                                                                                                                                                                                                                    | Rate limiting logic                       |
| `lib/notifications.ts`    | `createNotification`, `createNotificationForRole`, `notifyLoadStakeholders`, `notifyOrganization`, `markAsRead`, `markAllAsRead`, `cleanupOldNotifications`                                                                                          | Notification delivery                     |
| `lib/trustMetrics.ts`     | `incrementCompletedLoads`, `incrementCancelledLoads`                                                                                                                                                                                                 | Trust scoring                             |
| `lib/bypassDetection.ts`  | `checkSuspiciousCancellation`                                                                                                                                                                                                                        | Fraud detection                           |
| `lib/gpsVerification.ts`  | `validateImeiFormat`, `verifyGpsDevice`, `detectGpsProvider`, `determineGpsStatus`                                                                                                                                                                   | GPS device validation                     |
| `lib/loadUtils.ts`        | `calculateAge`, `formatAge`, `calculateRPM`, `calculateTRPM`, `maskCompany`, `canSeeContact`                                                                                                                                                         | Used in Jest-excluded `loadUtils.test.ts` |
| `lib/csrfFetch.ts`        | CSRF token fetch utility                                                                                                                                                                                                                             | Used by all forms                         |
| `lib/foundation-rules.ts` | Foundation rule enforcement functions                                                                                                                                                                                                                | Business invariants                       |

### B. Untested API Routes (HIGH priority)

| Route                                     | Methods                  | Why Critical                                       |
| ----------------------------------------- | ------------------------ | -------------------------------------------------- |
| `POST /api/auth/register`                 | Registration flow        | User onboarding — validation, org creation, wallet |
| `POST /api/auth/login`                    | Login flow               | Rate limiting, MFA, session creation               |
| `POST /api/auth/logout`                   | Logout flow              | Session revocation                                 |
| `GET /api/auth/me`                        | Profile fetch            | Session validation                                 |
| `POST /api/trucks`                        | Truck creation           | CSRF, license plate uniqueness, IMEI validation    |
| `GET /api/trucks`                         | Truck listing            | Role-based visibility, SHIPPER block, caching      |
| `GET /api/trucks/[id]`                    | Truck detail             | Permission checks                                  |
| `PATCH /api/trucks/[id]`                  | Truck update             | Ownership, resubmission                            |
| `DELETE /api/trucks/[id]`                 | Truck deletion           | Active trip guard                                  |
| `POST /api/loads`                         | Load creation            | Status defaults, ACTIVE user requirement           |
| `GET /api/loads`                          | Load listing/marketplace | Role-based filtering, age calculation, masking     |
| `GET /api/loads/[id]`                     | Load detail              | Contact visibility                                 |
| `PATCH /api/loads/[id]`                   | Load update              | State machine, trip sync, trust metrics            |
| `DELETE /api/loads/[id]`                  | Load deletion            | Active state guard, cascade request rejection      |
| `POST /api/truck-postings`                | Truck posting            | ONE_ACTIVE_POST_PER_TRUCK, date validation         |
| `GET /api/truck-postings`                 | Posting listing          | City resolution, match scoring                     |
| `POST /api/trips`                         | Trip creation            | Truck availability, tracking URL                   |
| `GET /api/trips`                          | Trip listing             | Role-based, status filtering                       |
| `PATCH /api/trips/[tripId]`               | Trip status update       | State machine, role enforcement                    |
| `POST /api/match-proposals`               | Match proposal           | DISPATCHER_COORDINATION_ONLY                       |
| `POST /api/load-requests`                 | Load request             | Carrier offer workflow                             |
| `POST /api/truck-requests`                | Truck request            | Shipper request workflow                           |
| `POST /api/financial/withdraw`            | Financial withdrawal     | Wallet balance, CSRF                               |
| `POST /api/admin/users/[id]/verify`       | User verification        | Admin-only, status transition                      |
| `POST /api/admin/users/[id]/wallet/topup` | Wallet topup             | Admin-only, amount validation                      |
| `GET /api/health`                         | Health check             | Auth for detailed, metric exposure                 |
| `GET /api/csrf-token`                     | CSRF token               | Token generation                                   |

### C. Untested Components (MEDIUM priority)

| Component                 | Why                                             |
| ------------------------- | ----------------------------------------------- |
| `AddTruckForm.tsx`        | Complex form with CSRF, validation, truck types |
| `EditTruckForm.tsx`       | Edit flow with pre-populated data               |
| `DocumentUpload.tsx`      | File validation, upload flow                    |
| `PlacesAutocomplete.tsx`  | Google Maps API integration                     |
| `GoogleMap.tsx`           | Map rendering, markers                          |
| `TripHistoryPlayback.tsx` | GPS replay logic                                |
| `QuickAssignModal.tsx`    | Trip assignment flow                            |
| `SavedSearches.tsx`       | CRUD for saved filters                          |
| `ReportBypassButton.tsx`  | Bypass report submission                        |

### D. Untested Mobile Code (HIGH priority)

| Module                      | Functions                                                         | Current Tests |
| --------------------------- | ----------------------------------------------------------------- | ------------- |
| `auth_service.dart`         | login, register, verifyMfa, logout, forgotPassword, resetPassword | None          |
| `truck_service.dart`        | CRUD + postings + requests (17 methods)                           | None          |
| `load_service.dart`         | search, CRUD, status transitions, requests (11 methods)           | None          |
| `trip_service.dart`         | CRUD, status transitions, POD upload, GPS (11 methods)            | None          |
| `dashboard_service.dart`    | getCarrierDashboard, getShipperDashboard                          | None          |
| `notification_service.dart` | CRUD + preferences (6 methods)                                    | None          |
| `foundation_rules.dart`     | State machines, permission checks (20+ functions)                 | None          |
| `parse_utils.dart`          | parseDoubleOrNull, parseDoubleOrDefault                           | None          |
| `auth_provider.dart`        | AuthNotifier state management                                     | None          |
| `settings_provider.dart`    | Settings state management                                         | None          |
| `api_client.dart`           | Dio configuration, token management, CSRF                         | None          |

---

## Test Plan — New Test Suites

### Phase 1: Core Library Unit Tests (Est. ~180 new tests)

#### P1-01: `__tests__/lib/validation.test.ts` (~55 tests)

```
describe('validateEmail')
  - valid standard email → true
  - valid email with subdomain → true
  - email with consecutive dots → false
  - email with leading dot → false
  - email with trailing dot → false
  - email < 5 chars → false
  - email > 254 chars → false
  - email without @ → false
  - empty string → false
  - converts to lowercase → verified via emailSchema.parse

describe('validatePhoneNumber')
  - valid +251912345678 → true
  - valid 0912345678 → true
  - valid 912345678 → true
  - with spaces: +251 91 234 5678 → true
  - with dashes: 091-234-5678 → true
  - too short (8 digits) → false
  - too long (16 chars) → false
  - non-Ethiopian prefix (+1...) → false
  - alpha characters → false
  - empty string → false

describe('validatePassword')
  - valid "Abc123!@" → true
  - missing uppercase → false
  - missing lowercase → false
  - missing number → false
  - missing special char → false
  - < 8 characters → false
  - empty string → false
  - null/undefined → false

describe('sanitizeText')
  - strips HTML tags → clean text
  - strips javascript: protocol → clean
  - strips event handlers (onclick=) → clean
  - normalizes whitespace → single spaces
  - respects maxLength → truncated
  - empty input → ""
  - non-string input → ""

describe('validateFileName')
  - valid "report.pdf" → valid
  - path traversal "../secret" → invalid
  - forward slash "dir/file.txt" → invalid
  - backslash "dir\\file.txt" → invalid
  - null bytes → invalid
  - no extension "filename" → invalid
  - special characters "file@#$.txt" → invalid
  - > 255 chars → invalid
  - multiple consecutive dots → sanitized
  - multiple consecutive spaces → sanitized

describe('validateNumericRange')
  - value within range → valid
  - value at min boundary → valid
  - value at max boundary → valid
  - value below min → invalid
  - value above max → invalid
  - NaN → invalid
  - Infinity → invalid
  - non-number type → invalid

describe('validateDateRange')
  - start < end → valid
  - start == end → invalid
  - start > end → invalid
  - invalid start date → invalid
  - invalid end date → invalid

describe('validateFutureDate')
  - tomorrow → valid
  - today (allowToday=true) → valid
  - today (allowToday=false) → invalid
  - yesterday → invalid
  - invalid date → invalid

describe('validateUUID')
  - valid UUID v4 → true
  - valid UUID v1 → true
  - invalid format → false
  - too short → false
  - empty string → false

describe('validateIdFormat')
  - valid CUID → valid
  - valid UUID → valid
  - SQL injection attempt "'; DROP TABLE" → invalid
  - too short (<10) → invalid
  - too long (>50) → invalid
  - special characters → invalid
  - null/empty → invalid

describe('validateFileSize')
  - within limit → valid
  - exactly at limit → valid
  - over limit → invalid
  - zero size → invalid
  - negative size → invalid
  - custom maxSizeMB → respected

describe('zodErrorResponse')
  - creates NextResponse with 400 status
  - sanitizes error fields correctly
```

#### P1-02: `__tests__/lib/security.test.ts` (expand existing, ~25 new tests)

```
describe('IP Security Functions')
  - getClientIP from X-Forwarded-For → first IP
  - getClientIP from X-Real-IP → IP
  - getClientIP fallback → default
  - blockIP → isIPBlocked returns true
  - unblocked IP → isIPBlocked returns false
  - recordFailedAttempt increments counter
  - isBlockedByBruteForce after threshold → true
  - isBlockedByBruteForce under threshold → false
  - resetFailedAttempts clears counter
  - logSecurityEvent creates audit entry

describe('Rate Limiting')
  - checkRateLimit under limit → allowed
  - checkRateLimit at limit → blocked
  - checkRateLimit returns retryAfter seconds
  - checkRpsLimit under burst → allowed
  - checkRpsLimit at burst → blocked
  - different keys are independent
  - rate limit resets after window
```

#### P1-03: `__tests__/lib/gpsVerification.test.ts` (~15 tests)

```
describe('validateImeiFormat')
  - valid 15-digit IMEI → true
  - 14 digits → false
  - 16 digits → false
  - non-numeric → false
  - empty string → false

describe('detectGpsProvider')
  - known IMEI prefix → correct provider
  - unknown prefix → "UNKNOWN"

describe('determineGpsStatus')
  - lastSeenAt within 5 min → ACTIVE
  - lastSeenAt > 1 hour → OFFLINE
  - lastSeenAt null → NEVER_CONNECTED
  - lastSeenAt > 24 hours → LOST
```

#### P1-04: `__tests__/lib/notifications.test.ts` (~20 tests)

```
describe('createNotification')
  - creates notification for user → DB record
  - respects preference (disabled) → skips
  - respects preference (enabled) → creates
  - unknown notification type → defaults to enabled
  - skipPreferenceCheck → always creates
  - sends real-time WebSocket event

describe('createNotificationForRole')
  - notifies all users with role
  - respects individual preferences

describe('markAsRead / markAllAsRead')
  - marks single notification → isRead=true
  - marks all for user → all isRead=true

describe('cleanupOldNotifications')
  - deletes read notifications >90 days
  - keeps unread notifications
  - keeps recent read notifications
```

#### P1-05: `__tests__/lib/trustMetrics.test.ts` (~10 tests)

```
describe('incrementCompletedLoads')
  - increments count → new value
  - creates record if not exists

describe('incrementCancelledLoads')
  - increments count → new value
  - creates record if not exists

describe('Trust Score Calculation')
  - all completed → high score
  - mixed → moderate score
  - all cancelled → low score
```

#### P1-06: `__tests__/lib/bypassDetection.test.ts` (~10 tests)

```
describe('checkSuspiciousCancellation')
  - normal cancellation → not suspicious
  - rapid cancellations (3+ in 1 hour) → suspicious
  - cancellation after assignment → suspicious
  - cancellation during transit → flagged
  - no history → not suspicious
```

#### P1-07: `__tests__/lib/loadUtils.test.ts` (migrate from custom runner, ~20 tests)

Migrate the existing `loadUtils.test.ts` (currently using custom runner, excluded from Jest) to proper Jest format:

```
describe('calculateAge')
  - uses postedAt when available
  - falls back to createdAt when postedAt null
  - returns 0 for future dates

describe('formatAge')
  - minutes for < 60
  - hours + minutes for < 24h
  - days for >= 24h
  - 0 minutes

describe('calculateRPM')
  - correct rate per km
  - null for null/zero/negative tripKm
  - handles Decimal-like objects

describe('calculateTRPM')
  - correct with all deadhead
  - correct with no deadhead
  - null for zero total km
  - handles partial deadhead

describe('maskCompany')
  - anonymous → "Anonymous Shipper"
  - not anonymous → company name
  - null company → "Unknown Company"

describe('canSeeContact')
  - ADMIN → always true
  - PLATFORM_OPS → always true
  - assigned to own org → true
  - assigned to other org → false
  - unassigned → false
```

#### P1-08: `__tests__/lib/foundationRules.test.ts` (~25 tests)

```
describe('Foundation Rule Enforcement')
  - SHIPPER_DEMAND_FOCUS: shippers cannot browse /api/trucks
  - ONE_ACTIVE_POST_PER_TRUCK: duplicate posting blocked
  - DISPATCHER_COORDINATION_ONLY: dispatcher cannot execute assignments
  - CARRIER_FINAL_AUTHORITY: only carrier commits truck
  - rule violation returns correct error code
  - rule check with valid role → passes
  - rule check with invalid role → throws
```

---

### Phase 2: API Route Integration Tests (Est. ~200 new tests)

#### P2-01: `__tests__/api/auth-register.test.ts` (~30 tests)

```
describe('POST /api/auth/register')
  Happy Path:
  - register SHIPPER → 201, user + org + wallet created
  - register CARRIER → 201, carrier org type mapping correct
  - register DISPATCHER → 201

  Validation:
  - missing email → 400
  - invalid email format → 400
  - missing password → 400
  - weak password (no special char) → 400
  - missing name → 400
  - missing role → 400

  Uniqueness:
  - duplicate email → 400
  - duplicate phone → 400

  Security:
  - ADMIN role → blocked (400)
  - SUPER_ADMIN role → blocked (400)
  - rate limit (4th registration) → 429

  Edge Cases:
  - carrier with companyName → org name set
  - carrier without companyName → default
  - carrier with associationId → linked
  - carrier with taxId → stored
  - carrierType mapping: COMPANY → CARRIER_COMPANY
  - carrierType mapping: INDIVIDUAL → CARRIER_INDIVIDUAL
```

#### P2-02: `__tests__/api/auth-login.test.ts` (~25 tests)

```
describe('POST /api/auth/login')
  Happy Path:
  - valid credentials → 200, session token + cookie
  - mobile client → Bearer token in response

  Failure:
  - wrong password → 401
  - non-existent email → 401
  - empty email → 400
  - empty password → 400

  Account Status:
  - REGISTERED (not verified) → 403
  - SUSPENDED → 403
  - REJECTED → 403
  - ACTIVE → 200

  Rate Limiting:
  - 5th failed attempt → 429
  - rate limit returns retryAfter header

  MFA:
  - MFA-enabled user → 200 with mfaRequired=true + tempToken
  - MFA verify with correct OTP → 200 with full session
  - MFA verify with wrong OTP → 401
  - MFA verify with recovery code → 200

  Session:
  - session record created in DB
  - previous sessions not revoked (unless cross-device logout)
```

#### P2-03: `__tests__/api/trucks.test.ts` (~35 tests)

```
describe('POST /api/trucks')
  Happy Path:
  - carrier creates truck → 201, { truck: {...} }
  - includes all fields (type, capacity, licensePlate, etc.)
  - sets approvalStatus to PENDING

  Validation:
  - missing licensePlate → 400
  - duplicate licensePlate → 400
  - invalid truckType → 400
  - negative capacity → 400
  - invalid IMEI (not 15 digits) → 400

  Authorization:
  - shipper → 403
  - unauthenticated → 401
  - user without organization → 400

  CSRF:
  - web client without CSRF token → 403
  - web client with valid CSRF → 201
  - mobile client with Bearer → 201 (skips CSRF)

describe('GET /api/trucks')
  - CARRIER → only own fleet
  - SHIPPER → 403 (SHIPPER_DEMAND_FOCUS)
  - ADMIN → all trucks
  - DISPATCHER → all trucks
  - filter by truckType → filtered
  - filter by isAvailable → filtered
  - filter by approvalStatus → filtered
  - pagination (page + limit) → paginated
  - limit > 100 → capped at 100
  - cache hit for ADMIN query

describe('GET /api/trucks/[id]')
  - owner → truck with GPS details
  - admin → truck details
  - non-owner carrier → 403
  - non-existent ID → 404

describe('PATCH /api/trucks/[id]')
  - owner updates capacity → 200, updated
  - change licensePlate to existing → 400
  - non-owner → 403
  - SUPER_ADMIN → 200 (override)

describe('DELETE /api/trucks/[id]')
  - no active trips → 200
  - active trip (ASSIGNED) → 409
  - active trip (IN_TRANSIT) → 409
  - non-owner → 403
```

#### P2-04: `__tests__/api/loads.test.ts` (~35 tests)

```
describe('POST /api/loads')
  Happy Path:
  - shipper creates DRAFT load → 201, { load: {...} }
  - shipper creates POSTED load → 201, postedAt set
  - carrier creates load → 403 (only shippers)

  Validation:
  - missing pickupCity → 400
  - missing deliveryCity → 400
  - missing truckType → 400
  - weight <= 0 → 400
  - invalid bookMode → 400

  Authorization:
  - user not ACTIVE → 403
  - user without organization → 400
  - unauthenticated → 401

describe('GET /api/loads')
  - SHIPPER → own loads only
  - CARRIER → assigned loads (via trips)
  - ADMIN → all loads
  - marketplace (no auth) → POSTED only
  - filter by pickupCity → filtered
  - filter by deliveryCity → filtered
  - filter by truckType → filtered
  - filter by tripKmMin/Max → range filtered
  - sort by age → sorted by postedAt
  - anonymous load → company masked
  - contact info hidden for unassigned

describe('PATCH /api/loads/[id]')
  - DRAFT → POSTED → valid
  - POSTED → ASSIGNED → valid (with truck linkage)
  - IN_TRANSIT → CANCELLED → 400 (invalid transition)
  - DRAFT → IN_TRANSIT → 400 (invalid transition)
  - DELIVERED → COMPLETED → trust metrics updated
  - non-owner → 403
  - load event created

describe('DELETE /api/loads/[id]')
  - DRAFT load → 200
  - ASSIGNED load → 400
  - IN_TRANSIT load → 400
  - cascade: pending requests rejected
  - non-owner → 403
```

#### P2-05: `__tests__/api/truck-postings.test.ts` (~25 tests)

```
describe('POST /api/truck-postings')
  Happy Path:
  - carrier posts available truck → 201
  - sets availableFrom/To dates
  - includes contact info

  Validation:
  - missing truckId → 400
  - missing originCityId → 400
  - availableFrom > availableTo → 400
  - truck not APPROVED → 403
  - truck already has active posting → 409 (ONE_ACTIVE_POST_PER_TRUCK)

  Authorization:
  - shipper → 403
  - user not ACTIVE → 403

describe('GET /api/truck-postings')
  - public → ACTIVE postings only
  - filter by originCity name → resolved to ID, filtered
  - filter by destinationCity → filtered
  - filter by truckType → filtered
  - filter by fullPartial → filtered
  - match count calculated for each
  - pagination working
  - invalid status enum → 400 with hint
```

#### P2-06: `__tests__/api/trips.test.ts` (~25 tests)

```
describe('POST /api/trips')
  - unassigned load + available truck → 201
  - load already assigned → 400
  - trip already exists for load → 409
  - trackingUrl generated
  - trip event created

describe('GET /api/trips')
  - CARRIER → org trips only
  - SHIPPER → own org trips
  - ADMIN → all
  - filter by status → filtered
  - comma-separated statuses → "ASSIGNED,IN_TRANSIT"
  - pagination (limit 1-200)

describe('PATCH /api/trips/[tripId]')
  - ASSIGNED → PICKUP_PENDING → valid
  - PICKUP_PENDING → IN_TRANSIT → valid
  - IN_TRANSIT → DELIVERED → valid
  - DELIVERED → COMPLETED → valid
  - IN_TRANSIT → ASSIGNED → 400 (no backward)
  - COMPLETED → anything → 400 (terminal)
  - CANCELLED → anything → 400 (terminal)
  - carrier role required for pickup/delivery
  - trip event created for each transition
```

#### P2-07: `__tests__/api/match-proposals.test.ts` (~15 tests)

```
describe('POST /api/match-proposals')
  - dispatcher creates proposal → 201
  - carrier creates → 403 (DISPATCHER_COORDINATION_ONLY)
  - load not POSTED/SEARCHING → 400
  - load already assigned → 400
  - duplicate pending proposal → 409
  - expiration hours 1-72

describe('GET /api/match-proposals')
  - CARRIER → proposals for own trucks
  - SHIPPER → proposals for own loads
  - DISPATCHER → all
  - filter by status
```

#### P2-08: `__tests__/api/requests.test.ts` (~20 tests)

```
describe('POST /api/load-requests')
  - carrier requests load → 201
  - shipper → 403
  - load not POSTED → 400
  - duplicate pending → 409
  - proposed rate optional

describe('POST /api/truck-requests')
  - shipper requests truck → 201
  - carrier → 403
  - truck not available → 400

describe('Response Workflow')
  - shipper approves load request → load ASSIGNED
  - shipper rejects load request → REJECTED
  - carrier approves truck request → truck assigned
  - carrier rejects → REJECTED
  - expired request → cannot respond
```

#### P2-09: `__tests__/api/admin.test.ts` (~20 tests)

```
describe('POST /api/admin/users/[id]/verify')
  - admin verifies PENDING user → ACTIVE
  - admin rejects user → REJECTED
  - non-admin → 403
  - already ACTIVE user → 400

describe('POST /api/admin/users/[id]/wallet/topup')
  - admin tops up wallet → balance updated
  - negative amount → 400
  - non-admin → 403

describe('GET /api/health')
  - basic health → 200
  - ?detailed=true without auth → 401
  - ?detailed=true with admin → 200 with details
  - ?metrics=true with admin → 200 with metrics
```

#### P2-10: `__tests__/api/csrf-token.test.ts` (~8 tests)

```
describe('GET /api/csrf-token')
  - returns token → 200, { csrfToken: "..." }
  - sets httpOnly cookie
  - token matches cookie value

describe('CSRF Validation Integration')
  - valid X-CSRF-Token header → passes
  - mismatched token → 403
  - missing token → 403
  - Bearer token → skips CSRF
```

---

### Phase 3: Component Tests (Est. ~80 new tests)

#### P3-01: `__tests__/components/AddTruckForm.test.tsx` (~20 tests)

```
describe('AddTruckForm')
  - renders all form fields
  - truck type dropdown has all 8 types
  - capacity input accepts positive numbers
  - license plate input validation
  - IMEI optional field
  - CSRF token fetched on mount
  - submit with valid data → POST /api/trucks
  - submit with missing fields → client validation error
  - server validation error → displayed
  - success → redirects to trucks list
  - loading state during submission
```

#### P3-02: `__tests__/components/EditTruckForm.test.tsx` (~15 tests)

```
describe('EditTruckForm')
  - pre-populates fields from truck data
  - updates only changed fields
  - license plate change → uniqueness check
  - owner or SUPER_ADMIN can edit
  - non-owner → redirected
  - resubmission (approval reset to PENDING)
```

#### P3-03: `__tests__/components/DocumentUpload.test.tsx` (~15 tests)

```
describe('DocumentUpload')
  - file selection renders preview
  - invalid file type → error message
  - file too large → error message
  - valid upload → success state
  - multiple files → batch upload
  - progress indicator during upload
  - cancel upload
```

#### P3-04: `__tests__/components/SavedSearches.test.tsx` (~10 tests)

```
describe('SavedSearches')
  - renders saved search list
  - apply saved search → populates filters
  - delete saved search → removed from list
  - save current search → added to list
  - empty state message
```

#### P3-05: `__tests__/components/QuickAssignModal.test.tsx` (~10 tests)

```
describe('QuickAssignModal')
  - renders truck selection dropdown
  - submit assignment → API call
  - truck not available → error
  - success → callback fired
  - cancel → closes modal
```

#### P3-06: `__tests__/components/ReportBypassButton.test.tsx` (~10 tests)

```
describe('ReportBypassButton')
  - renders report button
  - click → opens confirmation dialog
  - confirm → submits bypass report
  - success → toast notification
  - already reported → disabled
```

---

### Phase 4: Mobile Tests (Est. ~150 new tests)

#### P4-01: `mobile/test/foundation_rules_test.dart` (~40 tests)

```
group('LoadStateMachine')
  - canTransition DRAFT→POSTED → true
  - canTransition DRAFT→IN_TRANSIT → false
  - canTransition IN_TRANSIT→CANCELLED → false (must go through EXCEPTION)
  - all 22 valid transitions verified
  - all invalid transitions return false
  - getValidNextStatuses for each state
  - isTerminal for COMPLETED, CANCELLED → true
  - isTerminal for DRAFT, POSTED → false
  - canEdit for DRAFT, UNPOSTED, POSTED → true
  - canEdit for ASSIGNED+ → false
  - canDelete for DRAFT, UNPOSTED → true

group('TripStateMachine')
  - ASSIGNED→PICKUP_PENDING → true
  - PICKUP_PENDING→IN_TRANSIT → true
  - IN_TRANSIT→DELIVERED → true
  - no backward transitions
  - COMPLETED is terminal
  - CANCELLED is terminal

group('Permission Functions')
  - canModifyTruckOwnership: carrier → true, shipper → false
  - canDirectlyAssignLoads: carrier → true, dispatcher → false
  - canProposeMatches: dispatcher → true, carrier → false
  - canStartTrips: carrier → true, shipper → false
  - canAcceptLoadRequests: carrier → true, shipper → false
  - canAcceptTruckRequests: shipper → true, carrier → false

group('Assertion Functions')
  - assertCanModifyTruck(carrier) → no throw
  - assertCanModifyTruck(shipper) → throws FoundationRuleViolation
  - assertDispatcherCannotExecute(dispatcher, "assign") → throws

group('TruckPostingValidator')
  - areDatesValid: end > start → true
  - areDatesValid: end <= start → false
  - hasActivePosting: existing ACTIVE → true
  - validatePosting: all valid → empty errors
  - validatePosting: missing fields → error list
```

#### P4-02: `mobile/test/parse_utils_test.dart` (~12 tests)

```
group('parseDoubleOrNull')
  - int 42 → 42.0
  - double 3.14 → 3.14
  - String "3.14" → 3.14
  - String "abc" → null
  - null → null
  - empty string → null

group('parseDoubleOrDefault')
  - valid input → parsed value
  - null → default value
  - invalid string → default value
  - int input → converted double
```

#### P4-03: `mobile/test/models/truck_model_test.dart` (~20 tests)

```
group('Truck.fromJson')
  - complete JSON → all fields populated
  - minimal JSON → defaults used
  - missing GPS fields → null
  - missing capacity → defaults to 0
  - TruckType enum parsing for all 8 types
  - invalid TruckType → default

group('Truck helpers')
  - hasGps: with lastLatitude → true
  - hasGps: without → false
  - isGpsActive: lastSeenAt < 5 min → true
  - isGpsActive: lastSeenAt > 1 hour → false
  - gpsPosition: prefers lastLatitude over currentLocation
  - headingDisplay: 0° → "N", 90° → "E", 180° → "S", 270° → "W"
  - capacityDisplay: "15,000 kg"

group('TruckPosting.fromJson')
  - complete JSON → all fields
  - parseDoubleOrNull for numeric fields
```

#### P4-04: `mobile/test/models/load_model_test.dart` (~15 tests)

```
group('Load.fromJson')
  - complete JSON → all 39 fields
  - nested location parsing (object format)
  - nested location parsing (string format fallback)
  - missing shipper object → defaults
  - service fee fields parsed correctly
  - date fallback to DateTime.now()

group('Load helpers')
  - status helpers: can delete DRAFT → true
  - status helpers: can delete ASSIGNED → false
```

#### P4-05: `mobile/test/models/trip_model_test.dart` (~15 tests)

```
group('Trip.fromJson')
  - complete JSON → all fields + nested objects
  - nested Load parsing
  - nested Truck parsing
  - null nested objects → null

group('Trip status helpers')
  - canStart: ASSIGNED → true
  - canMarkPickedUp: PICKUP_PENDING → true
  - canMarkDelivered: IN_TRANSIT → true
  - canUploadPod: DELIVERED → true
  - canCancel: COMPLETED → false

group('TripPod.fromJson')
  - complete POD data
  - missing optional fields → defaults

group('GpsPosition.fromJson')
  - lat, lng, speed, heading, accuracy parsed
```

#### P4-06: `mobile/test/models/notification_model_test.dart` (~10 tests)

```
group('AppNotification.fromJson')
  - complete JSON → all fields
  - isUnread: read=false → true
  - timeAgo: < 1 min → "Just now"
  - timeAgo: 5 min ago → "5m ago"
  - timeAgo: 2 hours ago → "2h ago"
  - dateGroup: today → "Today"
  - dateGroup: yesterday → "Yesterday"

group('NotificationPreferences.fromJson')
  - all 14 settings parsed
  - quiet hours parsed
```

#### P4-07: `mobile/test/services/auth_service_test.dart` (~20 tests)

```
group('AuthService.login')
  - successful login → saves tokens, returns user
  - MFA required → returns LoginResult with mfaRequired=true
  - invalid credentials → error with message
  - rate limited → 429 error message

group('AuthService.register')
  - successful → saves tokens, returns user
  - duplicate email → error
  - weak password → error
  - role mapping: carrier → "CARRIER"

group('AuthService.verifyMfa')
  - valid OTP → saves auth, returns user
  - valid recovery code → saves auth
  - neither OTP nor recovery → throws

group('AuthService.logout')
  - clears tokens even on network error
  - graceful Firebase failure handling
```

#### P4-08: `mobile/test/services/truck_service_test.dart` (~20 tests)

```
group('TruckService.createTruck')
  - valid data → Truck object (wrapped response)
  - non-carrier role → throws FoundationRuleViolation

group('TruckService.getTruckById')
  - wrapped response → parsed
  - unwrapped response → parsed

group('TruckService.searchTruckPostings')
  - filters passed correctly
  - pagination parsed from response
  - empty results → empty list

group('TruckService.createTruckPosting')
  - valid posting → created
  - validation errors extracted from response

group('TruckService.respondToTruckRequest')
  - APPROVE → request updated
  - REJECT → request updated
  - defensive response parsing
```

---

### Phase 5: Cross-Cutting & Integration (Est. ~40 new tests)

#### P5-01: `__tests__/integration/full-lifecycle.test.ts` (~15 tests)

```
describe('Complete Business Lifecycle')
  - Shipper registers → creates load → posts to marketplace
  - Carrier registers → creates truck → posts availability
  - Dispatcher creates match proposal
  - Carrier accepts assignment → trip created
  - Trip: ASSIGNED → PICKUP_PENDING → IN_TRANSIT → DELIVERED → COMPLETED
  - Service fee deducted from both wallets
  - Trust metrics updated
  - Notifications sent at each step
```

#### P5-02: `__tests__/integration/concurrent-ops.test.ts` (~10 tests)

```
describe('Concurrent Operations')
  - two carriers request same load → only one wins
  - delete truck while creating posting → proper error
  - update load while creating trip → proper error
  - cache invalidation during concurrent updates
```

#### P5-03: `__tests__/integration/cross-role-access.test.ts` (~15 tests)

```
describe('Cross-Role Access Control')
  - shipper accessing /api/trucks → 403
  - carrier accessing /api/loads (create) → 403
  - dispatcher executing assignment → 403
  - admin accessing all endpoints → 200
  - unauthenticated → 401 on all protected routes
  - REGISTERED user accessing marketplace → 403
  - SUSPENDED user → 403
```

---

## Execution Priority

| Priority | Phase                             | Est. Tests | Rationale                               |
| -------- | --------------------------------- | ---------- | --------------------------------------- |
| P0       | P1-01 (validation.ts)             | 55         | Input boundary — prevents XSS/injection |
| P0       | P1-07 (loadUtils.ts migration)    | 20         | Existing tests not in Jest              |
| P0       | P2-01 (auth register)             | 30         | User onboarding critical path           |
| P0       | P2-02 (auth login)                | 25         | Authentication critical path            |
| P1       | P2-03 (trucks API)                | 35         | Core marketplace functionality          |
| P1       | P2-04 (loads API)                 | 35         | Core marketplace functionality          |
| P1       | P2-05 (truck-postings)            | 25         | Posting workflow                        |
| P1       | P2-06 (trips API)                 | 25         | Trip lifecycle                          |
| P1       | P4-01 (mobile foundation rules)   | 40         | Mobile business logic                   |
| P2       | P1-02 (security)                  | 25         | Security hardening                      |
| P2       | P1-03 (GPS verification)          | 15         | Device validation                       |
| P2       | P1-08 (foundation rules)          | 25         | Business invariants                     |
| P2       | P2-07 (match proposals)           | 15         | Dispatcher workflow                     |
| P2       | P2-08 (requests)                  | 20         | Request workflow                        |
| P2       | P2-09 (admin)                     | 20         | Admin operations                        |
| P2       | P4-02-08 (mobile models/services) | 112        | Mobile parity                           |
| P3       | P3-01-06 (components)             | 80         | UI coverage                             |
| P3       | P5-01-03 (integration)            | 40         | End-to-end confidence                   |
| P3       | P1-04 (notifications)             | 20         | Notification system                     |
| P3       | P1-05 (trust metrics)             | 10         | Trust scoring                           |
| P3       | P1-06 (bypass detection)          | 10         | Fraud prevention                        |
| P3       | P2-10 (CSRF)                      | 8          | CSRF token flow                         |

---

## Summary

| Category           | Current  | Proposed New | Total Target |
| ------------------ | -------- | ------------ | ------------ |
| Library unit tests | ~210     | ~180         | ~390         |
| API route tests    | ~100     | ~200         | ~300         |
| Component tests    | ~90      | ~80          | ~170         |
| Foundation/RBAC    | ~60      | ~25          | ~85          |
| Mobile tests       | ~20      | ~150         | ~170         |
| Integration tests  | ~20      | ~40          | ~60          |
| **TOTAL**          | **~660** | **~675**     | **~1,335**   |

This plan roughly doubles test coverage, targeting all untested libraries, API routes, components, and mobile code with emphasis on edge cases, error conditions, and security boundaries.
