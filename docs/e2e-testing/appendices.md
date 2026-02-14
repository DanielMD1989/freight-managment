# Appendices

---

## A. Prisma Model Reference (40+ models)

### Core Models

| Model              | Description               | Key Fields                                     |
| ------------------ | ------------------------- | ---------------------------------------------- |
| User               | Platform users            | id, email, phone, role, status, organizationId |
| Organization       | Companies/carriers        | id, name, type, isVerified, completionRate     |
| Session            | Server-side sessions      | id, userId, tokenHash, expiresAt, revokedAt    |
| UserMFA            | MFA configuration         | userId, enabled, phone, recoveryCodes          |
| SecurityEvent      | Auth/security audit trail | eventType, userId, ipAddress, success          |
| PasswordResetToken | OTP for password reset    | token(hashed), expiresAt, attempts             |
| Invitation         | Team invitations          | email, role, token, status, expiresAt          |
| DeviceToken        | Push notification tokens  | userId, token, platform                        |

### Marketplace Models

| Model             | Description            | Key Fields                                                     |
| ----------------- | ---------------------- | -------------------------------------------------------------- |
| Load              | Freight loads          | status(13 states), pickupCity, deliveryCity, truckType, weight |
| LoadEvent         | Load status change log | eventType, loadId, metadata                                    |
| LoadEscalation    | Issue tracking         | escalationType, priority, status                               |
| Truck             | Carrier vehicles       | truckType, licensePlate, capacity, approvalStatus, gpsStatus   |
| TruckPosting      | Truck availability     | status, originCityId, availableFrom, contactName               |
| EthiopianLocation | Location reference     | name, region, latitude, longitude                              |

### Matching Models

| Model         | Description                    | Key Fields                         |
| ------------- | ------------------------------ | ---------------------------------- |
| MatchProposal | Dispatcher → Carrier proposals | loadId, truckId, carrierId, status |
| TruckRequest  | Shipper → Carrier requests     | loadId, truckId, shipperId, status |
| LoadRequest   | Carrier → Shipper requests     | loadId, truckId, carrierId, status |

### Trip & GPS Models

| Model       | Description            | Key Fields                                    |
| ----------- | ---------------------- | --------------------------------------------- |
| Trip        | Delivery execution     | status(6 states), loadId, truckId, timestamps |
| TripPod     | Proof of delivery docs | tripId, fileUrl, fileName, uploadedBy         |
| GpsDevice   | GPS hardware tracking  | imei, status                                  |
| GpsPosition | GPS data points        | latitude, longitude, speed, truckId, tripId   |

### Financial Models

| Model             | Description               | Key Fields                                                            |
| ----------------- | ------------------------- | --------------------------------------------------------------------- |
| FinancialAccount  | Wallets & revenue         | accountType, balance, organizationId                                  |
| JournalEntry      | Double-entry transactions | transactionType, description, loadId                                  |
| JournalLine       | Debit/credit lines        | amount, isDebit, accountId                                            |
| Corridor          | Route pricing             | originRegion, destinationRegion, shipperPricePerKm, carrierPricePerKm |
| WithdrawalRequest | Cash-out requests         | amount, status, bankAccount                                           |

### System Models

| Model                   | Description          | Key Fields                                |
| ----------------------- | -------------------- | ----------------------------------------- |
| SystemConfig            | Key-value config     | key, value                                |
| SystemSettings          | Platform settings    | rateLimits, matchThresholds, emailToggles |
| AuditLog                | Platform audit trail | eventType, severity, userId, resource     |
| AutomationRule          | Cron/event rules     | ruleType, trigger, conditions, actions    |
| AutomationRuleExecution | Rule execution log   | status, matchedLoads, actionsExecuted     |
| SavedSearch             | User saved searches  | type(LOADS/TRUCKS), criteria(JSON)        |
| Notification            | In-app notifications | type, title, message, read                |
| RouteCache              | Distance API cache   | cacheKey, distanceKm, durationSeconds     |

### Document Models

| Model           | Description             | Key Fields                               |
| --------------- | ----------------------- | ---------------------------------------- |
| Document        | Load documents          | type(BOL/POD/etc), fileUrl, loadId       |
| CompanyDocument | Org verification docs   | type, verificationStatus, organizationId |
| TruckDocument   | Truck verification docs | type, verificationStatus, truckId        |
| Report          | User reports            | type(FRAUD/HARASSMENT/etc), status       |
| Dispute         | Load disputes           | type, status, loadId, resolution         |

---

## B. Enum Reference

### User & Auth Enums

| Enum             | Values                                                        |
| ---------------- | ------------------------------------------------------------- |
| UserRole         | SHIPPER, CARRIER, DISPATCHER, ADMIN, SUPER_ADMIN              |
| UserStatus       | REGISTERED, PENDING_VERIFICATION, ACTIVE, SUSPENDED, REJECTED |
| InvitationStatus | PENDING, ACCEPTED, EXPIRED, CANCELLED                         |

### Load & Marketplace Enums

| Enum          | Values                                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| LoadStatus    | DRAFT, POSTED, SEARCHING, OFFERED, ASSIGNED, PICKUP_PENDING, IN_TRANSIT, DELIVERED, COMPLETED, EXCEPTION, CANCELLED, EXPIRED, UNPOSTED |
| TripStatus    | ASSIGNED, PICKUP_PENDING, IN_TRANSIT, DELIVERED, COMPLETED, CANCELLED                                                                  |
| TruckType     | FLATBED, REFRIGERATED, TANKER, CONTAINER, DRY_VAN, LOWBOY, DUMP_TRUCK, BOX_TRUCK                                                       |
| LoadType      | FULL, PARTIAL                                                                                                                          |
| BookMode      | REQUEST, INSTANT                                                                                                                       |
| PostingStatus | ACTIVE, EXPIRED, CANCELLED, MATCHED                                                                                                    |
| LocationType  | CITY, TOWN, VILLAGE, LANDMARK                                                                                                          |
| SearchType    | LOADS, TRUCKS                                                                                                                          |

### Matching Enums

| Enum               | Values                                          |
| ------------------ | ----------------------------------------------- |
| ProposalStatus     | PENDING, ACCEPTED, REJECTED, EXPIRED, CANCELLED |
| RequestStatus      | PENDING, APPROVED, REJECTED, EXPIRED, CANCELLED |
| VerificationStatus | PENDING, APPROVED, REJECTED, EXPIRED            |

### Financial Enums

| Enum              | Values                                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| AccountType       | SHIPPER_WALLET, CARRIER_WALLET, PLATFORM_REVENUE                                                                 |
| TransactionType   | DEPOSIT, WITHDRAWAL, COMMISSION, SETTLEMENT, REFUND, SERVICE_FEE_RESERVE, SERVICE_FEE_DEDUCT, SERVICE_FEE_REFUND |
| ServiceFeeStatus  | PENDING, RESERVED, DEDUCTED, REFUNDED, WAIVED                                                                    |
| CorridorDirection | ONE_WAY, ROUND_TRIP, BIDIRECTIONAL                                                                               |

### Document Enums

| Enum                | Values                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| DocumentType        | BOL, POD, INVOICE, RECEIPT, INSURANCE, PERMIT, OTHER                                           |
| CompanyDocumentType | COMPANY_LICENSE, TIN_CERTIFICATE, BUSINESS_REGISTRATION, TRADE_LICENSE, VAT_CERTIFICATE, OTHER |
| TruckDocumentType   | TITLE_DEED, REGISTRATION, INSURANCE, ROAD_WORTHINESS, DRIVER_LICENSE, OTHER                    |

### Escalation Enums

| Enum               | Values                                                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EscalationType     | LATE_PICKUP, LATE_DELIVERY, TRUCK_BREAKDOWN, CARRIER_NO_SHOW, ROUTE_DEVIATION, GPS_OFFLINE, CARGO_DAMAGE, SHIPPER_ISSUE, CARRIER_ISSUE, DOCUMENTATION, PAYMENT_DISPUTE, BYPASS_DETECTED, OTHER |
| EscalationPriority | LOW, MEDIUM, HIGH, CRITICAL                                                                                                                                                                    |
| EscalationStatus   | OPEN, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED, ESCALATED                                                                                                                                       |

### Other Enums

| Enum             | Values                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| OrganizationType | SHIPPER, CARRIER_COMPANY, CARRIER_INDIVIDUAL, CARRIER_ASSOCIATION, FLEET_OWNER, LOGISTICS_AGENT               |
| GpsDeviceStatus  | ACTIVE, INACTIVE, SIGNAL_LOST, MAINTENANCE                                                                    |
| DisputeStatus    | OPEN, UNDER_REVIEW, RESOLVED, CLOSED                                                                          |
| DisputeType      | PAYMENT_ISSUE, DAMAGE, LATE_DELIVERY, QUALITY_ISSUE, OTHER                                                    |
| ReportStatus     | NEW, REVIEWED, ACTIONED, DISMISSED                                                                            |
| ReportType       | FRAUD, HARASSMENT, SPAM, SAFETY_VIOLATION, OTHER                                                              |
| RuleType         | TIME_BASED, GPS_BASED, THRESHOLD_BASED, CUSTOM                                                                |
| RuleTrigger      | ON_LOAD_CREATED, ON_LOAD_ASSIGNED, ON_PICKUP_PENDING, ON_IN_TRANSIT, ON_STATUS_CHANGE, ON_SCHEDULE, ON_MANUAL |
| ExecutionStatus  | PENDING, RUNNING, COMPLETED, FAILED                                                                           |

---

## C. Test User Credentials

| Role        | Email               | Password | Org              | Status     |
| ----------- | ------------------- | -------- | ---------------- | ---------- |
| SUPER_ADMIN | superadmin@test.com | Test123! | -                | ACTIVE     |
| ADMIN       | admin@test.com      | Test123! | -                | ACTIVE     |
| SHIPPER     | shipper@test.com    | Test123! | Test Shipper Co. | ACTIVE     |
| CARRIER     | carrier@test.com    | Test123! | Test Carrier Co. | ACTIVE     |
| DISPATCHER  | dispatcher@test.com | Test123! | -                | ACTIVE     |
| Unverified  | unverified@test.com | Test123! | -                | REGISTERED |
| Suspended   | suspended@test.com  | Test123! | -                | SUSPENDED  |

---

## D. Automated Test Mapping

### Jest Tests (`__tests__/e2e-core-flows.test.ts`)

| Jest Test                         | Maps To                                |
| --------------------------------- | -------------------------------------- |
| User registration and org setup   | AUTH-001, AUTH-002, USER-007           |
| Load posting and management       | LOAD-001, LOAD-002, LOAD-003, LOAD-004 |
| Truck posting and search          | TRUCK-001, TRUCK-013, TRUCK-018        |
| Load assignment and trip creation | LOAD-013, TRIP-001                     |
| GPS tracking and position         | GPS-001, GPS-005, GPS-012              |
| POD submission and completion     | TRIP-021, TRIP-007, LOAD-018           |
| Service fee system                | FIN-019, FIN-020                       |
| Notification creation             | NOTIF-005, NOTIF-006                   |
| Database integrity                | EDGE-019                               |
| Business logic validation         | LOAD-025 to LOAD-036                   |

### API Flow Test (`scripts/e2e-flow-test.ts`)

| Step                         | Maps To            |
| ---------------------------- | ------------------ |
| 1. Login as shipper          | AUTH-007           |
| 2. Create load               | LOAD-001           |
| 3. Post load                 | LOAD-002           |
| 4. Login as carrier          | AUTH-007           |
| 5. Search loads              | LOAD-004           |
| 6. Login as dispatcher       | AUTH-007           |
| 7. Create match proposal     | MATCH-001          |
| 8. Accept proposal (carrier) | MATCH-002          |
| 9. Start trip                | TRIP-004, TRIP-005 |
| 10. Submit GPS               | GPS-001            |
| 11. Deliver                  | TRIP-006           |
| 12. Upload POD               | TRIP-021           |
| 13. Confirm delivery         | TRIP-023           |
| 14. Verify fees              | FIN-019, FIN-020   |
| 15. Check notifications      | NOTIF-005          |

### Business Logic Test (`scripts/e2e-test-business-logic.ts`)

| Test                           | Maps To                   |
| ------------------------------ | ------------------------- |
| Load state machine transitions | LOAD-011 to LOAD-036      |
| Corridor pricing               | FIN-010, FIN-013, FIN-014 |
| Trip state machine             | TRIP-004 to TRIP-015      |
| Role permissions               | SEC-010 to SEC-021        |
| Financial double-entry         | FIN-019, FIN-020          |

---

## E. Superseded Files

This documentation supersedes and consolidates the following files:

| File                                    | Status     | Notes                                         |
| --------------------------------------- | ---------- | --------------------------------------------- |
| `COMPREHENSIVE_E2E_TEST_PLAN.md`        | Superseded | 93 scenarios consolidated into sections 01-19 |
| `E2E_TEST_REPORT.md`                    | Superseded | v1 audit report                               |
| `E2E_TEST_REPORT_v2.md`                 | Superseded | v2 audit report                               |
| `E2E_TEST_REPORT_v3.md`                 | Superseded | v3 audit report                               |
| `E2E_TEST_REPORT_v4.md`                 | Superseded | v4 audit report                               |
| `E2E_TEST_RESULTS.md`                   | Superseded | Automated verification results                |
| `E2E_FOUNDATION_AUDIT.md`               | Superseded | Foundation audit → Section 13 (Security)      |
| `E2E_FLOW_SIMULATION_REPORT.md`         | Superseded | Flow simulation → Section 14 (Cross-Role)     |
| `E2E_SCENARIOS_VALIDATION.md`           | Superseded | Business validation                           |
| `E2E-VERIFICATION.md`                   | Superseded | v1 verification checklist                     |
| `E2E-VERIFICATION-V2.md`                | Superseded | v2 verification checklist                     |
| `E2E_MANUAL_TEST_SCRIPT.md`             | Superseded | Manual scripts → integrated into all sections |
| `DEEP_E2E_QA_REPORT.md`                 | Superseded | Deep QA report                                |
| `FUNCTIONAL_TEST_REPORT.md`             | Superseded | Web functional tests                          |
| `SECURITY_TEST_RESULTS.md`              | Superseded | Security audit → Section 13                   |
| `SECURITY_TESTING.md`                   | Superseded | Security testing methodology                  |
| `MOBILE_FUNCTIONAL_TEST_REPORT.md`      | Superseded | Mobile tests → Section 15                     |
| `MOBILE_TEST_REPORT.md`                 | Superseded | Mobile report → Section 15                    |
| `WEB_TEST_REPORT.md`                    | Superseded | Web report                                    |
| `FULL_SYSTEM_TEST_REPORT.md`            | Superseded | Full system report                            |
| `PERFORMANCE_TEST_REPORT.md`            | Superseded | Performance → Section 17                      |
| `NOTIFICATION_SYSTEM_TEST.md`           | Superseded | Notification tests → Section 10               |
| `MANUAL_TEST_PLAN.md`                   | Superseded | Manual plan                                   |
| `TESTING_GUIDE.md`                      | Superseded | Testing guide → Section 00                    |
| `QA_TEST_SCRIPT.md`                     | Superseded | QA scripts                                    |
| `ROLE_BASED_FLOW_TESTS.md`              | Superseded | Role flows → Sections 13, 14                  |
| `mobile/E2E_QA_COMPREHENSIVE_REPORT.md` | Superseded | Mobile QA → Section 15                        |
| `mobile/E2E_QA_RETEST_REPORT.md`        | Superseded | Mobile retest                                 |
| `mobile/E2E_FINAL_VALIDATION_REPORT.md` | Superseded | Mobile validation                             |

> **Note:** The superseded files are retained for historical reference. This `docs/e2e-testing/` directory is the authoritative source going forward.

### Files NOT Superseded (Still Active)

| File                                 | Reason                                        |
| ------------------------------------ | --------------------------------------------- |
| `__tests__/e2e-core-flows.test.ts`   | Active Jest test suite (run via `npm test`)   |
| `scripts/e2e-flow-test.ts`           | Active API test script                        |
| `scripts/e2e-test-business-logic.ts` | Active business logic test script             |
| `docs/LOAD_STATE_MACHINE.md`         | Source-of-truth documentation for load states |
| `ADMIN-AUDIT.md`                     | Active known-issues tracker                   |
