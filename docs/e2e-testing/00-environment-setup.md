# 00 - Environment Setup & Prerequisites

## Required Services

| Service            | Version | Purpose                        |
| ------------------ | ------- | ------------------------------ |
| PostgreSQL         | 14+     | Primary database               |
| Redis              | 7+      | Session cache, BullMQ queues   |
| Node.js            | 18+     | Next.js runtime                |
| Next.js Dev Server | 14+     | `npm run dev` on port 3000     |
| Flutter            | 3.x     | Mobile app (for MOB-xxx tests) |

## Environment Variables

Ensure `.env` is configured with:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/freight_dev"
REDIS_URL="redis://localhost:6379"
NEXTAUTH_SECRET="test-secret-key"
NEXTAUTH_URL="http://localhost:3000"
JWT_SECRET="test-jwt-secret"
CSRF_SECRET="test-csrf-secret"

# Google Routes API (for distance tests)
GOOGLE_ROUTES_API_KEY="your-api-key"

# File uploads
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE_MB=10

# Feature flags
FEATURE_GPS_TRACKING=true
FEATURE_MFA=true
FEATURE_PUSH_NOTIFICATIONS=false
```

## Database Setup

```bash
# Reset and seed database
npx prisma migrate reset --force
npx prisma db seed

# Verify seed data
npx prisma studio
```

## Test User Credentials

| Role            | Email                 | Password   | Org Type        | Status     |
| --------------- | --------------------- | ---------- | --------------- | ---------- |
| Super Admin     | `superadmin@test.com` | `Test123!` | -               | ACTIVE     |
| Admin           | `admin@test.com`      | `Test123!` | -               | ACTIVE     |
| Shipper         | `shipper@test.com`    | `Test123!` | SHIPPER         | ACTIVE     |
| Carrier         | `carrier@test.com`    | `Test123!` | CARRIER_COMPANY | ACTIVE     |
| Dispatcher      | `dispatcher@test.com` | `Test123!` | -               | ACTIVE     |
| Unverified User | `unverified@test.com` | `Test123!` | SHIPPER         | REGISTERED |
| Suspended User  | `suspended@test.com`  | `Test123!` | CARRIER_COMPANY | SUSPENDED  |

## Test Data Seeding Requirements

The following data should exist after seeding:

### Organizations

- At least 1 shipper organization (verified)
- At least 1 carrier organization (verified)
- At least 1 unverified organization

### Corridors

- At least 3 active corridors (e.g., Addis Ababa - Dire Dawa, Addis Ababa - Mekelle, Hawassa - Jimma)
- At least 1 corridor with promo discount active
- At least 1 bidirectional corridor

### Trucks

- At least 2 trucks per carrier organization (different types: FLATBED, REFRIGERATED)
- At least 1 approved truck, 1 pending approval

### Loads

- At least 1 load in DRAFT status
- At least 1 load in POSTED status
- At least 1 load in COMPLETED status (for financial tests)

### Financial Accounts

- Shipper wallet with 10,000 ETB balance
- Carrier wallet with 5,000 ETB balance
- Platform revenue account

### Ethiopian Locations

- Addis Ababa, Dire Dawa, Mekelle, Hawassa, Jimma, Bahir Dar (minimum)

## How to Run Tests

### Automated Tests (Jest)

```bash
# Run all E2E tests
npm test -- --testPathPattern=e2e

# Run specific test file
npm test -- __tests__/e2e-core-flows.test.ts
```

### API Flow Test Script

```bash
# Full 15-step E2E flow
npx tsx scripts/e2e-flow-test.ts
```

### Business Logic Test Script

```bash
# 16-test DB validation
npx tsx scripts/e2e-test-business-logic.ts
```

### Manual Testing

```bash
# Start dev server
npm run dev

# In another terminal, use curl or Postman
# Base URL: http://localhost:3000/api
```

## Authentication for API Tests

```bash
# Login to get JWT token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "shipper@test.com", "password": "Test123!"}'

# Use token in subsequent requests
curl http://localhost:3000/api/loads \
  -H "Authorization: Bearer <token>"
```

## CSRF Token for Mutating Requests

```bash
# Get CSRF token
curl http://localhost:3000/api/csrf-token

# Include in POST/PUT/DELETE requests
curl -X POST http://localhost:3000/api/loads \
  -H "Authorization: Bearer <token>" \
  -H "X-CSRF-Token: <csrf-token>" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

## Cleanup After Testing

```bash
# Reset database to clean state
npx prisma migrate reset --force

# Or selective cleanup
npx tsx scripts/cleanup-test-data.ts
```
