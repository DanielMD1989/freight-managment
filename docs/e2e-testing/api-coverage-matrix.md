# API Endpoint Coverage Matrix

> **Total Endpoints:** 169
> **Mapped to Tests:** All endpoints below reference test IDs from sections 01-19

---

## Coverage Summary

| API Group       | Endpoints | Test IDs                                   | Coverage |
| --------------- | --------- | ------------------------------------------ | -------- |
| Auth            | 7         | AUTH-001 to AUTH-030                       | 100%     |
| User            | 12        | AUTH-031 to AUTH-034, USER-001 to USER-006 | 100%     |
| Organizations   | 6         | USER-007 to USER-017                       | 100%     |
| Admin           | 26        | ADMIN-001 to ADMIN-030                     | 100%     |
| Loads           | 23        | LOAD-001 to LOAD-052                       | 100%     |
| Trucks          | 7         | TRUCK-001 to TRUCK-024                     | 100%     |
| Truck Postings  | 4         | TRUCK-013 to TRUCK-020                     | 100%     |
| Match Proposals | 2         | MATCH-001 to MATCH-006                     | 100%     |
| Truck Requests  | 4         | MATCH-007 to MATCH-012                     | 100%     |
| Load Requests   | 2         | MATCH-013 to MATCH-017                     | 100%     |
| Trips           | 8         | TRIP-001 to TRIP-028                       | 100%     |
| GPS             | 10        | GPS-001 to GPS-022                         | 100%     |
| Financial       | 2         | FIN-001 to FIN-006                         | 100%     |
| Wallet          | 2         | FIN-001, FIN-002                           | 100%     |
| Corridors       | 2         | FIN-010 to FIN-013                         | 100%     |
| Notifications   | 3         | NOTIF-001 to NOTIF-012                     | 100%     |
| Cron            | 6         | AUTO-001 to AUTO-009                       | 100%     |
| Automation      | 5         | AUTO-010 to AUTO-012                       | 100%     |
| Distance        | 4         | INFRA-011 to INFRA-014                     | 100%     |
| Disputes        | 2         | (via SEC/CROSS)                            | 80%      |
| Escalations     | 2         | DISP-008 to DISP-011                       | 100%     |
| Other           | 25        | Various                                    | 90%+     |

---

## Detailed Endpoint-to-Test Mapping

### Authentication (`/api/auth/*`) - 7 endpoints

| Method | Endpoint                    | Test IDs                                                                       |
| ------ | --------------------------- | ------------------------------------------------------------------------------ |
| POST   | `/api/auth/register`        | AUTH-001, AUTH-002, AUTH-003, AUTH-004, AUTH-005, AUTH-006                     |
| POST   | `/api/auth/login`           | AUTH-007, AUTH-008, AUTH-009, AUTH-010, AUTH-011, AUTH-012, AUTH-013, AUTH-027 |
| POST   | `/api/auth/logout`          | AUTH-018, AUTH-019                                                             |
| GET    | `/api/auth/me`              | AUTH-015, AUTH-016, AUTH-017                                                   |
| POST   | `/api/auth/forgot-password` | AUTH-020                                                                       |
| POST   | `/api/auth/reset-password`  | AUTH-021, AUTH-022, AUTH-023, AUTH-024                                         |
| POST   | `/api/auth/verify-mfa`      | AUTH-027, AUTH-028, AUTH-029                                                   |

### User (`/api/user/*`) - 12 endpoints

| Method | Endpoint                             | Test IDs            |
| ------ | ------------------------------------ | ------------------- |
| GET    | `/api/user/profile`                  | USER-001            |
| PUT    | `/api/user/profile`                  | USER-002            |
| POST   | `/api/user/change-password`          | USER-003, USER-004  |
| GET    | `/api/user/security-events`          | USER-005            |
| PUT    | `/api/user/notification-preferences` | USER-006, NOTIF-011 |
| GET    | `/api/user/sessions`                 | AUTH-031            |
| DELETE | `/api/user/sessions/{id}`            | AUTH-032            |
| POST   | `/api/user/sessions/revoke-all`      | AUTH-033            |
| POST   | `/api/user/mfa/enable`               | AUTH-025            |
| POST   | `/api/user/mfa/disable`              | AUTH-030            |
| POST   | `/api/user/mfa/verify`               | AUTH-026            |
| GET    | `/api/user/mfa/recovery-codes`       | AUTH-029            |

### Organizations (`/api/organizations/*`) - 6 endpoints

| Method | Endpoint                              | Test IDs                     |
| ------ | ------------------------------------- | ---------------------------- |
| POST   | `/api/organizations`                  | USER-007                     |
| GET    | `/api/organizations/me`               | USER-008                     |
| GET    | `/api/organizations/{id}`             | USER-010                     |
| PUT    | `/api/organizations/{id}`             | USER-009                     |
| POST   | `/api/organizations/invitations`      | USER-013                     |
| PUT    | `/api/organizations/invitations/{id}` | USER-014, USER-015, USER-016 |
| DELETE | `/api/organizations/members/{id}`     | USER-017                     |

### Admin (`/api/admin/*`) - 26 endpoints

| Method | Endpoint                                   | Test IDs                       |
| ------ | ------------------------------------------ | ------------------------------ |
| GET    | `/api/admin/dashboard`                     | ADMIN-001                      |
| GET    | `/api/admin/users`                         | ADMIN-009, ADMIN-030           |
| POST   | `/api/admin/users`                         | USER-022, ADMIN-011, ADMIN-012 |
| GET    | `/api/admin/users/{id}`                    | ADMIN-010                      |
| PUT    | `/api/admin/users/{id}`                    | USER-018, USER-019, USER-021   |
| PUT    | `/api/admin/users/{id}/verify`             | USER-020                       |
| GET    | `/api/admin/users/{id}/wallet`             | FIN-004                        |
| POST   | `/api/admin/users/{id}/wallet/topup`       | FIN-003                        |
| GET    | `/api/admin/organizations`                 | USER-011                       |
| PUT    | `/api/admin/organizations/{id}/verify`     | VER-012                        |
| GET    | `/api/admin/documents`                     | ADMIN-016                      |
| GET    | `/api/admin/verification/queue`            | VER-009                        |
| PUT    | `/api/admin/verification/{id}`             | VER-010, VER-011               |
| GET    | `/api/admin/corridors`                     | ADMIN-019                      |
| POST   | `/api/admin/corridors`                     | FIN-007                        |
| PUT    | `/api/admin/corridors/{id}`                | FIN-008, FIN-009               |
| GET    | `/api/admin/settlements`                   | ADMIN-021                      |
| PUT    | `/api/admin/settlements/{id}/approve`      | FIN-006                        |
| GET    | `/api/admin/settlement-automation`         | FIN-025                        |
| PUT    | `/api/admin/settlement-automation`         | FIN-025                        |
| GET    | `/api/admin/settings`                      | ADMIN-025                      |
| PUT    | `/api/admin/settings`                      | ADMIN-025                      |
| GET    | `/api/admin/analytics`                     | ADMIN-005                      |
| GET    | `/api/admin/audit-logs`                    | ADMIN-018                      |
| GET    | `/api/admin/audit-logs/stats`              | ADMIN-023                      |
| GET    | `/api/admin/platform-metrics`              | ADMIN-004                      |
| GET    | `/api/admin/service-fees/metrics`          | FIN-018                        |
| GET    | `/api/admin/bypass-warnings`               | ADMIN-017                      |
| GET    | `/api/admin/bypass-warnings/organizations` | ADMIN-017                      |
| POST   | `/api/admin/activate-test-users`           | ADMIN-014                      |

### Loads (`/api/loads/*`) - 23 endpoints

| Method | Endpoint                                     | Test IDs                       |
| ------ | -------------------------------------------- | ------------------------------ |
| GET    | `/api/loads`                                 | LOAD-004, DISP-006, MOB-018    |
| POST   | `/api/loads`                                 | LOAD-001, SEC-011, SEC-001     |
| GET    | `/api/loads/{id}`                            | LOAD-003                       |
| PUT    | `/api/loads/{id}`                            | LOAD-005, LOAD-006             |
| DELETE | `/api/loads/{id}`                            | LOAD-007, LOAD-008             |
| PUT    | `/api/loads/{id}/status`                     | LOAD-002, LOAD-011 to LOAD-044 |
| PUT    | `/api/loads/{id}/assign`                     | LOAD-013, MATCH-006            |
| POST   | `/api/loads/{id}/duplicate`                  | LOAD-009                       |
| GET    | `/api/loads/{id}/matching-trucks`            | LOAD-045, MATCH-018            |
| GET    | `/api/loads/{id}/service-fee`                | LOAD-046, FIN-013              |
| GET    | `/api/loads/{id}/gps-history`                | LOAD-047                       |
| GET    | `/api/loads/{id}/live-position`              | LOAD-048                       |
| POST   | `/api/loads/{id}/escalations`                | LOAD-049                       |
| GET    | `/api/loads/{id}/escalations`                | DISP-009                       |
| GET    | `/api/loads/{id}/reference-pricing`          | LOAD-050                       |
| POST   | `/api/loads/{id}/report-bypass`              | LOAD-051                       |
| GET    | `/api/loads/{id}/next-loads`                 | LOAD-052                       |
| GET    | `/api/loads/{id}/documents`                  | VER-006                        |
| GET    | `/api/loads/{id}/documents/{docId}/download` | VER-007                        |
| GET    | `/api/loads/{id}/tracking`                   | GPS-015                        |
| GET    | `/api/loads/{id}/progress`                   | GPS-004                        |
| GET    | `/api/loads/{id}/pod`                        | TRIP-021                       |
| POST   | `/api/loads/{id}/settle`                     | FIN-019                        |
| GET    | `/api/loads/{id}/check-exceptions`           | DISP-014                       |

### Trucks (`/api/trucks/*`) - 7 endpoints

| Method | Endpoint                        | Test IDs                      |
| ------ | ------------------------------- | ----------------------------- |
| GET    | `/api/trucks`                   | TRUCK-003, DISP-007           |
| POST   | `/api/trucks`                   | TRUCK-001, TRUCK-007, SEC-012 |
| GET    | `/api/trucks/{id}`              | TRUCK-002                     |
| PUT    | `/api/trucks/{id}`              | TRUCK-004                     |
| DELETE | `/api/trucks/{id}`              | TRUCK-005, TRUCK-006          |
| PUT    | `/api/trucks/{id}/approve`      | TRUCK-009, TRUCK-010          |
| PUT    | `/api/trucks/{id}/location`     | TRUCK-008                     |
| GET    | `/api/trucks/{id}/nearby-loads` | TRUCK-021                     |
| POST   | `/api/trucks/{id}/position`     | TRUCK-022                     |
| GET    | `/api/trucks/{id}/history`      | TRUCK-023                     |

### Truck Postings (`/api/truck-postings/*`) - 4 endpoints

| Method | Endpoint                                  | Test IDs             |
| ------ | ----------------------------------------- | -------------------- |
| GET    | `/api/truck-postings`                     | TRUCK-014            |
| POST   | `/api/truck-postings`                     | TRUCK-013, TRUCK-011 |
| PUT    | `/api/truck-postings/{id}`                | TRUCK-015, TRUCK-016 |
| POST   | `/api/truck-postings/{id}/duplicate`      | TRUCK-017            |
| GET    | `/api/truck-postings/{id}/matching-loads` | TRUCK-018, MATCH-018 |

### Match Proposals (`/api/match-proposals/*`) - 2 endpoints

| Method   | Endpoint                            | Test IDs                        |
| -------- | ----------------------------------- | ------------------------------- |
| GET/POST | `/api/match-proposals`              | MATCH-001, MATCH-005, DISP-004  |
| PUT      | `/api/match-proposals/{id}/respond` | MATCH-002, MATCH-003, MATCH-004 |

### Truck Requests (`/api/truck-requests/*`) - 4 endpoints

| Method   | Endpoint                           | Test IDs             |
| -------- | ---------------------------------- | -------------------- |
| GET/POST | `/api/truck-requests`              | MATCH-007, MATCH-011 |
| GET      | `/api/truck-requests/{id}`         | MATCH-011            |
| PUT      | `/api/truck-requests/{id}/respond` | MATCH-008, MATCH-009 |
| PUT      | `/api/truck-requests/{id}/cancel`  | MATCH-010            |

### Load Requests (`/api/load-requests/*`) - 2 endpoints

| Method   | Endpoint                          | Test IDs                        |
| -------- | --------------------------------- | ------------------------------- |
| GET/POST | `/api/load-requests`              | MATCH-013, MATCH-016, MATCH-017 |
| PUT      | `/api/load-requests/{id}/respond` | MATCH-014, MATCH-015            |

### Trips (`/api/trips/*`) - 8 endpoints

| Method | Endpoint                      | Test IDs                     |
| ------ | ----------------------------- | ---------------------------- |
| GET    | `/api/trips`                  | TRIP-003                     |
| GET    | `/api/trips/{tripId}`         | TRIP-002                     |
| PUT    | `/api/trips/{tripId}`         | TRIP-004 to TRIP-020         |
| POST   | `/api/trips/{tripId}/cancel`  | TRIP-008, TRIP-017, TRIP-018 |
| POST   | `/api/trips/{tripId}/confirm` | TRIP-007, TRIP-023           |
| POST   | `/api/trips/{tripId}/pod`     | TRIP-021, TRIP-022, TRIP-025 |
| GET    | `/api/trips/{tripId}/gps`     | TRIP-026                     |
| GET    | `/api/trips/{tripId}/live`    | TRIP-027                     |
| GET    | `/api/trips/{tripId}/history` | TRIP-028                     |

### GPS (`/api/gps/*`) - 10 endpoints

| Method   | Endpoint                       | Test IDs                           |
| -------- | ------------------------------ | ---------------------------------- |
| POST     | `/api/gps/position`            | GPS-001, GPS-003, GPS-004, GPS-005 |
| POST     | `/api/gps/batch`               | GPS-002                            |
| GET      | `/api/gps/live`                | GPS-012                            |
| GET      | `/api/gps/history`             | GPS-013                            |
| GET      | `/api/gps/eta`                 | GPS-014                            |
| GET      | `/api/gps/positions`           | GPS-018                            |
| GET/POST | `/api/gps/devices`             | GPS-007, GPS-010                   |
| GET      | `/api/gps/devices/{id}`        | GPS-010                            |
| POST     | `/api/gps/devices/{id}/verify` | GPS-009                            |

### Financial & Wallet (4 endpoints)

| Method | Endpoint                   | Test IDs |
| ------ | -------------------------- | -------- |
| GET    | `/api/financial/wallet`    | FIN-001  |
| POST   | `/api/financial/withdraw`  | FIN-005  |
| GET    | `/api/wallet/balance`      | FIN-001  |
| GET    | `/api/wallet/transactions` | FIN-002  |

### Corridors (`/api/corridors/*`) - 2 endpoints

| Method | Endpoint                       | Test IDs                           |
| ------ | ------------------------------ | ---------------------------------- |
| POST   | `/api/corridors/calculate-fee` | FIN-013, FIN-014, FIN-015, FIN-016 |
| POST   | `/api/corridors/match`         | FIN-010, FIN-011, FIN-012          |

### Notifications (`/api/notifications/*`) - 3 endpoints

| Method | Endpoint                           | Test IDs             |
| ------ | ---------------------------------- | -------------------- |
| GET    | `/api/notifications`               | NOTIF-001, NOTIF-004 |
| PUT    | `/api/notifications/{id}/read`     | NOTIF-002            |
| POST   | `/api/notifications/mark-all-read` | NOTIF-003            |

### Cron Jobs (`/api/cron/*`) - 6 endpoints

| Method | Endpoint                    | Test IDs                              |
| ------ | --------------------------- | ------------------------------------- |
| POST   | `/api/cron/expire-loads`    | AUTO-001, AUTO-002, AUTO-004          |
| POST   | `/api/cron/expire-postings` | AUTO-003                              |
| POST   | `/api/cron/auto-settle`     | AUTO-005, AUTO-006, AUTO-007, FIN-026 |
| POST   | `/api/cron/gps-cleanup`     | AUTO-009, GPS-022                     |
| POST   | `/api/cron/gps-monitor`     | AUTO-008, GPS-017                     |
| POST   | `/api/cron/aggregate-sla`   | PERF-003                              |

### Automation (`/api/automation/*`) - 5 endpoints

| Method | Endpoint                             | Test IDs |
| ------ | ------------------------------------ | -------- |
| GET    | `/api/automation/rules`              | AUTO-010 |
| POST   | `/api/automation/rules`              | AUTO-010 |
| GET    | `/api/automation/rules/{id}`         | AUTO-010 |
| PUT    | `/api/automation/rules/{id}`         | AUTO-010 |
| POST   | `/api/automation/rules/{id}/execute` | AUTO-011 |
| GET    | `/api/automation/executions`         | AUTO-012 |
| GET    | `/api/automation/monitor`            | DISP-014 |

### Distance (`/api/distance/*`) - 4 endpoints

| Method | Endpoint              | Test IDs  |
| ------ | --------------------- | --------- |
| POST   | `/api/distance`       | INFRA-011 |
| POST   | `/api/distance/batch` | INFRA-012 |
| POST   | `/api/distance/dh`    | INFRA-013 |
| POST   | `/api/distance/road`  | INFRA-011 |

### Dashboards (3 endpoints)

| Method | Endpoint                    | Test IDs          |
| ------ | --------------------------- | ----------------- |
| GET    | `/api/dispatcher/dashboard` | DISP-001, SEC-020 |
| GET    | `/api/shipper/dashboard`    | PERF-003          |
| GET    | `/api/carrier/dashboard`    | MOB-015           |

### Map & Tracking (5 endpoints)

| Method | Endpoint                     | Test IDs         |
| ------ | ---------------------------- | ---------------- |
| GET    | `/api/map`                   | ADMIN-007        |
| GET    | `/api/map/vehicles`          | GPS-021          |
| GET    | `/api/map/loads`             | ADMIN-007        |
| GET    | `/api/map/trips`             | DISP-012         |
| GET    | `/api/tracking/{trackingId}` | GPS-015, GPS-016 |

### Other Endpoints

| Method   | Endpoint                        | Test IDs             |
| -------- | ------------------------------- | -------------------- |
| GET      | `/api/health`                   | INFRA-001, INFRA-002 |
| GET      | `/api/config`                   | INFRA-004            |
| GET      | `/api/csrf-token`               | SEC-002              |
| GET      | `/api/monitoring`               | INFRA-003            |
| GET      | `/api/feature-flags`            | INFRA-005            |
| PUT      | `/api/feature-flags/{key}`      | INFRA-006            |
| GET      | `/api/queues`                   | INFRA-008            |
| GET      | `/api/queues/{queue}`           | INFRA-009            |
| GET      | `/api/ethiopian-locations`      | LOAD-001             |
| GET      | `/api/locations`                | LOAD-001             |
| GET      | `/api/locations/{id}`           | LOAD-003             |
| GET/POST | `/api/disputes`                 | CROSS-004            |
| GET      | `/api/disputes/{id}`            | CROSS-004            |
| GET/POST | `/api/escalations`              | DISP-008, DISP-009   |
| PUT      | `/api/escalations/{id}`         | DISP-010, DISP-011   |
| GET      | `/api/exceptions/analytics`     | DISP-014             |
| GET      | `/api/exceptions/monitor`       | DISP-014             |
| GET      | `/api/carrier/gps`              | GPS-019              |
| GET      | `/api/audit-logs/dispatcher`    | DISP-013             |
| POST     | `/api/deadhead/analyze`         | TRUCK-021            |
| GET      | `/api/dispatch`                 | DISP-002             |
| GET      | `/api/return-loads`             | LOAD-052             |
| GET      | `/api/routes/distance`          | INFRA-011            |
| GET      | `/api/saved-searches`           | MOB-018              |
| POST     | `/api/saved-searches`           | MOB-018              |
| DELETE   | `/api/saved-searches/{id}`      | MOB-018              |
| GET      | `/api/associations`             | USER-012             |
| POST     | `/api/support/report`           | NOTIF-010            |
| GET      | `/api/uploads/{...path}`        | VER-007              |
| GET      | `/api/user/verification-status` | VER-013              |
