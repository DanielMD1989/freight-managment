# FreightFlow UI/UX Review Report

**Date:** February 15, 2026
**Platforms:** Next.js Web App (localhost:3000) + Flutter Mobile App (localhost:8080)
**Viewport Tested:** Desktop 1280x800, Mobile 412x915
**Total Screens Reviewed:** 45+ (31 web, 16 mobile)

---

## Executive Summary

The FreightFlow platform presents a polished, professional interface across both web and mobile. The A2 Modern Navy design system is well-implemented with consistent use of Ocean Blue primary and status-based color coding. However, several bugs and UX issues were identified across both platforms, ranging from critical data display bugs to responsive layout failures.

**Overall Rating: 7.5/10** - Strong foundation with key issues needing attention.

---

## Issues Found

### CRITICAL (Must Fix)

| #   | Platform | Screen                        | Issue                        | Description                                                                                                                                                 |
| --- | -------- | ----------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Web      | `/admin/security`             | **Invalid Date in all rows** | Every security event shows "Invalid Date" in the Time column. Date parsing/formatting is broken.                                                            |
| 2   | Web      | `/admin/security`             | **Empty Details column**     | All security events show `{}` in Details - no useful information displayed.                                                                                 |
| 3   | Web      | `/carrier/dashboard`          | **Empty route names**        | Recent Activity shows just "→" with no city names (e.g., "→" instead of "Addis Ababa → Dire Dawa"). Same issue in Available Loads section.                  |
| 4   | Web      | All portals (mobile viewport) | **Sidebar doesn't collapse** | At 412px width, the sidebar remains fully expanded, consuming ~70% of screen width and making content unusable. No hamburger menu toggle exists for mobile. |
| 5   | Flutter  | `/carrier/post-trucks`        | **RenderFlex overflow**      | Yellow/black overflow indicators visible on truck cards where Row widget content exceeds available width (e.g., E2E-TEST-001, DD-RF-003).                   |
| 6   | Flutter  | Logout                        | **Firebase logout error**    | Tapping Logout throws a `FirebaseException`, failing to log out. User must clear browser storage manually.                                                  |
| 7   | Web      | `/carrier/gps`                | **React hydration error**    | Server/client HTML mismatch causing hydration failure. "1 Issue" badge visible in Next.js dev tools.                                                        |

### MODERATE (Should Fix)

| #   | Platform | Screen                | Issue                                      | Description                                                                                                                     |
| --- | -------- | --------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 8   | Web      | `/forgot-password`    | **Inconsistent button styling**            | Uses teal-colored button while login/register use blue-purple gradient. Also lacks the branding panel that login/register have. |
| 9   | Web      | `/carrier/dashboard`  | **Wallet balance truncated**               | Stat card shows "ETB 100,00..." - text is cut off instead of displaying the full amount or using compact notation.              |
| 10  | Web      | `/carrier/trucks`     | **Empty toggle switches in Status column** | Status column shows non-functional empty toggle switches instead of text labels.                                                |
| 11  | Web      | `/admin/trucks`       | **Capacity column all dashes**             | Every truck shows "-" for Capacity - data is missing or not being fetched.                                                      |
| 12  | Web      | `/admin/service-fees` | **Grammar: "From 1 loads"**                | Should be "From 1 load" (singular).                                                                                             |
| 13  | Web      | `/admin/settings`     | **Raw user ID in footer**                  | "Last modified by: cml3o4tcy0004moulpbaoa74g" shows raw DB ID instead of human-readable name.                                   |
| 14  | Web      | `/admin/loads`        | **Created column partially cut off**       | Last column (Created date) is truncated on right edge at 1280px width.                                                          |

### MINOR (Nice to Fix)

| #   | Platform | Screen         | Issue                         | Description                                                                                         |
| --- | -------- | -------------- | ----------------------------- | --------------------------------------------------------------------------------------------------- |
| 15  | Web      | All pages      | **CSP inline script warning** | "Executing inline script violates the Content Security Policy" on every page load (dev-mode issue). |
| 16  | Web      | `/shipper/map` | **Empty state only**          | Map view shows empty state with no map rendering - likely expected without active GPS data.         |
| 17  | Flutter  | Onboarding     | **Swipe gesture not working** | Carousel pages don't respond to swipe gestures in web mode - only Next/Skip buttons work.           |

---

## Phase-by-Phase Results

### Phase 1: Public & Auth Screens (8 screenshots)

- **Landing page:** Clean, responsive at both desktop and mobile
- **Login:** Professional split-panel layout, responsive
- **Register:** Good form layout, consistent with login
- **Forgot Password:** Functional but inconsistent styling (see Issue #8)

### Phase 2: Shipper Portal (8 screenshots)

- **Dashboard:** Well-structured with stats, quick actions, activity feed
- **Loadboard:** Functional load/truck tabs with status filtering
- **My Loads:** Clean data table with status badges
- **Create Load:** Multi-step form wizard works well
- **Trips:** Trip cards with good information hierarchy
- **Map:** Empty state (no active trips)
- **Wallet:** Balance card and transaction history clean
- **Settings:** Standard form layout

### Phase 3: Carrier Portal (7 screenshots)

- **Dashboard:** Multiple data bugs (Issues #3, #9)
- **Loadboard:** Truck postings table works
- **Trucks:** Status toggle issue (Issue #10)
- **Trips:** Empty state
- **GPS:** Hydration error (Issue #7)
- **Wallet:** Clean layout
- **Settings:** Consistent with shipper

### Phase 4: Admin Portal (10 screenshots)

- **Dashboard:** Comprehensive metrics, system status
- **Analytics:** KPI cards and charts render well
- **Users:** Clean user management table with search/filter
- **All Loads:** Good table with 13 status filter tabs, pagination
- **All Trucks:** Table with approval status tabs
- **Settlement:** Clear automation pipeline with status cards
- **Platform Revenue:** Color-coded revenue cards, fee distribution
- **Corridors:** Well-structured pricing table with actions
- **Security:** Critical date/details bugs (Issues #1, #2)
- **System Settings:** Tabbed configuration, raw user ID in footer

### Phase 5: Responsive & Dark Mode (6 screenshots)

- **Mobile Responsive:** CRITICAL failure - sidebar doesn't collapse (Issue #4)
- **Dark Mode:** Excellent implementation - clean dark theme with good contrast across dashboard and data tables

### Phase 6: Flutter Mobile App (16 screenshots)

- **Onboarding:** Polished dark navy carousel with branding
- **Login:** Clean form matching web branding
- **Shipper Home:** Excellent dashboard with stats, quick actions, active shipments
- **Shipper My Loads:** Tab-based filtering, good card layout
- **Shipper Track:** Clean empty state
- **Shipper Shipments:** Great filter chips with counts, progress bars
- **Shipper Find Trucks:** Detailed truck cards with Book Truck CTAs
- **Shipper Drawer:** Complete navigation with user info
- **Carrier Home:** Good overview stats grid, quick actions
- **Carrier Find Loads:** Detailed load cards with routes, verification badges
- **Carrier Post Trucks:** Overflow bug visible (Issue #5)
- **Carrier Trips:** Clean empty state with tab filters
- **Carrier Trucks:** Good stats summary, truck cards with actions
- **Carrier Drawer:** Complete navigation menu

---

## Cross-Platform Consistency (Phase 7)

| Aspect               | Web                                              | Mobile                   | Consistent?           |
| -------------------- | ------------------------------------------------ | ------------------------ | --------------------- |
| **Primary Color**    | Ocean Blue (#1B4965)                             | Ocean Blue (matching)    | Yes                   |
| **Accent Color**     | Burnt Orange (buttons, CTAs)                     | Orange/Teal accents      | Mostly                |
| **Status Badges**    | Color-coded (green=completed, blue=posted, etc.) | Same color coding        | Yes                   |
| **Typography**       | Inter font family                                | System/Roboto            | Different (expected)  |
| **Dashboard Layout** | Stat cards + quick actions + activity            | Same pattern             | Yes                   |
| **Navigation**       | Sidebar (web) vs Bottom Nav + Drawer (mobile)    | Appropriate per platform | Yes                   |
| **Brand Name**       | FreightET (web)                                  | FreightFlow (mobile)     | **NO - Inconsistent** |
| **Card Patterns**    | Rounded cards with shadows                       | Similar card style       | Yes                   |
| **Empty States**     | Icons + text + action buttons                    | Same pattern             | Yes                   |
| **Loading States**   | "Loading..." text                                | Spinners/skeleton        | Different approach    |

**Key Inconsistency:** The web app uses "FreightET" branding while the mobile app uses "FreightFlow". This should be unified.

---

## Recommendations

### Priority 1 (This Sprint)

1. **Fix sidebar responsive collapse** - Add hamburger toggle and hide sidebar on mobile viewports (<768px)
2. **Fix carrier dashboard empty routes** - Ensure origin/destination city names are populated in Recent Activity and Available Loads
3. **Fix security dashboard date parsing** - Correct the date formatting for audit events
4. **Fix Flutter Post Trucks overflow** - Wrap or constrain Row content with Flexible/Expanded widgets
5. **Fix Flutter logout Firebase error** - Handle or remove Firebase dependency for web logout

### Priority 2 (Next Sprint)

6. **Unify branding** - Decide on FreightET vs FreightFlow and use consistently across both platforms
7. **Fix carrier trucks status toggles** - Replace empty toggles with text status labels
8. **Fix forgot password styling** - Match button gradient and add branding panel
9. **Fix admin settings raw user ID** - Resolve user name from ID
10. **Fix carrier GPS hydration error** - Ensure server/client HTML consistency

### Priority 3 (Polish)

11. Add proper mobile-responsive tables (horizontal scroll or card view at small breakpoints)
12. Fix grammar issues ("1 loads" → "1 load")
13. Add capacity data to admin trucks table
14. Improve loading states consistency between web and mobile

---

## Screenshots Index

```
ui-review-screenshots/
├── phase1-public/           (8 files - landing, login, register, forgot-password at desktop + mobile)
├── phase2-shipper/          (8 files - dashboard, loadboard, loads, create, trips, map, wallet, settings)
├── phase3-carrier/          (7 files - dashboard, loadboard, trucks, trips, gps, wallet, settings)
├── phase4-admin/            (10 files - dashboard, analytics, users, loads, trucks, settlement, service-fees, corridors, security, settings)
├── phase5-responsive/       (6 files - shipper/carrier/admin mobile, dark mode dashboard + loads)
└── phase6-flutter/          (16 files - onboarding, login, shipper screens, carrier screens, drawers)
```

**Total: 55 screenshots captured**

---

_Report generated by automated UI/UX review using Playwright browser automation._
