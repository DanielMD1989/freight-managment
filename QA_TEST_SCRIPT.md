# End-to-End QA Test Script

**Date:** 2026-01-23
**Version:** 1.0
**Platforms:** Web + Mobile (Flutter)
**Target:** Production Readiness Verification

---

## Test Environment Setup

### Prerequisites

```bash
# Backend
npm install
npm run dev  # or npm run build && npm start for production mode

# Mobile (Flutter)
cd mobile
flutter pub get
flutter run
```

### Test Accounts Required

| Role | Email | Password | Organization |
|------|-------|----------|--------------|
| Admin | admin@test.com | Test123! | Platform |
| Shipper | shipper@test.com | Test123! | ABC Shipping |
| Carrier | carrier@test.com | Test123! | XYZ Transport |
| Driver | driver@test.com | Test123! | XYZ Transport |

---

## PART 1: AUTHENTICATION TESTS

### 1.1 Registration Flow

| # | Test Case | Platform | Steps | Expected Result | Status |
|---|-----------|----------|-------|-----------------|--------|
| 1.1.1 | Register new shipper | Web | 1. Go to /register<br>2. Select "Shipper"<br>3. Fill form<br>4. Submit | Account created, redirect to verification | [ ] |
| 1.1.2 | Register new carrier | Web | 1. Go to /register<br>2. Select "Carrier"<br>3. Fill form<br>4. Submit | Account created, redirect to verification | [ ] |
| 1.1.3 | Register with weak password | Web | Use password "123" | Error: Password requirements not met | [ ] |
| 1.1.4 | Register duplicate email | Web | Use existing email | Error: Email already registered | [ ] |
| 1.1.5 | Mobile registration | Mobile | Same as 1.1.1 on mobile | Account created successfully | [ ] |

### 1.2 Login Flow

| # | Test Case | Platform | Steps | Expected Result | Status |
|---|-----------|----------|-------|-----------------|--------|
| 1.2.1 | Valid login | Web | Enter valid credentials | Redirect to dashboard | [ ] |
| 1.2.2 | Invalid password | Web | Enter wrong password | Error: Invalid credentials | [ ] |
| 1.2.3 | Non-existent user | Web | Enter unknown email | Error: Invalid credentials | [ ] |
| 1.2.4 | Rate limit (5 attempts) | Web | Fail login 5 times | Error: Too many attempts, wait 15 min | [ ] |
| 1.2.5 | Mobile login | Mobile | Enter valid credentials | Redirect to home screen | [ ] |
| 1.2.6 | Bearer token auth | Mobile | Login and check token | Token stored securely | [ ] |

### 1.3 Logout & Session Security

| # | Test Case | Platform | Steps | Expected Result | Status |
|---|-----------|----------|-------|-----------------|--------|
| 1.3.1 | Basic logout | Web | Click logout | Session cleared, redirect to login | [ ] |
| 1.3.2 | Cross-device logout | Web+Mobile | 1. Login on web<br>2. Login on mobile<br>3. Logout on web | Mobile session also invalidated | [ ] |
| 1.3.3 | Session expiry | Web | Wait 7+ days (or modify token) | Auto-logout, redirect to login | [ ] |
| 1.3.4 | Revoked session access | Web | Try to access API with revoked token | 401 Unauthorized | [ ] |

---

## PART 2: LOAD MANAGEMENT TESTS

### 2.1 Create Load (Shipper)

| # | Test Case | Platform | Steps | Expected Result | Status |
|---|-----------|----------|-------|-----------------|--------|
| 2.1.1 | Create draft load | Web | Fill form, save as draft | Load saved with DRAFT status | [ ] |
| 2.1.2 | Post load to marketplace | Web | Fill form, status=POSTED | Load visible in marketplace | [ ] |
| 2.1.3 | Required fields validation | Web | Submit with empty fields | Validation errors shown | [ ] |
| 2.1.4 | Create load (mobile) | Mobile | Fill form, submit | Load created successfully | [ ] |
| 2.1.5 | Push notification on post | Mobile | Post load on web | Carriers receive push notification | [ ] |

### 2.2 View Loads

| # | Test Case | Platform | Steps | Expected Result | Status |
|---|-----------|----------|-------|-----------------|--------|
| 2.2.1 | View marketplace | Web | Go to /loads | See all POSTED loads | [ ] |
| 2.2.2 | Filter by city | Web | Filter pickup=Addis | Only matching loads shown | [ ] |
| 2.2.3 | Filter by truck type | Web | Filter type=FLATBED | Only flatbed loads shown | [ ] |
| 2.2.4 | View my loads (shipper) | Web | Toggle "My Loads" | Only own loads shown | [ ] |
| 2.2.5 | View load details | Web | Click on load | Full details displayed | [ ] |
| 2.2.6 | Anonymous shipper | Web | View load with isAnonymous=true | Company name masked | [ ] |
| 2.2.7 | Mobile marketplace | Mobile | View loads list | Same loads as web | [ ] |

### 2.3 Load Status Transitions

| # | Test Case | Platform | Steps | Expected Result | Status |
|---|-----------|----------|-------|-----------------|--------|
| 2.3.1 | DRAFT → POSTED | Web | Edit draft, post | Status updated, visible in marketplace | [ ] |
| 2.3.2 | POSTED → ASSIGNED | Web | Assign truck | Status = ASSIGNED | [ ] |
| 2.3.3 | ASSIGNED → IN_TRANSIT | Mobile | Driver starts trip | Status = IN_TRANSIT | [ ] |
| 2.3.4 | IN_TRANSIT → DELIVERED | Mobile | Driver completes delivery | Status = DELIVERED | [ ] |
| 2.3.5 | POSTED → CANCELLED | Web | Cancel load | Status = CANCELLED, not in marketplace | [ ] |

---

## PART 3: TRUCK MANAGEMENT TESTS

### 3.1 Truck Registration (Carrier)

| # | Test Case | Platform | Steps | Expected Result | Status |
|---|-----------|----------|-------|-----------------|--------|
| 3.1.1 | Register truck | Web | Fill truck form, submit | Truck created, PENDING approval | [ ] |
| 3.1.2 | Duplicate plate | Web | Use existing plate number | Error: Plate already registered | [ ] |
| 3.1.3 | Approve truck (admin) | Web | Admin approves truck | Status = APPROVED | [ ] |
| 3.1.4 | Reject truck (admin) | Web | Admin rejects with reason | Status = REJECTED, reason shown | [ ] |
| 3.1.5 | Mobile truck registration | Mobile | Register truck on mobile | Same as web | [ ] |

### 3.2 Truck Posting (DAT Board)

| # | Test Case | Platform | Steps | Expected Result | Status |
|---|-----------|----------|-------|-----------------|--------|
| 3.2.1 | Post truck availability | Web | Create truck posting | Visible on DAT board | [ ] |
| 3.2.2 | One active post per truck | Web | Try to post same truck twice | Error: Already has active posting | [ ] |
| 3.2.3 | View DAT board | Web | Go to /truck-postings | See all active postings | [ ] |
| 3.2.4 | Filter by origin | Web | Filter origin=Addis | Only matching postings | [ ] |
| 3.2.5 | CSRF protection | Web | POST without CSRF token | 403 Forbidden | [ ] |

### 3.3 Truck Requests (Shipper → Carrier)

| # | Test Case | Platform | Steps | Expected Result | Status |
|---|-----------|----------|-------|-----------------|--------|
| 3.3.1 | Request truck | Web | Shipper requests posted truck | Request created, PENDING | [ ] |
| 3.3.2 | Carrier receives notification | Web/Mobile | After request | Carrier notified | [ ] |
| 3.3.3 | Approve request | Web | Carrier approves | Truck assigned to load | [ ] |
| 3.3.4 | Reject request | Web | Carrier rejects | Request = REJECTED | [ ] |
| 3.3.5 | Request expiry | Web | Wait 24+ hours | Request = EXPIRED | [ ] |

---

## PART 4: TRIP & GPS TRACKING TESTS

### 4.1 Trip Creation

| # | Test Case | Platform | Steps | Expected Result | Status |
|---|-----------|----------|-------|-----------------|--------|
| 4.1.1 | Auto-create trip on assign | Web | Assign truck to load | Trip created automatically | [ ] |
| 4.1.2 | View trip details | Web | Go to /trips/[id] | Trip details displayed | [ ] |
| 4.1.3 | Trip status reflects load | Web | Change load status | Trip status synced | [ ] |

### 4.2 GPS Position Updates

| # | Test Case | Platform | Steps | Expected Result | Status |
|---|-----------|----------|-------|-----------------|--------|
| 4.2.1 | Submit GPS position | Mobile | POST /api/gps/position | Position recorded | [ ] |
| 4.2.2 | Batch GPS upload | Mobile | POST /api/gps/batch (100 positions) | All positions recorded | [ ] |
| 4.2.3 | GPS rate limit | Mobile | Submit 200+ positions/sec | 429 after limit | [ ] |
| 4.2.4 | View truck location | Web | View trip map | Current position shown | [ ] |
| 4.2.5 | GPS history | Web | View trip history | Path displayed on map | [ ] |

### 4.3 Real-time Tracking (WebSocket)

| # | Test Case | Platform | Steps | Expected Result | Status |
|---|-----------|----------|-------|-----------------|--------|
| 4.3.1 | WebSocket connect | Web | Open trip page | WebSocket connected | [ ] |
| 4.3.2 | Subscribe to trip | Web | View active trip | Subscribed to trip room | [ ] |
| 4.3.3 | Receive GPS updates | Web | Driver submits position | Map updates in real-time | [ ] |
| 4.3.4 | Permission denied | Web | Shipper views other's trip | Error: Permission denied | [ ] |
| 4.3.5 | Session validation | Web | Connect with revoked session | Connection rejected | [ ] |
| 4.3.6 | Fleet tracking (carrier) | Web | View all fleet trucks | All trucks shown | [ ] |
| 4.3.7 | All GPS (admin only) | Web | Admin subscribes to all-gps | All positions received | [ ] |

---

## PART 5: NOTIFICATION TESTS

### 5.1 In-App Notifications

| # | Test Case | Platform | Steps | Expected Result | Status |
|---|-----------|----------|-------|-----------------|--------|
| 5.1.1 | Notification bell | Web | View notification icon | Unread count shown | [ ] |
| 5.1.2 | View notifications | Web | Click bell | List of notifications | [ ] |
| 5.1.3 | Mark as read | Web | Click notification | Marked as read | [ ] |
| 5.1.4 | Mark all as read | Web | Click "Mark all read" | All marked as read | [ ] |
| 5.1.5 | Real-time notification | Web | Trigger event | Notification appears instantly | [ ] |

### 5.2 Push Notifications (Mobile)

| # | Test Case | Platform | Steps | Expected Result | Status |
|---|-----------|----------|-------|-----------------|--------|
| 5.2.1 | New load notification | Mobile | Shipper posts load | Carrier receives push | [ ] |
| 5.2.2 | Truck request notification | Mobile | Shipper requests truck | Carrier receives push | [ ] |
| 5.2.3 | Request approved | Mobile | Carrier approves | Shipper receives push | [ ] |
| 5.2.4 | Trip status change | Mobile | Status changes | Both parties notified | [ ] |
| 5.2.5 | Notification preferences | Mobile | Disable notification type | That type not received | [ ] |

### 5.3 Email Notifications

| # | Test Case | Platform | Steps | Expected Result | Status |
|---|-----------|----------|-------|-----------------|--------|
| 5.3.1 | Document approved | N/A | Admin approves document | Email sent to user | [ ] |
| 5.3.2 | Document rejected | N/A | Admin rejects document | Email with reason sent | [ ] |
| 5.3.3 | Password reset | Web | Request password reset | Email with link sent | [ ] |
| 5.3.4 | Queue processing | N/A | Check email queue | Jobs processed by worker | [ ] |

---

## PART 6: SECURITY TESTS

### 6.1 CSRF Protection

| # | Test Case | Platform | Steps | Expected Result | Status |
|---|-----------|----------|-------|-----------------|--------|
| 6.1.1 | POST without CSRF | Web | cURL POST without token | 403 Forbidden | [ ] |
| 6.1.2 | POST with valid CSRF | Web | Include X-CSRF-Token header | Request succeeds | [ ] |
| 6.1.3 | Mobile bypass (Bearer) | Mobile | POST with Bearer token | CSRF skipped, request succeeds | [ ] |
| 6.1.4 | Invalid CSRF token | Web | Send wrong token | 403 Forbidden | [ ] |

### 6.2 Authorization (RBAC)

| # | Test Case | Platform | Steps | Expected Result | Status |
|---|-----------|----------|-------|-----------------|--------|
| 6.2.1 | Shipper can't approve trucks | Web | Shipper tries to approve | 403 Forbidden | [ ] |
| 6.2.2 | Carrier can't create loads | Web | Carrier tries POST /loads | 403 Forbidden | [ ] |
| 6.2.3 | Cross-org access denied | Web | Access other org's data | 403 Forbidden | [ ] |
| 6.2.4 | Admin can access all | Web | Admin views any data | Access granted | [ ] |
| 6.2.5 | Dispatcher permissions | Web | Dispatcher views all trucks | Access granted | [ ] |

### 6.3 Rate Limiting

| # | Test Case | Platform | Steps | Expected Result | Status |
|---|-----------|----------|-------|-----------------|--------|
| 6.3.1 | Login rate limit | Web | 6 failed logins | 429 after 5th attempt | [ ] |
| 6.3.2 | API rate limit | Web | 200+ requests/sec | 429 after limit | [ ] |
| 6.3.3 | GPS rate limit | Mobile | 150+ positions/sec | 429 after 100 RPS | [ ] |
| 6.3.4 | Rate limit headers | Web | Check response headers | X-RateLimit-* present | [ ] |

### 6.4 Input Validation

| # | Test Case | Platform | Steps | Expected Result | Status |
|---|-----------|----------|-------|-----------------|--------|
| 6.4.1 | XSS in load description | Web | Include `<script>` tag | Sanitized/escaped | [ ] |
| 6.4.2 | SQL injection | Web | Include SQL in input | Parameterized, no injection | [ ] |
| 6.4.3 | Invalid ID format | Web | Use malformed ID | 400 Bad Request | [ ] |
| 6.4.4 | Oversized payload | Web | Submit 10MB JSON | 413 Payload Too Large | [ ] |

---

## PART 7: CROSS-PLATFORM SCENARIOS

### 7.1 Web → Mobile Sync

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 7.1.1 | Load created on web | 1. Create load on web<br>2. Open mobile app | Load visible on mobile | [ ] |
| 7.1.2 | Truck posted on web | 1. Post truck on web<br>2. View DAT on mobile | Posting visible on mobile | [ ] |
| 7.1.3 | Status change on web | 1. Change status on web<br>2. View on mobile | Status synced | [ ] |

### 7.2 Mobile → Web Sync

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 7.2.1 | GPS from mobile | 1. Driver submits GPS<br>2. View trip on web | Position shown on web map | [ ] |
| 7.2.2 | Trip started on mobile | 1. Driver starts trip<br>2. View on web | Status = IN_TRANSIT on web | [ ] |
| 7.2.3 | Delivery completed | 1. Complete on mobile<br>2. View on web | Status = DELIVERED on web | [ ] |

### 7.3 Real-time Scenarios

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 7.3.1 | Live GPS tracking | 1. Shipper watches trip (web)<br>2. Driver moves (mobile) | Map updates in real-time | [ ] |
| 7.3.2 | Instant notifications | 1. Shipper posts load (web)<br>2. Carrier has mobile open | Push received instantly | [ ] |
| 7.3.3 | Concurrent edits | 1. Both edit same load<br>2. Submit | Last write wins, no crash | [ ] |

---

## PART 8: PERFORMANCE TESTS

### 8.1 API Latency

| Endpoint | Method | Target P95 | Actual | Status |
|----------|--------|------------|--------|--------|
| /api/health | GET | < 50ms | | [ ] |
| /api/loads | GET | < 200ms | | [ ] |
| /api/loads | POST | < 500ms | | [ ] |
| /api/trucks | GET | < 200ms | | [ ] |
| /api/gps/position | POST | < 200ms | | [ ] |
| /api/gps/batch | POST | < 500ms | | [ ] |

### 8.2 Load Testing

| Scenario | Target | Actual | Status |
|----------|--------|--------|--------|
| 50 concurrent users | 99% success | | [ ] |
| 100 concurrent users | 98% success | | [ ] |
| 200 RPS sustained | 90% success | | [ ] |

### 8.3 Mobile Performance

| Scenario | Target | Actual | Status |
|----------|--------|--------|--------|
| App cold start | < 3 seconds | | [ ] |
| Load list refresh | < 2 seconds | | [ ] |
| GPS batch upload | < 1 second | | [ ] |

---

## PART 9: ERROR HANDLING TESTS

### 9.1 Network Errors

| # | Test Case | Platform | Steps | Expected Result | Status |
|---|-----------|----------|-------|-----------------|--------|
| 9.1.1 | Offline mode | Mobile | Disable network | Graceful error, cached data shown | [ ] |
| 9.1.2 | Timeout | Web | Slow network | Timeout error displayed | [ ] |
| 9.1.3 | Server down | Web | Stop backend | Error page shown | [ ] |
| 9.1.4 | Reconnect | Mobile | Restore network | Auto-reconnect, sync data | [ ] |

### 9.2 Validation Errors

| # | Test Case | Platform | Steps | Expected Result | Status |
|---|-----------|----------|-------|-----------------|--------|
| 9.2.1 | Form validation | Web | Submit invalid form | Field-level errors shown | [ ] |
| 9.2.2 | API validation | Web | Send invalid JSON | 400 with error details | [ ] |
| 9.2.3 | Business rule error | Web | Violate business rule | Clear error message | [ ] |

---

## PART 10: DATA INTEGRITY TESTS

### 10.1 Consistency

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 10.1.1 | Load-Trip sync | Assign truck | Trip created with correct data | [ ] |
| 10.1.2 | GPS-Truck sync | Submit GPS | Truck location updated | [ ] |
| 10.1.3 | Notification-Event sync | Trigger event | Notification matches event | [ ] |

### 10.2 Constraints

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 10.2.1 | Unique email | Register duplicate | Error: Email exists | [ ] |
| 10.2.2 | Unique plate | Register duplicate | Error: Plate exists | [ ] |
| 10.2.3 | Foreign key | Delete referenced org | Error: Cannot delete | [ ] |

---

## Test Execution Log

### Summary

| Part | Total | Pass | Fail | Skip | % |
|------|-------|------|------|------|---|
| 1. Authentication | 14 | | | | |
| 2. Load Management | 17 | | | | |
| 3. Truck Management | 14 | | | | |
| 4. Trip & GPS | 12 | | | | |
| 5. Notifications | 13 | | | | |
| 6. Security | 15 | | | | |
| 7. Cross-Platform | 9 | | | | |
| 8. Performance | 9 | | | | |
| 9. Error Handling | 7 | | | | |
| 10. Data Integrity | 5 | | | | |
| **TOTAL** | **115** | | | | |

### Issues Found

| # | Test ID | Description | Severity | Status |
|---|---------|-------------|----------|--------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

### Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| QA Lead | | | |
| Dev Lead | | | |
| Product Owner | | | |

---

## Quick Commands for Testing

### API Testing (cURL)

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"shipper@test.com","password":"Test123!"}'

# Get loads (with auth)
curl http://localhost:3000/api/loads \
  -H "Cookie: session=<token>"

# Create load (with CSRF)
curl -X POST http://localhost:3000/api/loads \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<token>" \
  -H "X-CSRF-Token: <csrf-token>" \
  -d '{"pickupCity":"Addis Ababa","deliveryCity":"Dire Dawa",...}'

# GPS position (mobile)
curl -X POST http://localhost:3000/api/gps/position \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -H "x-client-type: mobile" \
  -d '{"truckId":"xxx","lat":9.03,"lng":38.74}'
```

### WebSocket Testing

```javascript
// Browser console
const socket = io('http://localhost:3000', { path: '/api/socket' });
socket.on('connect', () => console.log('Connected'));
socket.emit('authenticate', { userId: 'xxx', token: 'yyy' });
socket.on('notification', (data) => console.log('Notification:', data));
socket.emit('subscribe-trip', 'load-id-here');
socket.on('gps-position', (data) => console.log('GPS:', data));
```

### Rate Limit Testing

```bash
# Test login rate limit
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}' \
    -w "\n%{http_code}\n"
done
```

---

**Document Version:** 1.0
**Created:** 2026-01-23
**Total Test Cases:** 115
