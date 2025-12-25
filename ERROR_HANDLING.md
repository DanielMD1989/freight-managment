# Error Handling Documentation

**Sprint 9 - Story 9.7: Error Handling & Information Disclosure Prevention**
**Date:** 2025-12-25
**Status:** Implemented

---

## Overview

Proper error handling prevents information disclosure while maintaining detailed server-side logging for debugging. The Freight Management Platform implements secure error handling that protects sensitive implementation details from being exposed to clients.

## Security Principles

### ❌ Never Expose to Clients:
- Database errors or SQL queries
- File paths or directory structures
- Stack traces
- Internal implementation details
- Environment variables
- Connection strings
- Server architecture details

### ✅ Always Include:
- Generic user-friendly error messages
- Error codes for client handling
- Request IDs for debugging correlation
- HTTP status codes

### ✅ Always Log Server-Side:
- Full error details including stack traces
- Request context (method, URL, headers)
- User context (userId, organizationId, role)
- Timestamp and request ID
- Original error information

---

## Error Response Format

### Client Response Structure

All error responses follow this structure:

```json
{
  "error": "User-friendly error message",
  "code": "ERROR_CODE",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-12-25T12:00:00.000Z"
}
```

### HTTP Headers

All responses include:
```
X-Request-Id: 550e8400-e29b-41d4-a716-446655440000
```

---

## Error Codes

### Authentication & Authorization (401, 403)

| Code | Status | Description | User Message |
|------|--------|-------------|--------------|
| `UNAUTHORIZED` | 401 | User not authenticated | "Authentication required" |
| `INVALID_CREDENTIALS` | 401 | Wrong username/password | "Invalid credentials" |
| `SESSION_EXPIRED` | 401 | JWT token expired | "Session expired. Please log in again" |
| `FORBIDDEN` | 403 | User lacks permissions | "You do not have permission to perform this action" |
| `INSUFFICIENT_PERMISSIONS` | 403 | Specific permission missing | "Insufficient permissions" |
| `CSRF_TOKEN_INVALID` | 403 | CSRF validation failed | "CSRF token validation failed" |

---

### Validation Errors (400)

| Code | Status | Description | User Message |
|------|--------|-------------|--------------|
| `VALIDATION_ERROR` | 400 | Generic validation failure | "Invalid data provided" |
| `INVALID_INPUT` | 400 | Input format invalid | "Invalid input format" |
| `MISSING_REQUIRED_FIELD` | 400 | Required field missing | "Required field missing" |
| `INVALID_FILE_TYPE` | 400 | File type not allowed | "File type not allowed. Only PDF, JPG, PNG accepted" |
| `FILE_TOO_LARGE` | 400 | File exceeds size limit | "File size exceeds maximum of 10MB" |
| `INVALID_FORMAT` | 400 | Data format incorrect | "Invalid format" |

---

### Resource Errors (404, 409)

| Code | Status | Description | User Message |
|------|--------|-------------|--------------|
| `NOT_FOUND` | 404 | Resource doesn't exist | "Resource not found" |
| `ALREADY_EXISTS` | 409 | Duplicate resource | "A record with this information already exists" |
| `CONFLICT` | 409 | Resource state conflict | "Resource conflict" |

---

### Rate Limiting (429)

| Code | Status | Description | User Message |
|------|--------|-------------|--------------|
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | "Rate limit exceeded. Please try again later" |

---

### Server Errors (500)

| Code | Status | Description | User Message |
|------|--------|-------------|--------------|
| `INTERNAL_SERVER_ERROR` | 500 | Generic server error | "An unexpected error occurred" |
| `DATABASE_ERROR` | 500 | Database operation failed | "A database error occurred" |
| `EXTERNAL_SERVICE_ERROR` | 500 | External API failed | "External service unavailable" |
| `FILE_SYSTEM_ERROR` | 500 | File operation failed | "File system error" |

---

## Implementation

### Using Error Handler in API Routes

```typescript
import { handleError, getRequestId } from '@/lib/errorHandler';

export async function POST(request: NextRequest) {
  try {
    const requestId = getRequestId(request);
    const session = await requireAuth();

    // Your endpoint logic...

    return NextResponse.json({ success: true }, {
      headers: { 'X-Request-Id': requestId }
    });
  } catch (error: any) {
    return handleError(error, request, session?.userId, session?.organizationId, session?.role);
  }
}
```

---

### Creating Custom Errors

```typescript
import {
  createValidationError,
  createNotFoundError,
  createUnauthorizedError,
  createForbiddenError,
} from '@/lib/errorHandler';

// Validation error
if (!data.email) {
  throw createValidationError('Email is required');
}

// Not found
const user = await db.user.findUnique({ where: { id } });
if (!user) {
  throw createNotFoundError('User');
}

// Unauthorized
if (!token) {
  throw createUnauthorizedError('Authentication required');
}

// Forbidden
if (resource.ownerId !== session.userId) {
  throw createForbiddenError('You do not have permission to access this resource');
}
```

---

### Using Error Wrapper

Automatically wrap route handlers for consistent error handling:

```typescript
import { withErrorHandling } from '@/lib/errorHandler';

async function handler(request: NextRequest) {
  // Your logic - errors automatically caught and handled
  const session = await requireAuth();
  // ...
  return NextResponse.json({ success: true });
}

export const POST = withErrorHandling(handler);
```

---

## Database Error Handling

### Prisma Error Mapping

The error handler automatically converts Prisma errors to safe responses:

| Prisma Code | Error Code | User Message |
|-------------|------------|--------------|
| `P2002` | `ALREADY_EXISTS` | "A record with this information already exists" |
| `P2025` | `NOT_FOUND` | "The requested resource was not found" |
| `P2003` | `VALIDATION_ERROR` | "Invalid reference to related resource" |
| `P2014` | `VALIDATION_ERROR` | "Related resource is required" |
| Other | `DATABASE_ERROR` | "A database error occurred" |

### Example

**Bad** - Exposes database details:
```typescript
} catch (error) {
  console.error(error);
  return NextResponse.json(
    { error: error.message }, // ❌ Exposes "Unique constraint failed on the fields: (`email`)"
    { status: 500 }
  );
}
```

**Good** - Safe error handling:
```typescript
} catch (error) {
  return handleError(error, request, userId, organizationId, role);
  // Returns: { error: "A record with this information already exists", code: "ALREADY_EXISTS" }
}
```

---

## Message Sanitization

The error handler automatically sanitizes messages to remove:

### File Paths
```
Before: "Cannot find module '/Users/john/app/lib/file.ts'"
After:  "Cannot find module '[file]'"
```

### Database Details
```
Before: "Unique constraint failed on table 'users' column 'email'"
After:  "Unique constraint failed on table [redacted] column [redacted]"
```

### SQL Queries
```
Before: "SELECT * FROM users WHERE email = 'test@example.com'"
After:  "[query]"
```

### Connection Strings
```
Before: "postgresql://user:pass@localhost:5432/db"
After:  "[database_url]"
```

### Environment Variables
```
Before: "process.env.JWT_SECRET"
After:  "[env_var]"
```

---

## Server-Side Logging

### Log Format

Detailed errors are logged server-side with full context:

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-12-25T12:00:00.000Z",
  "error": {
    "message": "Unique constraint failed on the fields: (`email`)",
    "code": "ALREADY_EXISTS",
    "statusCode": 409
  },
  "request": {
    "method": "POST",
    "url": "https://freight-platform.com/api/users",
    "headers": { /* redacted sensitive headers */ },
    "ip": "192.168.1.100"
  },
  "user": {
    "userId": "user-123",
    "organizationId": "org-456",
    "role": "CARRIER"
  },
  "original": {
    "name": "PrismaClientKnownRequestError",
    "message": "Unique constraint failed on the fields: (`email`)",
    "stack": "Error: Unique constraint...\n    at ...",
    "code": "P2002"
  }
}
```

### Logging Levels

- **ERROR**: All caught exceptions
- **WARN**: Validation failures, rate limit hits
- **INFO**: Normal operation (not errors)

---

## Request ID Correlation

### How Request IDs Work

1. **Middleware generates UUID** for each request
2. **Request ID attached** to all responses via `X-Request-Id` header
3. **Request ID included** in all error responses
4. **Request ID logged** server-side for correlation

### Using Request IDs for Debugging

**Client sees error:**
```json
{
  "error": "An unexpected error occurred",
  "code": "INTERNAL_SERVER_ERROR",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-12-25T12:00:00.000Z"
}
```

**Server logs show details:**
```bash
# Search logs by request ID
grep "550e8400-e29b-41d4-a716-446655440000" server.log

# Returns full error details including stack trace
```

---

## Client-Side Error Handling

### Handling Error Responses

```typescript
async function uploadDocument(file: File) {
  try {
    const response = await fetch('/api/documents/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();

      // Get request ID for support
      const requestId = response.headers.get('X-Request-Id');

      // Handle specific error codes
      switch (error.code) {
        case 'UNAUTHORIZED':
          // Redirect to login
          window.location.href = '/login';
          break;

        case 'FILE_TOO_LARGE':
          // Show specific message
          showError('File is too large. Maximum size is 10MB.');
          break;

        case 'RATE_LIMIT_EXCEEDED':
          // Show rate limit message
          showError(`Upload limit exceeded. ${error.error}`);
          break;

        default:
          // Generic error with request ID
          showError(
            `${error.error} (Request ID: ${requestId})`
          );
      }

      return;
    }

    // Success handling...
  } catch (err) {
    console.error('Network error:', err);
    showError('Network error. Please check your connection.');
  }
}
```

### Displaying Request IDs to Users

```tsx
function ErrorMessage({ error, requestId }: { error: string; requestId: string }) {
  return (
    <div className="error">
      <p>{error}</p>
      <p className="text-sm text-gray-500">
        Request ID: {requestId}
        <button onClick={() => navigator.clipboard.writeText(requestId)}>
          Copy
        </button>
      </p>
      <p className="text-sm">
        If this problem persists, contact support with the Request ID above.
      </p>
    </div>
  );
}
```

---

## Testing Error Scenarios

### Manual Testing

**Test Information Disclosure:**
```bash
# 1. Trigger database error
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"existing@example.com"}'

# Should return:
# {"error":"A record with this information already exists","code":"ALREADY_EXISTS","requestId":"..."}
# NOT: "Unique constraint failed on table 'users' column 'email'"

# 2. Trigger file path disclosure
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@invalid.txt"

# Should return:
# {"error":"File type not allowed","code":"INVALID_FILE_TYPE","requestId":"..."}
# NOT: "Cannot save file to /Users/admin/app/uploads/file.txt"

# 3. Check request ID in headers
curl -v http://localhost:3000/api/users

# Should include header:
# X-Request-Id: 550e8400-e29b-41d4-a716-446655440000
```

### Automated Testing

```typescript
describe('Error Handling', () => {
  it('should not expose database errors', async () => {
    // Trigger P2002 (unique constraint)
    const response = await request(app)
      .post('/api/users')
      .send({ email: 'existing@example.com' });

    expect(response.status).toBe(409);
    expect(response.body.error).not.toContain('Unique constraint');
    expect(response.body.error).not.toContain('table');
    expect(response.body.error).not.toContain('column');
    expect(response.body.code).toBe('ALREADY_EXISTS');
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('should not expose file paths', async () => {
    const response = await request(app)
      .post('/api/documents/upload')
      .attach('file', 'test.txt');

    expect(response.body.error).not.toMatch(/\/Users\//);
    expect(response.body.error).not.toMatch(/\/home\//);
    expect(response.body.error).not.toMatch(/C:\\/);
  });

  it('should include request ID in all errors', async () => {
    const response = await request(app)
      .get('/api/nonexistent');

    expect(response.body.requestId).toBeDefined();
    expect(response.headers['x-request-id']).toBe(response.body.requestId);
  });
});
```

---

## Production Error Tracking

### Sentry Integration (Future)

```typescript
// lib/errorHandler.ts

import * as Sentry from '@sentry/nextjs';

export function logDetailedError(
  error: any,
  request: NextRequest,
  requestId: string,
  userId?: string
) {
  // Console logging
  console.error('[ERROR]', JSON.stringify(detailedError, null, 2));

  // Send to Sentry in production
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error, {
      tags: {
        requestId,
        userId,
        endpoint: request.url,
      },
      contexts: {
        request: {
          method: request.method,
          url: request.url,
          headers: Object.fromEntries(request.headers.entries()),
        },
      },
    });
  }
}
```

### Environment Setup

```env
# .env.local
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=v1.0.0
```

---

## Best Practices

### ✅ DO:
- Use `handleError()` in all catch blocks
- Include request ID in all responses
- Log full error details server-side
- Use error codes for client handling
- Sanitize all error messages
- Test error scenarios regularly

### ❌ DON'T:
- Return raw error messages to clients
- Expose stack traces
- Include file paths in responses
- Show database error codes (P2002, etc.)
- Return SQL queries
- Expose environment variables

---

## Monitoring & Alerts

### Key Metrics to Track

1. **Error Rate**: Errors per minute/hour
2. **Error Types**: Distribution by error code
3. **Affected Endpoints**: Which APIs fail most
4. **User Impact**: Errors per user/organization
5. **Response Time**: Correlation with errors

### Alert Thresholds

- **Critical**: Error rate > 50 per minute
- **Warning**: Error rate > 20 per minute
- **Info**: New error types detected

---

## Compliance

**Standards Met**:
- ✅ OWASP Top 10 (A04:2021 - Insecure Design)
- ✅ OWASP API Security (API3:2023 - Excessive Data Exposure)
- ✅ CWE-209 (Information Exposure Through Error Message)
- ✅ CWE-497 (Exposure of System Data)

---

## Summary

| Feature | Status | Description |
|---------|--------|-------------|
| Generic Error Messages | ✅ | Users see safe, sanitized errors |
| Request IDs | ✅ | All responses include X-Request-Id header |
| Server-Side Logging | ✅ | Full error details logged with context |
| Error Codes | ✅ | Standardized codes for client handling |
| Message Sanitization | ✅ | Auto-removes paths, DB details, queries |
| Prisma Error Mapping | ✅ | Database errors converted to safe responses |
| Error Wrapper | ✅ | withErrorHandling() for easy integration |
| Error Tracking | ⚠️ | Ready for Sentry integration |

---

**Last Updated:** 2025-12-25
**Maintained By:** Development Team
**Review Frequency:** Quarterly or after security incidents
