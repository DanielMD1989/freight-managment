# 11 - Admin Panel (ADMIN-xxx)

> **Total Tests:** 30
> **Priority Breakdown:** P0: 6 | P1: 12 | P2: 10 | P3: 2
> **API Endpoints:** `/api/admin/*`
> **Web Pages:** 25 admin pages under `/admin/*`

---

## Admin Pages Reference (25 pages)

| #   | Page              | Path                                 |
| --- | ----------------- | ------------------------------------ |
| 1   | Admin Home        | `/admin`                             |
| 2   | Users             | `/admin/users`                       |
| 3   | User Detail       | `/admin/users/[id]`                  |
| 4   | Organizations     | `/admin/organizations`               |
| 5   | Loads             | `/admin/loads`                       |
| 6   | Trucks            | `/admin/trucks`                      |
| 7   | Pending Trucks    | `/admin/trucks/pending`              |
| 8   | Trips             | `/admin/trips`                       |
| 9   | Audit Logs        | `/admin/audit-logs`                  |
| 10  | Analytics         | `/admin/analytics`                   |
| 11  | Map               | `/admin/map`                         |
| 12  | GPS               | `/admin/gps`                         |
| 13  | Corridors         | `/admin/corridors`                   |
| 14  | Settlement        | `/admin/settlement`                  |
| 15  | Settlement Review | `/admin/settlement/review`           |
| 16  | Automation Rules  | `/admin/settlement/automation-rules` |
| 17  | Wallets           | `/admin/wallets`                     |
| 18  | Service Fees      | `/admin/service-fees`                |
| 19  | Verification      | `/admin/verification`                |
| 20  | Settings          | `/admin/settings`                    |
| 21  | Security          | `/admin/security`                    |
| 22  | Feature Flags     | `/admin/feature-flags`               |
| 23  | Health            | `/admin/health`                      |
| 24  | Platform Metrics  | `/admin/platform-metrics`            |
| 25  | Bypass Review     | `/admin/bypass-review`               |

---

## A. Admin Dashboard & Pages (ADMIN-001 to ADMIN-008)

### ADMIN-001: Admin dashboard loads

| Field               | Value                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                 |
| **Preconditions**   | Logged in as admin                                                                                 |
| **Steps**           | 1. `GET /api/admin/dashboard`                                                                      |
| **Expected Result** | 200 OK. Summary metrics: total users, loads, trucks, active trips, pending verifications, revenue. |
| **Status**          |                                                                                                    |
| **Actual Result**   |                                                                                                    |

### ADMIN-002: All 25 admin pages accessible

| Field               | Value                                                   |
| ------------------- | ------------------------------------------------------- |
| **Priority**        | P0                                                      |
| **Preconditions**   | Logged in as admin                                      |
| **Steps**           | 1. Navigate to each of the 25 admin pages listed above  |
| **Expected Result** | All pages render without error. No 404s or blank pages. |
| **Status**          |                                                         |
| **Actual Result**   |                                                         |

### ADMIN-003: Admin pages blocked for non-admin

| Field               | Value                                   |
| ------------------- | --------------------------------------- |
| **Priority**        | P0                                      |
| **Preconditions**   | Logged in as shipper                    |
| **Steps**           | 1. Navigate to `/admin/dashboard`       |
| **Expected Result** | Redirected to unauthorized page or 403. |
| **Status**          |                                         |
| **Actual Result**   |                                         |

### ADMIN-004: Platform metrics page

| Field               | Value                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                            |
| **Preconditions**   | Admin logged in                                                                               |
| **Steps**           | 1. `GET /api/admin/platform-metrics`                                                          |
| **Expected Result** | 200 OK. Aggregated platform data: user counts by role, load counts by status, revenue totals. |
| **Status**          |                                                                                               |
| **Actual Result**   |                                                                                               |

### ADMIN-005: Analytics page

| Field               | Value                                                                              |
| ------------------- | ---------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                 |
| **Preconditions**   | Admin logged in                                                                    |
| **Steps**           | 1. `GET /api/admin/analytics`                                                      |
| **Expected Result** | 200 OK. Charts data: load volume trends, trip completion rates, revenue over time. |
| **Status**          |                                                                                    |
| **Actual Result**   |                                                                                    |

### ADMIN-006: Health check page

| Field               | Value                                                           |
| ------------------- | --------------------------------------------------------------- |
| **Priority**        | P1                                                              |
| **Preconditions**   | Admin logged in                                                 |
| **Steps**           | 1. Visit `/admin/health` and `GET /api/health`                  |
| **Expected Result** | System health: DB connection, Redis status, API response times. |
| **Status**          |                                                                 |
| **Actual Result**   |                                                                 |

### ADMIN-007: Admin map view

| Field               | Value                                                                          |
| ------------------- | ------------------------------------------------------------------------------ |
| **Priority**        | P2                                                                             |
| **Preconditions**   | Admin logged in, trucks with positions                                         |
| **Steps**           | 1. Visit `/admin/map`                                                          |
| **Expected Result** | Map displays all vehicles with current positions, trip routes, load locations. |
| **Status**          |                                                                                |
| **Actual Result**   |                                                                                |

### ADMIN-008: Admin GPS management

| Field               | Value                                                                            |
| ------------------- | -------------------------------------------------------------------------------- |
| **Priority**        | P2                                                                               |
| **Preconditions**   | Admin logged in                                                                  |
| **Steps**           | 1. Visit `/admin/gps`                                                            |
| **Expected Result** | List of all GPS devices, statuses, associated trucks. Ability to manage devices. |
| **Status**          |                                                                                  |
| **Actual Result**   |                                                                                  |

---

## B. User Management (ADMIN-009 to ADMIN-014)

### ADMIN-009: List all users

| Field               | Value                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                      |
| **Preconditions**   | Admin logged in                                                                                         |
| **Steps**           | 1. `GET /api/admin/users`                                                                               |
| **Expected Result** | 200 OK. Paginated user list with `role`, `status`, `email`, `organization`. Admin sees non-admin users. |
| **Status**          |                                                                                                         |
| **Actual Result**   |                                                                                                         |

### ADMIN-010: View user detail

| Field               | Value                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| **Priority**        | P1                                                                    |
| **Preconditions**   | Admin logged in                                                       |
| **Steps**           | 1. `GET /api/admin/users/{id}`                                        |
| **Expected Result** | 200 OK. Full user profile, organization, wallet, documents, activity. |
| **Status**          |                                                                       |
| **Actual Result**   |                                                                       |

### ADMIN-011: Admin cannot create admin users

| Field               | Value                                                   |
| ------------------- | ------------------------------------------------------- |
| **Priority**        | P1                                                      |
| **Preconditions**   | Admin (not super_admin) logged in                       |
| **Steps**           | 1. `POST /api/admin/users` with `{ role: "ADMIN" }`     |
| **Expected Result** | 403 Forbidden. Only SUPER_ADMIN can create ADMIN users. |
| **Status**          |                                                         |
| **Actual Result**   |                                                         |

### ADMIN-012: Super admin creates admin user

| Field               | Value                                                                        |
| ------------------- | ---------------------------------------------------------------------------- |
| **Priority**        | P1                                                                           |
| **Preconditions**   | Super admin logged in                                                        |
| **Steps**           | 1. `POST /api/admin/users` with `{ role: "ADMIN", email, password }`         |
| **Expected Result** | 201 Created. New admin user. Only super_admin has `CREATE_ADMIN` permission. |
| **Status**          |                                                                              |
| **Actual Result**   |                                                                              |

### ADMIN-013: Admin cannot delete admin users

| Field               | Value                                                 |
| ------------------- | ----------------------------------------------------- |
| **Priority**        | P1                                                    |
| **Preconditions**   | Admin logged in, another admin user exists            |
| **Steps**           | 1. `DELETE /api/admin/users/{adminId}`                |
| **Expected Result** | 403 Forbidden. Admin lacks `DELETE_ADMIN` permission. |
| **Status**          |                                                       |
| **Actual Result**   |                                                       |

### ADMIN-014: Activate test users (dev helper)

| Field               | Value                                              |
| ------------------- | -------------------------------------------------- |
| **Priority**        | P3                                                 |
| **Preconditions**   | Admin logged in, test env                          |
| **Steps**           | 1. `POST /api/admin/activate-test-users`           |
| **Expected Result** | 200 OK. Test users activated for testing purposes. |
| **Status**          |                                                    |
| **Actual Result**   |                                                    |

---

## C. Verification Queue (ADMIN-015 to ADMIN-018)

### ADMIN-015: Verification queue page

| Field               | Value                                                                             |
| ------------------- | --------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                |
| **Preconditions**   | Admin logged in, pending documents/orgs                                           |
| **Steps**           | 1. Visit `/admin/verification`                                                    |
| **Expected Result** | Queue shows pending items: company documents, truck documents, org verifications. |
| **Status**          |                                                                                   |
| **Actual Result**   |                                                                                   |

### ADMIN-016: Admin documents review

| Field               | Value                                                                |
| ------------------- | -------------------------------------------------------------------- |
| **Priority**        | P1                                                                   |
| **Preconditions**   | Admin logged in                                                      |
| **Steps**           | 1. `GET /api/admin/documents`                                        |
| **Expected Result** | 200 OK. All documents across organizations with verification status. |
| **Status**          |                                                                      |
| **Actual Result**   |                                                                      |

### ADMIN-017: Bypass review page

| Field               | Value                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------- |
| **Priority**        | P2                                                                                    |
| **Preconditions**   | Admin logged in, bypass warnings exist                                                |
| **Steps**           | 1. `GET /api/admin/bypass-warnings` 2. `GET /api/admin/bypass-warnings/organizations` |
| **Expected Result** | 200 OK. List of reported bypass attempts with organization details.                   |
| **Status**          |                                                                                       |
| **Actual Result**   |                                                                                       |

### ADMIN-018: Audit logs page

| Field               | Value                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                                   |
| **Preconditions**   | Admin logged in                                                                                      |
| **Steps**           | 1. `GET /api/admin/audit-logs` with optional filters: `eventType`, `severity`, `userId`, `dateRange` |
| **Expected Result** | 200 OK. Paginated audit logs with event type, user, action, result, timestamp.                       |
| **Status**          |                                                                                                      |
| **Actual Result**   |                                                                                                      |

---

## D. Financial Admin (ADMIN-019 to ADMIN-024)

### ADMIN-019: Corridors management page

| Field               | Value                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                       |
| **Preconditions**   | Admin logged in                                                                          |
| **Steps**           | 1. Visit `/admin/corridors`                                                              |
| **Expected Result** | List of corridors with pricing (shipper+carrier), promo flags, distance. CRUD available. |
| **Status**          |                                                                                          |
| **Actual Result**   |                                                                                          |

### ADMIN-020: Wallets overview

| Field               | Value                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| **Priority**        | P1                                                                                               |
| **Preconditions**   | Admin logged in                                                                                  |
| **Steps**           | 1. Visit `/admin/wallets`                                                                        |
| **Expected Result** | All financial accounts: shipper wallets, carrier wallets, platform revenue. Balances and status. |
| **Status**          |                                                                                                  |
| **Actual Result**   |                                                                                                  |

### ADMIN-021: Settlement page

| Field               | Value                                                                    |
| ------------------- | ------------------------------------------------------------------------ |
| **Priority**        | P1                                                                       |
| **Preconditions**   | Admin logged in                                                          |
| **Steps**           | 1. `GET /api/admin/settlements`                                          |
| **Expected Result** | 200 OK. Pending withdrawals, settlement history, auto-settlement status. |
| **Status**          |                                                                          |
| **Actual Result**   |                                                                          |

### ADMIN-022: Service fees page

| Field               | Value                                                               |
| ------------------- | ------------------------------------------------------------------- |
| **Priority**        | P2                                                                  |
| **Preconditions**   | Admin logged in                                                     |
| **Steps**           | 1. Visit `/admin/service-fees`                                      |
| **Expected Result** | Fee overview: total collected, breakdown by corridor, pending fees. |
| **Status**          |                                                                     |
| **Actual Result**   |                                                                     |

### ADMIN-023: Audit log stats

| Field               | Value                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| **Priority**        | P2                                                                        |
| **Preconditions**   | Admin logged in                                                           |
| **Steps**           | 1. `GET /api/admin/audit-logs/stats`                                      |
| **Expected Result** | 200 OK. Aggregated stats: events per type, severity distribution, trends. |
| **Status**          |                                                                           |
| **Actual Result**   |                                                                           |

### ADMIN-024: Settlement automation rules page

| Field               | Value                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| **Priority**        | P2                                                                    |
| **Preconditions**   | Admin logged in                                                       |
| **Steps**           | 1. Visit `/admin/settlement/automation-rules`                         |
| **Expected Result** | Automation rules configuration with enable/disable, timeout settings. |
| **Status**          |                                                                       |
| **Actual Result**   |                                                                       |

---

## E. System Configuration (ADMIN-025 to ADMIN-030)

### ADMIN-025: System settings

| Field               | Value                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                                            |
| **Preconditions**   | Admin logged in                                                                                               |
| **Steps**           | 1. `GET /api/admin/settings` 2. `PUT /api/admin/settings` with updated values                                 |
| **Expected Result** | 200 OK. All SystemSettings readable and updatable: rate limits, match thresholds, email toggles, file limits. |
| **Status**          |                                                                                                               |
| **Actual Result**   |                                                                                                               |

### ADMIN-026: Feature flags management

| Field               | Value                                                         |
| ------------------- | ------------------------------------------------------------- |
| **Priority**        | P1                                                            |
| **Preconditions**   | Admin logged in                                               |
| **Steps**           | 1. `GET /api/feature-flags` 2. `PUT /api/feature-flags/{key}` |
| **Expected Result** | 200 OK. Feature flags viewable and toggleable.                |
| **Status**          |                                                               |
| **Actual Result**   |                                                               |

### ADMIN-027: Security page

| Field               | Value                                                                          |
| ------------------- | ------------------------------------------------------------------------------ |
| **Priority**        | P2                                                                             |
| **Preconditions**   | Admin logged in                                                                |
| **Steps**           | 1. Visit `/admin/security`                                                     |
| **Expected Result** | Security overview: active sessions, recent security events, rate limit status. |
| **Status**          |                                                                                |
| **Actual Result**   |                                                                                |

### ADMIN-028: Config API

| Field               | Value                                                                       |
| ------------------- | --------------------------------------------------------------------------- |
| **Priority**        | P2                                                                          |
| **Preconditions**   | None                                                                        |
| **Steps**           | 1. `GET /api/config`                                                        |
| **Expected Result** | 200 OK. Public config (feature flags, public settings). No secrets exposed. |
| **Status**          |                                                                             |
| **Actual Result**   |                                                                             |

### ADMIN-029: Maintenance mode

| Field               | Value                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------- |
| **Priority**        | P2                                                                                     |
| **Preconditions**   | Admin logged in                                                                        |
| **Steps**           | 1. Enable `platformMaintenanceMode` via settings 2. Non-admin user tries to access API |
| **Expected Result** | Non-admin requests receive maintenance mode response. Admin still has access.          |
| **Status**          |                                                                                        |
| **Actual Result**   |                                                                                        |

### ADMIN-030: Super admin sees all users

| Field               | Value                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| **Priority**        | P1                                                                    |
| **Preconditions**   | Super admin logged in                                                 |
| **Steps**           | 1. `GET /api/admin/users` as super_admin                              |
| **Expected Result** | Returns ALL users including admins (has `VIEW_ALL_USERS` permission). |
| **Status**          |                                                                       |
| **Actual Result**   |                                                                       |
