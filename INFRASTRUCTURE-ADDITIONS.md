# Infrastructure Additions

**Date:** 2026-02-11
**Status:** COMPLETED

---

## Summary

Added 4 reusable infrastructure items that work across all panels (Carrier, Shipper, Dispatcher, Admin).

| Item | File | Purpose |
|------|------|---------|
| Rate Limiting | `lib/rateLimit.ts` (extended) | Dashboard and write operation limits |
| Route Constants | `lib/routes.ts` | Type-safe centralized route definitions |
| Tab State Hook | `lib/hooks/useTabState.ts` | URL-based tab persistence |
| CSRF Helper | `lib/csrf.ts` (extended) | Consolidated CSRF with mobile bypass |

---

## 1. Rate Limiting (Extended)

### Added Configurations

```typescript
// In lib/rateLimit.ts - RPS_CONFIGS

// Dashboard endpoints - 60/min (1 RPS + 5 burst)
dashboard: {
  endpoint: '/api/*/dashboard',
  rps: 1,
  burst: 5,
}

// Write operations - 30/min (0.5 RPS + 5 burst)
write: {
  endpoint: '/api/*',
  rps: 0.5,
  burst: 5,
}
```

### Usage

```typescript
import { checkRpsLimit, RPS_CONFIGS } from '@/lib/rateLimit';

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

  const rpsResult = await checkRpsLimit(
    RPS_CONFIGS.dashboard.endpoint,
    ip,
    RPS_CONFIGS.dashboard.rps,
    RPS_CONFIGS.dashboard.burst
  );

  if (!rpsResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: 1 },
      { status: 429 }
    );
  }

  // ... rest of handler
}
```

### Applied To

- `app/api/carrier/dashboard/route.ts`

---

## 2. Route Constants

### File: `lib/routes.ts`

### Structure

```typescript
import { ROUTES } from '@/lib/routes';

// Panel routes
ROUTES.carrier.dashboard          // '/carrier/dashboard'
ROUTES.carrier.trucks.list        // '/carrier/trucks'
ROUTES.carrier.trucks.detail(id)  // '/carrier/trucks/{id}'
ROUTES.carrier.trucks.add         // '/carrier/trucks/add'

ROUTES.shipper.loads.create       // '/shipper/loads/create'
ROUTES.admin.users.list           // '/admin/users'

// API routes
ROUTES.api.carrier.trucks         // '/api/trucks'
ROUTES.api.gps.position(truckId)  // '/api/trucks/{truckId}/position'

// Auth routes
ROUTES.auth.login                 // '/login'
ROUTES.auth.register              // '/register'
```

### Features

- Type-safe route generation
- Dynamic parameter support
- Organized by panel
- API routes included
- Helper functions: `getFullUrl()`, `matchesRoute()`

### Applied To

- `app/carrier/trucks/TruckManagementClient.tsx`

---

## 3. Tab State Persistence Hook

### File: `lib/hooks/useTabState.ts`

### Usage

```typescript
'use client';

import { useTabState } from '@/lib/hooks/useTabState';

function TabbedComponent() {
  const [activeTab, setActiveTab] = useTabState('overview', 'tab');

  return (
    <div>
      <button
        onClick={() => setActiveTab('overview')}
        className={activeTab === 'overview' ? 'active' : ''}
      >
        Overview
      </button>
      <button
        onClick={() => setActiveTab('details')}
        className={activeTab === 'details' ? 'active' : ''}
      >
        Details
      </button>

      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'details' && <DetailsTab />}
    </div>
  );
}
```

### Features

- URL-based persistence (`?tab=details`)
- Browser back/forward support
- Page refresh persistence
- Shareable URLs with tab state
- Multi-tab support with `useMultiTabState`

### Options

```typescript
const [tab, setTab] = useTabState('default', 'tab', {
  replace: true,        // Use replace instead of push (default: true)
  preserveParams: true, // Keep other query params (default: true)
});
```

---

## 4. CSRF Helper with Mobile Bypass

### File: `lib/csrf.ts` (extended)

### New Function

```typescript
import { validateCSRFWithMobile } from '@/lib/csrf';

export async function POST(request: NextRequest) {
  // One-liner replaces 15+ lines of copy-pasted code
  const csrfError = await validateCSRFWithMobile(request);
  if (csrfError) return csrfError;

  // ... rest of handler
}
```

### Logic

1. If `x-client-type: mobile` header present:
   - MUST have `Authorization: Bearer ...` header
   - Returns 401 if missing Bearer token

2. If web client (no mobile header):
   - Validates CSRF token from cookie/header
   - Returns 403 if invalid

3. If has Bearer auth (mobile or web):
   - Skips CSRF (Bearer is inherently CSRF-safe)

### Applied To

- `app/api/trucks/route.ts` (POST handler)

### Before (15 lines)

```typescript
const isMobileClient = request.headers.get('x-client-type') === 'mobile';
const hasBearerAuth = request.headers.get('authorization')?.startsWith('Bearer ');

if (isMobileClient && !hasBearerAuth) {
  return NextResponse.json(
    { error: 'Mobile clients require Bearer authentication' },
    { status: 401 }
  );
}

if (!isMobileClient && !hasBearerAuth) {
  const csrfError = await requireCSRF(request);
  if (csrfError) {
    return csrfError;
  }
}
```

### After (2 lines)

```typescript
const csrfError = await validateCSRFWithMobile(request);
if (csrfError) return csrfError;
```

---

## Verification

```bash
# TypeScript compilation
npx tsc --noEmit
# Exit code: 0 (success)
```

---

## Files Modified

| File | Change |
|------|--------|
| `lib/rateLimit.ts` | Added dashboard and write RPS configs |
| `lib/csrf.ts` | Added `validateCSRFWithMobile()` function |
| `lib/routes.ts` | NEW - Centralized route constants |
| `lib/hooks/useTabState.ts` | NEW - Tab state persistence hook |
| `app/api/carrier/dashboard/route.ts` | Added rate limiting |
| `app/api/trucks/route.ts` | Using new CSRF helper |
| `app/carrier/trucks/TruckManagementClient.tsx` | Using route constants |

---

## Migration Guide

### Updating Existing CSRF Code

Replace all instances of the 15-line CSRF pattern with:

```typescript
import { validateCSRFWithMobile } from '@/lib/csrf';

// Replace the 15-line pattern with:
const csrfError = await validateCSRFWithMobile(request);
if (csrfError) return csrfError;
```

### Updating Hardcoded Routes

```typescript
// Before
href="/carrier/trucks/add"

// After
import { ROUTES } from '@/lib/routes';
href={ROUTES.carrier.trucks.add}
```

### Adding Tab Persistence

```typescript
// Before (local state)
const [activeTab, setActiveTab] = useState('overview');

// After (URL-persisted)
import { useTabState } from '@/lib/hooks/useTabState';
const [activeTab, setActiveTab] = useTabState('overview');
```

---

*Infrastructure additions completed: 2026-02-11*
