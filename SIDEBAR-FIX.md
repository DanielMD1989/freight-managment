# Admin Sidebar Fix - Removed User Wallets Tab

**Date:** 2026-02-06

---

## Issue

The admin sidebar had a "User Wallets" tab that was redundant and confusing. Wallet management should only be accessible from within the user detail page, not as a separate navigation item.

**Before:**
```
Financial
├── Platform Revenue
├── User Wallets  ← REMOVED
├── Corridors
└── Settlement
```

**After:**
```
Financial
├── Platform Revenue
├── Corridors
└── Settlement
```

---

## Change Made

**File:** `components/RoleAwareSidebar.tsx`

Removed the "User Wallets" navigation item from the Financial section:

```diff
  {
    title: 'Financial',
    items: [
      { label: 'Platform Revenue', href: '/admin/service-fees', ... },
-     { label: 'User Wallets', href: '/admin/wallets', ... },
      { label: 'Corridors', href: '/admin/corridors', ... },
      { label: 'Settlement', href: '/admin/settlement', ... },
    ],
  },
```

---

## Correct Admin Flow

Wallet management is now accessed through the user detail page:

1. **Admin Sidebar** → Click "Users"
2. **Users List** → Click on a Shipper or Carrier user
3. **User Detail Page** → See wallet section with:
   - Current balance display
   - Recent transaction history
   - "Top Up" button for manual deposits

---

## Verification

### User Detail Page Wallet Features

The `app/admin/users/[id]/UserDetailClient.tsx` component includes:

| Feature | Status |
|---------|--------|
| Wallet balance display | ✓ |
| Recent transactions (last 10) | ✓ |
| Top Up button | ✓ |
| Top Up modal with payment method | ✓ |
| Reference number field | ✓ |
| Notes field | ✓ |
| Only shows for SHIPPER/CARRIER | ✓ |

### Sidebar Verification

| Tab | Present |
|-----|---------|
| Dashboard | ✓ |
| Users | ✓ |
| Organizations | ✓ |
| Platform Revenue | ✓ |
| **User Wallets** | ✗ (removed) |
| Corridors | ✓ |
| Settlement | ✓ |

---

## Testing Checklist

1. Navigate to admin sidebar
   - Should NOT see "User Wallets" or "Wallets" tab

2. Go to Users → click on a Shipper
   - Should see wallet section with balance
   - Should see "Top Up" button

3. Go to Users → click on a Carrier
   - Should see wallet section with balance
   - Should see "Top Up" button

4. Go to Users → click on an Admin
   - Should NOT see wallet section
