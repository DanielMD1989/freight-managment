# 01 - Authentication & Sessions (AUTH-xxx)

> **Total Tests:** 34
> **Priority Breakdown:** P0: 8 | P1: 14 | P2: 8 | P3: 4
> **API Endpoints:** `/api/auth/*`, `/api/user/sessions/*`, `/api/user/mfa/*`
> **Source Files:** `app/api/auth/*/route.ts`, `lib/rbac/permissions.ts`

---

## A. Registration (AUTH-001 to AUTH-006)

### AUTH-001: Successful shipper registration

| Field               | Value                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                   |
| **Preconditions**   | No existing user with test email                                                                     |
| **Steps**           | 1. `POST /api/auth/register` with `{ email, password, firstName, lastName, role: "SHIPPER", phone }` |
| **Expected Result** | 201 Created. User created with status `REGISTERED`, role `SHIPPER`. JWT token returned.              |
| **Status**          |                                                                                                      |
| **Actual Result**   |                                                                                                      |

### AUTH-002: Successful carrier registration

| Field               | Value                                                               |
| ------------------- | ------------------------------------------------------------------- |
| **Priority**        | P0                                                                  |
| **Preconditions**   | No existing user with test email                                    |
| **Steps**           | 1. `POST /api/auth/register` with `{ role: "CARRIER" }`             |
| **Expected Result** | 201 Created. User created with status `REGISTERED`, role `CARRIER`. |
| **Status**          |                                                                     |
| **Actual Result**   |                                                                     |

### AUTH-003: Registration with duplicate email

| Field               | Value                                                       |
| ------------------- | ----------------------------------------------------------- |
| **Priority**        | P1                                                          |
| **Preconditions**   | User `shipper@test.com` exists                              |
| **Steps**           | 1. `POST /api/auth/register` with existing email            |
| **Expected Result** | 409 Conflict. Error message indicates email already in use. |
| **Status**          |                                                             |
| **Actual Result**   |                                                             |

### AUTH-004: Registration with weak password

| Field               | Value                                                |
| ------------------- | ---------------------------------------------------- |
| **Priority**        | P1                                                   |
| **Preconditions**   | None                                                 |
| **Steps**           | 1. `POST /api/auth/register` with password `123`     |
| **Expected Result** | 400 Bad Request. Password validation error returned. |
| **Status**          |                                                      |
| **Actual Result**   |                                                      |

### AUTH-005: Registration with invalid email format

| Field               | Value                                                  |
| ------------------- | ------------------------------------------------------ |
| **Priority**        | P2                                                     |
| **Preconditions**   | None                                                   |
| **Steps**           | 1. `POST /api/auth/register` with email `not-an-email` |
| **Expected Result** | 400 Bad Request. Email validation error.               |
| **Status**          |                                                        |
| **Actual Result**   |                                                        |

### AUTH-006: Registration with missing required fields

| Field               | Value                                                       |
| ------------------- | ----------------------------------------------------------- |
| **Priority**        | P2                                                          |
| **Preconditions**   | None                                                        |
| **Steps**           | 1. `POST /api/auth/register` with empty body `{}`           |
| **Expected Result** | 400 Bad Request. Validation errors for all required fields. |
| **Status**          |                                                             |
| **Actual Result**   |                                                             |

---

## B. Login (AUTH-007 to AUTH-014)

### AUTH-007: Successful login with email/password

| Field               | Value                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                        |
| **Preconditions**   | Active user `shipper@test.com` exists                                                     |
| **Steps**           | 1. `POST /api/auth/login` with `{ email: "shipper@test.com", password: "Test123!" }`      |
| **Expected Result** | 200 OK. JWT token returned. `lastLoginAt` updated. SecurityEvent `LOGIN_SUCCESS` created. |
| **Status**          |                                                                                           |
| **Actual Result**   |                                                                                           |

### AUTH-008: Login with wrong password

| Field               | Value                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                             |
| **Preconditions**   | Active user exists                                                                             |
| **Steps**           | 1. `POST /api/auth/login` with wrong password                                                  |
| **Expected Result** | 401 Unauthorized. SecurityEvent `LOGIN_FAILURE` created. Generic error message (no info leak). |
| **Status**          |                                                                                                |
| **Actual Result**   |                                                                                                |

### AUTH-009: Login with non-existent email

| Field               | Value                                                                         |
| ------------------- | ----------------------------------------------------------------------------- |
| **Priority**        | P1                                                                            |
| **Preconditions**   | None                                                                          |
| **Steps**           | 1. `POST /api/auth/login` with `{ email: "nonexistent@test.com" }`            |
| **Expected Result** | 401 Unauthorized. Same error message as wrong password (no user enumeration). |
| **Status**          |                                                                               |
| **Actual Result**   |                                                                               |

### AUTH-010: Login as suspended user

| Field               | Value                                                     |
| ------------------- | --------------------------------------------------------- |
| **Priority**        | P1                                                        |
| **Preconditions**   | User with status `SUSPENDED` exists                       |
| **Steps**           | 1. `POST /api/auth/login` with suspended user credentials |
| **Expected Result** | 403 Forbidden. Error indicates account is suspended.      |
| **Status**          |                                                           |
| **Actual Result**   |                                                           |

### AUTH-011: Login as rejected user

| Field               | Value                                                    |
| ------------------- | -------------------------------------------------------- |
| **Priority**        | P1                                                       |
| **Preconditions**   | User with status `REJECTED` exists                       |
| **Steps**           | 1. `POST /api/auth/login` with rejected user credentials |
| **Expected Result** | 403 Forbidden. Error indicates account was rejected.     |
| **Status**          |                                                          |
| **Actual Result**   |                                                          |

### AUTH-012: Login sets session cookie correctly

| Field               | Value                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                                |
| **Preconditions**   | Active user exists                                                                                |
| **Steps**           | 1. `POST /api/auth/login` 2. Inspect `Set-Cookie` header                                          |
| **Expected Result** | Session cookie set with `HttpOnly`, `Secure`, `SameSite=Lax` flags. Session record created in DB. |
| **Status**          |                                                                                                   |
| **Actual Result**   |                                                                                                   |

### AUTH-013: Login creates server-side session

| Field               | Value                                                                          |
| ------------------- | ------------------------------------------------------------------------------ |
| **Priority**        | P1                                                                             |
| **Preconditions**   | Active user exists                                                             |
| **Steps**           | 1. `POST /api/auth/login` 2. Query `Session` table for user                    |
| **Expected Result** | Session record with `tokenHash`, `ipAddress`, `userAgent`, `expiresAt` exists. |
| **Status**          |                                                                                |
| **Actual Result**   |                                                                                |

### AUTH-014: Concurrent login creates multiple sessions

| Field               | Value                                                                       |
| ------------------- | --------------------------------------------------------------------------- |
| **Priority**        | P2                                                                          |
| **Preconditions**   | Active user exists                                                          |
| **Steps**           | 1. Login from browser A 2. Login from browser B 3. `GET /api/user/sessions` |
| **Expected Result** | Both sessions listed as active.                                             |
| **Status**          |                                                                             |
| **Actual Result**   |                                                                             |

---

## C. Current User (AUTH-015 to AUTH-017)

### AUTH-015: Get current user profile

| Field               | Value                                                                             |
| ------------------- | --------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                |
| **Preconditions**   | Logged in as shipper                                                              |
| **Steps**           | 1. `GET /api/auth/me` with valid JWT                                              |
| **Expected Result** | 200 OK. Returns user object with `id`, `email`, `role`, `status`, `organization`. |
| **Status**          |                                                                                   |
| **Actual Result**   |                                                                                   |

### AUTH-016: Get current user without token

| Field               | Value                                              |
| ------------------- | -------------------------------------------------- |
| **Priority**        | P0                                                 |
| **Preconditions**   | None                                               |
| **Steps**           | 1. `GET /api/auth/me` without Authorization header |
| **Expected Result** | 401 Unauthorized.                                  |
| **Status**          |                                                    |
| **Actual Result**   |                                                    |

### AUTH-017: Get current user with expired token

| Field               | Value                                  |
| ------------------- | -------------------------------------- |
| **Priority**        | P1                                     |
| **Preconditions**   | JWT token that has expired             |
| **Steps**           | 1. `GET /api/auth/me` with expired JWT |
| **Expected Result** | 401 Unauthorized. Token expired error. |
| **Status**          |                                        |
| **Actual Result**   |                                        |

---

## D. Logout (AUTH-018 to AUTH-019)

### AUTH-018: Successful logout

| Field               | Value                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------ |
| **Priority**        | P0                                                                                         |
| **Preconditions**   | Logged in user with active session                                                         |
| **Steps**           | 1. `POST /api/auth/logout` with valid JWT                                                  |
| **Expected Result** | 200 OK. Session revoked (`revokedAt` set). Cookie cleared. SecurityEvent `LOGOUT` created. |
| **Status**          |                                                                                            |
| **Actual Result**   |                                                                                            |

### AUTH-019: Subsequent requests after logout fail

| Field               | Value                                                            |
| ------------------- | ---------------------------------------------------------------- |
| **Priority**        | P1                                                               |
| **Preconditions**   | Just logged out                                                  |
| **Steps**           | 1. `POST /api/auth/logout` 2. `GET /api/auth/me` with same token |
| **Expected Result** | 401 Unauthorized. Session is revoked.                            |
| **Status**          |                                                                  |
| **Actual Result**   |                                                                  |

---

## E. Password Reset (AUTH-020 to AUTH-024)

### AUTH-020: Request password reset OTP

| Field               | Value                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| **Priority**        | P1                                                                        |
| **Preconditions**   | Active user exists                                                        |
| **Steps**           | 1. `POST /api/auth/forgot-password` with `{ email: "shipper@test.com" }`  |
| **Expected Result** | 200 OK. PasswordResetToken created with bcrypt-hashed OTP and expiration. |
| **Status**          |                                                                           |
| **Actual Result**   |                                                                           |

### AUTH-021: Reset password with valid OTP

| Field               | Value                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                      |
| **Preconditions**   | OTP token generated and not expired                                                     |
| **Steps**           | 1. `POST /api/auth/reset-password` with `{ email, otp, newPassword }`                   |
| **Expected Result** | 200 OK. Password updated. Token marked as used. SecurityEvent `PASSWORD_RESET` created. |
| **Status**          |                                                                                         |
| **Actual Result**   |                                                                                         |

### AUTH-022: Reset password with expired OTP

| Field               | Value                                               |
| ------------------- | --------------------------------------------------- |
| **Priority**        | P2                                                  |
| **Preconditions**   | OTP token exists but past `expiresAt`               |
| **Steps**           | 1. `POST /api/auth/reset-password` with expired OTP |
| **Expected Result** | 400 Bad Request. OTP expired error.                 |
| **Status**          |                                                     |
| **Actual Result**   |                                                     |

### AUTH-023: Reset password with wrong OTP

| Field               | Value                                                    |
| ------------------- | -------------------------------------------------------- |
| **Priority**        | P2                                                       |
| **Preconditions**   | Valid OTP token exists                                   |
| **Steps**           | 1. `POST /api/auth/reset-password` with wrong OTP        |
| **Expected Result** | 400 Bad Request. `attempts` incremented on token record. |
| **Status**          |                                                          |
| **Actual Result**   |                                                          |

### AUTH-024: Brute force OTP protection

| Field               | Value                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                    |
| **Preconditions**   | Valid OTP token exists                                                                |
| **Steps**           | 1. Submit wrong OTP 5+ times in succession                                            |
| **Expected Result** | Token locked after max attempts. Further attempts rejected regardless of correctness. |
| **Status**          |                                                                                       |
| **Actual Result**   |                                                                                       |

---

## F. MFA (AUTH-025 to AUTH-030)

### AUTH-025: Enable MFA

| Field               | Value                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                              |
| **Preconditions**   | Logged in active user, MFA not enabled                                                          |
| **Steps**           | 1. `POST /api/user/mfa/enable` with `{ phone }`                                                 |
| **Expected Result** | 200 OK. UserMFA record created with `enabled: false` (pending verification). OTP sent to phone. |
| **Status**          |                                                                                                 |
| **Actual Result**   |                                                                                                 |

### AUTH-026: Verify MFA setup

| Field               | Value                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                                  |
| **Preconditions**   | MFA enable initiated                                                                                |
| **Steps**           | 1. `POST /api/user/mfa/verify` with correct OTP                                                     |
| **Expected Result** | 200 OK. UserMFA `enabled: true`. Recovery codes generated and returned. SecurityEvent `MFA_ENABLE`. |
| **Status**          |                                                                                                     |
| **Actual Result**   |                                                                                                     |

### AUTH-027: Login with MFA enabled

| Field               | Value                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                       |
| **Preconditions**   | User with MFA enabled                                                                                    |
| **Steps**           | 1. `POST /api/auth/login` 2. Response indicates MFA required 3. `POST /api/auth/verify-mfa` with OTP     |
| **Expected Result** | Step 1: Partial auth (MFA challenge). Step 3: Full JWT token issued. SecurityEvent `MFA_VERIFY_SUCCESS`. |
| **Status**          |                                                                                                          |
| **Actual Result**   |                                                                                                          |

### AUTH-028: Login with MFA - wrong OTP

| Field               | Value                                                               |
| ------------------- | ------------------------------------------------------------------- |
| **Priority**        | P1                                                                  |
| **Preconditions**   | User with MFA enabled                                               |
| **Steps**           | 1. Login successfully 2. `POST /api/auth/verify-mfa` with wrong OTP |
| **Expected Result** | 401 Unauthorized. SecurityEvent `MFA_VERIFY_FAILURE`.               |
| **Status**          |                                                                     |
| **Actual Result**   |                                                                     |

### AUTH-029: Use recovery code for MFA

| Field               | Value                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                                        |
| **Preconditions**   | MFA enabled, recovery codes generated                                                                     |
| **Steps**           | 1. Login 2. `POST /api/auth/verify-mfa` with recovery code                                                |
| **Expected Result** | 200 OK. Recovery code consumed. `recoveryCodesUsedCount` incremented. SecurityEvent `RECOVERY_CODE_USED`. |
| **Status**          |                                                                                                           |
| **Actual Result**   |                                                                                                           |

### AUTH-030: Disable MFA

| Field               | Value                                                          |
| ------------------- | -------------------------------------------------------------- |
| **Priority**        | P2                                                             |
| **Preconditions**   | MFA enabled for user                                           |
| **Steps**           | 1. `POST /api/user/mfa/disable`                                |
| **Expected Result** | 200 OK. UserMFA `enabled: false`. SecurityEvent `MFA_DISABLE`. |
| **Status**          |                                                                |
| **Actual Result**   |                                                                |

---

## G. Session Management (AUTH-031 to AUTH-034)

### AUTH-031: List active sessions

| Field               | Value                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------ |
| **Priority**        | P1                                                                                         |
| **Preconditions**   | User logged in from multiple devices                                                       |
| **Steps**           | 1. `GET /api/user/sessions`                                                                |
| **Expected Result** | 200 OK. Array of sessions with `id`, `deviceInfo`, `ipAddress`, `lastSeenAt`, `createdAt`. |
| **Status**          |                                                                                            |
| **Actual Result**   |                                                                                            |

### AUTH-032: Revoke single session

| Field               | Value                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                                 |
| **Preconditions**   | Multiple active sessions                                                                           |
| **Steps**           | 1. `DELETE /api/user/sessions/{id}`                                                                |
| **Expected Result** | 200 OK. Target session `revokedAt` set. Other sessions unaffected. SecurityEvent `SESSION_REVOKE`. |
| **Status**          |                                                                                                    |
| **Actual Result**   |                                                                                                    |

### AUTH-033: Revoke all other sessions

| Field               | Value                                                                                |
| ------------------- | ------------------------------------------------------------------------------------ |
| **Priority**        | P2                                                                                   |
| **Preconditions**   | Multiple active sessions                                                             |
| **Steps**           | 1. `POST /api/user/sessions/revoke-all`                                              |
| **Expected Result** | 200 OK. All sessions except current one revoked. SecurityEvent `SESSION_REVOKE_ALL`. |
| **Status**          |                                                                                      |
| **Actual Result**   |                                                                                      |

### AUTH-034: Session expiry enforcement

| Field               | Value                                                    |
| ------------------- | -------------------------------------------------------- |
| **Priority**        | P3                                                       |
| **Preconditions**   | Session with past `expiresAt`                            |
| **Steps**           | 1. Use token from expired session for `GET /api/auth/me` |
| **Expected Result** | 401 Unauthorized. Expired session rejected.              |
| **Status**          |                                                          |
| **Actual Result**   |                                                          |
