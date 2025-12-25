# CSRF Protection Documentation

**Sprint 9 - Story 9.6: CSRF Protection**
**Date:** 2025-12-25
**Status:** Implemented

---

## Overview

CSRF (Cross-Site Request Forgery) protection prevents attackers from tricking authenticated users into performing unwanted actions on the Freight Management Platform.

## Implementation

**Technology**: Double-submit cookie pattern
**File**: `lib/csrf.ts`
**Pattern**: Token in both httpOnly cookie AND custom header

---

## How It Works

### Double-Submit Cookie Pattern

1. **Token Generation**:
   - Server generates cryptographically secure random token (256 bits)
   - Token stored in httpOnly cookie (cannot be read by JavaScript)
   - Same token returned in response body

2. **Client Storage**:
   - Browser automatically stores httpOnly cookie
   - Client application stores token in memory/state
   - Client includes token in `X-CSRF-Token` header for mutations

3. **Server Validation**:
   - Server reads token from cookie
   - Server reads token from `X-CSRF-Token` header
   - Server validates both tokens match using timing-safe comparison
   - Request allowed only if tokens match

### Why This Prevents CSRF

**Attacker Limitations**:
- ❌ Cannot read httpOnly cookies (XSS protection)
- ❌ Cannot set custom headers cross-domain (CORS protection)
- ❌ Cannot read token from response (Same-Origin Policy)

**Defense in Depth**:
- ✅ httpOnly cookie prevents JavaScript access
- ✅ SameSite cookie attribute blocks cross-site requests
- ✅ Custom header requirement enforces CORS
- ✅ Timing-safe comparison prevents timing attacks

---

## Protected Endpoints

### Document Upload

**Endpoint**: `POST /api/documents/upload`

**Protection**: CSRF token required in header

**Error Response** (403):
```json
{
  "error": "CSRF token validation failed",
  "code": "CSRF_TOKEN_INVALID"
}
```

---

### Truck Posting

**Endpoint**: `POST /api/truck-postings`

**Protection**: CSRF token required in header

**Error Response** (403):
```json
{
  "error": "CSRF token validation failed",
  "code": "CSRF_TOKEN_INVALID"
}
```

---

### Truck Posting Update

**Endpoint**: `PATCH /api/truck-postings/[id]`

**Protection**: CSRF token required in header

**Error Response** (403):
```json
{
  "error": "CSRF token validation failed",
  "code": "CSRF_TOKEN_INVALID"
}
```

---

### Truck Posting Deletion

**Endpoint**: `DELETE /api/truck-postings/[id]`

**Protection**: CSRF token required in header (soft delete)

**Error Response** (403):
```json
{
  "error": "CSRF token validation failed",
  "code": "CSRF_TOKEN_INVALID"
}
```

---

### Document Verification

**Endpoint**: `PATCH /api/documents/[id]`

**Protection**: CSRF token required in header (admin only)

**Error Response** (403):
```json
{
  "error": "CSRF token validation failed",
  "code": "CSRF_TOKEN_INVALID"
}
```

---

### Document Deletion

**Endpoint**: `DELETE /api/documents/[id]`

**Protection**: CSRF token required in header

**Error Response** (403):
```json
{
  "error": "CSRF token validation failed",
  "code": "CSRF_TOKEN_INVALID"
}
```

---

## Client Implementation

### Step 1: Fetch CSRF Token

**On application load or login:**

```javascript
async function fetchCSRFToken() {
  const response = await fetch('/api/csrf-token', {
    method: 'GET',
    credentials: 'include', // Include cookies
  });

  const data = await response.json();
  const csrfToken = data.csrfToken;

  // Store token in application state
  // (React context, Zustand store, Redux, etc.)
  return csrfToken;
}
```

---

### Step 2: Include Token in Requests

**For all state-changing requests (POST, PATCH, DELETE):**

```javascript
async function uploadDocument(file, csrfToken) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', 'OPERATING_LICENSE');
  formData.append('entityType', 'company');
  formData.append('entityId', 'org-123');

  const response = await fetch('/api/documents/upload', {
    method: 'POST',
    headers: {
      'X-CSRF-Token': csrfToken, // Include CSRF token
    },
    body: formData,
    credentials: 'include', // Include cookies
  });

  if (response.status === 403) {
    const data = await response.json();
    if (data.code === 'CSRF_TOKEN_INVALID') {
      // Token expired or invalid, fetch new token
      const newToken = await fetchCSRFToken();
      // Retry request with new token
      return uploadDocument(file, newToken);
    }
  }

  return response;
}
```

---

### Step 3: Handle Token Expiration

**CSRF tokens expire after 24 hours:**

```javascript
// React example with context
const CSRFContext = React.createContext(null);

function CSRFProvider({ children }) {
  const [csrfToken, setCSRFToken] = useState(null);

  useEffect(() => {
    // Fetch token on mount
    fetchCSRFToken().then(setCSRFToken);

    // Refresh token every 12 hours (half of expiration)
    const interval = setInterval(() => {
      fetchCSRFToken().then(setCSRFToken);
    }, 12 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <CSRFContext.Provider value={csrfToken}>
      {children}
    </CSRFContext.Provider>
  );
}

function useCSRFToken() {
  return useContext(CSRFContext);
}

// Usage in component
function UploadButton() {
  const csrfToken = useCSRFToken();

  const handleUpload = async (file) => {
    await uploadDocument(file, csrfToken);
  };

  return <button onClick={() => handleUpload(selectedFile)}>Upload</button>;
}
```

---

## API Reference

### GET /api/csrf-token

**Description**: Get or generate CSRF token

**Authentication**: Required

**Response** (200):
```json
{
  "csrfToken": "a1b2c3d4e5f6..."
}
```

**Headers**:
```
Set-Cookie: csrf_token=a1b2c3d4e5f6...; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400
```

**Usage**:
```javascript
const response = await fetch('/api/csrf-token', {
  credentials: 'include'
});
const { csrfToken } = await response.json();
```

---

## Security Details

### Token Generation

**Algorithm**: Cryptographically secure random bytes
**Length**: 32 bytes (256 bits)
**Encoding**: Hexadecimal string

```typescript
import crypto from 'crypto';

function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
```

---

### Cookie Configuration

**Name**: `csrf_token`

**Attributes**:
- `httpOnly: true` - Prevents JavaScript access
- `secure: true` (production only) - HTTPS only
- `sameSite: 'lax'` - Prevents cross-site requests
- `path: '/'` - Available for all routes
- `maxAge: 86400` - 24 hours expiration

**Example**:
```
Set-Cookie: csrf_token=a1b2c3d4...;
  HttpOnly;
  Secure;
  SameSite=Lax;
  Path=/;
  Max-Age=86400
```

---

### Token Validation

**Timing-Safe Comparison**:
```typescript
import crypto from 'crypto';

function validateCSRFToken(request: NextRequest): boolean {
  const cookieToken = getCSRFTokenFromCookie(request);
  const headerToken = getCSRFTokenFromHeader(request);

  if (!cookieToken || !headerToken) return false;

  try {
    // Timing-safe comparison prevents timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(cookieToken),
      Buffer.from(headerToken)
    );
  } catch (error) {
    // Tokens have different lengths
    return false;
  }
}
```

**Why Timing-Safe?**
- Regular comparison (`===`) may leak information via timing
- Timing-safe comparison takes constant time regardless of where mismatch occurs
- Prevents attackers from brute-forcing tokens character by character

---

## Safe Methods (No CSRF Check)

The following HTTP methods are exempt from CSRF protection:

- ✅ `GET` - Read-only, no state change
- ✅ `HEAD` - Metadata only
- ✅ `OPTIONS` - CORS preflight

**Rationale**: CSRF attacks only work for state-changing operations. Read-only operations are safe.

---

## Testing

### Manual Testing with curl

**1. Get CSRF token:**
```bash
curl -X GET http://localhost:3000/api/csrf-token \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -c cookies.txt \
  -v

# Response:
# {"csrfToken":"a1b2c3d4e5f6..."}
# Set-Cookie: csrf_token=a1b2c3d4e5f6...; HttpOnly; SameSite=Lax
```

**2. Make request WITH token (should succeed):**
```bash
curl -X POST http://localhost:3000/api/truck-postings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-CSRF-Token: a1b2c3d4e5f6..." \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "truckId": "truck-123",
    "originCityId": "city-123",
    "availableFrom": "2025-12-26T00:00:00.000Z",
    "contactName": "John Doe",
    "contactPhone": "+251912345678"
  }'

# Response: 201 Created
```

**3. Make request WITHOUT token (should fail):**
```bash
curl -X POST http://localhost:3000/api/truck-postings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "truckId": "truck-123",
    "originCityId": "city-123",
    "availableFrom": "2025-12-26T00:00:00.000Z",
    "contactName": "John Doe",
    "contactPhone": "+251912345678"
  }'

# Response: 403 Forbidden
# {"error":"CSRF token validation failed","code":"CSRF_TOKEN_INVALID"}
```

**4. Make request with WRONG token (should fail):**
```bash
curl -X POST http://localhost:3000/api/truck-postings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-CSRF-Token: wrong-token-12345" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '...'

# Response: 403 Forbidden
# {"error":"CSRF token validation failed","code":"CSRF_TOKEN_INVALID"}
```

---

## Attack Scenarios Prevented

### ✅ Classic CSRF Attack

**Attack**:
```html
<!-- Malicious site tricks user into submitting form -->
<form action="https://freight-platform.com/api/documents/upload" method="POST">
  <input type="hidden" name="file" value="malicious.pdf">
  <input type="hidden" name="type" value="OPERATING_LICENSE">
</form>
<script>document.forms[0].submit();</script>
```

**Protection**:
- Attacker cannot read CSRF token (httpOnly cookie)
- Attacker cannot set `X-CSRF-Token` header cross-domain
- Request blocked by server (403)

---

### ✅ XSS-Based CSRF

**Attack**:
```html
<!-- Attacker injects script via XSS vulnerability -->
<script>
  // Try to read CSRF token
  const token = document.cookie.match(/csrf_token=([^;]+)/);
  console.log(token); // null - httpOnly cookie!
</script>
```

**Protection**:
- httpOnly cookie cannot be read by JavaScript
- XSS cannot steal CSRF token
- Even if XSS exists, CSRF attacks still blocked

---

### ✅ Subdomain Attack

**Attack**:
```javascript
// Attacker controls subdomain: attacker.freight-platform.com
// Tries to make request to main domain
fetch('https://freight-platform.com/api/truck-postings', {
  method: 'POST',
  credentials: 'include', // Includes cookies
  headers: {
    'X-CSRF-Token': 'stolen-token' // Cannot obtain valid token
  },
  body: JSON.stringify({...})
});
```

**Protection**:
- SameSite cookie attribute blocks cross-site cookies
- CORS prevents setting custom headers cross-origin
- Request blocked

---

## Common Issues and Solutions

### Issue: "CSRF token validation failed" on valid requests

**Possible Causes**:
1. Token expired (24 hours)
2. Client not including `X-CSRF-Token` header
3. Client not including cookies (`credentials: 'include'`)
4. Token mismatch (different token in cookie vs header)

**Solution**:
```javascript
// Ensure both are included
fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrfToken, // ← Include token
  },
  credentials: 'include', // ← Include cookies
  body: JSON.stringify(data)
});
```

---

### Issue: Token not set in cookie

**Possible Causes**:
1. Not calling `/api/csrf-token` endpoint
2. Browser blocking cookies (privacy settings)
3. HTTPS/Secure mismatch (development vs production)

**Solution**:
```javascript
// Explicitly fetch token on login
async function handleLogin(credentials) {
  const loginResponse = await login(credentials);

  if (loginResponse.ok) {
    // Immediately fetch CSRF token after login
    const tokenResponse = await fetch('/api/csrf-token', {
      credentials: 'include'
    });
    const { csrfToken } = await tokenResponse.json();

    // Store token in app state
    setCSRFToken(csrfToken);
  }
}
```

---

## Compliance

**Standards Met**:
- ✅ OWASP Top 10 (A01:2021 - Broken Access Control)
- ✅ OWASP CSRF Prevention Cheat Sheet
- ✅ Double-Submit Cookie Pattern (industry standard)
- ✅ Timing-safe comparison (prevents timing attacks)

---

## Production Considerations

### HTTPS Requirement

**Development**: `secure: false` (allow HTTP)
**Production**: `secure: true` (require HTTPS)

```typescript
setCSRFCookie(response, token, {
  secure: process.env.NODE_ENV === 'production',
});
```

---

### Token Refresh Strategy

**Current**: 24-hour expiration, manual refresh

**Recommended**:
- Refresh token every 12 hours (automatic)
- Refresh on login/logout events
- Refresh before making critical operations

```javascript
// Check token age before critical operation
async function performCriticalOperation(csrfToken, tokenTimestamp) {
  const tokenAge = Date.now() - tokenTimestamp;
  const TWELVE_HOURS = 12 * 60 * 60 * 1000;

  if (tokenAge > TWELVE_HOURS) {
    // Refresh token before operation
    const newToken = await fetchCSRFToken();
    return performOperation(newToken);
  }

  return performOperation(csrfToken);
}
```

---

### CDN and Load Balancer

**Issue**: CSRF cookies may not work correctly behind CDN/load balancer

**Solution**:
- Ensure `Set-Cookie` headers are not cached by CDN
- Configure load balancer to preserve cookies
- Use session affinity (sticky sessions) if needed

**CDN Configuration** (example for Cloudflare):
```
Cache-Control: private, no-cache, no-store, must-revalidate
```

---

## Summary

| Endpoint | Method | CSRF Protected | Error Code |
|----------|--------|----------------|------------|
| Document Upload | POST | ✅ | CSRF_TOKEN_INVALID |
| Truck Posting | POST | ✅ | CSRF_TOKEN_INVALID |
| Truck Update | PATCH | ✅ | CSRF_TOKEN_INVALID |
| Truck Delete | DELETE | ✅ | CSRF_TOKEN_INVALID |
| Document Verify | PATCH | ✅ | CSRF_TOKEN_INVALID |
| Document Delete | DELETE | ✅ | CSRF_TOKEN_INVALID |
| CSRF Token Fetch | GET | ❌ (safe method) | N/A |

---

**Last Updated:** 2025-12-25
**Maintained By:** Development Team
**Review Frequency:** Quarterly or after security incidents
