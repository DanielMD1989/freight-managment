# Admin Panel Fixes Applied

**Date:** 2026-02-06
**Based on:** ADMIN-AUDIT.md

---

## Summary

| Priority | Issues Fixed | Files Changed |
|----------|-------------|---------------|
| P1 (Broken) | 3 | 6 |
| P2 (Consistency) | 3 | 3 |
| **TOTAL** | **6** | **9** |

---

## Priority 1: Broken Functionality

### 1.1 Organizations Page - Wrong API

**Files Changed:**
- `app/admin/organizations/page.tsx` (line 66)
- `app/api/admin/organizations/route.ts`

**Before:**
```typescript
const response = await fetch(`${baseUrl}/api/organizations?${params}`, {
```

**After:**
```typescript
const response = await fetch(`${baseUrl}/api/admin/organizations?${params}`, {
```

**API Updates:**
The `/api/admin/organizations` route now returns all fields needed by the client:
- Added: `description`, `city`, `verifiedAt`
- Added: `_count` object for backward compatibility
- Keeps existing: `userCount`, `loadCount`, `truckCount`

---

### 1.2 User Edit Flow - Missing Detail Page

**Files Created:**
- `app/admin/users/[id]/page.tsx`
- `app/admin/users/[id]/UserDetailClient.tsx`

**File Updated:**
- `app/admin/users/UserManagementClient.tsx` (line 345)

**Before:**
```typescript
onClick={() => alert(`Edit functionality coming soon for user ${user.id}`)}
```

**After:**
```typescript
onClick={() => router.push(`/admin/users/${user.id}`)}
```

**Features:**
- View complete user details
- Edit phone number
- Change user status
- Delete user (soft delete)
- Role-based access control (Admin can edit Carrier/Shipper/Dispatcher, SuperAdmin can edit all)

---

### 1.3 Verification Documents - Missing User Data

**File Changed:**
- `app/api/admin/documents/route.ts`

**Issue:**
The API was not returning `uploadedBy` and `verifiedBy` fields that the frontend expected.

**Fix:**
Added helper function to fetch user details by ID:
```typescript
const fetchUserDetails = async (userIds: string[]) => {
  if (userIds.length === 0) return new Map();
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  return new Map(users.map(u => [u.id, u]));
};
```

Now documents include:
- `uploadedBy: { id, email, firstName, lastName }`
- `verifiedBy: { id, email, firstName, lastName } | null`

---

## Priority 2: Data Consistency

### 2.1 Centralized Admin Metrics

**File Created:**
- `lib/admin/metrics.ts`

**Purpose:**
Single source of truth for all admin metric calculations. All admin endpoints should use these functions.

**Key Functions:**
```typescript
// Core metrics
getCountMetrics()      // totalUsers, totalOrganizations, totalLoads, totalTrucks
getLoadMetrics()       // Full load breakdown by status
getTripMetrics()       // Full trip breakdown by status (uses Trip model)
getTruckMetrics()      // Available, unavailable, by approval status
getRevenueMetrics()    // Platform balance, service fees, pending withdrawals
getDisputeMetrics()    // Open, under review, resolved

// Composite
getAdminDashboardMetrics()  // All metrics in one call

// Period-based
getDateRangeForPeriod()     // Consistent date range calculation
getPeriodMetrics()          // New entities in time period
getChartData()              // Time series data for charts
```

**Constants:**
```typescript
LOAD_STATUSES         // All 13 LoadStatus values
ACTIVE_LOAD_STATUSES  // POSTED, SEARCHING, OFFERED
IN_PROGRESS_LOAD_STATUSES  // ASSIGNED, PICKUP_PENDING, IN_TRANSIT
TRIP_STATUSES         // All 6 TripStatus values
ACTIVE_TRIP_STATUSES  // ASSIGNED, PICKUP_PENDING, IN_TRANSIT
```

---

### 2.2 Active Trips Inconsistency

**Files Updated:**
- `app/api/admin/dashboard/route.ts`
- `app/api/admin/analytics/route.ts`

**Before (analytics):**
```typescript
// Used Load model for trips
db.load.count({ where: { status: 'DELIVERED' } })
db.load.count({ where: { status: 'IN_TRANSIT' } })
```

**After (both):**
```typescript
// Uses Trip model via centralized metrics
const trips = await getTripMetrics();
// trips.active uses Trip model status: { in: ['ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT'] }
```

**Key Decision:**
- **Trip model** is the correct model for trip-related metrics
- A Load exists before assignment; a Trip represents an actual carrier assignment
- Both dashboard and analytics now use the same Trip-based calculations

---

### 2.3 Revenue Calculation

**Before:**
Dashboard used `PLATFORM_REVENUE` account, analytics used `serviceFeeEtb` sum.

**After:**
Both use the same approach via `getRevenueMetrics()`:
```typescript
{
  platformBalance: Number(platformAccount?.balance || 0),  // From PLATFORM_REVENUE account
  serviceFeeCollected: Number(serviceFees._sum.serviceFeeEtb || 0),  // Period sum
  pendingWithdrawals: count
}
```

**Note on serviceFeeEtb:**
The legacy `serviceFeeEtb` field is still used for service fee calculations because:
1. It's the established field in the schema
2. It's consistently populated when fees are deducted
3. Changing to JournalEntry would require migration of historical data

---

## Files Changed Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `lib/admin/metrics.ts` | Created | Centralized metrics module |
| `app/admin/organizations/page.tsx` | Updated | Use correct API endpoint |
| `app/api/admin/organizations/route.ts` | Updated | Add missing fields |
| `app/admin/users/[id]/page.tsx` | Created | User detail page |
| `app/admin/users/[id]/UserDetailClient.tsx` | Created | User edit component |
| `app/admin/users/UserManagementClient.tsx` | Updated | Link to edit page |
| `app/api/admin/documents/route.ts` | Updated | Include user details |
| `app/api/admin/dashboard/route.ts` | Updated | Use centralized metrics |
| `app/api/admin/analytics/route.ts` | Updated | Use centralized metrics |

---

## TypeScript Verification

```bash
npx tsc --noEmit --skipLibCheck
# No errors
```

---

## Remaining Items from ADMIN-AUDIT.md

### Priority 3: UX Improvements (Not Implemented)

These are enhancement items that can be addressed in a future sprint:

1. **Merge Platform Revenue & Service Fee tabs**
   - Currently separate tabs in finance section
   - Consider consolidating for cleaner UX

2. **Restructure wallet tab for admin**
   - Admin doesn't have a personal wallet
   - Could show platform-wide wallet overview

3. **Clean up finance section**
   - Multiple overlapping metrics endpoints
   - Consider consolidating into fewer views

### Documentation Updates

1. **ADMIN-AUDIT.md** - Original audit document (preserved)
2. **ADMIN-FIXES-APPLIED.md** - This document

---

## Testing Recommendations

1. **Organizations Page**
   - Navigate to `/admin/organizations`
   - Verify all organizations load
   - Verify search and filter work
   - Verify verify/unverify actions work

2. **User Edit**
   - Navigate to `/admin/users`
   - Click "Edit" on a user
   - Verify detail page loads
   - Test phone number edit
   - Test status change
   - Verify role-based access (Admin can't edit Admin/SuperAdmin)

3. **Document Verification**
   - Navigate to `/admin/verification`
   - Verify documents show uploader name
   - Verify filters work (status, entity type)

4. **Dashboard Consistency**
   - Compare activeTrips on dashboard vs analytics
   - Should now show same value (both use Trip model)

5. **Run Data Integrity Script**
   ```bash
   npx tsx scripts/verify-data-integrity.ts
   ```
