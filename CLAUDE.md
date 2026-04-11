# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

### Web (Next.js)

```bash
npm run dev              # Start dev server on port 3000
npm run build            # Production build
npm run lint             # ESLint
npm run format:check     # Prettier check
npm run type-check       # TypeScript type check (tsconfig.build.json)
```

### Tests

```bash
npm test                 # Run all Jest tests (191 suites, 3179 tests)
npm test -- --testPathPattern="auth" # Run tests matching pattern
npm test -- __tests__/api/trucks.test.ts  # Run single test file
npm run test:coverage    # Tests with coverage report
npm run test:security    # Security-focused test subset
```

### Database

```bash
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run migrations (dev)
npm run db:deploy        # Apply migrations (prod)
npm run db:studio        # Open Prisma Studio GUI
```

### Mobile (React Native / Expo)

```bash
cd mobile
npm test                 # Run Jest tests (37 suites, 570 tests)
npx tsc --noEmit         # TypeScript check
npx expo start           # Start Expo dev server
npx expo export --platform web  # Build for web (Playwright-testable)
```

### Mobile (Flutter — archived)

```bash
cd mobile-flutter        # Original Flutter codebase (kept for reference)
flutter analyze          # Dart linter
```

## Architecture

### Web Stack

- **Framework**: Next.js 15 with App Router (`app/` directory)
- **Database**: PostgreSQL via Prisma ORM (`prisma/schema.prisma`)
- **Auth**: JWT with jose library — Bearer tokens for mobile, httpOnly cookies for web
- **CSRF**: Double-submit cookie pattern; mobile with Bearer token skips CSRF
- **Validation**: Zod schemas (`lib/validation.ts`)
- **UI**: Tailwind CSS 4, Lucide icons, react-hot-toast

### Mobile Stack (React Native / Expo)

- **Framework**: React Native + Expo SDK 54 (TypeScript)
- **State (client)**: Zustand (`mobile/src/stores/`)
- **State (server)**: TanStack Query (`mobile/src/hooks/`)
- **Navigation**: Expo Router v4 (file-based, `mobile/app/`)
- **HTTP**: Axios with interceptors (`mobile/src/api/client.ts`)
- **Forms**: React Hook Form + Zod
- **Storage**: expo-secure-store for tokens, AsyncStorage for settings, MMKV for GPS queue
- **i18n**: i18next + expo-localization (`mobile/src/i18n/`)
- **Native**: expo-location, expo-notifications, expo-image-picker, react-native-maps

### Key Directories

```
app/api/          # ~45 API route groups (auth, loads, trucks, trips, etc.)
app/(carrier|shipper|admin|dispatcher)/  # Role-based page routes
lib/              # Shared utilities (auth, security, validation, prisma)
components/       # Shared React components
mobile/app/       # Expo Router screens (carrier, shipper, shared, auth)
mobile/src/       # Services, stores, hooks, utils, theme, types, i18n
mobile-flutter/   # Archived Flutter codebase (reference only)
prisma/           # Schema and migrations
__tests__/        # Jest test suites (191 suites across api/, components/, lib/, etc.)
e2e/              # Playwright E2E tests (895 tests across shipper/, carrier/, admin/, dispatcher/)
scripts/          # Seed scripts (seed-test-data.ts, seed-demo-data.ts)
```

## API Response Patterns

POST endpoints typically wrap responses; GET/PATCH return unwrapped:

- `POST /api/trucks` → `{ truck: {...} }`
- `GET /api/trucks/[id]` → truck object directly
- `PATCH /api/trucks/[id]` → truck object directly
- `POST /api/loads` → `{ load: {...} }`

Mobile code uses defensive pattern: `response.data.truck ?? response.data`

## Roles & Access Control

Six roles: `SHIPPER`, `CARRIER`, `DISPATCHER`, `ADMIN`, `SUPER_ADMIN`, `DRIVER`

- Only SHIPPER, CARRIER, DISPATCHER can self-register (admin-blocked at API level)
- DRIVER is invite-only — created by a CARRIER via invite code; status flow: INVITED → PENDING_VERIFICATION → ACTIVE
- Shippers cannot browse `/api/trucks` — must use `/api/truck-postings`
- Cross-role route access returns 403 / redirects to `/unauthorized`
- User statuses: REGISTERED → PENDING_VERIFICATION → ACTIVE (admin approval required). Drivers use INVITED → PENDING_VERIFICATION → ACTIVE.
- Drivers are assigned per-trip (`Trip.driverId`), NOT per-truck. They can advance trip status (PICKUP_PENDING → IN_TRANSIT → DELIVERED → COMPLETED) and raise EXCEPTION, but cannot CANCEL trips, browse the load marketplace, manage trucks, or access finances.

## Trip State Machine

`ASSIGNED → PICKUP_PENDING → IN_TRANSIT → DELIVERED → COMPLETED`

Exception path: `IN_TRANSIT → EXCEPTION → ASSIGNED | IN_TRANSIT | CANCELLED | COMPLETED`

Invalid transitions return 400. Canonical transitions defined in `lib/tripStateMachine.ts`.

## E2E Test Stability Rules

### Schema change → E2E update (same session)

Whenever `app/api/loads/route.ts` `createLoadSchema` gains or loses a required field, update ALL of these in the same session:

- `e2e/shipper/test-utils.ts` (`ensureLoad`, `ensureTrip`)
- `e2e/carrier/test-utils.ts` (`ensureCarrierTrip`)
- `e2e/admin/test-utils.ts`
- `e2e/dispatcher/test-utils.ts` (`ensurePostedLoad`)
- `e2e/shared/schema-validate.ts` (`loadPayloadSchema`)

Find all inline load-creation sites:

```bash
grep -r "POST.*api/loads" e2e/ tests/e2e/
```

The shared schema validator (`e2e/shared/schema-validate.ts`) is a dev-time guard — it throws immediately with a descriptive error if any `ensure*()` factory sends an invalid payload.

### Token cache

All four role test-utils import `readTokenCache`/`writeTokenCache`/`TOKEN_CACHE_TTL` from `e2e/shared/token-cache.ts`. If the cache format changes, update only that file.

### Revoke-then-restore pattern

Any test that calls a destructive admin action (revoke, suspend, reject) on a **shared test user** (`shipper@test.com`, `carrier@test.com`, `dispatcher@test.com`) **must**:

1. Re-activate the user inline immediately after the assertion (belt-and-suspenders)
2. Call `invalidateTokenCache(email)` to evict the now-invalid JWT from the file cache
3. Add an `afterAll` block that calls `restoreTestUsers()` from `tests/e2e/shared/test-utils.ts` as a safety net in case the test fails before the inline re-activation runs

Rationale: `POST /admin/users/:id/revoke` calls `revokeAllSessions()` which invalidates all existing JWTs. Even after re-activation, the cached token is a dead credential — subsequent tests that call `getShipperToken()` / `getCarrierToken()` would receive the stale invalid token and fail silently.

```ts
test.afterAll(async () => {
  await restoreTestUsers(); // re-activates shipper, carrier, dispatcher + clears cache
});
```

## Testing Notes

- Jest defaults to `node` environment; component tests use `@jest-environment jsdom` docblock
- `jest.mock()` is hoisted above imports — mock factories cannot reference `const` variables (TDZ)
- Path alias `@/` maps to project root
- `jose` is in `transformIgnorePatterns` exception list
- Pre-commit hook runs eslint + prettier via husky/lint-staged

## CSRF Protection

All mutation API endpoints require CSRF validation via `validateCSRFWithMobile()`:

- Checks `X-CSRF-Token` header against httpOnly cookie
- Mobile requests with `Authorization: Bearer` header skip CSRF
- Web forms fetch CSRF token from `GET /api/csrf-token`

## E2E Tests (Playwright)

```bash
npx playwright test                    # Run all 895 E2E tests
npx playwright test e2e/shipper/       # Run shipper tests only
npx playwright test --headed           # Run with visible browser
npx playwright test --ui               # Interactive UI mode
```

- Tests run against real PostgreSQL (not mocks)
- Seed data required: `npx ts-node scripts/seed-test-data.ts`
- Token cache at `e2e/.auth/token-cache.json` (avoids rate limit exhaustion)
- Login rate limiter (30 req/15min per email) can block tests — restart dev server to clear

## Cron Endpoints

All cron endpoints require `Authorization: Bearer ${CRON_SECRET}` header. Returns 401 without valid secret.

- `POST /api/cron/trip-monitor` — Auto-close 48h+ DELIVERED trips
- `POST /api/cron/gps-monitor` — GPS position staleness check
- `POST /api/cron/gps-cleanup` — Purge old GPS positions
- `POST /api/cron/insurance-monitor` — Insurance expiry notifications
- `POST /api/cron/saved-search-monitor` — Match new loads to saved searches
- `POST /api/cron/aggregate-sla` — Daily SLA metric aggregation
- `POST /api/cron/expire-loads` — Expire old unmatched loads
- `POST /api/cron/expire-postings` — Expire old truck postings
- `POST /api/cron/auto-settle` — Auto-settle completed loads

GitHub Actions cron schedule: `.github/workflows/cron.yml` (hourly)

## Rate Limiting

- Login: In-memory rate limiter (30 attempts per 15 min per email+IP)
- Registration: 3 per hour per IP
- Marketplace endpoints: RPS-based rate limiting via `checkRpsLimit()`
- Health endpoint detailed info requires authentication

## Environment Variables

Required in production (no fallbacks):

- `JWT_SECRET`, `JWT_ENCRYPTION_KEY`, `MFA_TOKEN_SECRET`
- `DATABASE_URL` (PostgreSQL connection string)
- `CRON_SECRET` (for cron endpoint auth)

Optional: `GOOGLE_MAPS_API_KEY`, `CLOUDINARY_*`, `REDIS_URL`, `SENTRY_DSN`, `AWS_*`
