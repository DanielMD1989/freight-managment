# 10 - Notifications (NOTIF-xxx)

> **Total Tests:** 12
> **Priority Breakdown:** P0: 2 | P1: 4 | P2: 4 | P3: 2
> **API Endpoints:** `/api/notifications/*`
> **Source Files:** `app/api/notifications/*/route.ts`

---

## A. Notification CRUD (NOTIF-001 to NOTIF-004)

### NOTIF-001: List notifications

| Field               | Value                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                                                |
| **Preconditions**   | Logged in user with notifications                                                                                                 |
| **Steps**           | 1. `GET /api/notifications`                                                                                                       |
| **Expected Result** | 200 OK. Paginated list of notifications: `type`, `title`, `message`, `read`, `createdAt`, `metadata`. Sorted by `createdAt` desc. |
| **Status**          |                                                                                                                                   |
| **Actual Result**   |                                                                                                                                   |

### NOTIF-002: Mark notification as read

| Field               | Value                                 |
| ------------------- | ------------------------------------- |
| **Priority**        | P0                                    |
| **Preconditions**   | Unread notification exists            |
| **Steps**           | 1. `PUT /api/notifications/{id}/read` |
| **Expected Result** | 200 OK. Notification `read: true`.    |
| **Status**          |                                       |
| **Actual Result**   |                                       |

### NOTIF-003: Mark all notifications as read

| Field               | Value                                                 |
| ------------------- | ----------------------------------------------------- |
| **Priority**        | P1                                                    |
| **Preconditions**   | Multiple unread notifications                         |
| **Steps**           | 1. `POST /api/notifications/mark-all-read`            |
| **Expected Result** | 200 OK. All user's notifications set to `read: true`. |
| **Status**          |                                                       |
| **Actual Result**   |                                                       |

### NOTIF-004: Notifications only for own user

| Field               | Value                                                        |
| ------------------- | ------------------------------------------------------------ |
| **Priority**        | P1                                                           |
| **Preconditions**   | Two different users with notifications                       |
| **Steps**           | 1. Login as user A 2. `GET /api/notifications`               |
| **Expected Result** | Only user A's notifications returned. No cross-user leakage. |
| **Status**          |                                                              |
| **Actual Result**   |                                                              |

---

## B. Auto-Created Notifications (NOTIF-005 to NOTIF-010)

### NOTIF-005: Notification on load assignment

| Field               | Value                                                                      |
| ------------------- | -------------------------------------------------------------------------- |
| **Priority**        | P1                                                                         |
| **Preconditions**   | Load gets assigned to carrier's truck                                      |
| **Steps**           | 1. Assign load to truck 2. Check carrier's notifications                   |
| **Expected Result** | Notification created: type `LOAD_ASSIGNED`, message includes load details. |
| **Status**          |                                                                            |
| **Actual Result**   |                                                                            |

### NOTIF-006: Notification on POD submission

| Field               | Value                                                                             |
| ------------------- | --------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                |
| **Preconditions**   | Carrier uploads POD                                                               |
| **Steps**           | 1. Upload POD for trip 2. Check shipper's notifications                           |
| **Expected Result** | Notification created: type `POD_SUBMITTED`, metadata includes `loadId`, `tripId`. |
| **Status**          |                                                                                   |
| **Actual Result**   |                                                                                   |

### NOTIF-007: Notification on GPS offline

| Field               | Value                                                                      |
| ------------------- | -------------------------------------------------------------------------- |
| **Priority**        | P2                                                                         |
| **Preconditions**   | Truck GPS goes offline during active trip                                  |
| **Steps**           | 1. GPS monitor detects signal loss 2. Check admin/dispatcher notifications |
| **Expected Result** | Notification: type `GPS_OFFLINE`, includes truck and trip info.            |
| **Status**          |                                                                            |
| **Actual Result**   |                                                                            |

### NOTIF-008: Notification on user suspension

| Field               | Value                                         |
| ------------------- | --------------------------------------------- |
| **Priority**        | P2                                            |
| **Preconditions**   | Admin suspends a user                         |
| **Steps**           | 1. Suspend user 2. Check user's notifications |
| **Expected Result** | Notification: type `USER_SUSPENDED`.          |
| **Status**          |                                               |
| **Actual Result**   |                                               |

### NOTIF-009: Notification on document verification

| Field               | Value                                                          |
| ------------------- | -------------------------------------------------------------- |
| **Priority**        | P2                                                             |
| **Preconditions**   | Admin approves/rejects document                                |
| **Steps**           | 1. Approve document 2. Check uploader's notifications          |
| **Expected Result** | Notification: type `DOCUMENT_APPROVED` or `DOCUMENT_REJECTED`. |
| **Status**          |                                                                |
| **Actual Result**   |                                                                |

### NOTIF-010: Notification on escalation

| Field               | Value                                                      |
| ------------------- | ---------------------------------------------------------- |
| **Priority**        | P2                                                         |
| **Preconditions**   | Dispatcher creates escalation                              |
| **Steps**           | 1. Create escalation for load 2. Check admin notifications |
| **Expected Result** | Notification created for admin team about escalation.      |
| **Status**          |                                                            |
| **Actual Result**   |                                                            |

---

## C. Notification Preferences (NOTIF-011 to NOTIF-012)

### NOTIF-011: Respect notification preferences

| Field               | Value                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------- |
| **Priority**        | P3                                                                                            |
| **Preconditions**   | User has disabled email notifications                                                         |
| **Steps**           | 1. Set `notificationPreferences: { email: false }` 2. Trigger event that creates notification |
| **Expected Result** | In-app notification still created. Email notification NOT sent.                               |
| **Status**          |                                                                                               |
| **Actual Result**   |                                                                                               |

### NOTIF-012: Default notification preferences

| Field               | Value                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| **Priority**        | P3                                                                        |
| **Preconditions**   | New user with no preferences set                                          |
| **Steps**           | 1. Trigger event 2. Check notifications                                   |
| **Expected Result** | Default preferences applied. All notification channels active by default. |
| **Status**          |                                                                           |
| **Actual Result**   |                                                                           |
