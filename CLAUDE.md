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
npm test                 # Run all Jest tests (23 suites, 660+ tests)
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
npm test                 # Run Jest tests (6 suites, 93 tests)
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
__tests__/        # Jest test suites (api/ and components/ subdirs)
```

## API Response Patterns

POST endpoints typically wrap responses; GET/PATCH return unwrapped:

- `POST /api/trucks` → `{ truck: {...} }`
- `GET /api/trucks/[id]` → truck object directly
- `PATCH /api/trucks/[id]` → truck object directly
- `POST /api/loads` → `{ load: {...} }`

Mobile code uses defensive pattern: `response.data.truck ?? response.data`

## Roles & Access Control

Five roles: `SHIPPER`, `CARRIER`, `DISPATCHER`, `ADMIN`, `SUPER_ADMIN`

- Only SHIPPER, CARRIER, DISPATCHER can self-register (admin-blocked at API level)
- Shippers cannot browse `/api/trucks` — must use `/api/truck-postings`
- Cross-role route access returns 403 / redirects to `/unauthorized`
- User statuses: REGISTERED → PENDING_VERIFICATION → ACTIVE (admin approval required)

## Trip State Machine

`ASSIGNED → PICKUP_PENDING → IN_TRANSIT → DELIVERED`

Invalid transitions return 400. Canonical transitions defined in `lib/tripStateMachine.ts`.

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

## Rate Limiting

- Login: In-memory rate limiter (can block repeated attempts ~30s)
- Registration: 3 per hour per IP
- Health endpoint detailed info requires authentication

## Environment Variables

Required in production (no fallbacks):

- `JWT_SECRET`, `JWT_ENCRYPTION_KEY`, `MFA_TOKEN_SECRET`
- `DATABASE_URL` (PostgreSQL connection string)
- `CRON_SECRET` (for cron endpoint auth)

Optional: `GOOGLE_MAPS_API_KEY`, `CLOUDINARY_*`, `REDIS_URL`, `SENTRY_DSN`, `AWS_*`
