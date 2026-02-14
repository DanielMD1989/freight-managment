# 13 - Security & RBAC (SEC-xxx)

> **Total Tests:** 36
> **Priority Breakdown:** P0: 10 | P1: 14 | P2: 8 | P3: 4
> **Source Files:** `lib/rbac/permissions.ts`, `middleware.ts`
> **Reference:** 5 roles, 100+ permissions (see Appendix)

---

## Roles & Permission Count

| Role        | Permission Count | Key Capabilities                                                      |
| ----------- | ---------------- | --------------------------------------------------------------------- |
| SHIPPER     | 17               | Loads CRUD, truck search, POD view, wallet                            |
| CARRIER     | 17               | Trucks CRUD, load search/accept, trip execution, GPS, POD upload      |
| DISPATCHER  | 15               | View all loads/trucks, propose match, escalate, GPS monitoring        |
| ADMIN       | 43               | User management (non-admin), verification, wallets, fees, exceptions  |
| SUPER_ADMIN | All (66+)        | All permissions including CREATE_ADMIN, ASSIGN_ROLES, GLOBAL_OVERRIDE |

---

## A. CSRF Protection (SEC-001 to SEC-003)

### SEC-001: CSRF token required for mutations

| Field               | Value                                                              |
| ------------------- | ------------------------------------------------------------------ |
| **Priority**        | P0                                                                 |
| **Preconditions**   | Logged in user                                                     |
| **Steps**           | 1. `POST /api/loads` without `X-CSRF-Token` header                 |
| **Expected Result** | 403 Forbidden. CSRF token required for POST/PUT/DELETE operations. |
| **Status**          |                                                                    |
| **Actual Result**   |                                                                    |

### SEC-002: CSRF token generation

| Field               | Value                              |
| ------------------- | ---------------------------------- |
| **Priority**        | P0                                 |
| **Preconditions**   | None                               |
| **Steps**           | 1. `GET /api/csrf-token`           |
| **Expected Result** | 200 OK. Valid CSRF token returned. |
| **Status**          |                                    |
| **Actual Result**   |                                    |

### SEC-003: Invalid CSRF token rejected

| Field               | Value                                                   |
| ------------------- | ------------------------------------------------------- |
| **Priority**        | P1                                                      |
| **Preconditions**   | Logged in                                               |
| **Steps**           | 1. `POST /api/loads` with `X-CSRF-Token: invalid-token` |
| **Expected Result** | 403 Forbidden. Invalid CSRF token.                      |
| **Status**          |                                                         |
| **Actual Result**   |                                                         |

---

## B. Authentication Security (SEC-004 to SEC-009)

### SEC-004: JWT token validation

| Field               | Value                                            |
| ------------------- | ------------------------------------------------ |
| **Priority**        | P0                                               |
| **Preconditions**   | None                                             |
| **Steps**           | 1. Call any protected endpoint with tampered JWT |
| **Expected Result** | 401 Unauthorized. Signature verification fails.  |
| **Status**          |                                                  |
| **Actual Result**   |                                                  |

### SEC-005: Password hashing (bcrypt)

| Field               | Value                                                               |
| ------------------- | ------------------------------------------------------------------- |
| **Priority**        | P0                                                                  |
| **Preconditions**   | Register new user                                                   |
| **Steps**           | 1. Register user 2. Query DB for `passwordHash`                     |
| **Expected Result** | Password stored as bcrypt hash (starts with `$2b$`). Not plaintext. |
| **Status**          |                                                                     |
| **Actual Result**   |                                                                     |

### SEC-006: No user enumeration on login

| Field               | Value                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                              |
| **Preconditions**   | None                                                                                            |
| **Steps**           | 1. Login with non-existent email 2. Login with existing email + wrong password                  |
| **Expected Result** | Same error message and response time for both cases. Attacker cannot determine if email exists. |
| **Status**          |                                                                                                 |
| **Actual Result**   |                                                                                                 |

### SEC-007: Session cookie security flags

| Field               | Value                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                              |
| **Preconditions**   | Login                                                                                                           |
| **Steps**           | 1. Inspect Set-Cookie header after login                                                                        |
| **Expected Result** | Cookie has: `HttpOnly` (no JS access), `Secure` (HTTPS only), `SameSite=Lax`, appropriate `Path` and `Expires`. |
| **Status**          |                                                                                                                 |
| **Actual Result**   |                                                                                                                 |

### SEC-008: Rate limiting on login

| Field               | Value                                                     |
| ------------------- | --------------------------------------------------------- |
| **Priority**        | P0                                                        |
| **Preconditions**   | SystemSettings `rateLimitAuthAttempts: 5` per 15 min      |
| **Steps**           | 1. Attempt 6 failed logins from same IP within 15 minutes |
| **Expected Result** | 6th attempt returns 429 Too Many Requests.                |
| **Status**          |                                                           |
| **Actual Result**   |                                                           |

### SEC-009: Security events logged

| Field               | Value                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Priority**        | P1                                                                                                                                         |
| **Preconditions**   | Perform various auth actions                                                                                                               |
| **Steps**           | 1. Login (success) 2. Login (failure) 3. Change password 4. Enable MFA 5. Check SecurityEvent table                                        |
| **Expected Result** | SecurityEvent records for each: LOGIN_SUCCESS, LOGIN_FAILURE, PASSWORD_CHANGE, MFA_ENABLE. Each has `ipAddress`, `userAgent`, `timestamp`. |
| **Status**          |                                                                                                                                            |
| **Actual Result**   |                                                                                                                                            |

---

## C. RBAC Enforcement (SEC-010 to SEC-021)

### SEC-010: Shipper cannot access admin endpoints

| Field               | Value                                                                                |
| ------------------- | ------------------------------------------------------------------------------------ |
| **Priority**        | P0                                                                                   |
| **Preconditions**   | Logged in as shipper                                                                 |
| **Steps**           | 1. `GET /api/admin/users` 2. `GET /api/admin/dashboard` 3. `GET /api/admin/settings` |
| **Expected Result** | All return 403 Forbidden.                                                            |
| **Status**          |                                                                                      |
| **Actual Result**   |                                                                                      |

### SEC-011: Carrier cannot create loads

| Field               | Value                                                  |
| ------------------- | ------------------------------------------------------ |
| **Priority**        | P1                                                     |
| **Preconditions**   | Logged in as carrier                                   |
| **Steps**           | 1. `POST /api/loads`                                   |
| **Expected Result** | 403 Forbidden. Carrier lacks `CREATE_LOAD` permission. |
| **Status**          |                                                        |
| **Actual Result**   |                                                        |

### SEC-012: Shipper cannot create trucks

| Field               | Value                                                   |
| ------------------- | ------------------------------------------------------- |
| **Priority**        | P1                                                      |
| **Preconditions**   | Logged in as shipper                                    |
| **Steps**           | 1. `POST /api/trucks`                                   |
| **Expected Result** | 403 Forbidden. Shipper lacks `CREATE_TRUCK` permission. |
| **Status**          |                                                         |
| **Actual Result**   |                                                         |

### SEC-013: Dispatcher cannot modify trucks

| Field               | Value                                           |
| ------------------- | ----------------------------------------------- |
| **Priority**        | P1                                              |
| **Preconditions**   | Logged in as dispatcher                         |
| **Steps**           | 1. `PUT /api/trucks/{id}`                       |
| **Expected Result** | 403 Forbidden. Dispatcher can only view trucks. |
| **Status**          |                                                 |
| **Actual Result**   |                                                 |

### SEC-014: Dispatcher cannot assign loads directly

| Field               | Value                                                                      |
| ------------------- | -------------------------------------------------------------------------- |
| **Priority**        | P0                                                                         |
| **Preconditions**   | Logged in as dispatcher                                                    |
| **Steps**           | 1. `PUT /api/loads/{id}/assign`                                            |
| **Expected Result** | 403 Forbidden. Dispatcher must use `PROPOSE_MATCH`, not direct assignment. |
| **Status**          |                                                                            |
| **Actual Result**   |                                                                            |

### SEC-015: Carrier can only manage own trucks

| Field               | Value                                                                         |
| ------------------- | ----------------------------------------------------------------------------- |
| **Priority**        | P1                                                                            |
| **Preconditions**   | Carrier A logged in, truck belongs to Carrier B                               |
| **Steps**           | 1. `PUT /api/trucks/{carrierBTruckId}`                                        |
| **Expected Result** | 403 Forbidden. `MANAGE_OWN_TRUCKS` only applies to own organization's trucks. |
| **Status**          |                                                                               |
| **Actual Result**   |                                                                               |

### SEC-016: Shipper can only manage own loads

| Field               | Value                                          |
| ------------------- | ---------------------------------------------- |
| **Priority**        | P1                                             |
| **Preconditions**   | Shipper A logged in, load belongs to Shipper B |
| **Steps**           | 1. `PUT /api/loads/{shipperBLoadId}`           |
| **Expected Result** | 403 Forbidden.                                 |
| **Status**          |                                                |
| **Actual Result**   |                                                |

### SEC-017: Admin cannot assign roles

| Field               | Value                                               |
| ------------------- | --------------------------------------------------- |
| **Priority**        | P1                                                  |
| **Preconditions**   | Admin (not super_admin) logged in                   |
| **Steps**           | 1. Attempt to change user role                      |
| **Expected Result** | 403 Forbidden. Only SUPER_ADMIN has `ASSIGN_ROLES`. |
| **Status**          |                                                     |
| **Actual Result**   |                                                     |

### SEC-018: Admin can verify documents

| Field               | Value                                                              |
| ------------------- | ------------------------------------------------------------------ |
| **Priority**        | P1                                                                 |
| **Preconditions**   | Admin logged in                                                    |
| **Steps**           | 1. `PUT /api/admin/verification/{id}` with `{ action: "approve" }` |
| **Expected Result** | 200 OK. Admin has `VERIFY_DOCUMENTS` permission.                   |
| **Status**          |                                                                    |
| **Actual Result**   |                                                                    |

### SEC-019: Super admin has all permissions

| Field               | Value                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                       |
| **Preconditions**   | Super admin logged in                                                                    |
| **Steps**           | 1. Access admin endpoints 2. Create admin user 3. Delete admin user 4. Override settings |
| **Expected Result** | All succeed. Super admin has every permission.                                           |
| **Status**          |                                                                                          |
| **Actual Result**   |                                                                                          |

### SEC-020: Carrier cannot access dispatcher features

| Field               | Value                                                     |
| ------------------- | --------------------------------------------------------- |
| **Priority**        | P1                                                        |
| **Preconditions**   | Carrier logged in                                         |
| **Steps**           | 1. `GET /api/dispatcher/dashboard` 2. `GET /api/dispatch` |
| **Expected Result** | 403 Forbidden. Carrier lacks dispatch permissions.        |
| **Status**          |                                                           |
| **Actual Result**   |                                                           |

### SEC-021: Permission check for each role (comprehensive)

| Field               | Value                                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P2                                                                                                                            |
| **Preconditions**   | All 5 test users logged in separately                                                                                         |
| **Steps**           | For each role, verify key permission checks: SHIPPER (17 perms), CARRIER (17), DISPATCHER (15), ADMIN (43), SUPER_ADMIN (all) |
| **Expected Result** | Each role has exactly the permissions defined in `lib/rbac/permissions.ts`.                                                   |
| **Status**          |                                                                                                                               |
| **Actual Result**   |                                                                                                                               |

---

## D. Input Validation (SEC-022 to SEC-027)

### SEC-022: SQL injection prevention

| Field               | Value                                                                |
| ------------------- | -------------------------------------------------------------------- |
| **Priority**        | P0                                                                   |
| **Preconditions**   | None                                                                 |
| **Steps**           | 1. `POST /api/auth/login` with `{ email: "'; DROP TABLE users;--" }` |
| **Expected Result** | 400 Bad Request. Prisma parameterized queries prevent SQL injection. |
| **Status**          |                                                                      |
| **Actual Result**   |                                                                      |

### SEC-023: XSS prevention in stored data

| Field               | Value                                                                                |
| ------------------- | ------------------------------------------------------------------------------------ |
| **Priority**        | P0                                                                                   |
| **Preconditions**   | Logged in                                                                            |
| **Steps**           | 1. Create load with `cargoDescription: "<script>alert('xss')</script>"` 2. View load |
| **Expected Result** | Script tags escaped/sanitized in output. No script execution.                        |
| **Status**          |                                                                                      |
| **Actual Result**   |                                                                                      |

### SEC-024: File upload type validation

| Field               | Value                                                            |
| ------------------- | ---------------------------------------------------------------- |
| **Priority**        | P1                                                               |
| **Preconditions**   | None                                                             |
| **Steps**           | 1. Upload `.exe` file disguised as `.pdf` (wrong MIME type)      |
| **Expected Result** | Rejected. Server validates actual MIME type, not just extension. |
| **Status**          |                                                                  |
| **Actual Result**   |                                                                  |

### SEC-025: Request body size limits

| Field               | Value                                                    |
| ------------------- | -------------------------------------------------------- |
| **Priority**        | P2                                                       |
| **Preconditions**   | None                                                     |
| **Steps**           | 1. Send extremely large JSON body (>1MB) to any endpoint |
| **Expected Result** | 413 Payload Too Large.                                   |
| **Status**          |                                                          |
| **Actual Result**   |                                                          |

### SEC-026: Path traversal prevention

| Field               | Value                                                       |
| ------------------- | ----------------------------------------------------------- |
| **Priority**        | P1                                                          |
| **Preconditions**   | None                                                        |
| **Steps**           | 1. `GET /api/uploads/../../etc/passwd`                      |
| **Expected Result** | 404 or 400. No file system access outside upload directory. |
| **Status**          |                                                             |
| **Actual Result**   |                                                             |

### SEC-027: Integer overflow in financial amounts

| Field               | Value                                                               |
| ------------------- | ------------------------------------------------------------------- |
| **Priority**        | P2                                                                  |
| **Preconditions**   | Admin role                                                          |
| **Steps**           | 1. Top-up wallet with `{ amount: 99999999999999 }`                  |
| **Expected Result** | Validation error or capped by Decimal(12,2) precision. No overflow. |
| **Status**          |                                                                     |
| **Actual Result**   |                                                                     |

---

## E. Middleware & Route Protection (SEC-028 to SEC-033)

### SEC-028: Verification status enforcement

| Field               | Value                                                                         |
| ------------------- | ----------------------------------------------------------------------------- |
| **Priority**        | P1                                                                            |
| **Preconditions**   | User with status `REGISTERED` (unverified)                                    |
| **Steps**           | 1. Login as unverified user 2. Try to access marketplace features             |
| **Expected Result** | Redirected to verification-pending page. Cannot access load/truck operations. |
| **Status**          |                                                                               |
| **Actual Result**   |                                                                               |

### SEC-029: Suspended user blocked

| Field               | Value                                                 |
| ------------------- | ----------------------------------------------------- |
| **Priority**        | P1                                                    |
| **Preconditions**   | SUSPENDED user                                        |
| **Steps**           | 1. Login as suspended user 2. Access any API endpoint |
| **Expected Result** | 403 Forbidden. Account suspended.                     |
| **Status**          |                                                       |
| **Actual Result**   |                                                       |

### SEC-030: Role-based page routing

| Field               | Value                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| **Priority**        | P1                                                                        |
| **Preconditions**   | Logged in user                                                            |
| **Steps**           | 1. Shipper navigates to `/carrier/*` 2. Carrier navigates to `/shipper/*` |
| **Expected Result** | Redirected to own role's dashboard or unauthorized page.                  |
| **Status**          |                                                                           |
| **Actual Result**   |                                                                           |

### SEC-031: Public routes accessible without auth

| Field               | Value                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| **Priority**        | P2                                                                      |
| **Preconditions**   | Not logged in                                                           |
| **Steps**           | 1. `GET /api/health` 2. `GET /api/tracking/{id}` 3. Visit `/login` page |
| **Expected Result** | All succeed without authentication.                                     |
| **Status**          |                                                                         |
| **Actual Result**   |                                                                         |

### SEC-032: API versioning and unknown routes

| Field               | Value                                                      |
| ------------------- | ---------------------------------------------------------- |
| **Priority**        | P3                                                         |
| **Preconditions**   | None                                                       |
| **Steps**           | 1. `GET /api/nonexistent-endpoint`                         |
| **Expected Result** | 404 Not Found. No stack trace or internal details exposed. |
| **Status**          |                                                            |
| **Actual Result**   |                                                            |

### SEC-033: Sensitive data not leaked in errors

| Field               | Value                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P2                                                                                                            |
| **Preconditions**   | None                                                                                                          |
| **Steps**           | 1. Trigger various errors (invalid JSON, missing params, server errors)                                       |
| **Expected Result** | Error responses contain user-friendly messages. No stack traces, DB queries, or internal paths in production. |
| **Status**          |                                                                                                               |
| **Actual Result**   |                                                                                                               |

---

## F. Rate Limiting (SEC-034 to SEC-036)

### SEC-034: Auth endpoint rate limiting

| Field               | Value                                                             |
| ------------------- | ----------------------------------------------------------------- |
| **Priority**        | P1                                                                |
| **Preconditions**   | None                                                              |
| **Steps**           | 1. Exceed `rateLimitAuthAttempts` (5) failed logins in 15 minutes |
| **Expected Result** | 429 Too Many Requests after limit exceeded.                       |
| **Status**          |                                                                   |
| **Actual Result**   |                                                                   |

### SEC-035: Document upload rate limiting

| Field               | Value                                                     |
| ------------------- | --------------------------------------------------------- |
| **Priority**        | P2                                                        |
| **Preconditions**   | Logged in                                                 |
| **Steps**           | 1. Exceed `rateLimitDocumentUpload` (10) uploads per hour |
| **Expected Result** | 429 after 10th upload.                                    |
| **Status**          |                                                           |
| **Actual Result**   |                                                           |

### SEC-036: File download rate limiting

| Field               | Value                                                      |
| ------------------- | ---------------------------------------------------------- |
| **Priority**        | P3                                                         |
| **Preconditions**   | Logged in                                                  |
| **Steps**           | 1. Exceed `rateLimitFileDownload` (100) downloads per hour |
| **Expected Result** | 429 after 100th download.                                  |
| **Status**          |                                                            |
| **Actual Result**   |                                                            |
