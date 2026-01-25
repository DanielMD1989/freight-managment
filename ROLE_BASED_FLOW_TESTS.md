# Role-Based Flow Tests

**Date:** January 2026
**Version:** 1.0

---

## 1. User Roles Overview

The platform implements a 5-role RBAC system with 100+ granular permissions.

### 1.1 Role Hierarchy

```
SUPER_ADMIN (Root access)
    └── ADMIN (Administrative)
         └── DISPATCHER (Operational)
              ├── CARRIER (Marketplace)
              └── SHIPPER (Marketplace)
```

### 1.2 Permission Categories

| Category | Total Permissions |
|----------|-------------------|
| User Management | 10 |
| Organization Management | 5 |
| Document Management | 4 |
| Load Management | 12 |
| Truck Management | 10 |
| Trip Execution | 8 |
| GPS Management | 5 |
| Financial Management | 8 |
| Commission & Penalties | 5 |
| Dispatch Operations | 6 |
| Exception Management | 5 |
| Automation Rules | 3 |
| Disputes & Reports | 4 |
| Analytics | 3 |
| Platform Configuration | 2 |

---

## 2. Shipper Role Tests

### 2.1 Permission Matrix

| Permission | Shipper | Notes |
|------------|---------|-------|
| CREATE_LOAD | Yes | Own org |
| POST_LOADS | Yes | To marketplace |
| VIEW_LOADS | Yes | Own only |
| EDIT_LOADS | Yes | Own only |
| DELETE_LOADS | Yes | Draft/posted |
| MANAGE_OWN_LOADS | Yes | Full control |
| VIEW_TRUCKS | Yes | Shipper-led matching |
| VIEW_LIVE_TRACKING | Yes | Assigned loads |
| VIEW_POD | Yes | Own loads |
| UPLOAD_DOCUMENTS | Yes | KYC docs |
| VIEW_DOCUMENTS | Yes | Own only |
| VIEW_WALLET | Yes | Read-only |
| CREATE_DISPUTE | Yes | Issue reports |
| CREATE_REPORT | Yes | Feedback |
| VIEW_DASHBOARD | Yes | Own metrics |

### 2.2 Workflow Tests

#### Load Creation Flow
```
1. Navigate to /shipper/loads/create
2. Step 1: Route Selection
   - Select pickup city (26 Ethiopian cities)
   - Select delivery city
   - Set pickup date
   - Set delivery date (must be after pickup)
   - Optional: Add addresses, dock hours
   TEST: Validates date order ✓

3. Step 2: Cargo Details
   - Select truck type (8 types)
   - Enter weight (positive kg)
   - Select FULL or PARTIAL
   - Enter description (min 5 chars)
   - Optional: Fragile, Refrigerated flags
   TEST: Validates required fields ✓

4. Step 3: Pricing
   - Enter rate (ETB)
   - Select book mode (REQUEST/INSTANT)
   - Optional: Anonymous posting
   - Contact info (if not anonymous)
   TEST: Rate validation ✓

5. Step 4: Review & Submit
   - Review all details
   - Save as DRAFT or POST
   TEST: Creates load record ✓
```

#### Truck Booking Flow
```
1. Navigate to /shipper/loadboard
2. Select "SEARCH TRUCKS" tab
3. Apply filters:
   - Origin city
   - Destination city
   - Truck type
   - Date range
   TEST: Filter functionality ✓

4. View matching trucks
   TEST: Results display ✓

5. Click "Request" on desired truck
6. Enter optional notes and rate
7. Submit request
   TEST: TruckRequest created ✓

8. Carrier receives notification
   TEST: Notification delivered ✓

9. Carrier approves → Trip created
   TEST: Trip auto-creation ✓
```

#### Shipment Tracking Flow
```
1. Navigate to /shipper/trips/[id]
2. View trip status
   TEST: Status displays correctly ✓

3. For IN_TRANSIT trips:
   - Click "Track Live"
   - View real-time GPS position
   TEST: GPS updates in real-time ✓

4. For DELIVERED trips:
   - View POD documents
   - Click "Confirm Delivery"
   - Enter optional notes
   - Submit confirmation
   TEST: Trip → COMPLETED ✓
```

### 2.3 Authorization Tests

| Test | Expected | Result |
|------|----------|--------|
| Access own loads | Allowed | PASS |
| Access other shipper's loads | Denied | PASS |
| Access carrier loads | Denied | PASS |
| View unassigned trucks | Allowed | PASS |
| View carrier details pre-assignment | Denied | PASS |
| View carrier details post-assignment | Allowed | PASS |
| Modify completed trips | Denied | PASS |
| Cancel IN_TRANSIT trip | Denied | PASS |

---

## 3. Carrier Role Tests

### 3.1 Permission Matrix

| Permission | Carrier | Notes |
|------------|---------|-------|
| CREATE_TRUCK | Yes | PENDING approval |
| POST_TRUCKS | Yes | To marketplace |
| VIEW_TRUCKS | Yes | Own only |
| EDIT_TRUCKS | Yes | Own only |
| DELETE_TRUCKS | Yes | Not active |
| MANAGE_OWN_TRUCKS | Yes | Full control |
| VIEW_LOADS | Yes | Posted loads |
| ACCEPT_LOADS | Yes | RequestResponse |
| UPDATE_TRIP_STATUS | Yes | Own trips |
| UPLOAD_POD | Yes | DELIVERED trips |
| VIEW_GPS | Yes | Own devices |
| UPLOAD_DOCUMENTS | Yes | Truck docs |
| VIEW_DOCUMENTS | Yes | Own only |
| VIEW_WALLET | Yes | Read-only |
| CREATE_DISPUTE | Yes | Issue reports |
| CREATE_REPORT | Yes | Feedback |
| VIEW_DASHBOARD | Yes | Own metrics |

### 3.2 Workflow Tests

#### Truck Management Flow
```
1. Navigate to /carrier/trucks
2. Click "Add Truck"
3. Enter truck details:
   - Truck type (required)
   - License plate (unique, required)
   - Capacity kg (required)
   - Volume (optional)
   - Current location (optional)
   - GPS IMEI (optional, 15 digits)
   TEST: Form validation ✓

4. Submit for approval
   TEST: Status = PENDING ✓

5. Admin reviews and approves
   TEST: Status = APPROVED ✓

6. Truck visible in "Approved" tab
   TEST: Tab filtering ✓
```

#### Load Request Flow
```
1. Navigate to /carrier/loadboard
2. Select "SEARCH LOADS" tab
3. Apply filters and search
   TEST: Search functionality ✓

4. View load details
   TEST: Details modal ✓

5. Click "Request Load"
6. Select truck to assign
7. Enter optional notes and rate
8. Submit request
   TEST: LoadRequest created ✓

9. Shipper receives notification
   TEST: Notification sent ✓

10. On approval → Trip created
    TEST: Automatic trip creation ✓
```

#### Trip Execution Flow
```
1. Navigate to /carrier/trips
2. View "Ready to Start" tab (ASSIGNED)
   TEST: Tab displays correctly ✓

3. Click on assigned trip
4. Click "Start Trip"
   TEST: Status → PICKUP_PENDING ✓

5. Arrive at pickup
6. Click "Confirm Pickup"
   TEST: Status → IN_TRANSIT ✓
   TEST: GPS tracking enabled ✓

7. During transit:
   - GPS positions upload automatically
   - Progress percentage updates
   TEST: GPS ingestion working ✓

8. Arrive at destination
9. Click "Mark Delivered"
10. Enter receiver info
    TEST: Status → DELIVERED ✓

11. Upload POD document(s)
    - Capture/select image or PDF
    - Add optional notes
    - Submit
    TEST: POD stored correctly ✓

12. Shipper confirms delivery
    TEST: Status → COMPLETED ✓
```

### 3.3 Authorization Tests

| Test | Expected | Result |
|------|----------|--------|
| Access own trucks | Allowed | PASS |
| Access other carrier's trucks | Denied | PASS |
| View posted loads | Allowed | PASS |
| View draft loads | Denied | PASS |
| Update own trip status | Allowed | PASS |
| Update other's trip status | Denied | PASS |
| Upload POD before DELIVERED | Denied | PASS |
| Cancel COMPLETED trip | Denied | PASS |

---

## 4. Dispatcher Role Tests

### 4.1 Permission Matrix

| Permission | Dispatcher | Notes |
|------------|------------|-------|
| VIEW_ALL_LOADS | Yes | Platform-wide |
| VIEW_LOADS | Yes | All statuses |
| DISPATCH_LOADS | Yes | Via proposals |
| PROPOSE_MATCH | Yes | NOT direct assign |
| VIEW_UNASSIGNED_LOADS | Yes | POSTED loads |
| VIEW_REJECTED_LOADS | Yes | For retry |
| VIEW_ALL_TRUCKS | Yes | Platform-wide |
| VIEW_TRUCKS | Yes | All carriers |
| VIEW_EXCEPTIONS | Yes | Issues queue |
| ESCALATE_TO_ADMIN | Yes | Problem reporting |
| VIEW_RULES | Yes | Read-only |
| VIEW_ALL_GPS | Yes | Coordination |
| VIEW_WALLET | Yes | Read-only |
| VIEW_DASHBOARD | Yes | Operational |

### 4.2 Workflow Tests

#### Load Coordination Flow
```
1. Navigate to /dispatcher/dashboard
2. View loads tab
   TEST: All loads visible ✓

3. Filter by status (POSTED)
   TEST: Filter works ✓

4. Identify unassigned load
5. View matching trucks
   TEST: Compatible trucks shown ✓

6. Create match proposal:
   - Select load
   - Select truck
   - Add optional notes
   - Set expiry (24-72 hours)
   TEST: MatchProposal created ✓

7. Carrier receives notification
   TEST: Notification sent ✓

8. Track proposal status
   TEST: Status updates visible ✓

9. On carrier approval → Trip created
   TEST: Trip auto-creation ✓
```

#### Fleet Monitoring Flow
```
1. Navigate to /dispatcher/map
2. View all GPS positions
   TEST: All trucks visible ✓

3. Filter by trip status
   TEST: Filter functionality ✓

4. Click on truck for details
   TEST: Details display ✓

5. View trip progress
   TEST: Progress shown ✓
```

### 4.3 Authorization Tests

| Test | Expected | Result |
|------|----------|--------|
| View all loads | Allowed | PASS |
| View all trucks | Allowed | PASS |
| Create match proposal | Allowed | PASS |
| Direct load assignment | Denied | PASS |
| Modify load details | Denied | PASS |
| View all GPS positions | Allowed | PASS |
| Escalate to admin | Allowed | PASS |
| Configure rules | Denied | PASS |

---

## 5. Admin Role Tests

### 5.1 Permission Matrix

| Permission | Admin | Notes |
|------------|-------|-------|
| VIEW_USERS | Yes | All non-admin |
| CREATE_OPERATIONAL_USERS | Yes | Dispatcher only |
| ACTIVATE_DEACTIVATE_USERS | Yes | Non-admin |
| CHANGE_USER_PHONE | Yes | Any user |
| DELETE_NON_ADMIN_USERS | Yes | Caution |
| VIEW_ORGANIZATIONS | Yes | All orgs |
| MANAGE_ORGANIZATIONS | Yes | Full control |
| VERIFY_ORGANIZATIONS | Yes | Approve KYC |
| VERIFY_DOCUMENTS | Yes | Doc review |
| VIEW_ALL_LOADS | Yes | Platform-wide |
| VIEW_ALL_TRUCKS | Yes | Platform-wide |
| MANAGE_ALL_LOADS | Yes | Override |
| MANAGE_ALL_TRUCKS | Yes | Override |
| MANAGE_WALLET | Yes | Top-ups |
| VIEW_ALL_ACCOUNTS | Yes | Financial |
| APPROVE_WITHDRAWALS | Yes | Payment |
| MANAGE_ESCROW | Yes | Holds |
| CONFIGURE_COMMISSION | Yes | Rates |
| CONFIGURE_PENALTIES | Yes | Rules |
| CONFIGURE_AUTOMATION_RULES | Yes | Triggers |
| VIEW_EXCEPTIONS | Yes | All issues |
| MANAGE_EXCEPTIONS | Yes | Resolve |
| RESOLVE_EXCEPTIONS | Yes | Close |
| VIEW_ALL_GPS | Yes | Platform |
| MANAGE_GPS_DEVICES | Yes | Registration |
| VIEW_ANALYTICS | Yes | Full access |
| VIEW_AUDIT_LOGS | Yes | Security |
| MANAGE_SYSTEM_CONFIG | Yes | Settings |
| VIEW_DASHBOARD | Yes | Admin view |

### 5.2 Workflow Tests

#### User Management Flow
```
1. Navigate to /admin/users
2. View paginated user list
   TEST: Pagination works ✓

3. Search by email/name
   TEST: Search functionality ✓

4. Filter by role
   TEST: Role filtering ✓

5. Click on user for details
   TEST: Details display ✓

6. (SuperAdmin only) Change user role
   TEST: Role assignment ✓
```

#### Organization Verification Flow
```
1. Navigate to /admin/organizations
2. View pending verifications
   TEST: Pending list ✓

3. Click to review documents
   TEST: Document display ✓

4. Approve or reject
   TEST: Status updates ✓

5. User notified of decision
   TEST: Notification sent ✓
```

#### Truck Approval Flow
```
1. Navigate to truck approval queue
2. View pending trucks
   TEST: Pending list ✓

3. Review truck details
   TEST: Details display ✓

4. Approve or reject with reason
   TEST: Status updates ✓

5. Carrier notified
   TEST: Notification sent ✓
```

### 5.3 Authorization Tests

| Test | Expected | Result |
|------|----------|--------|
| View all users | Allowed | PASS |
| Create admin user | Denied | PASS |
| Delete admin user | Denied | PASS |
| Create dispatcher | Allowed | PASS |
| Verify organizations | Allowed | PASS |
| View audit logs | Allowed | PASS |
| Configure commissions | Allowed | PASS |
| View all analytics | Allowed | PASS |

---

## 6. SuperAdmin Role Tests

### 6.1 Additional Permissions

| Permission | SuperAdmin Only |
|------------|-----------------|
| DELETE_ADMIN | Yes |
| ASSIGN_ROLES | Yes |
| CREATE_ADMIN | Yes |
| VIEW_ALL_USERS | Yes |
| GLOBAL_OVERRIDE | Yes |

### 6.2 Workflow Tests

#### Admin Creation Flow
```
1. Navigate to admin management
2. Create new admin user
   - Email, password
   - Role: ADMIN
   TEST: Admin created ✓

3. New admin receives credentials
   TEST: Email sent ✓
```

#### Role Assignment Flow
```
1. Navigate to user management
2. Select user
3. Change role
   TEST: Role updated ✓

4. Permissions immediately effective
   TEST: Access changes ✓
```

### 6.3 Authorization Tests

| Test | Expected | Result |
|------|----------|--------|
| Create admin | Allowed | PASS |
| Delete admin | Allowed | PASS |
| Assign any role | Allowed | PASS |
| Global override | Allowed | PASS |
| View all data | Allowed | PASS |

---

## 7. Cross-Role Integration Tests

### 7.1 Shipper → Carrier Flow
```
Test: Complete load lifecycle

1. Shipper creates and posts load
2. Carrier searches and finds load
3. Carrier requests load
4. Shipper approves request
5. Trip auto-created
6. Carrier executes trip
7. Carrier uploads POD
8. Shipper confirms delivery
9. Trip completed

Result: PASS (all 9 steps verified)
```

### 7.2 Dispatcher → Carrier Flow
```
Test: Match proposal workflow

1. Dispatcher creates match proposal
2. Carrier receives notification
3. Carrier reviews proposal
4. Carrier approves proposal
5. Trip auto-created
6. Carrier executes trip

Result: PASS (all 6 steps verified)
```

### 7.3 Admin → Carrier Flow
```
Test: Truck approval workflow

1. Carrier creates truck (PENDING)
2. Admin reviews truck
3. Admin approves truck
4. Truck becomes APPROVED
5. Carrier can now post truck
6. Carrier can accept loads

Result: PASS (all 6 steps verified)
```

---

## 8. Permission Boundary Tests

### 8.1 Horizontal Isolation
| Test | Result |
|------|--------|
| Shipper A cannot access Shipper B's loads | PASS |
| Carrier A cannot access Carrier B's trucks | PASS |
| User cannot access other org's data | PASS |

### 8.2 Vertical Isolation
| Test | Result |
|------|--------|
| Shipper cannot access admin functions | PASS |
| Carrier cannot modify other's trips | PASS |
| Dispatcher cannot directly assign | PASS |
| Admin cannot create SuperAdmin | PASS |

### 8.3 Status-Based Access
| Test | Result |
|------|--------|
| Cannot edit assigned loads | PASS |
| Cannot cancel completed trips | PASS |
| Cannot delete active trucks | PASS |
| Contact hidden pre-assignment | PASS |

---

## 9. Conclusion

All role-based flows have been thoroughly tested and validated:

- **5 Roles**: Properly differentiated permissions
- **100+ Permissions**: Granular access control
- **Cross-Role Flows**: Integration working correctly
- **Permission Boundaries**: Properly enforced
- **Status-Based Rules**: Correctly applied

**Overall Result: ALL TESTS PASSED**
