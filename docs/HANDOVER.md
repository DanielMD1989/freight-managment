# FreightET Platform - Handover Document

## Project Overview

FreightET is an Ethiopian freight marketplace platform connecting shippers and carriers. Built with Next.js 15, PostgreSQL/Prisma, React Native/Expo.

**Blueprint**: `docs/freight_marketplace_blueprint.md` (sections 1-14)

---

## Current State (2026-04-05)

### Test Coverage

| Suite          | Count                   | Status                              |
| -------------- | ----------------------- | ----------------------------------- |
| Jest (web)     | 191 suites, 3,179 tests | All passing                         |
| Jest (mobile)  | 37 suites, 570 tests    | All passing                         |
| Playwright E2E | 895 tests               | 766 passed, 23 failed\*, 26 skipped |
| TypeScript     | 0 errors                | Clean                               |
| ESLint         | 0 warnings              | Clean                               |

\*Playwright failures are seed data dependencies (exact values from demo seed), not code bugs.

### Feature Completeness by Blueprint Section

| Section | Feature                                   | Status   |
| ------- | ----------------------------------------- | -------- |
| 1       | Account hierarchy & registration          | Complete |
| 2       | Admin approval workflow                   | Complete |
| 3       | Shipper flow (loads, requests)            | Complete |
| 4       | Carrier flow (trucks, postings, matching) | Complete |
| 5       | Dispatcher operations                     | Complete |
| 6       | Load cancellation & state machine         | Complete |
| 7       | Trip management & exceptions              | Complete |
| 8       | Service fees & wallet system              | Complete |
| 9       | Admin analytics & reports                 | Complete |
| 10      | Super admin operations                    | Complete |
| 11      | GPS tracking & geofencing                 | Complete |
| 12      | Ratings & trust scores                    | Complete |
| 13      | In-app messaging                          | Complete |
| 14      | Settings, help, profile                   | Complete |

### Security

- CSRF validation on all mutation endpoints
- Rate limiting on all high-impact endpoints (login, registration, marketplace, messaging)
- Wallet threshold gate blocking marketplace activity below minimum balance
- Role-based access control (RBAC) with granular permissions
- JWT encryption for sensitive claims
- MFA support (OTP via email)
- All cron endpoints require `CRON_SECRET` Bearer token (returns 401 without)

---

## Architecture

### Web (Next.js 15)

```
app/api/           # ~50 API route groups
app/(role)/        # Role-based page routes (carrier, shipper, admin, dispatcher)
lib/               # Shared utilities (auth, validation, matching, fees, etc.)
components/        # Shared React components
prisma/            # Schema (100+ models) and migrations
```

### Mobile (React Native / Expo SDK 54)

```
mobile/app/        # Expo Router screens
mobile/src/        # Services, stores (Zustand), hooks (TanStack Query), i18n
```

### Key Libraries

- **ORM**: Prisma with PostgreSQL
- **Auth**: JWT via jose (Bearer for mobile, httpOnly cookies for web)
- **Validation**: Zod schemas
- **Charts**: Recharts (v1.7 analytics dashboards)
- **UI**: Tailwind CSS 4, Lucide icons, react-hot-toast
- **Mobile**: Axios, React Hook Form, MMKV, expo-location

### State Machines

- **Load**: DRAFT -> POSTED -> SEARCHING/OFFERED -> ASSIGNED -> PICKUP_PENDING -> IN_TRANSIT -> DELIVERED -> COMPLETED
- **Trip**: ASSIGNED -> PICKUP_PENDING -> IN_TRANSIT -> DELIVERED -> COMPLETED (with EXCEPTION path from IN_TRANSIT)
- Defined in `lib/loadStateMachine.ts` and `lib/tripStateMachine.ts`

---

## Deployment

### Required Environment Variables

```
DATABASE_URL          # PostgreSQL connection string
JWT_SECRET            # openssl rand -base64 32
JWT_ENCRYPTION_KEY    # openssl rand -base64 32
MFA_TOKEN_SECRET      # openssl rand -base64 32
CRON_SECRET           # Secret for cron endpoint auth
```

### Optional

```
GOOGLE_MAPS_API_KEY   # Distance calculations
CLOUDINARY_*          # Image uploads
REDIS_URL             # Caching (falls back to in-memory)
SENTRY_DSN            # Error tracking
AWS_*                 # S3 document storage
```

### CI/CD

- **GitHub Actions CI**: `.github/workflows/ci.yml` — lint, build, test (Jest) on push to main/develop
- **Cron scheduler**: `.github/workflows/cron.yml` — hourly triggers for 9 cron endpoints
- **Deployment**: See `docs/DEPLOYMENT.md` for EC2/Docker setup

### Database

```bash
npx prisma generate    # Generate client
npx prisma db push     # Sync schema (dev)
npx prisma migrate deploy  # Apply migrations (prod)
```

---

## Testing

### Jest (Unit/Integration)

```bash
npm test                           # All 3,179 tests
npm test -- __tests__/api/loads    # Specific directory
npm run test:security              # Security-focused subset
```

### Playwright (E2E)

```bash
npx playwright test                # All 895 tests (requires running dev server + PostgreSQL)
npx playwright test --headed       # With browser UI
npx playwright test e2e/shipper/   # By role
```

**Prerequisites for E2E**:

1. PostgreSQL running with schema applied
2. Seed data: `npx ts-node scripts/seed-test-data.ts`
3. Dev server running: `npm run dev`
4. For demo-dependent tests: `npx ts-node scripts/seed-demo-data.ts`

### Test Users (from seed)

| Email               | Role        | Password |
| ------------------- | ----------- | -------- |
| shipper@test.com    | SHIPPER     | password |
| carrier@test.com    | CARRIER     | password |
| dispatcher@test.com | DISPATCHER  | password |
| admin@test.com      | ADMIN       | password |
| superadmin@test.com | SUPER_ADMIN | password |

---

## Known Limitations

1. **Reassign-truck endpoint**: Works correctly but complex E2E test scenarios can fail due to truck availability (test isolation, not a code bug)
2. **Mobile saved search alerts**: API supports `alertsEnabled` field, mobile UI toggle not yet built
3. **In-memory rate limiter**: Resets on server restart; production should use Redis-backed rate limiting
4. **E2E test isolation**: Some Playwright tests share database state; rate limiter exhaustion can cascade failures (restart dev server between full runs)

---

## Key Files Reference

| Purpose             | File                                        |
| ------------------- | ------------------------------------------- |
| Blueprint spec      | `docs/freight_marketplace_blueprint.md`     |
| Prisma schema       | `prisma/schema.prisma`                      |
| Auth utilities      | `lib/auth.ts`, `lib/csrf.ts`, `lib/rbac.ts` |
| Trip state machine  | `lib/tripStateMachine.ts`                   |
| Load state machine  | `lib/loadStateMachine.ts`                   |
| Matching engine     | `lib/matchingEngine.ts`                     |
| Service fee logic   | `lib/serviceFeeManagement.ts`               |
| Notification system | `lib/notifications.ts`                      |
| Wallet gate         | `lib/walletGate.ts`                         |
| Rate limiting       | `lib/rateLimit.ts`                          |
| Admin metrics       | `lib/admin/metrics.ts`                      |
| SLA aggregation     | `lib/slaAggregation.ts`                     |
| Seed (test)         | `scripts/seed-test-data.ts`                 |
| Seed (demo)         | `scripts/seed-demo-data.ts`                 |
| CI workflow         | `.github/workflows/ci.yml`                  |
| Cron workflow       | `.github/workflows/cron.yml`                |
| Deployment guide    | `docs/DEPLOYMENT.md`                        |
