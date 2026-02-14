# 15 - Mobile App (MOB-xxx)

> **Total Tests:** 28
> **Priority Breakdown:** P0: 6 | P1: 10 | P2: 8 | P3: 4
> **Platform:** Flutter (Android/iOS)
> **Total Screens:** 35 (Auth: 2, Carrier: 15, Shipper: 12, Shared: 5, Onboarding: 1)

---

## Mobile Screens Reference

### Auth (2 screens)

- `login_screen.dart`
- `register_screen.dart`

### Carrier (15 screens)

- `carrier_home_screen.dart`, `carrier_trucks_screen.dart`, `truck_details_screen.dart`
- `edit_truck_screen.dart`, `add_truck_screen.dart`, `carrier_trips_screen.dart`
- `carrier_trip_details_screen.dart`, `carrier_loads_screen.dart`, `load_details_screen.dart`
- `pod_upload_screen.dart`, `carrier_map_screen.dart`, `carrier_loadboard_screen.dart`
- `carrier_load_requests_screen.dart`, `carrier_truck_requests_screen.dart`, `carrier_post_trucks_screen.dart`

### Shipper (12 screens)

- `shipper_home_screen.dart`, `shipper_trucks_screen.dart`, `shipper_truck_details_screen.dart`
- `shipper_trips_screen.dart`, `shipper_trip_details_screen.dart`, `shipper_loads_screen.dart`
- `shipper_load_details_screen.dart`, `post_load_screen.dart`, `shipper_map_screen.dart`
- `shipper_truckboard_screen.dart`, `shipper_load_requests_screen.dart`, `shipper_truck_requests_screen.dart`

### Shared (5 screens)

- `notifications_screen.dart`, `profile_screen.dart`, `wallet_screen.dart`
- `settings_screen.dart`, `pending_verification_screen.dart`

### Onboarding (1 screen)

- `onboarding_screen.dart`

---

## A. Mobile Auth (MOB-001 to MOB-006)

### MOB-001: Mobile login

| Field               | Value                                                                              |
| ------------------- | ---------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                 |
| **Preconditions**   | Active user exists                                                                 |
| **Steps**           | 1. Open app 2. Enter email and password on login_screen 3. Tap login               |
| **Expected Result** | Successful login. JWT stored securely. Redirected to role-appropriate home screen. |
| **Status**          |                                                                                    |
| **Actual Result**   |                                                                                    |

### MOB-002: Mobile registration

| Field               | Value                                                    |
| ------------------- | -------------------------------------------------------- |
| **Priority**        | P0                                                       |
| **Preconditions**   | None                                                     |
| **Steps**           | 1. Tap "Register" 2. Fill registration form 3. Submit    |
| **Expected Result** | User created. Redirected to pending verification screen. |
| **Status**          |                                                          |
| **Actual Result**   |                                                          |

### MOB-003: Login with invalid credentials

| Field               | Value                                |
| ------------------- | ------------------------------------ |
| **Priority**        | P1                                   |
| **Preconditions**   | None                                 |
| **Steps**           | 1. Enter wrong password 2. Tap login |
| **Expected Result** | Error message displayed. No crash.   |
| **Status**          |                                      |
| **Actual Result**   |                                      |

### MOB-004: Session persistence

| Field               | Value                                            |
| ------------------- | ------------------------------------------------ |
| **Priority**        | P1                                               |
| **Preconditions**   | Logged in                                        |
| **Steps**           | 1. Close app 2. Reopen app                       |
| **Expected Result** | User still logged in. Token refreshed if needed. |
| **Status**          |                                                  |
| **Actual Result**   |                                                  |

### MOB-005: Onboarding screen

| Field               | Value                                                    |
| ------------------- | -------------------------------------------------------- |
| **Priority**        | P2                                                       |
| **Preconditions**   | First app launch                                         |
| **Steps**           | 1. Install and open app                                  |
| **Expected Result** | Onboarding screen shown. Can swipe through intro slides. |
| **Status**          |                                                          |
| **Actual Result**   |                                                          |

### MOB-006: Pending verification screen

| Field               | Value                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| **Priority**        | P1                                                                      |
| **Preconditions**   | Logged in as REGISTERED user                                            |
| **Steps**           | 1. Login as unverified user                                             |
| **Expected Result** | Redirected to pending_verification_screen. Cannot access main features. |
| **Status**          |                                                                         |
| **Actual Result**   |                                                                         |

---

## B. Shipper Mobile (MOB-007 to MOB-014)

### MOB-007: Shipper home screen

| Field               | Value                                                                         |
| ------------------- | ----------------------------------------------------------------------------- |
| **Priority**        | P0                                                                            |
| **Preconditions**   | Logged in as shipper                                                          |
| **Steps**           | 1. View shipper_home_screen                                                   |
| **Expected Result** | Dashboard: active loads count, active trips, wallet balance, recent activity. |
| **Status**          |                                                                               |
| **Actual Result**   |                                                                               |

### MOB-008: Post load from mobile

| Field               | Value                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                  |
| **Preconditions**   | Verified shipper                                                                                    |
| **Steps**           | 1. Navigate to post_load_screen 2. Fill form: pickup, delivery, truck type, weight, dates 3. Submit |
| **Expected Result** | Load created in DRAFT. Can then post to marketplace.                                                |
| **Status**          |                                                                                                     |
| **Actual Result**   |                                                                                                     |

### MOB-009: View loads list

| Field               | Value                                                                             |
| ------------------- | --------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                |
| **Preconditions**   | Shipper with loads                                                                |
| **Steps**           | 1. Navigate to shipper_loads_screen                                               |
| **Expected Result** | List of shipper's loads with status badges, dates, routes. Pull-to-refresh works. |
| **Status**          |                                                                                   |
| **Actual Result**   |                                                                                   |

### MOB-010: View load details

| Field               | Value                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                             |
| **Preconditions**   | Load exists                                                                                    |
| **Steps**           | 1. Tap load in list                                                                            |
| **Expected Result** | shipper_load_details_screen shows full details: status, assigned truck, service fee, tracking. |
| **Status**          |                                                                                                |
| **Actual Result**   |                                                                                                |

### MOB-011: Browse truckboard

| Field               | Value                                                                        |
| ------------------- | ---------------------------------------------------------------------------- |
| **Priority**        | P1                                                                           |
| **Preconditions**   | Active truck postings exist                                                  |
| **Steps**           | 1. Navigate to shipper_truckboard_screen                                     |
| **Expected Result** | List of available trucks with type, location, capacity. Filter/search works. |
| **Status**          |                                                                              |
| **Actual Result**   |                                                                              |

### MOB-012: Request truck from mobile

| Field               | Value                                                                  |
| ------------------- | ---------------------------------------------------------------------- |
| **Priority**        | P1                                                                     |
| **Preconditions**   | Viewed truck posting                                                   |
| **Steps**           | 1. View truck details 2. Tap "Request Truck" 3. Select load, add notes |
| **Expected Result** | TruckRequest created. Carrier notified.                                |
| **Status**          |                                                                        |
| **Actual Result**   |                                                                        |

### MOB-013: View shipper trips

| Field               | Value                                           |
| ------------------- | ----------------------------------------------- |
| **Priority**        | P1                                              |
| **Preconditions**   | Shipper with active/completed trips             |
| **Steps**           | 1. Navigate to shipper_trips_screen             |
| **Expected Result** | List of trips with status, carrier info, dates. |
| **Status**          |                                                 |
| **Actual Result**   |                                                 |

### MOB-014: Shipper map view

| Field               | Value                                             |
| ------------------- | ------------------------------------------------- |
| **Priority**        | P2                                                |
| **Preconditions**   | Active trips                                      |
| **Steps**           | 1. Navigate to shipper_map_screen                 |
| **Expected Result** | Map shows active trip routes and truck positions. |
| **Status**          |                                                   |
| **Actual Result**   |                                                   |

---

## C. Carrier Mobile (MOB-015 to MOB-024)

### MOB-015: Carrier home screen

| Field               | Value                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| **Priority**        | P0                                                                      |
| **Preconditions**   | Logged in as carrier                                                    |
| **Steps**           | 1. View carrier_home_screen                                             |
| **Expected Result** | Dashboard: truck count, active trips, pending requests, wallet balance. |
| **Status**          |                                                                         |
| **Actual Result**   |                                                                         |

### MOB-016: Add truck from mobile

| Field               | Value                                                           |
| ------------------- | --------------------------------------------------------------- |
| **Priority**        | P1                                                              |
| **Preconditions**   | Verified carrier                                                |
| **Steps**           | 1. Navigate to add_truck_screen 2. Fill truck details 3. Submit |
| **Expected Result** | Truck created with PENDING approval status.                     |
| **Status**          |                                                                 |
| **Actual Result**   |                                                                 |

### MOB-017: Post truck availability

| Field               | Value                                                                               |
| ------------------- | ----------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                  |
| **Preconditions**   | Approved truck exists                                                               |
| **Steps**           | 1. Navigate to carrier_post_trucks_screen 2. Select truck, set availability 3. Post |
| **Expected Result** | TruckPosting created. Truck appears in marketplace.                                 |
| **Status**          |                                                                                     |
| **Actual Result**   |                                                                                     |

### MOB-018: Browse loadboard

| Field               | Value                                                             |
| ------------------- | ----------------------------------------------------------------- |
| **Priority**        | P1                                                                |
| **Preconditions**   | Posted loads exist                                                |
| **Steps**           | 1. Navigate to carrier_loadboard_screen                           |
| **Expected Result** | List of posted loads with routes, truck type requirements, dates. |
| **Status**          |                                                                   |
| **Actual Result**   |                                                                   |

### MOB-019: Request load from mobile

| Field               | Value                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| **Priority**        | P1                                                                    |
| **Preconditions**   | Viewed load, approved truck                                           |
| **Steps**           | 1. View load details 2. Tap "Request Load" 3. Select truck, add notes |
| **Expected Result** | LoadRequest created. Shipper notified.                                |
| **Status**          |                                                                       |
| **Actual Result**   |                                                                       |

### MOB-020: Execute trip from mobile

| Field               | Value                                                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                                                      |
| **Preconditions**   | Assigned trip                                                                                                                           |
| **Steps**           | 1. View carrier_trip_details_screen 2. Tap "Start Trip" → PICKUP_PENDING 3. Tap "Picked Up" → IN_TRANSIT 4. Tap "Delivered" → DELIVERED |
| **Expected Result** | Trip status updates flow correctly through mobile.                                                                                      |
| **Status**          |                                                                                                                                         |
| **Actual Result**   |                                                                                                                                         |

### MOB-021: Upload POD from mobile

| Field               | Value                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| **Priority**        | P0                                                                      |
| **Preconditions**   | DELIVERED trip                                                          |
| **Steps**           | 1. Navigate to pod_upload_screen 2. Take photo or select file 3. Upload |
| **Expected Result** | POD uploaded. Trip can proceed to COMPLETED.                            |
| **Status**          |                                                                         |
| **Actual Result**   |                                                                         |

### MOB-022: Carrier map with GPS

| Field               | Value                                                  |
| ------------------- | ------------------------------------------------------ |
| **Priority**        | P2                                                     |
| **Preconditions**   | Active trip                                            |
| **Steps**           | 1. Navigate to carrier_map_screen                      |
| **Expected Result** | Map shows current position, route to destination, ETA. |
| **Status**          |                                                        |
| **Actual Result**   |                                                        |

### MOB-023: Respond to truck requests

| Field               | Value                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| **Priority**        | P2                                                                        |
| **Preconditions**   | Pending truck request for carrier's truck                                 |
| **Steps**           | 1. Navigate to carrier_truck_requests_screen 2. Approve or reject request |
| **Expected Result** | Request updated. If approved, load assigned.                              |
| **Status**          |                                                                           |
| **Actual Result**   |                                                                           |

### MOB-024: Respond to match proposals

| Field               | Value                                                                    |
| ------------------- | ------------------------------------------------------------------------ |
| **Priority**        | P2                                                                       |
| **Preconditions**   | Pending match proposal                                                   |
| **Steps**           | 1. Navigate to carrier_load_requests_screen 2. Accept or reject proposal |
| **Expected Result** | Proposal responded to. If accepted, trip created.                        |
| **Status**          |                                                                          |
| **Actual Result**   |                                                                          |

---

## D. Shared Mobile Features (MOB-025 to MOB-028)

### MOB-025: Notifications screen

| Field               | Value                                                                |
| ------------------- | -------------------------------------------------------------------- |
| **Priority**        | P1                                                                   |
| **Preconditions**   | User with notifications                                              |
| **Steps**           | 1. Navigate to notifications_screen                                  |
| **Expected Result** | List of notifications. Can mark as read. Unread badge count updates. |
| **Status**          |                                                                      |
| **Actual Result**   |                                                                      |

### MOB-026: Profile screen

| Field               | Value                                                 |
| ------------------- | ----------------------------------------------------- |
| **Priority**        | P2                                                    |
| **Preconditions**   | Logged in                                             |
| **Steps**           | 1. Navigate to profile_screen                         |
| **Expected Result** | Shows user info, organization details. Can edit name. |
| **Status**          |                                                       |
| **Actual Result**   |                                                       |

### MOB-027: Wallet screen

| Field               | Value                               |
| ------------------- | ----------------------------------- |
| **Priority**        | P2                                  |
| **Preconditions**   | Logged in with wallet               |
| **Steps**           | 1. Navigate to wallet_screen        |
| **Expected Result** | Shows balance, recent transactions. |
| **Status**          |                                     |
| **Actual Result**   |                                     |

### MOB-028: Settings screen

| Field               | Value                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| **Priority**        | P3                                                                                                |
| **Preconditions**   | Logged in                                                                                         |
| **Steps**           | 1. Navigate to settings_screen                                                                    |
| **Expected Result** | Language toggle (EN/AM), notification preferences, logout button. Localization works for Amharic. |
| **Status**          |                                                                                                   |
| **Actual Result**   |                                                                                                   |
