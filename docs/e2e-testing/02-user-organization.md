# 02 - User & Organization Lifecycle (USER-xxx)

> **Total Tests:** 22
> **Priority Breakdown:** P0: 4 | P1: 10 | P2: 6 | P3: 2
> **API Endpoints:** `/api/user/*`, `/api/organizations/*`, `/api/admin/users/*`
> **Source Files:** `app/api/user/*/route.ts`, `app/api/organizations/*/route.ts`

---

## A. User Profile (USER-001 to USER-006)

### USER-001: View own profile

| Field               | Value                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                           |
| **Preconditions**   | Logged in as any role                                                                        |
| **Steps**           | 1. `GET /api/user/profile`                                                                   |
| **Expected Result** | 200 OK. Returns `firstName`, `lastName`, `email`, `phone`, `role`, `status`, `organization`. |
| **Status**          |                                                                                              |
| **Actual Result**   |                                                                                              |

### USER-002: Update profile (name)

| Field               | Value                                                                        |
| ------------------- | ---------------------------------------------------------------------------- |
| **Priority**        | P1                                                                           |
| **Preconditions**   | Logged in user                                                               |
| **Steps**           | 1. `PUT /api/user/profile` with `{ firstName: "Updated", lastName: "Name" }` |
| **Expected Result** | 200 OK. Name updated. SecurityEvent `PROFILE_UPDATE` created.                |
| **Status**          |                                                                              |
| **Actual Result**   |                                                                              |

### USER-003: Change password

| Field               | Value                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------ |
| **Priority**        | P0                                                                                         |
| **Preconditions**   | Logged in user, knows current password                                                     |
| **Steps**           | 1. `POST /api/user/change-password` with `{ currentPassword, newPassword }`                |
| **Expected Result** | 200 OK. Password hash updated. SecurityEvent `PASSWORD_CHANGE`. Old sessions remain valid. |
| **Status**          |                                                                                            |
| **Actual Result**   |                                                                                            |

### USER-004: Change password with wrong current password

| Field               | Value                                                            |
| ------------------- | ---------------------------------------------------------------- |
| **Priority**        | P1                                                               |
| **Preconditions**   | Logged in user                                                   |
| **Steps**           | 1. `POST /api/user/change-password` with wrong `currentPassword` |
| **Expected Result** | 400 Bad Request. Current password incorrect error.               |
| **Status**          |                                                                  |
| **Actual Result**   |                                                                  |

### USER-005: View security events

| Field               | Value                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------- |
| **Priority**        | P2                                                                                       |
| **Preconditions**   | Logged in user with security history                                                     |
| **Steps**           | 1. `GET /api/user/security-events`                                                       |
| **Expected Result** | 200 OK. List of events: `LOGIN_SUCCESS`, `PASSWORD_CHANGE`, etc. with timestamps and IP. |
| **Status**          |                                                                                          |
| **Actual Result**   |                                                                                          |

### USER-006: Update notification preferences

| Field               | Value                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------ |
| **Priority**        | P2                                                                                         |
| **Preconditions**   | Logged in user                                                                             |
| **Steps**           | 1. `PUT /api/user/notification-preferences` with `{ email: true, push: false, sms: true }` |
| **Expected Result** | 200 OK. User `notificationPreferences` JSON updated.                                       |
| **Status**          |                                                                                            |
| **Actual Result**   |                                                                                            |

---

## B. Organization CRUD (USER-007 to USER-012)

### USER-007: Create organization

| Field               | Value                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                            |
| **Preconditions**   | Logged in user without organization                                                           |
| **Steps**           | 1. `POST /api/organizations` with `{ name, type: "SHIPPER", contactEmail, contactPhone }`     |
| **Expected Result** | 201 Created. Organization created with `isVerified: false`. User linked via `organizationId`. |
| **Status**          |                                                                                               |
| **Actual Result**   |                                                                                               |

### USER-008: View own organization

| Field               | Value                                                                               |
| ------------------- | ----------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                  |
| **Preconditions**   | User belongs to an organization                                                     |
| **Steps**           | 1. `GET /api/organizations/me`                                                      |
| **Expected Result** | 200 OK. Returns org with `name`, `type`, `isVerified`, `completionRate`, `members`. |
| **Status**          |                                                                                     |
| **Actual Result**   |                                                                                     |

### USER-009: Update organization details

| Field               | Value                                                                  |
| ------------------- | ---------------------------------------------------------------------- |
| **Priority**        | P1                                                                     |
| **Preconditions**   | User is org member                                                     |
| **Steps**           | 1. `PUT /api/organizations/{id}` with updated `address`, `description` |
| **Expected Result** | 200 OK. Organization fields updated.                                   |
| **Status**          |                                                                        |
| **Actual Result**   |                                                                        |

### USER-010: View organization by ID

| Field               | Value                                                                              |
| ------------------- | ---------------------------------------------------------------------------------- |
| **Priority**        | P2                                                                                 |
| **Preconditions**   | Organization exists                                                                |
| **Steps**           | 1. `GET /api/organizations/{id}`                                                   |
| **Expected Result** | 200 OK. Public org info returned. Sensitive fields excluded for non-admin callers. |
| **Status**          |                                                                                    |
| **Actual Result**   |                                                                                    |

### USER-011: List organizations (admin)

| Field               | Value                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| **Priority**        | P1                                                                    |
| **Preconditions**   | Logged in as admin                                                    |
| **Steps**           | 1. `GET /api/admin/organizations`                                     |
| **Expected Result** | 200 OK. Paginated list of all organizations with verification status. |
| **Status**          |                                                                       |
| **Actual Result**   |                                                                       |

### USER-012: Carrier with association membership

| Field               | Value                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------ |
| **Priority**        | P2                                                                                         |
| **Preconditions**   | CARRIER_ASSOCIATION org exists                                                             |
| **Steps**           | 1. Create CARRIER_INDIVIDUAL org with `associationId` set 2. `GET /api/organizations/{id}` |
| **Expected Result** | Carrier org shows `association` relation. Association org shows carrier in `members`.      |
| **Status**          |                                                                                            |
| **Actual Result**   |                                                                                            |

---

## C. Team Invitations (USER-013 to USER-017)

### USER-013: Send team invitation

| Field               | Value                                                                       |
| ------------------- | --------------------------------------------------------------------------- |
| **Priority**        | P1                                                                          |
| **Preconditions**   | User is org admin/owner                                                     |
| **Steps**           | 1. `POST /api/organizations/invitations` with `{ email, role }`             |
| **Expected Result** | 201 Created. Invitation record with `token`, `expiresAt`, status `PENDING`. |
| **Status**          |                                                                             |
| **Actual Result**   |                                                                             |

### USER-014: Accept invitation

| Field               | Value                                                                               |
| ------------------- | ----------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                  |
| **Preconditions**   | Valid pending invitation exists                                                     |
| **Steps**           | 1. `PUT /api/organizations/invitations/{id}` with `{ action: "accept" }`            |
| **Expected Result** | 200 OK. Invitation status `ACCEPTED`, `acceptedAt` set. User added to organization. |
| **Status**          |                                                                                     |
| **Actual Result**   |                                                                                     |

### USER-015: Cancel invitation

| Field               | Value                                                                    |
| ------------------- | ------------------------------------------------------------------------ |
| **Priority**        | P2                                                                       |
| **Preconditions**   | Pending invitation exists                                                |
| **Steps**           | 1. `PUT /api/organizations/invitations/{id}` with `{ action: "cancel" }` |
| **Expected Result** | 200 OK. Invitation status `CANCELLED`.                                   |
| **Status**          |                                                                          |
| **Actual Result**   |                                                                          |

### USER-016: Accept expired invitation

| Field               | Value                                      |
| ------------------- | ------------------------------------------ |
| **Priority**        | P2                                         |
| **Preconditions**   | Invitation past `expiresAt`                |
| **Steps**           | 1. Attempt to accept expired invitation    |
| **Expected Result** | 400 Bad Request. Invitation expired error. |
| **Status**          |                                            |
| **Actual Result**   |                                            |

### USER-017: Remove team member

| Field               | Value                                                             |
| ------------------- | ----------------------------------------------------------------- |
| **Priority**        | P1                                                                |
| **Preconditions**   | Organization has multiple members                                 |
| **Steps**           | 1. `DELETE /api/organizations/members/{id}`                       |
| **Expected Result** | 200 OK. User `organizationId` set to null. User removed from org. |
| **Status**          |                                                                   |
| **Actual Result**   |                                                                   |

---

## D. User Status Transitions (USER-018 to USER-022)

### USER-018: Admin activates user

| Field               | Value                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| **Priority**        | P0                                                                      |
| **Preconditions**   | Admin logged in, PENDING_VERIFICATION user exists                       |
| **Steps**           | 1. `PUT /api/admin/users/{id}` with `{ status: "ACTIVE" }`              |
| **Expected Result** | 200 OK. User status → ACTIVE. User can now access marketplace features. |
| **Status**          |                                                                         |
| **Actual Result**   |                                                                         |

### USER-019: Admin suspends user

| Field               | Value                                                                    |
| ------------------- | ------------------------------------------------------------------------ |
| **Priority**        | P1                                                                       |
| **Preconditions**   | Admin logged in, active user exists                                      |
| **Steps**           | 1. `PUT /api/admin/users/{id}` with `{ status: "SUSPENDED" }`            |
| **Expected Result** | 200 OK. User status → SUSPENDED. User's subsequent API calls return 403. |
| **Status**          |                                                                          |
| **Actual Result**   |                                                                          |

### USER-020: Admin rejects user

| Field               | Value                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                             |
| **Preconditions**   | Admin logged in, PENDING_VERIFICATION user                                                     |
| **Steps**           | 1. `PUT /api/admin/users/{id}/verify` with `{ action: "reject", reason: "Invalid documents" }` |
| **Expected Result** | 200 OK. User status → REJECTED. Rejection reason stored.                                       |
| **Status**          |                                                                                                |
| **Actual Result**   |                                                                                                |

### USER-021: Admin changes user phone

| Field               | Value                                                                          |
| ------------------- | ------------------------------------------------------------------------------ |
| **Priority**        | P2                                                                             |
| **Preconditions**   | Admin logged in                                                                |
| **Steps**           | 1. `PUT /api/admin/users/{id}` with `{ phone: "+251911111111" }`               |
| **Expected Result** | 200 OK. Phone updated. Only admin/super_admin can change phone (users cannot). |
| **Status**          |                                                                                |
| **Actual Result**   |                                                                                |

### USER-022: Admin creates operational user

| Field               | Value                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                             |
| **Preconditions**   | Logged in as admin                                                                             |
| **Steps**           | 1. `POST /api/admin/users` with `{ email, password, role: "DISPATCHER", firstName, lastName }` |
| **Expected Result** | 201 Created. User created with specified role. Admin cannot create ADMIN or SUPER_ADMIN.       |
| **Status**          |                                                                                                |
| **Actual Result**   |                                                                                                |
