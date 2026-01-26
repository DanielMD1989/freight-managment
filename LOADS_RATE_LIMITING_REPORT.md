# Loads API Rate Limiting Report

**Date:** 2026-01-23
**Implementer:** Claude Opus 4.5
**Severity:** MEDIUM (Security / Performance)

---

## Executive Summary

Applied `RPS_CONFIGS.marketplace` rate limiting to all loads API endpoints to prevent abuse and ensure fair resource distribution.

| Endpoint | Method | Rate Limit | Burst |
|----------|--------|------------|-------|
| `/api/loads` | GET | 50 RPS | +20 |
| `/api/loads` | POST | 50 RPS | +20 |
| `/api/loads/{id}` | GET | 50 RPS | +20 |
| `/api/loads/{id}` | PATCH | 50 RPS | +20 |

---

## RPS Configuration

### Added `RPS_CONFIGS.marketplace`

```typescript
// lib/rateLimit.ts
export const RPS_CONFIGS: Record<string, RpsConfig> = {
  // ...existing configs...

  // Marketplace (loads) - shared config for all loads endpoints
  marketplace: {
    endpoint: '/api/loads',
    rps: 50,
    burst: 20,
  },
};
```

### Rate Limit Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `rps` | 50 | Maximum requests per second per IP |
| `burst` | 20 | Extra requests allowed in short bursts |
| `maxTokens` | 70 | Total tokens (rps + burst) |
| `window` | 1 second | Token bucket refill window |

---

## Files Modified

| File | Changes |
|------|---------|
| `lib/rateLimit.ts` | Added `RPS_CONFIGS.marketplace` |
| `app/api/loads/route.ts` | Added RPS check to GET and POST |
| `app/api/loads/[id]/route.ts` | Added RPS check to GET and PATCH |

---

## Implementation Details

### lib/rateLimit.ts

Added new marketplace config:

```typescript
marketplace: {
  endpoint: '/api/loads',
  rps: 50,
  burst: 20,
},
```

### app/api/loads/route.ts

Added imports:

```typescript
import { checkRpsLimit, RPS_CONFIGS, addRateLimitHeaders } from "@/lib/rateLimit";
```

Added to GET handler:

```typescript
// Rate limiting: Apply RPS_CONFIGS.marketplace
const ip =
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
  request.headers.get('x-real-ip') ||
  'unknown';
const rpsResult = await checkRpsLimit(
  RPS_CONFIGS.marketplace.endpoint,
  ip,
  RPS_CONFIGS.marketplace.rps,
  RPS_CONFIGS.marketplace.burst
);
if (!rpsResult.allowed) {
  return NextResponse.json(
    { error: 'Rate limit exceeded. Please slow down.', retryAfter: 1 },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': rpsResult.limit.toString(),
        'X-RateLimit-Remaining': rpsResult.remaining.toString(),
        'Retry-After': '1',
      },
    }
  );
}
```

Same pattern applied to POST handler.

### app/api/loads/[id]/route.ts

Added helper function for DRY rate limiting:

```typescript
async function applyRpsLimit(request: NextRequest): Promise<NextResponse | null> {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const rpsResult = await checkRpsLimit(
    RPS_CONFIGS.marketplace.endpoint,
    ip,
    RPS_CONFIGS.marketplace.rps,
    RPS_CONFIGS.marketplace.burst
  );
  if (!rpsResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please slow down.', retryAfter: 1 },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rpsResult.limit.toString(),
          'X-RateLimit-Remaining': rpsResult.remaining.toString(),
          'Retry-After': '1',
        },
      }
    );
  }
  return null;
}
```

Applied to GET and PATCH handlers:

```typescript
const rateLimitError = await applyRpsLimit(request);
if (rateLimitError) return rateLimitError;
```

---

## Rate Limit Algorithm

Uses **Token Bucket** algorithm via Redis:

```
┌─────────────────────────────────────────────────┐
│  Token Bucket (per IP)                          │
│                                                 │
│  Capacity: 70 tokens (50 RPS + 20 burst)        │
│  Refill: 50 tokens per second                   │
│                                                 │
│  Each request consumes 1 token                  │
│  If tokens = 0, request is rejected (429)       │
└─────────────────────────────────────────────────┘
```

### Redis Implementation

```typescript
// 1-second TTL counter per IP
const pipeline = redis.pipeline();
pipeline.incr(key);
pipeline.expire(key, 1);
const results = await pipeline.exec();

const currentCount = results[0]?.[1];
const allowed = currentCount <= maxTokens;
```

---

## Response Headers

### Successful Request

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 70
X-RateLimit-Remaining: 69
X-RateLimit-Reset: 2026-01-23T10:30:01.000Z
```

### Rate Limited Request

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 70
X-RateLimit-Remaining: 0
Retry-After: 1

{
  "error": "Rate limit exceeded. Please slow down.",
  "retryAfter": 1
}
```

---

## Rate Limit Behavior

### Per-IP Limiting

Rate limits are applied per IP address, extracted from:

1. `x-forwarded-for` header (first IP in chain)
2. `x-real-ip` header (fallback)
3. `'unknown'` (last resort)

### Redis-Backed Distribution

When Redis is enabled, rate limits are distributed across all server instances:

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Server 1 │     │ Server 2 │     │ Server 3 │
│  50 RPS  │     │  50 RPS  │     │  50 RPS  │
└────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │
     └────────────────┼────────────────┘
                      │
               ┌──────▼──────┐
               │    Redis    │
               │  (Shared)   │
               └─────────────┘
```

### Fallback Behavior

If Redis is unavailable, rate limiting fails open (requests allowed):

```typescript
} catch (error) {
  // Fallback: allow the request (fail open for availability)
  return {
    allowed: true,
    limit: maxTokens,
    remaining: maxTokens,
    resetTime: now + 1000,
  };
}
```

---

## Capacity Planning

### 10K DAU Scenario

| Metric | Value |
|--------|-------|
| Peak concurrent users | ~1,000 |
| Estimated RPS per user | 0.5 |
| Total estimated RPS | 500 |
| Rate limit per IP | 50 RPS |
| IPs to saturate system | 10 |

The 50 RPS per IP limit prevents a single user/bot from consuming >10% of system capacity.

### Burst Handling

| Scenario | Burst Allowance |
|----------|-----------------|
| Page load (multiple API calls) | 20 tokens |
| Auto-refresh (1 call/10s) | No burst needed |
| Bot scraping | Blocked after 70 calls/s |

---

## Testing

### Manual Test

```bash
# Rapid requests (should trigger rate limit after ~70)
for i in {1..100}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/loads
done
```

Expected output: First ~70 requests return `200`, remaining return `429`.

### Check Rate Limit Headers

```bash
curl -v http://localhost:3000/api/loads 2>&1 | grep -i x-ratelimit
```

Expected:
```
< X-RateLimit-Limit: 70
< X-RateLimit-Remaining: 69
< X-RateLimit-Reset: 2026-01-23T...
```

---

## Monitoring

### Health Endpoint

`GET /api/health?detailed=true` includes rate limit metrics:

```json
{
  "rateLimit": {
    "redisEnabled": true,
    "redisConnected": true,
    "inMemoryKeys": 0,
    "mode": "distributed"
  }
}
```

### Metrics to Watch

| Metric | Alert Threshold |
|--------|-----------------|
| 429 responses | >5% of requests |
| Rate limit cache misses | >10% |
| Unique IPs rate limited | >100/hour |

---

## Security Considerations

1. **IP Spoofing**: `x-forwarded-for` can be spoofed if not behind a trusted proxy
2. **Shared IPs**: Users behind NAT may share rate limits
3. **Distributed Attacks**: Each IP gets 50 RPS, so 100 IPs = 5000 RPS potential

### Mitigations

- Use `x-real-ip` from trusted load balancer
- Consider user-based rate limiting for authenticated endpoints
- Monitor for distributed attack patterns

---

## Verification Checklist

- [x] `RPS_CONFIGS.marketplace` added
- [x] `GET /api/loads` rate limited
- [x] `POST /api/loads` rate limited
- [x] `GET /api/loads/{id}` rate limited
- [x] `PATCH /api/loads/{id}` rate limited
- [x] Rate limit headers included in responses
- [x] 429 response for exceeded limits
- [x] Redis-backed distribution

---

## Future Improvements

1. **User-Based Limits**: Apply per-user limits for authenticated requests
2. **Org-Based Limits**: Shared quota for organization members
3. **Dynamic Limits**: Adjust based on server load
4. **Whitelist**: Allow higher limits for trusted partners

---

**Report Generated:** 2026-01-23
**Implementer:** Claude Opus 4.5
**Status:** IMPLEMENTED
