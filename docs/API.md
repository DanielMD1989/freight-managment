# Freight Management Platform - API Documentation

## Overview

The Freight Management Platform provides a comprehensive REST API for Ethiopian freight logistics operations. The API supports shipper, carrier, dispatcher, and admin workflows with real-time GPS tracking.

**Base URLs:**
- Development: `http://localhost:3000/api`
- Production: `https://api.freightplatform.com/api`

**API Version:** 1.0.0

---

## Authentication

### Session-Based Authentication (Web)

Web clients use HTTP-only session cookies with CSRF protection.

1. **Login** to obtain session cookie:
   ```bash
   POST /api/auth/login
   Content-Type: application/json

   {"email": "user@example.com", "password": "password123"}
   ```

2. **Include CSRF token** in subsequent requests:
   ```bash
   GET /api/loads
   X-CSRF-Token: <token-from-login-response>
   ```

### Bearer Token Authentication (Mobile)

Mobile clients receive a session token in the login response.

```bash
GET /api/loads
Authorization: Bearer <sessionToken>
```

### Multi-Factor Authentication (MFA)

If MFA is enabled, login returns an `mfaRequired` response:

```json
{
  "mfaRequired": true,
  "mfaToken": "temp-token",
  "phoneLastFour": "1234",
  "expiresIn": 300
}
```

Complete login with:
```bash
POST /api/auth/verify-mfa
{"mfaToken": "temp-token", "code": "123456"}
```

---

## Rate Limiting

All endpoints are rate-limited to prevent abuse.

| Endpoint Category | Limit |
|-------------------|-------|
| Login | 5 attempts / 15 min / email |
| Registration | 3 / hour / IP |
| Marketplace (loads, trucks) | 10-20 RPS |
| Dashboard | 20 RPS |
| GPS updates | 50 RPS |
| General API | 100 RPS |

**Rate Limit Response:**
```json
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{"error": "Rate limit exceeded", "retryAfter": 60}
```

---

## Error Handling

### Error Response Format

```json
{
  "error": "Error message",
  "statusCode": 400,
  "details": [
    {"field": "email", "message": "Invalid email format"}
  ]
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (not authenticated) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (state machine violation) |
| 429 | Rate Limit Exceeded |
| 500 | Internal Server Error |

---

## API Reference by Panel

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | User login |
| POST | `/auth/register` | User registration |
| POST | `/auth/logout` | Logout |
| GET | `/auth/me` | Get current user |
| POST | `/auth/verify-mfa` | Verify MFA code |
| POST | `/auth/forgot-password` | Request password reset |
| POST | `/auth/reset-password` | Reset password with token |

### User Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/user/profile` | Get user profile |
| PATCH | `/user/profile` | Update profile |
| POST | `/user/change-password` | Change password |
| POST | `/user/mfa/enable` | Enable MFA |
| POST | `/user/mfa/disable` | Disable MFA |
| GET | `/user/sessions` | List active sessions |
| DELETE | `/user/sessions/{id}` | Revoke session |
| POST | `/user/sessions/revoke-all` | Revoke all other sessions |
| GET | `/user/notification-preferences` | Get notification settings |
| PATCH | `/user/notification-preferences` | Update notification settings |

### Shipper Panel

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/shipper/dashboard` | Shipper dashboard stats |
| GET | `/loads` | List loads (with filters) |
| POST | `/loads` | Create new load |
| GET | `/loads/{id}` | Get load details |
| PATCH | `/loads/{id}` | Update load |
| DELETE | `/loads/{id}` | Delete load |
| PATCH | `/loads/{id}/status` | Update load status |
| GET | `/loads/{id}/matching-trucks` | Find matching trucks |
| POST | `/loads/{id}/assign` | Assign truck to load |
| GET | `/loads/{id}/tracking` | Get tracking info |
| GET | `/loads/{id}/service-fee` | Get service fee preview |
| POST | `/loads/{id}/pod` | Upload proof of delivery |
| GET | `/load-requests` | List load requests |
| POST | `/load-requests/{id}/respond` | Respond to load request |
| GET | `/shipper/trips` | List shipper's trips |
| GET | `/shipper/wallet` | Get wallet balance |

### Carrier Panel

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/carrier/dashboard` | Carrier dashboard stats |
| GET | `/trucks` | List carrier's trucks |
| POST | `/trucks` | Register new truck |
| GET | `/trucks/{id}` | Get truck details |
| PATCH | `/trucks/{id}` | Update truck |
| DELETE | `/trucks/{id}` | Delete truck |
| POST | `/trucks/{id}/position` | Update truck GPS position |
| GET | `/trucks/{id}/nearby-loads` | Find nearby loads |
| GET | `/truck-postings` | List truck postings |
| POST | `/truck-postings` | Create truck posting |
| GET | `/truck-postings/{id}` | Get posting details |
| PATCH | `/truck-postings/{id}` | Update posting |
| DELETE | `/truck-postings/{id}` | Delete posting |
| GET | `/truck-postings/{id}/matching-loads` | Find matching loads |
| GET | `/truck-requests` | List truck requests |
| POST | `/truck-requests/{id}/respond` | Respond to request |
| GET | `/trips` | List carrier's trips |
| GET | `/trips/{tripId}` | Get trip details |
| PATCH | `/trips/{tripId}` | Update trip status |
| POST | `/trips/{tripId}/confirm` | Confirm pickup |
| POST | `/trips/{tripId}/cancel` | Cancel trip |
| POST | `/trips/{tripId}/pod` | Upload POD |

### Dispatcher Panel

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dispatcher/dashboard` | Dispatcher dashboard |
| GET | `/dispatch` | Get dispatch queue |
| POST | `/dispatch` | Dispatch load to truck |
| GET | `/match-proposals` | List match proposals |
| POST | `/match-proposals/{id}/respond` | Accept/reject proposal |
| GET | `/escalations` | List escalations |
| POST | `/escalations` | Create escalation |
| PATCH | `/escalations/{id}` | Resolve escalation |
| GET | `/map/loads` | Map view - loads |
| GET | `/map/trucks` | Map view - trucks |
| GET | `/map/trips` | Map view - trips |

### Admin Panel

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/dashboard` | Admin dashboard |
| GET | `/admin/users` | List all users |
| GET | `/admin/users/{id}` | Get user details |
| PATCH | `/admin/users/{id}` | Update user |
| DELETE | `/admin/users/{id}` | Deactivate user |
| POST | `/admin/users/{id}/verify` | Verify user |
| GET | `/admin/users/{id}/wallet` | Get user wallet |
| POST | `/admin/users/{id}/wallet/topup` | Admin wallet top-up |
| GET | `/admin/organizations` | List organizations |
| POST | `/admin/organizations/{id}/verify` | Verify organization |
| GET | `/admin/corridors` | List pricing corridors |
| POST | `/admin/corridors` | Create corridor |
| PATCH | `/admin/corridors/{id}` | Update corridor |
| DELETE | `/admin/corridors/{id}` | Delete corridor |
| GET | `/admin/settlements` | List pending settlements |
| POST | `/admin/settlements/{id}/approve` | Approve settlement |
| GET | `/admin/audit-logs` | View audit logs |
| GET | `/admin/platform-metrics` | Platform metrics |
| GET | `/admin/analytics` | Analytics data |
| GET | `/admin/documents` | List all documents |
| GET | `/admin/verification/queue` | Verification queue |

### Wallet & Financial

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/wallet/balance` | Get wallet balance |
| GET | `/wallet/transactions` | Transaction history |
| POST | `/financial/wallet` | Initiate top-up (Chapa) |
| POST | `/financial/withdraw` | Request withdrawal |
| GET | `/corridors/calculate-fee` | Calculate service fee |

### GPS & Tracking

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/gps/position` | Submit GPS position |
| POST | `/gps/batch` | Submit batch positions |
| GET | `/gps/live` | Get live positions |
| GET | `/gps/history` | Get position history |
| GET | `/gps/eta` | Calculate ETA |
| GET | `/gps/devices` | List GPS devices |
| POST | `/gps/devices` | Register GPS device |
| GET | `/tracking/{trackingId}` | Public tracking page |
| GET | `/trips/{tripId}/live` | Live trip position |
| GET | `/trips/{tripId}/history` | Trip route history |

### Organizations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/organizations` | List organizations |
| POST | `/organizations` | Create organization |
| GET | `/organizations/me` | Get my organization |
| GET | `/organizations/{id}` | Get organization |
| PATCH | `/organizations/{id}` | Update organization |
| GET | `/organizations/invitations` | List invitations |
| POST | `/organizations/invitations` | Send invitation |
| POST | `/organizations/invitations/{id}` | Accept/reject |
| DELETE | `/organizations/invitations/{id}` | Cancel invitation |

### Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/documents` | List documents |
| POST | `/documents/upload` | Upload document |
| GET | `/documents/{id}` | Get document |
| DELETE | `/documents/{id}` | Delete document |

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | List notifications |
| POST | `/notifications/{id}/read` | Mark as read |
| POST | `/notifications/mark-all-read` | Mark all as read |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/csrf-token` | Get CSRF token |
| GET | `/ethiopian-locations` | List Ethiopian cities |
| GET | `/distance` | Calculate distance |
| GET | `/config` | Get app configuration |

---

## Common Patterns

### Pagination

All list endpoints support pagination:

```bash
GET /api/loads?page=1&limit=20
```

**Response:**
```json
{
  "loads": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

### Filtering

Most list endpoints support filters via query parameters:

```bash
GET /api/loads?status=POSTED,ASSIGNED&pickupCity=Addis%20Ababa&truckType=FLATBED
```

### Sorting

```bash
GET /api/loads?sortBy=postedAt&sortOrder=desc
```

### Field Selection

Some endpoints support field selection:

```bash
GET /api/loads?fields=id,pickupCity,deliveryCity,status
```

---

## State Machines

### Load Status Flow

```
DRAFT → POSTED → [SEARCHING|OFFERED] → ASSIGNED → PICKUP_PENDING → IN_TRANSIT → DELIVERED → COMPLETED
                                    ↓                           ↓
                                UNPOSTED                    EXCEPTION
                                    ↓                           ↓
                                EXPIRED                    CANCELLED
```

**Valid Transitions:**
- `DRAFT` → `POSTED`, `CANCELLED`
- `POSTED` → `SEARCHING`, `OFFERED`, `ASSIGNED`, `UNPOSTED`, `CANCELLED`, `EXPIRED`
- `ASSIGNED` → `PICKUP_PENDING`, `IN_TRANSIT`, `CANCELLED`
- `IN_TRANSIT` → `DELIVERED`, `EXCEPTION`
- `DELIVERED` → `COMPLETED`, `EXCEPTION`
- `EXCEPTION` → `SEARCHING`, `ASSIGNED`, `CANCELLED`, `COMPLETED`

### Trip Status Flow

```
ASSIGNED → PICKUP_PENDING → IN_TRANSIT → DELIVERED → COMPLETED
    ↓            ↓              ↓            ↓
CANCELLED    CANCELLED      CANCELLED    CANCELLED
```

---

## Webhooks

Configure webhooks at `/admin/settings` to receive real-time notifications:

| Event | Description |
|-------|-------------|
| `load.created` | New load posted |
| `load.assigned` | Load assigned to truck |
| `load.completed` | Load delivery completed |
| `trip.status_changed` | Trip status updated |
| `payment.received` | Payment received |
| `payment.failed` | Payment failed |

**Webhook Payload:**
```json
{
  "event": "load.completed",
  "timestamp": "2026-02-13T10:30:00Z",
  "data": {
    "loadId": "load-123",
    "tripId": "trip-456",
    ...
  }
}
```

---

## SDKs & Tools

### OpenAPI Specification

The full OpenAPI 3.0 specification is available at:
- `docs/openapi.yaml`
- `GET /api/docs/openapi.json` (runtime)

### Postman Collection

Import from: `docs/postman-collection.json`

### Code Generation

Generate client SDKs using OpenAPI Generator:

```bash
# TypeScript
npx openapi-generator-cli generate -i docs/openapi.yaml -g typescript-fetch -o sdk/typescript

# Python
npx openapi-generator-cli generate -i docs/openapi.yaml -g python -o sdk/python
```

---

## Support

- **Documentation:** https://docs.freightplatform.com
- **API Status:** https://status.freightplatform.com
- **Support:** support@freightplatform.com
