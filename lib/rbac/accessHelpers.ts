/**
 * Access Helpers for Role-Based Access Control
 *
 * Centralizes the common role check patterns used throughout the API.
 * This eliminates the 40+ duplicate role check blocks across API routes.
 *
 * Single Source of Truth: lib/rbac/accessHelpers.ts
 */

import { Role } from "./permissions";

export interface SessionInfo {
  userId: string;
  role: Role | string;
  organizationId?: string | null;
}

export interface AccessRoles {
  /** User is a shipper and owns the entity (via organizationId match) */
  isShipper: boolean;
  /** User is a carrier and owns the entity (via organizationId match) */
  isCarrier: boolean;
  /** User is a dispatcher (coordination role) */
  isDispatcher: boolean;
  /** User is an admin or super admin */
  isAdmin: boolean;
  /** User is specifically a super admin */
  isSuperAdmin: boolean;
  /** User has any access to the entity */
  hasAccess: boolean;
}

/**
 * Get access roles for a user session relative to an entity
 *
 * This replaces the common pattern:
 * ```
 * const isShipper = session.role === 'SHIPPER' && load.shipperId === session.organizationId;
 * const isCarrier = session.role === 'CARRIER' && trip.carrierId === session.organizationId;
 * const isAdmin = session.role === 'ADMIN' || session.role === 'SUPER_ADMIN';
 * ```
 *
 * Usage:
 * ```
 * const { isShipper, isCarrier, isAdmin, hasAccess } = getAccessRoles(session, {
 *   shipperOrgId: load.shipperId,
 *   carrierOrgId: trip?.carrierId,
 * });
 *
 * if (!hasAccess) {
 *   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
 * }
 * ```
 *
 * @param session - The authenticated session
 * @param entityOwners - Optional organization IDs that own the entity
 * @returns AccessRoles object with boolean flags
 */
export function getAccessRoles(
  session: SessionInfo,
  entityOwners?: {
    /** Organization ID of the shipper that owns the entity */
    shipperOrgId?: string | null;
    /** Organization ID of the carrier that owns the entity */
    carrierOrgId?: string | null;
  }
): AccessRoles {
  const { role, organizationId } = session;
  const { shipperOrgId, carrierOrgId } = entityOwners || {};

  const isShipper =
    role === "SHIPPER" && !!shipperOrgId && shipperOrgId === organizationId;
  const isCarrier =
    role === "CARRIER" && !!carrierOrgId && carrierOrgId === organizationId;
  const isDispatcher = role === "DISPATCHER";
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isAdmin = role === "ADMIN" || isSuperAdmin;

  // User has access if they own the entity or are admin/dispatcher
  const hasAccess = isShipper || isCarrier || isDispatcher || isAdmin;

  return {
    isShipper,
    isCarrier,
    isDispatcher,
    isAdmin,
    isSuperAdmin,
    hasAccess,
  };
}

/**
 * Check if user can view an entity (broader access than modify)
 *
 * For viewing, we allow:
 * - Entity owners (shipper/carrier)
 * - Dispatchers (coordination)
 * - Admins
 */
export function canView(
  session: SessionInfo,
  entityOwners?: {
    shipperOrgId?: string | null;
    carrierOrgId?: string | null;
  }
): boolean {
  return getAccessRoles(session, entityOwners).hasAccess;
}

/**
 * Check if user can modify an entity (stricter than view)
 *
 * For modifying, we allow:
 * - Entity owners (shipper/carrier) based on context
 * - Admins
 */
export function canModify(
  session: SessionInfo,
  entityOwners?: {
    shipperOrgId?: string | null;
    carrierOrgId?: string | null;
  }
): boolean {
  const { isShipper, isCarrier, isAdmin } = getAccessRoles(
    session,
    entityOwners
  );
  return isShipper || isCarrier || isAdmin;
}

/**
 * Check if user is admin (ADMIN or SUPER_ADMIN)
 */
export function isAdminRole(role: string): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/**
 * Check if user is super admin
 */
export function isSuperAdminRole(role: string): boolean {
  return role === "SUPER_ADMIN";
}
