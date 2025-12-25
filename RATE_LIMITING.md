# Rate Limiting Documentation

**Sprint 9 - Story 9.5: Rate Limiting**
**Date:** 2025-12-25
**Status:** Implemented

---

## Overview

Rate limiting protects the Freight Management Platform from API abuse, DoS attacks, and excessive resource usage by restricting the number of requests a user or organization can make within a specified time window.

## Implementation

**Technology**: In-memory sliding window rate limiting (MVP)
**File**: `lib/rateLimit.ts`
**Algorithm**: Sliding window with automatic cleanup

**Production Recommendation**: Replace in-memory store with Redis for:
- Distributed rate limiting across multiple servers
- Persistent storage
- Automatic TTL/expiration
- Better performance at scale

---

## Rate Limit Rules

### 1. Document Upload

**Endpoint**: `POST /api/documents/upload`

**Limit**: 10 uploads per hour per user

**Scope**: Per user (userId)

**Rationale**: Prevents spam uploads and excessive storage usage

**Headers**:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 2025-12-25T15:30:00.000Z
```

**Error Response** (429):
```json
{
  "error": "Document upload limit exceeded. Maximum 10 uploads per hour.",
  "retryAfter": 1800
}
```

---

### 2. Truck Posting

**Endpoint**: `POST /api/truck-postings`

**Limit**: 100 postings per day per carrier

**Scope**: Per organization (organizationId)

**Rationale**: Prevents posting spam while allowing legitimate high-volume carriers

**Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 73
X-RateLimit-Reset: 2025-12-26T00:00:00.000Z
```

**Error Response** (429):
```json
{
  "error": "Truck posting limit exceeded. Maximum 100 postings per day per carrier.",
  "retryAfter": 43200
}
```

---

### 3. File Download

**Endpoint**: `GET /api/uploads/[...path]`

**Limit**: 100 downloads per hour per user

**Scope**: Per user (userId)

**Rationale**: Prevents bandwidth abuse and excessive file access

**Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 2025-12-25T15:30:00.000Z
```

**Error Response** (429):
```json
{
  "error": "File download limit exceeded. Maximum 100 downloads per hour.",
  "retryAfter": 1200
}
```

---

## Additional Rate Limits (Defined, Not Yet Applied)

### 4. Load Posting

**Endpoint**: `POST /api/loads`

**Limit**: 100 postings per day per shipper

**Scope**: Per organization

**Status**: ⚠️ Pending load posting implementation

---

### 5. General API

**Limit**: 1000 requests per hour per user

**Scope**: Per user

**Status**: ⚠️ Not yet implemented (future enhancement)

---

### 6. Authentication Attempts

**Endpoint**: `POST /api/auth/login`

**Limit**: 5 attempts per 15 minutes per IP

**Scope**: Per IP address

**Rationale**: Prevents brute force attacks

**Status**: ⚠️ Not yet implemented (future enhancement)

---

### 7. Password Reset

**Endpoint**: `POST /api/auth/reset-password`

**Limit**: 3 attempts per hour per email

**Scope**: Per email

**Rationale**: Prevents password reset abuse

**Status**: ⚠️ Not yet implemented (future enhancement)

---

## HTTP Headers

### Response Headers (All Requests)

```
X-RateLimit-Limit: <limit>
X-RateLimit-Remaining: <remaining>
X-RateLimit-Reset: <ISO 8601 timestamp>
```

### Response Headers (When Rate Limited)

```
X-RateLimit-Limit: <limit>
X-RateLimit-Remaining: 0
X-RateLimit-Reset: <ISO 8601 timestamp>
Retry-After: <seconds>
```

**Example**:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2025-12-25T15:30:00.000Z
Retry-After: 1800
```

---

## HTTP Status Codes

### 200 OK
Request successful, within rate limit

### 429 Too Many Requests
Rate limit exceeded

**Response Body**:
```json
{
  "error": "<descriptive error message>",
  "retryAfter": <seconds until reset>
}
```

---

## Sliding Window Algorithm

The implementation uses a **sliding window** approach:

1. Each request timestamp is stored
2. On new request, old timestamps outside the window are removed
3. Current count is checked against limit
4. If allowed, new timestamp is added

**Benefits**:
- More accurate than fixed windows
- Prevents burst attacks at window boundaries
- Fair distribution of requests

**Example** (10 requests per hour):
```
Time: 14:00 - User makes 5 requests
Time: 14:30 - User makes 5 requests (total: 10, at limit)
Time: 14:35 - User tries request → DENIED (still 10 in last hour)
Time: 15:01 - User tries request → ALLOWED (5 from 14:00 expired)
```

---

## Configuration

Rate limits are defined in `lib/rateLimit.ts`:

```typescript
export const RATE_LIMIT_DOCUMENT_UPLOAD: RateLimitConfig = {
  name: 'document_upload',
  limit: 10,
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'Document upload limit exceeded. Maximum 10 uploads per hour.',
};
```

### Adjusting Limits

To modify a rate limit:

1. Open `lib/rateLimit.ts`
2. Update the relevant configuration
3. Redeploy application

**Example** - Increase document uploads to 20/hour:
```typescript
export const RATE_LIMIT_DOCUMENT_UPLOAD: RateLimitConfig = {
  name: 'document_upload',
  limit: 20, // Changed from 10
  windowMs: 60 * 60 * 1000,
  message: 'Document upload limit exceeded. Maximum 20 uploads per hour.',
};
```

---

## Memory Management

**Automatic Cleanup**: Old entries are removed every 5 minutes

**Cleanup Rule**: Entries older than 24 hours are deleted

**Purpose**: Prevent memory leaks in long-running processes

```typescript
// Runs every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now - record.resetTime > 24 * 60 * 60 * 1000) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);
```

---

## Admin Functions

### Clear Rate Limit

Manually reset rate limit for a user:

```typescript
import { clearRateLimit } from '@/lib/rateLimit';

// Clear document upload limit for user
clearRateLimit('document_upload', 'user-123');
```

### Check Rate Limit Status

View current rate limit status:

```typescript
import { getRateLimitStatus } from '@/lib/rateLimit';

const status = getRateLimitStatus('document_upload', 'user-123');
console.log(status);
// { requests: 7, limit: 10, resetTime: 1703512800000 }
```

---

## Client-Side Handling

### Recommended Client Behavior

1. **Check Headers**: Read `X-RateLimit-Remaining` before making requests
2. **Handle 429**: Show user-friendly message with retry time
3. **Auto-Retry**: Use `Retry-After` header value
4. **Progress Indication**: Show remaining quota to users

### Example JavaScript

```javascript
async function uploadDocument(file) {
  try {
    const response = await fetch('/api/documents/upload', {
      method: 'POST',
      body: formData,
    });

    // Check rate limit headers
    const limit = response.headers.get('X-RateLimit-Limit');
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');

    if (response.status === 429) {
      const data = await response.json();
      const retryAfter = data.retryAfter;

      // Show user-friendly message
      showError(`Upload limit exceeded. Try again in ${Math.ceil(retryAfter / 60)} minutes.`);

      // Optional: Auto-retry after delay
      setTimeout(() => uploadDocument(file), retryAfter * 1000);

      return;
    }

    // Show remaining quota
    showQuota(`${remaining} uploads remaining this hour`);
  } catch (error) {
    console.error(error);
  }
}
```

---

## Testing

### Manual Testing

Test rate limits with curl:

```bash
# Upload 11 documents in quick succession
for i in {1..11}; do
  curl -X POST http://localhost:3000/api/documents/upload \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@test.pdf" \
    -F "type=OPERATING_LICENSE" \
    -F "entityType=company" \
    -F "entityId=org-123"

  echo "Request $i completed"
done

# 11th request should return 429
```

### Expected Behavior

- Requests 1-10: HTTP 200/201, headers show decreasing remaining count
- Request 11: HTTP 429, `Retry-After` header present
- After waiting (or clearing limit): Requests allowed again

---

## Monitoring

### Key Metrics to Track

1. **Rate Limit Hits**: How often users hit limits
2. **Blocked Requests**: Total 429 responses
3. **Top Rate Limited Users**: Identify abuse patterns
4. **Average Remaining**: How close users get to limits

### Logging

Current implementation logs to console:

```typescript
console.log(`[FILE ACCESS] User ${userId} accessed file: ${path}`);
```

**Production Recommendation**: Send to monitoring service (Datadog, New Relic, etc.)

---

## Security Considerations

### Protection Against

✅ **DoS Attacks**: Prevents overwhelming the server
✅ **Brute Force**: Limits login/password reset attempts (when implemented)
✅ **Resource Exhaustion**: Prevents excessive uploads/downloads
✅ **Spam**: Limits posting frequency

### Does NOT Protect Against

❌ **DDoS (Distributed)**: Single-IP rate limiting won't help
❌ **Layer 7 Attacks**: Needs WAF/CDN protection
❌ **Sophisticated Bots**: May rotate IPs/users

### Recommendations

1. Use CDN with DDoS protection (Cloudflare, AWS Shield)
2. Implement CAPTCHA for authentication endpoints
3. Monitor for distributed abuse patterns
4. Consider IP-based rate limiting at CDN level

---

## Production Migration

### Moving to Redis

When scaling to production, replace in-memory store:

```typescript
// Current (in-memory)
const rateLimitStore = new Map<string, RateLimitRecord>();

// Production (Redis)
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

// Store rate limit data
await redis.setex(`ratelimit:${key}`, ttl, JSON.stringify(record));

// Retrieve rate limit data
const data = await redis.get(`ratelimit:${key}`);
```

**Benefits**:
- Distributed across servers
- Automatic expiration
- Better performance
- Persistent storage

---

## Compliance

**Standards Met**:
- ✅ OWASP API Security Top 10 (API4:2023 Unrestricted Resource Consumption)
- ✅ RFC 6585 (429 Too Many Requests)
- ✅ RFC 7231 (Retry-After header)

---

## Summary

| Endpoint | Limit | Window | Scope | Status |
|----------|-------|--------|-------|--------|
| Document Upload | 10 | 1 hour | User | ✅ Implemented |
| Truck Posting | 100 | 24 hours | Organization | ✅ Implemented |
| File Download | 100 | 1 hour | User | ✅ Implemented |
| Load Posting | 100 | 24 hours | Organization | ⚠️ Pending |
| General API | 1000 | 1 hour | User | ⚠️ Future |
| Auth Attempts | 5 | 15 min | IP | ⚠️ Future |
| Password Reset | 3 | 1 hour | Email | ⚠️ Future |

---

**Last Updated:** 2025-12-25
**Maintained By:** Development Team
**Review Frequency:** Monthly or after security incidents
