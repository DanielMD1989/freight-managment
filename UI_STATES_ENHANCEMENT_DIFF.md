# UI States Enhancement Diff

**Date:** 2026-01-23
**Scope:** Loading skeletons, empty states, error screens

---

## Summary

Added polished loading skeletons, empty states, and improved error handling across the Shipper portal.

---

## Loading Skeletons Added

### 1. Settings Page Skeleton

```tsx
function SettingsSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-12 rounded-lg w-1/3" style={{ background: 'var(--bg-tinted)' }} />
      <div className="h-64 rounded-xl" style={{ background: 'var(--bg-tinted)' }} />
    </div>
  );
}
```

### 2. Team Page Skeleton

```tsx
function TeamSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-12 rounded w-1/3" style={{ background: 'var(--bg-tinted)' }} />
      <div className="h-64 rounded" style={{ background: 'var(--bg-tinted)' }} />
    </div>
  );
}
```

### 3. Documents Page Skeleton (NEW)

```tsx
function DocumentsSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-32 rounded-xl" style={{ background: 'var(--bg-tinted)' }} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-24 rounded-lg" style={{ background: 'var(--bg-tinted)' }} />
        <div className="h-24 rounded-lg" style={{ background: 'var(--bg-tinted)' }} />
      </div>
    </div>
  );
}
```

---

## Empty States Pattern

### Standard Empty State Structure

```tsx
<div className="py-12 text-center">
  {/* Icon Container */}
  <div
    className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
    style={{ background: 'var(--bg-tinted)' }}
  >
    <svg
      className="w-6 h-6"
      style={{ color: 'var(--foreground-muted)' }}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      {/* Icon path */}
    </svg>
  </div>

  {/* Title */}
  <p
    className="text-sm font-medium mb-1"
    style={{ color: 'var(--foreground)' }}
  >
    {emptyTitle}
  </p>

  {/* Description */}
  <p
    className="text-xs mb-4"
    style={{ color: 'var(--foreground-muted)' }}
  >
    {emptyDescription}
  </p>

  {/* Action Button */}
  <Link
    href={actionHref}
    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
    style={{ background: 'var(--primary-500)' }}
  >
    <PlusIcon />
    {actionLabel}
  </Link>
</div>
```

---

## Empty States in Use

### Wallet Page - No Activity
```tsx
{recentTransactions.length === 0 && (
  <div className="py-12 text-center">
    <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
         style={{ background: 'var(--bg-tinted)' }}>
      <PackageIcon />
    </div>
    <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
      No activity yet
    </p>
    <p className="text-xs mb-4" style={{ color: 'var(--foreground-muted)' }}>
      Your load activity will appear here
    </p>
    <Link href="/shipper/loads/create" className="btn-primary">
      Post Your First Load
    </Link>
  </div>
)}
```

### Dashboard - Active Shipments Empty
```tsx
{activeTrips.length === 0 && (
  <div className="py-12 text-center">
    <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
         style={{ background: 'var(--bg-tinted)' }}>
      <TruckIcon />
    </div>
    <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
      No active shipments
    </p>
    <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
      Your shipments will appear here once in transit
    </p>
  </div>
)}
```

### Dashboard - Posted Loads Empty
```tsx
{postedLoads.length === 0 && (
  <div className="py-12 text-center">
    <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
         style={{ background: 'var(--bg-tinted)' }}>
      <PackageIcon />
    </div>
    <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
      No posted loads
    </p>
    <p className="text-xs mb-4" style={{ color: 'var(--foreground-muted)' }}>
      Post your first load to find carriers
    </p>
    <Link href="/shipper/loads/create" className="inline-flex items-center gap-2 px-4 py-2">
      <PlusIcon />
      Post New Load
    </Link>
  </div>
)}
```

---

## Error Handling

### ErrorBoundary Usage
```tsx
// Loadboard wraps content in ErrorBoundary
<ErrorBoundary>
  {activeTab === 'POST_LOADS' && <PostLoadsTab ... />}
  {activeTab === 'SEARCH_TRUCKS' && <SearchTrucksTab ... />}
</ErrorBoundary>
```

### Form Error Display
```tsx
{error && (
  <div className="mb-4 rounded-lg p-3 text-sm flex items-center gap-2
                  bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400
                  border border-red-200 dark:border-red-800">
    <ErrorIcon />
    {error}
  </div>
)}
```

---

## Suspense Boundaries

| Page | Has Suspense | Skeleton |
|------|--------------|----------|
| Settings | ✅ | ✅ |
| Team | ✅ | ✅ |
| Documents | ✅ (NEW) | ✅ (NEW) |
| Wallet | N/A (SSR) | N/A |
| Dashboard | Client-side | Client handles |
| Loadboard | Client-side | Client handles |

---

## Visual Consistency

All loading states and empty states now use:

| Element | Style |
|---------|-------|
| Icon container | `bg-tinted`, `rounded-full`, `w-14 h-14` |
| Icon color | `foreground-muted` |
| Title | `text-sm font-medium`, `foreground` |
| Description | `text-xs`, `foreground-muted` |
| Action button | `primary-500` background, white text |
| Skeleton | `bg-tinted`, `animate-pulse` |

---

*Generated by UI/UX Professionalization Pass*
