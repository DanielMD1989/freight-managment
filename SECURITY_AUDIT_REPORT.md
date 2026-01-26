# Security Audit Report

**Date:** 2026-01-23
**Status:** COMPREHENSIVE AUDIT COMPLETE
**Auditor:** Claude Opus 4.5
**Scope:** CORS, JWT, CSRF, Push Notification Security

---

## Executive Summary

| Category | Status | Risk Level | Critical Issues |
|----------|--------|------------|-----------------|
| CORS Enforcement | GOOD | LOW | 2 minor inconsistencies |
| JWT Expiry Handling | PARTIAL | HIGH | No refresh token mechanism |
| CSRF Protection | GOOD | MEDIUM | 2 endpoint logic bugs |
| APNs/FCM Key Security | SECURE | LOW | Feature not complete |

**Overall Security Posture: GOOD with targeted improvements needed**

---

## 1. CORS ENFORCEMENT AUDIT

### 1.1 Configuration Summary

| Setting | Value | Status |
|---------|-------|--------|
| Wildcard Origins (*) | NOT FOUND | SECURE |
| Origin Whitelisting | Environment variable | SECURE |
| Credentials Handling | After validation only | SECURE |
| WebSocket Validation | Callback-based | SECURE |
| Mobile Detection | x-client-type header | SECURE |

### 1.2 Origin Validation

**Location:** `lib/cors.ts`, `middleware.ts`

```typescript
// Origins loaded from environment
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',')
);

// Validation function
function isOriginAllowed(origin: string): boolean {
  if (process.env.NODE_ENV === 'development') {
    if (origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')) {
      return true;
    }
  }
  return ALLOWED_ORIGINS.has(origin);
}
```

### 1.3 CORS Headers (Only Set for Allowed Origins)

```typescript
if (origin && isOriginAllowed(origin)) {
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  // ... other headers
}
// Empty headers for disallowed origins - SECURE
```

### 1.4 WebSocket Origin Validation

**Location:** `lib/websocket-server.ts:228-242`

```typescript
origin: (origin, callback) => {
  if (!origin) {
    callback(null, true);  // Allow no-origin (mobile apps)
    return;
  }
  if (isOriginAllowed(origin)) {
    callback(null, true);
  } else {
    console.warn(`[WebSocket CORS] Rejected origin: ${origin}`);
    callback(new Error('Origin not allowed'), false);
  }
}
```

### 1.5 Issues Found

| Issue | Severity | Location | Status |
|-------|----------|----------|--------|
| Health endpoint uses non-centralized CORS check | LOW | `app/api/health/route.ts:286` | Fix recommended |
| Config API missing CORS headers in OPTIONS | LOW | `app/api/config/route.ts:72` | Fix recommended |

### 1.6 CORS Test Results

**Note:** Live testing blocked by server runtime issue. Code analysis confirms:
- Unapproved origins receive empty CORS headers
- Browser will reject cross-origin requests without proper headers
- No wildcard origins anywhere in codebase

---

## 2. JWT EXPIRY HANDLING AUDIT

### 2.1 Token Configuration

| Setting | Value | Location |
|---------|-------|----------|
| JWT Expiration | 7 days | `lib/auth.ts:36` |
| Signing Algorithm | HS256 | `lib/auth.ts:74` |
| Encryption (optional) | A256GCM | `lib/auth.ts:82` |
| Cookie MaxAge | 7 days | `lib/auth.ts:202` |
| Session DB Expiry | 7 days | `lib/auth.ts:551` |

### 2.2 Web Token Handling

**Token Creation:**
```typescript
export async function createToken(payload: SessionPayload): Promise<string> {
  const signedToken = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)  // 7d
    .sign(JWT_SECRET);
  // ... optional encryption
}
```

**Expired Token Handling:**
```typescript
// Middleware redirects to login on expired token
if (tokenVerificationFailed) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete("session");
  return response;
}
```

### 2.3 Mobile Token Handling

**Storage:** `FlutterSecureStorage` (native) / `SharedPreferences` (web)

**401 Response Handling:**
```dart
onError: (error, handler) async {
  if (error.response?.statusCode == 401) {
    await clearAuth();  // Clears all tokens
    // Navigation to login handled by app state
  }
  handler.next(error);
}
```

### 2.4 Critical Gap: No Refresh Token

| Feature | Status |
|---------|--------|
| Access Token | Implemented (7 days) |
| Refresh Token | NOT IMPLEMENTED |
| Pre-expiry Warning | NOT IMPLEMENTED |
| Silent Refresh | NOT IMPLEMENTED |
| Token Rotation | NOT IMPLEMENTED |

**Impact:** Users are logged out after 7 days with no option for automatic re-authentication.

### 2.5 Recommendations

1. **CRITICAL:** Implement refresh token mechanism
   - Short-lived access token (15 min)
   - Long-lived refresh token (7 days)
   - Automatic silent refresh

2. **HIGH:** Add client-side expiry tracking
   - Decode JWT to extract `exp` claim
   - Warn user before expiry
   - Attempt refresh 5 min before expiry

---

## 3. CSRF PROTECTION AUDIT

### 3.1 Implementation Pattern

**Double-Submit Cookie Pattern:**
1. CSRF token stored in httpOnly cookie
2. Same token sent in X-CSRF-Token header
3. Server validates both match (timing-safe comparison)

### 3.2 Token Generation

**Location:** `lib/csrf.ts:44-46`

```typescript
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');  // 256-bit entropy
}
```

### 3.3 Cookie Settings

```typescript
response.cookies.set('csrf_token', token, {
  httpOnly: true,                              // XSS protection
  secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
  sameSite: 'lax',                             // Cross-site protection
  path: '/',
  maxAge: 60 * 60 * 24,                        // 24 hours
});
```

### 3.4 Validation

```typescript
export function validateCSRFToken(request: NextRequest): boolean {
  const cookieToken = getCSRFTokenFromCookie(request);
  const headerToken = getCSRFTokenFromHeader(request);

  if (!cookieToken || !headerToken) return false;

  return crypto.timingSafeEqual(  // Timing-safe comparison
    Buffer.from(cookieToken),
    Buffer.from(headerToken)
  );
}
```

### 3.5 Protected Methods

- POST, PUT, PATCH, DELETE (state-changing operations)

### 3.6 Exempt Routes (Justified)

| Route | Reason |
|-------|--------|
| `/api/auth/login` | Pre-authentication |
| `/api/auth/register` | Pre-authentication |
| `/api/auth/logout` | Session termination |
| `/api/auth/forgot-password` | Email token protection |
| `/api/auth/reset-password` | Email token protection |
| `/api/auth/verify-mfa` | MFA token protection |
| `/api/cron/*` | Server-to-server |
| `/api/webhooks/*` | Third-party callbacks |
| `/api/tracking/ingest` | Machine-to-machine GPS |

### 3.7 Bearer Token Exemption

**Middleware correctly exempts Bearer token requests:**
```typescript
const hasBearerToken = authHeader?.startsWith('Bearer ');
if (!hasBearerToken) {
  // Apply CSRF check
}
```

**Rationale:** Bearer tokens are CSRF-proof because:
- Not sent automatically by browser
- Attacker cannot forge valid JWT
- CORS prevents cross-origin Authorization headers

### 3.8 Issues Found

| Issue | Severity | Location | Fix |
|-------|----------|----------|-----|
| Logical error in CSRF check | HIGH | `truck-postings/route.ts:85` | Change OR to AND |
| Logical error in CSRF check | HIGH | `truck-requests/route.ts:53` | Change OR to AND |

**Bug Details:**
```typescript
// CURRENT (buggy):
if (!isMobileClient || !hasBearerAuth) {
  // Check CSRF - runs for web+Bearer incorrectly
}

// SHOULD BE:
if (!isMobileClient && !hasBearerAuth) {
  // Check CSRF - correct logic
}
```

### 3.9 Mobile CSRF Handling

**Mobile sends CSRF token in header:**
```dart
if (['POST', 'PUT', 'PATCH', 'DELETE'].contains(options.method)) {
  final csrfToken = await _readStorage(StorageKeys.csrfToken);
  if (csrfToken != null && csrfToken.isNotEmpty) {
    options.headers['x-csrf-token'] = csrfToken;
  }
}
```

---

## 4. APNs/FCM KEY SECURITY AUDIT

### 4.1 Server-Side Credential Storage

**All credentials stored as environment variables:**

```bash
# Firebase (FCM)
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=

# APNs
APNS_KEY_ID=
APNS_TEAM_ID=
APNS_KEY_FILE=
APNS_BUNDLE_ID=
```

### 4.2 Client-Side Exposure Check

| Check | Result |
|-------|--------|
| FCM Server Key in mobile code | NOT FOUND |
| APNs certificates in iOS bundle | NOT FOUND |
| Firebase config JSON files | NOT FOUND |
| Hardcoded API keys | NOT FOUND |
| Environment variable usage | PROPER |

### 4.3 Backend Implementation

**Location:** `lib/pushWorker.ts`

```typescript
// Firebase Admin SDK initialization (server-side only)
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

// APNs Provider initialization
const apnsProvider = new apn.Provider({
  token: {
    key: config.apns.keyFile,      // Path to .p8 file
    keyId: config.apns.keyId,
    teamId: config.apns.teamId,
  },
  production: config.apns.production,
});
```

### 4.4 Mobile Implementation Status

| Feature | Status |
|---------|--------|
| Firebase dependencies | Declared in pubspec.yaml |
| Firebase initialization | DISABLED (commented out) |
| Push token registration | NOT IMPLEMENTED |
| FCM token handling | NOT IMPLEMENTED |

**Finding:** Push notifications are a **feature gap**, not a security issue.

### 4.5 Device Token Management

```typescript
// Server-side token registration
export async function registerDeviceToken(
  userId: string,
  token: string,
  platform: 'ios' | 'android',
  appVersion: string
): Promise<void> {
  await db.deviceToken.upsert({
    where: { token },
    update: { userId, platform, appVersion, lastActiveAt: new Date() },
    create: { userId, token, platform, appVersion },
  });
}

// Inactive token cleanup (30 days)
export async function cleanupInactiveTokens(): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const result = await db.deviceToken.deleteMany({
    where: { lastActiveAt: { lt: thirtyDaysAgo } },
  });
  return result.count;
}
```

---

## 5. SECURITY FINDINGS SUMMARY

### 5.1 Critical Issues

| # | Issue | Location | Impact | Fix |
|---|-------|----------|--------|-----|
| 1 | No refresh token mechanism | `lib/auth.ts` | Users logged out after 7 days | Implement refresh tokens |
| 2 | CSRF logic bug (2 endpoints) | `truck-postings`, `truck-requests` | Web+Bearer bypass possible | Fix OR to AND |

### 5.2 High Priority Issues

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 3 | No pre-expiry token warning | Mobile/Web | Poor UX on expiry |
| 4 | No token rotation | `lib/auth.ts` | Compromised token valid 7 days |
| 5 | 84 endpoints rely on middleware CSRF only | Various routes | Defense-in-depth gap |

### 5.3 Medium Priority Issues

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 6 | Health endpoint non-centralized CORS | `api/health/route.ts` | Inconsistency |
| 7 | Config API missing CORS headers | `api/config/route.ts` | Preflight may fail |
| 8 | Secure cookie flag env-dependent | `lib/csrf.ts` | Misconfiguration risk |

### 5.4 Strengths

- No wildcard CORS origins
- Proper origin whitelisting
- httpOnly cookies for session and CSRF
- Timing-safe CSRF comparison
- Bearer token CSRF exemption (correct)
- No exposed credentials in mobile code
- Proper environment variable usage
- Session revocation support
- MFA implementation

---

## 6. COMPLIANCE MATRIX

| Security Control | Web | Mobile | Status |
|------------------|-----|--------|--------|
| Origin Validation | CORS headers | N/A (native) | PASS |
| Token Expiration | 7 days | 7 days | PASS |
| Token Storage | httpOnly cookie | SecureStorage | PASS |
| Refresh Mechanism | None | None | FAIL |
| CSRF Protection | Double-submit | Bearer exempt | PARTIAL |
| Credential Storage | Env vars | N/A | PASS |
| Key Pinning | N/A | Not implemented | N/A |

---

## 7. RECOMMENDATIONS BY PRIORITY

### Immediate (Week 1)

1. **Fix CSRF logic bug** in truck-postings and truck-requests
   ```typescript
   // Change from:
   if (!isMobileClient || !hasBearerAuth)
   // To:
   if (!isMobileClient && !hasBearerAuth)
   ```

2. **Add explicit CSRF checks** to high-risk endpoints:
   - `/api/loads` (POST)
   - `/api/organizations` (POST)
   - `/api/loads/[id]` (PATCH)

### Short-term (Week 2-3)

3. **Implement refresh token mechanism**
   - Add `POST /api/auth/refresh` endpoint
   - Issue 15-min access tokens + 7-day refresh tokens
   - Store refresh tokens in httpOnly cookie

4. **Add token expiry tracking** on mobile
   - Decode JWT to get expiry time
   - Warn user 5 minutes before expiry
   - Attempt silent refresh

### Medium-term (Week 4-6)

5. **Implement token rotation**
   - Rotate access token on each refresh
   - Invalidate old tokens

6. **Complete push notification implementation**
   - Initialize Firebase in mobile app
   - Create `POST /api/push/register` endpoint
   - Test FCM/APNs delivery

7. **Standardize CORS across all endpoints**
   - Use centralized `isOriginAllowed()` everywhere
   - Remove endpoint-specific CORS implementations

---

## 8. TEST VERIFICATION STATUS

| Test | Status | Notes |
|------|--------|-------|
| CORS rejection from evil origin | BLOCKED | Server runtime issue |
| CORS acceptance from localhost | BLOCKED | Server runtime issue |
| JWT expiry handling | CODE VERIFIED | Logic correct |
| CSRF token validation | CODE VERIFIED | Timing-safe |
| Mobile key exposure | VERIFIED | None found |

**Note:** Live CORS testing blocked by ioredis edge runtime incompatibility. Code analysis confirms proper implementation.

---

## Conclusion

The application has a **solid security foundation** with proper:
- Origin validation and CORS configuration
- CSRF protection using double-submit cookies
- Credential management (no client-side exposure)
- Session security (httpOnly, secure cookies)

**Key improvements needed:**
1. Fix 2 CSRF logic bugs (HIGH)
2. Implement refresh token mechanism (CRITICAL for UX)
3. Add defense-in-depth CSRF checks
4. Complete push notification feature

**Overall Risk Assessment: MEDIUM**
- No critical data exposure risks
- Authentication improvements needed for production readiness
- CSRF bugs should be fixed before production

---

**Report Generated:** 2026-01-23
**Audit Method:** Static code analysis + architecture review
**Files Analyzed:** 50+ security-related files
