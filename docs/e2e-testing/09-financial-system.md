# 09 - Financial System (FIN-xxx)

> **Total Tests:** 26
> **Priority Breakdown:** P0: 6 | P1: 12 | P2: 6 | P3: 2
> **API Endpoints:** `/api/financial/*`, `/api/wallet/*`, `/api/corridors/*`, `/api/admin/corridors/*`, `/api/admin/settlements/*`
> **Source Files:** `lib/serviceFeeCalculation.ts`, `lib/serviceFeeManagement.ts`, `app/api/financial/*/route.ts`

---

## Service Fee Flow Reference

1. **Load posted** -> Corridor auto-assigned based on route
2. **Trip acceptance** -> `validateWalletBalancesForTrip()` (validation only, no deduction)
3. **Trip completed** -> `deductServiceFee()` deducts from both shipper and carrier wallets
4. **Trip cancelled** -> No refund needed (nothing was taken pre-completion)

**Fee Formula:** `baseFee = distanceKm x pricePerKm` (with optional promo discount)

---

## A. Wallet Operations (FIN-001 to FIN-006)

### FIN-001: View wallet balance

| Field               | Value                                                        |
| ------------------- | ------------------------------------------------------------ |
| **Priority**        | P0                                                           |
| **Preconditions**   | Logged in as shipper/carrier with wallet                     |
| **Steps**           | 1. `GET /api/wallet/balance`                                 |
| **Expected Result** | 200 OK. Returns `balance`, `currency: "ETB"`, `accountType`. |
| **Status**          |                                                              |
| **Actual Result**   |                                                              |

### FIN-002: View wallet transactions

| Field               | Value                                                                       |
| ------------------- | --------------------------------------------------------------------------- |
| **Priority**        | P1                                                                          |
| **Preconditions**   | Wallet with transactions                                                    |
| **Steps**           | 1. `GET /api/wallet/transactions`                                           |
| **Expected Result** | 200 OK. List of journal entries: deposits, service fee deductions, refunds. |
| **Status**          |                                                                             |
| **Actual Result**   |                                                                             |

### FIN-003: Admin top-up shipper wallet

| Field               | Value                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                    |
| **Preconditions**   | Admin logged in, shipper wallet exists                                                                |
| **Steps**           | 1. `POST /api/admin/users/{id}/wallet/topup` with `{ amount: 5000 }`                                  |
| **Expected Result** | 200 OK. Wallet balance increased by 5000 ETB. JournalEntry `DEPOSIT` created with debit/credit lines. |
| **Status**          |                                                                                                       |
| **Actual Result**   |                                                                                                       |

### FIN-004: View financial account (admin)

| Field               | Value                                                               |
| ------------------- | ------------------------------------------------------------------- |
| **Priority**        | P1                                                                  |
| **Preconditions**   | Admin role                                                          |
| **Steps**           | 1. `GET /api/admin/users/{id}/wallet`                               |
| **Expected Result** | 200 OK. Wallet details: balance, account type, transaction history. |
| **Status**          |                                                                     |
| **Actual Result**   |                                                                     |

### FIN-005: Request withdrawal

| Field               | Value                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                              |
| **Preconditions**   | Wallet with sufficient balance                                                                  |
| **Steps**           | 1. `POST /api/financial/withdraw` with `{ amount: 1000, bankAccount, bankName, accountHolder }` |
| **Expected Result** | 201 Created. WithdrawalRequest with `status: PENDING`. Balance not yet deducted.                |
| **Status**          |                                                                                                 |
| **Actual Result**   |                                                                                                 |

### FIN-006: Admin approves withdrawal

| Field               | Value                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                          |
| **Preconditions**   | Pending withdrawal, admin role                                                              |
| **Steps**           | 1. `PUT /api/admin/settlements/{id}/approve` with `{ action: "approve" }`                   |
| **Expected Result** | 200 OK. Withdrawal `status: APPROVED`. Balance deducted. JournalEntry `WITHDRAWAL` created. |
| **Status**          |                                                                                             |
| **Actual Result**   |                                                                                             |

---

## B. Corridor Management (FIN-007 to FIN-012)

### FIN-007: Create corridor

| Field               | Value                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                                                                                                                |
| **Preconditions**   | Admin logged in                                                                                                                                                                                   |
| **Steps**           | 1. `POST /api/admin/corridors` with `{ name: "Addis Ababa - Dire Dawa", originRegion, destinationRegion, distanceKm: 450, shipperPricePerKm: 2.5, carrierPricePerKm: 1.0, direction: "ONE_WAY" }` |
| **Expected Result** | 201 Created. Corridor with `isActive: true`, both party pricing.                                                                                                                                  |
| **Status**          |                                                                                                                                                                                                   |
| **Actual Result**   |                                                                                                                                                                                                   |

### FIN-008: Update corridor pricing

| Field               | Value                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                                                |
| **Preconditions**   | Active corridor, admin role                                                                                       |
| **Steps**           | 1. `PUT /api/admin/corridors/{id}` with `{ shipperPricePerKm: 3.0, shipperPromoFlag: true, shipperPromoPct: 10 }` |
| **Expected Result** | 200 OK. Corridor pricing updated. Promo active with 10% discount for shippers.                                    |
| **Status**          |                                                                                                                   |
| **Actual Result**   |                                                                                                                   |

### FIN-009: Deactivate corridor

| Field               | Value                                                                       |
| ------------------- | --------------------------------------------------------------------------- |
| **Priority**        | P1                                                                          |
| **Preconditions**   | Active corridor                                                             |
| **Steps**           | 1. `PUT /api/admin/corridors/{id}` with `{ isActive: false }`               |
| **Expected Result** | 200 OK. `isActive: false`. New loads on this route won't get auto-corridor. |
| **Status**          |                                                                             |
| **Actual Result**   |                                                                             |

### FIN-010: Corridor match - exact

| Field               | Value                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                                    |
| **Preconditions**   | ONE_WAY corridor Addis->Dire Dawa                                                                     |
| **Steps**           | 1. `POST /api/corridors/match` with `{ originRegion: "Addis Ababa", destinationRegion: "Dire Dawa" }` |
| **Expected Result** | 200 OK. Returns corridor with `matchType: "exact"`.                                                   |
| **Status**          |                                                                                                       |
| **Actual Result**   |                                                                                                       |

### FIN-011: Corridor match - bidirectional

| Field               | Value                                                     |
| ------------------- | --------------------------------------------------------- |
| **Priority**        | P1                                                        |
| **Preconditions**   | BIDIRECTIONAL corridor exists                             |
| **Steps**           | 1. Match with reversed origin/destination                 |
| **Expected Result** | 200 OK. Corridor found with `matchType: "bidirectional"`. |
| **Status**          |                                                           |
| **Actual Result**   |                                                           |

### FIN-012: Corridor match - no match

| Field               | Value                                                 |
| ------------------- | ----------------------------------------------------- |
| **Priority**        | P2                                                    |
| **Preconditions**   | No corridor for given route                           |
| **Steps**           | 1. `POST /api/corridors/match` with unmatched regions |
| **Expected Result** | 200 OK with null/empty result. Fees will be waived.   |
| **Status**          |                                                       |
| **Actual Result**   |                                                       |

---

## C. Service Fee Calculation (FIN-013 to FIN-018)

### FIN-013: Calculate fee preview

| Field               | Value                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                                  |
| **Preconditions**   | Active corridor                                                                                                     |
| **Steps**           | 1. `POST /api/corridors/calculate-fee` with `{ originRegion, destinationRegion }`                                   |
| **Expected Result** | 200 OK. `shipper: { baseFee, discount, finalFee }`, `carrier: { baseFee, discount, finalFee }`, `totalPlatformFee`. |
| **Status**          |                                                                                                                     |
| **Actual Result**   |                                                                                                                     |

### FIN-014: Fee with promo discount

| Field               | Value                                                           |
| ------------------- | --------------------------------------------------------------- |
| **Priority**        | P1                                                              |
| **Preconditions**   | Corridor with `shipperPromoFlag: true`, `shipperPromoPct: 15`   |
| **Steps**           | 1. Calculate fee for corridor with 450km, 2.5 ETB/km, 15% promo |
| **Expected Result** | `baseFee = 1125.00`, `discount = 168.75`, `finalFee = 956.25`.  |
| **Status**          |                                                                 |
| **Actual Result**   |                                                                 |

### FIN-015: Fee with zero carrier price

| Field               | Value                                                                      |
| ------------------- | -------------------------------------------------------------------------- |
| **Priority**        | P2                                                                         |
| **Preconditions**   | Corridor with `carrierPricePerKm: 0`                                       |
| **Steps**           | 1. Calculate fee                                                           |
| **Expected Result** | Carrier fee = 0. Only shipper pays. `totalPlatformFee` = shipper fee only. |
| **Status**          |                                                                            |
| **Actual Result**   |                                                                            |

### FIN-016: Fee with invalid inputs

| Field               | Value                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------- |
| **Priority**        | P2                                                                                          |
| **Preconditions**   | None                                                                                        |
| **Steps**           | 1. Calculate fee with `distanceKm: -100` or `pricePerKm: 0`                                 |
| **Expected Result** | Returns zero fees (per `calculatePartyFee` validation: returns 0 for negative/zero inputs). |
| **Status**          |                                                                                             |
| **Actual Result**   |                                                                                             |

### FIN-017: Fee uses actual GPS distance when available

| Field               | Value                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                                                               |
| **Preconditions**   | Load with `actualTripKm` from GPS                                                                                                |
| **Steps**           | 1. Complete trip where GPS tracked 480km (corridor is 450km)                                                                     |
| **Expected Result** | Fee calculated on 480km (actual), not 450km (corridor). Priority: actualTripKm > estimatedTripKm > tripKm > corridor.distanceKm. |
| **Status**          |                                                                                                                                  |
| **Actual Result**   |                                                                                                                                  |

### FIN-018: Service fee metrics

| Field               | Value                                                                        |
| ------------------- | ---------------------------------------------------------------------------- |
| **Priority**        | P2                                                                           |
| **Preconditions**   | Admin role, completed trips with fees                                        |
| **Steps**           | 1. `GET /api/admin/service-fees/metrics`                                     |
| **Expected Result** | 200 OK. Aggregated fee data: total collected, by corridor, average per trip. |
| **Status**          |                                                                              |
| **Actual Result**   |                                                                              |

---

## D. Fee Deduction & Refund (FIN-019 to FIN-024)

### FIN-019: Deduct service fees on trip completion

| Field               | Value                                                                                                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                                                                                                                                                        |
| **Preconditions**   | Load → COMPLETED, both wallets have sufficient balance                                                                                                                                                                                    |
| **Steps**           | 1. Complete trip (DELIVERED -> COMPLETED)                                                                                                                                                                                                 |
| **Expected Result** | Shipper wallet debited by shipper fee. Carrier wallet debited by carrier fee. Platform revenue credited by total. JournalEntry `SERVICE_FEE_DEDUCT` with balanced lines. Load `shipperFeeStatus: DEDUCTED`, `carrierFeeStatus: DEDUCTED`. |
| **Status**          |                                                                                                                                                                                                                                           |
| **Actual Result**   |                                                                                                                                                                                                                                           |

### FIN-020: Double-entry accounting verification

| Field               | Value                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                                  |
| **Preconditions**   | Fee deduction completed                                                                                             |
| **Steps**           | 1. Query JournalEntry for the load 2. Sum debit lines 3. Sum credit lines                                           |
| **Expected Result** | Total debits = Total credits (balanced). Debit lines from shipper+carrier wallets, credit line to platform revenue. |
| **Status**          |                                                                                                                     |
| **Actual Result**   |                                                                                                                     |

### FIN-021: Fee deduction with insufficient balance

| Field               | Value                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                                                      |
| **Preconditions**   | Shipper wallet with 0 balance                                                                                           |
| **Steps**           | 1. Complete trip                                                                                                        |
| **Expected Result** | Transaction fails atomically. No partial deduction. `shipperFeeStatus: PENDING`. Error: "Insufficient shipper balance". |
| **Status**          |                                                                                                                         |
| **Actual Result**   |                                                                                                                         |

### FIN-022: Prevent double fee deduction

| Field               | Value                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                            |
| **Preconditions**   | Fees already deducted for load                                                                |
| **Steps**           | 1. Call `deductServiceFee()` again for same load                                              |
| **Expected Result** | Returns `{ success: false, error: "Service fees already deducted" }`. No duplicate deduction. |
| **Status**          |                                                                                               |
| **Actual Result**   |                                                                                               |

### FIN-023: Wallet balance validation before trip acceptance

| Field               | Value                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                                      |
| **Preconditions**   | Load with corridor, carrier accepting                                                                   |
| **Steps**           | 1. Carrier with 0 balance tries to accept load requiring 500 ETB fee                                    |
| **Expected Result** | Validation fails: "Carrier has insufficient wallet balance. Required: 500.00 ETB, Available: 0.00 ETB". |
| **Status**          |                                                                                                         |
| **Actual Result**   |                                                                                                         |

### FIN-024: Fee waived when no corridor matches

| Field               | Value                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                        |
| **Preconditions**   | Load on route with no matching corridor                                                   |
| **Steps**           | 1. Complete trip for load without corridor                                                |
| **Expected Result** | Both fees waived: `shipperFeeStatus: WAIVED`, `carrierFeeStatus: WAIVED`. Zero deduction. |
| **Status**          |                                                                                           |
| **Actual Result**   |                                                                                           |

---

## E. Settlement Automation (FIN-025 to FIN-026)

### FIN-025: Settlement automation configuration

| Field               | Value                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                                                  |
| **Preconditions**   | Admin role                                                                                                          |
| **Steps**           | 1. `GET /api/admin/settlement-automation` 2. `PUT` with updated settings                                            |
| **Expected Result** | 200 OK. SystemSettings updated: `settlementAutomationEnabled`, `autoVerifyPodEnabled`, `autoVerifyPodTimeoutHours`. |
| **Status**          |                                                                                                                     |
| **Actual Result**   |                                                                                                                     |

### FIN-026: Auto-settle cron job

| Field               | Value                                                       |
| ------------------- | ----------------------------------------------------------- |
| **Priority**        | P2                                                          |
| **Preconditions**   | DELIVERED loads with POD uploaded 24+ hrs ago               |
| **Steps**           | 1. `POST /api/cron/auto-settle`                             |
| **Expected Result** | PODs auto-verified. Trips completed. Service fees deducted. |
| **Status**          |                                                             |
| **Actual Result**   |                                                             |
