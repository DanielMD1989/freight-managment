# 19 - Automation & Cron Jobs (AUTO-xxx)

> **Total Tests:** 12
> **Priority Breakdown:** P0: 2 | P1: 4 | P2: 4 | P3: 2
> **API Endpoints:** `/api/cron/*`, `/api/automation/*`
> **Source Files:** `app/api/cron/*/route.ts`, `app/api/automation/*/route.ts`

---

## Cron Jobs Reference

| Endpoint                    | Purpose                              | Schedule    |
| --------------------------- | ------------------------------------ | ----------- |
| `/api/cron/expire-loads`    | Expire POSTED loads past expiresAt   | Periodic    |
| `/api/cron/expire-postings` | Expire truck postings past expiresAt | Periodic    |
| `/api/cron/auto-settle`     | Auto-verify POD and complete trips   | Periodic    |
| `/api/cron/gps-cleanup`     | Archive old GPS positions            | Daily       |
| `/api/cron/gps-monitor`     | Detect offline GPS devices           | Every 5 min |
| `/api/cron/aggregate-sla`   | Aggregate SLA metrics                | Daily       |

---

## A. Load & Posting Expiry (AUTO-001 to AUTO-004)

### AUTO-001: Expire posted loads

| Field               | Value                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                    |
| **Preconditions**   | POSTED loads with past `expiresAt`                                                                    |
| **Steps**           | 1. `POST /api/cron/expire-loads`                                                                      |
| **Expected Result** | All POSTED loads past expiry → EXPIRED. LoadEvent `EXPIRED` created. Count of expired loads returned. |
| **Status**          |                                                                                                       |
| **Actual Result**   |                                                                                                       |

### AUTO-002: Non-expired loads unaffected

| Field               | Value                                                                           |
| ------------------- | ------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                              |
| **Preconditions**   | Mix of expired and non-expired loads                                            |
| **Steps**           | 1. Run expire-loads cron                                                        |
| **Expected Result** | Only expired loads changed. Active loads with future `expiresAt` remain POSTED. |
| **Status**          |                                                                                 |
| **Actual Result**   |                                                                                 |

### AUTO-003: Expire truck postings

| Field               | Value                                                  |
| ------------------- | ------------------------------------------------------ |
| **Priority**        | P0                                                     |
| **Preconditions**   | ACTIVE postings with past `expiresAt` or `availableTo` |
| **Steps**           | 1. `POST /api/cron/expire-postings`                    |
| **Expected Result** | Postings → EXPIRED. No longer appear in searches.      |
| **Status**          |                                                        |
| **Actual Result**   |                                                        |

### AUTO-004: Already expired loads not re-processed

| Field               | Value                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| **Priority**        | P2                                                                        |
| **Preconditions**   | Load already in EXPIRED status                                            |
| **Steps**           | 1. Run expire-loads cron again                                            |
| **Expected Result** | Already-expired loads skipped. No duplicate events. Idempotent operation. |
| **Status**          |                                                                           |
| **Actual Result**   |                                                                           |

---

## B. Auto-Settlement (AUTO-005 to AUTO-007)

### AUTO-005: Auto-settle delivered trips

| Field               | Value                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                                    |
| **Preconditions**   | DELIVERED trips with POD, past `autoVerifyPodTimeoutHours` (24h), `settlementAutomationEnabled: true` |
| **Steps**           | 1. `POST /api/cron/auto-settle`                                                                       |
| **Expected Result** | POD auto-verified. Trips → COMPLETED. Service fees deducted. Settlement records created.              |
| **Status**          |                                                                                                       |
| **Actual Result**   |                                                                                                       |

### AUTO-006: Auto-settle respects settings

| Field               | Value                                                     |
| ------------------- | --------------------------------------------------------- |
| **Priority**        | P1                                                        |
| **Preconditions**   | `settlementAutomationEnabled: false`                      |
| **Steps**           | 1. `POST /api/cron/auto-settle`                           |
| **Expected Result** | No settlements processed. Cron exits early when disabled. |
| **Status**          |                                                           |
| **Actual Result**   |                                                           |

### AUTO-007: Auto-settle batch size

| Field               | Value                                                               |
| ------------------- | ------------------------------------------------------------------- |
| **Priority**        | P2                                                                  |
| **Preconditions**   | 100 eligible trips, `settlementBatchSize: 50`                       |
| **Steps**           | 1. Run auto-settle                                                  |
| **Expected Result** | Only 50 trips processed per batch. Remaining processed in next run. |
| **Status**          |                                                                     |
| **Actual Result**   |                                                                     |

---

## C. GPS Maintenance (AUTO-008 to AUTO-009)

### AUTO-008: GPS monitor detects offline devices

| Field               | Value                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                                             |
| **Preconditions**   | Trucks with GPS that haven't reported recently                                                                 |
| **Steps**           | 1. `POST /api/cron/gps-monitor`                                                                                |
| **Expected Result** | Trucks with stale GPS → `gpsStatus: SIGNAL_LOST`. Notifications created for offline devices with active trips. |
| **Status**          |                                                                                                                |
| **Actual Result**   |                                                                                                                |

### AUTO-009: GPS data cleanup

| Field               | Value                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------- |
| **Priority**        | P2                                                                                       |
| **Preconditions**   | GPS positions older than retention period                                                |
| **Steps**           | 1. `POST /api/cron/gps-cleanup`                                                          |
| **Expected Result** | Old positions archived or deleted. Recent data preserved. Trip route history maintained. |
| **Status**          |                                                                                          |
| **Actual Result**   |                                                                                          |

---

## D. Automation Rules Engine (AUTO-010 to AUTO-012)

### AUTO-010: List automation rules

| Field               | Value                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                       |
| **Preconditions**   | Admin logged in, rules exist                                                             |
| **Steps**           | 1. `GET /api/automation/rules`                                                           |
| **Expected Result** | 200 OK. List of rules with `name`, `ruleType`, `trigger`, `isEnabled`, `executionCount`. |
| **Status**          |                                                                                          |
| **Actual Result**   |                                                                                          |

### AUTO-011: Execute automation rule manually

| Field               | Value                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P2                                                                                                                  |
| **Preconditions**   | Admin logged in, enabled rule exists                                                                                |
| **Steps**           | 1. `POST /api/automation/rules/{id}/execute`                                                                        |
| **Expected Result** | 200 OK. Rule executed. AutomationRuleExecution created with `status: COMPLETED`, `matchedLoads`, `actionsExecuted`. |
| **Status**          |                                                                                                                     |
| **Actual Result**   |                                                                                                                     |

### AUTO-012: View automation execution history

| Field               | Value                                                                               |
| ------------------- | ----------------------------------------------------------------------------------- |
| **Priority**        | P3                                                                                  |
| **Preconditions**   | Rules have been executed                                                            |
| **Steps**           | 1. `GET /api/automation/executions`                                                 |
| **Expected Result** | 200 OK. Execution history: rule name, status, matched loads, actions taken, errors. |
| **Status**          |                                                                                     |
| **Actual Result**   |                                                                                     |
