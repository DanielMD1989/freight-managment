# CARRIER PANEL SECURITY FIXES

**Date:** 2026-02-10
**Status:** FIXES APPLIED

---

## SUMMARY

| Category | Vulnerabilities Fixed |
|----------|-----------------------|
| CRITICAL | 4 |
| HIGH | 5 |
| **TOTAL** | **9** |

---

## VULNERABILITIES FIXED

### CRITICAL (C1-C4)

| ID | File | Vulnerability | Fix Applied |
|----|------|---------------|-------------|
| C1 | `app/api/truck-postings/route.ts` | CSRF bypass via spoofable `x-client-type: mobile` header | Mobile clients now MUST have Bearer authentication. Returns 401 if mobile header without Bearer auth. |
| C2 | `app/api/truck-postings/[id]/duplicate/route.ts` | Same CSRF bypass vulnerability | Same fix pattern applied |
| C3 | `app/api/truck-postings/[id]/duplicate/route.ts` | ONE_ACTIVE_POST_PER_TRUCK bypass - could create duplicate active postings | Added check for existing active posting before creating duplicate. Returns 409 with existing posting ID. |
| C4 | `app/api/trucks/route.ts` | Missing CSRF protection on POST (truck creation) | Added CSRF check with mobile Bearer requirement |

### HIGH (H1-H5)

| ID | File | Vulnerability | Fix Applied |
|----|------|---------------|-------------|
| H1 | `app/api/trucks/[id]/route.ts` | Missing CSRF protection on PATCH (truck update) | Added CSRF check with mobile Bearer requirement |
| H2 | `app/api/trucks/[id]/route.ts` | Missing CSRF protection on DELETE (truck deletion) | Added CSRF check with mobile Bearer requirement |
| H3 | `app/api/truck-postings/[id]/route.ts` | Missing CSRF protection on PATCH (posting update) | Added CSRF check with mobile Bearer requirement |
| H4 | `app/api/truck-postings/[id]/route.ts` | Missing CSRF protection on DELETE (posting cancellation) | Added CSRF check with mobile Bearer requirement |
| H5 | `app/api/trips/[tripId]/route.ts` | Missing CSRF protection on PATCH (trip status update) | Added CSRF check with mobile Bearer requirement |

---

## FIX PATTERN

The following pattern was applied to all state-changing endpoints:

```typescript
import { requireCSRF } from '@/lib/csrf';

// In the handler, before requireAuth():
// CSRF protection for state-changing operation
// Mobile clients MUST use Bearer token authentication (inherently CSRF-safe)
// Web clients MUST provide CSRF token
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

### Why This Pattern?

1. **Closes the CSRF bypass hole**: Previously, attackers could set `x-client-type: mobile` header to bypass CSRF checks. This was exploitable because the header is fully attacker-controlled.

2. **Mobile clients remain functional**: Legitimate mobile apps use Bearer token authentication (API keys or JWT tokens), which is inherently CSRF-safe because:
   - Tokens are stored in app memory, not cookies
   - Attacker sites cannot read or include the Authorization header

3. **Web clients get full protection**: Web clients that don't have Bearer auth must provide valid CSRF tokens via the double-submit cookie pattern.

---

## ONE_ACTIVE_POST_PER_TRUCK FIX (C3)

The duplicate endpoint now checks for existing active postings:

```typescript
// ONE_ACTIVE_POST_PER_TRUCK rule: Check if truck already has an active posting
const existingActivePosting = await db.truckPosting.findFirst({
  where: {
    truckId: originalPosting.truckId,
    status: 'ACTIVE',
  },
  select: { id: true },
});

if (existingActivePosting) {
  return NextResponse.json(
    {
      error: 'This truck already has an active posting',
      existingPostingId: existingActivePosting.id,
    },
    { status: 409 }
  );
}
```

---

## FILES MODIFIED

| File | Changes |
|------|---------|
| `app/api/truck-postings/route.ts` | +requireCSRF import, +CSRF check in POST |
| `app/api/truck-postings/[id]/route.ts` | +requireCSRF import, +CSRF check in PATCH/DELETE |
| `app/api/truck-postings/[id]/duplicate/route.ts` | +requireCSRF import, +CSRF check, +ONE_ACTIVE check |
| `app/api/trucks/route.ts` | +requireCSRF import, +CSRF check in POST |
| `app/api/trucks/[id]/route.ts` | +requireCSRF import, +CSRF check in PATCH/DELETE |
| `app/api/trips/[tripId]/route.ts` | +requireCSRF import, +CSRF check in PATCH |

---

## VERIFICATION

```bash
# TypeScript compilation
npx tsc --noEmit
# Exit code: 0 (success)
```

---

## REMAINING VULNERABILITIES (Not Fixed)

The following items from the security audit were NOT addressed:

### Rate Limiting Gaps
- Nearby-loads endpoint has different RPS config than other fleet endpoints
- Requires architectural decision on unified rate limiting

### Input Validation
- Some endpoints accept arbitrary JSON fields (Zod passthrough)
- Requires schema hardening across all endpoints

### Session Security
- Session token rotation on privilege change not implemented
- Requires session management infrastructure changes

---

*Security fixes applied: 2026-02-10*
