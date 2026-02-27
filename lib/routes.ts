/**
 * Application Routes - Single Source of Truth
 *
 * Centralized route definitions for all panels:
 * - Carrier
 * - Shipper
 * - Dispatcher
 * - Admin
 *
 * Usage:
 * ```typescript
 * import { ROUTES } from '@/lib/routes';
 *
 * // Static routes
 * router.push(ROUTES.carrier.dashboard);
 *
 * // Dynamic routes
 * router.push(ROUTES.carrier.trucks.detail('truck-123'));
 * ```
 */

// =============================================================================
// CARRIER ROUTES
// =============================================================================

export const CARRIER_ROUTES = {
  dashboard: "/carrier/dashboard",
  trucks: {
    list: "/carrier/trucks",
    detail: (id: string) => `/carrier/trucks/${id}` as const,
    add: "/carrier/trucks/add",
    edit: (id: string) => `/carrier/trucks/${id}/edit` as const,
  },
  loadboard: "/carrier/loadboard",
  trips: {
    list: "/carrier/trips",
    detail: (id: string) => `/carrier/trips/${id}` as const,
  },
  wallet: "/carrier/wallet",
  map: "/carrier/map",
  gps: "/carrier/gps",
  matches: "/carrier/matches",
  requests: "/carrier/requests",
  settings: "/carrier/settings",
} as const;

// =============================================================================
// SHIPPER ROUTES
// =============================================================================

export const SHIPPER_ROUTES = {
  dashboard: "/shipper/dashboard",
  loads: {
    list: "/shipper/loads",
    detail: (id: string) => `/shipper/loads/${id}` as const,
    create: "/shipper/loads/create",
    edit: (id: string) => `/shipper/loads/${id}/edit` as const,
  },
  tracking: {
    list: "/shipper/tracking",
    detail: (tripId: string) => `/shipper/tracking/${tripId}` as const,
  },
  wallet: "/shipper/wallet",
  history: "/shipper/history",
  settings: "/shipper/settings",
} as const;

// =============================================================================
// DISPATCHER ROUTES
// =============================================================================

export const DISPATCHER_ROUTES = {
  dashboard: "/dispatcher/dashboard",
  map: "/dispatcher/map",
  trips: {
    list: "/dispatcher/trips",
    detail: (id: string) => `/dispatcher/trips/${id}` as const,
  },
  fleet: "/dispatcher/fleet",
  loads: "/dispatcher/loads",
  alerts: "/dispatcher/alerts",
  settings: "/dispatcher/settings",
} as const;

// =============================================================================
// ADMIN ROUTES
// =============================================================================

export const ADMIN_ROUTES = {
  dashboard: "/admin/dashboard",
  users: {
    list: "/admin/users",
    detail: (id: string) => `/admin/users/${id}` as const,
    create: "/admin/users/create",
  },
  organizations: {
    list: "/admin/organizations",
    detail: (id: string) => `/admin/organizations/${id}` as const,
  },
  loads: {
    list: "/admin/loads",
    detail: (id: string) => `/admin/loads/${id}` as const,
  },
  trucks: {
    list: "/admin/trucks",
    detail: (id: string) => `/admin/trucks/${id}` as const,
    pending: "/admin/trucks/pending",
  },
  gps: {
    devices: "/admin/gps/devices",
    tracking: "/admin/gps/tracking",
  },
  corridors: "/admin/corridors",
  serviceFees: "/admin/service-fees",
  wallet: "/admin/wallet",
  reports: "/admin/reports",
  settings: "/admin/settings",
} as const;

// =============================================================================
// AUTH ROUTES
// =============================================================================

export const AUTH_ROUTES = {
  login: "/login",
  register: "/register",
  logout: "/logout",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  verify: "/verify",
} as const;

// =============================================================================
// API ROUTES
// =============================================================================

export const API_ROUTES = {
  carrier: {
    dashboard: "/api/carrier/dashboard",
    trucks: "/api/trucks",
    truckDetail: (id: string) => `/api/trucks/${id}` as const,
    postings: "/api/truck-postings",
    postingDetail: (id: string) => `/api/truck-postings/${id}` as const,
    trips: "/api/trips",
    tripDetail: (id: string) => `/api/trips/${id}` as const,
  },
  shipper: {
    dashboard: "/api/shipper/dashboard",
    loads: "/api/loads",
    loadDetail: (id: string) => `/api/loads/${id}` as const,
  },
  admin: {
    dashboard: "/api/admin/dashboard",
    users: "/api/admin/users",
    userDetail: (id: string) => `/api/admin/users/${id}` as const,
  },
  gps: {
    position: (truckId: string) => `/api/trucks/${truckId}/position` as const,
    history: (truckId: string) => `/api/trucks/${truckId}/history` as const,
    location: (truckId: string) => `/api/trucks/${truckId}/location` as const,
  },
  wallet: {
    transactions: "/api/wallet/transactions",
  },
} as const;

// =============================================================================
// COMBINED ROUTES OBJECT
// =============================================================================

export const ROUTES = {
  carrier: CARRIER_ROUTES,
  shipper: SHIPPER_ROUTES,
  dispatcher: DISPATCHER_ROUTES,
  admin: ADMIN_ROUTES,
  auth: AUTH_ROUTES,
  api: API_ROUTES,
} as const;

// =============================================================================
// TYPE HELPERS
// =============================================================================

export type CarrierRoutes = typeof CARRIER_ROUTES;
export type ShipperRoutes = typeof SHIPPER_ROUTES;
export type DispatcherRoutes = typeof DISPATCHER_ROUTES;
export type AdminRoutes = typeof ADMIN_ROUTES;
export type AuthRoutes = typeof AUTH_ROUTES;
export type ApiRoutes = typeof API_ROUTES;
export type AppRoutes = typeof ROUTES;

/**
 * Helper to get route with base URL for external links
 */
export function getFullUrl(route: string, baseUrl?: string): string {
  const base = baseUrl || process.env.NEXT_PUBLIC_APP_URL || "";
  return `${base}${route}`;
}

/**
 * Check if a pathname matches a route pattern
 */
export function matchesRoute(pathname: string, route: string): boolean {
  // Simple exact match or starts with for nested routes
  return pathname === route || pathname.startsWith(`${route}/`);
}
