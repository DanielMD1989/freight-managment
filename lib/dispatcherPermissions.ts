/**
 * Dispatcher Permissions Utility
 *
 * Sprint 16 - Story 16.4: Dispatcher System
 * Phase 2 Update - Foundation Rule: DISPATCHER_COORDINATION_ONLY
 *
 * Manages permissions for dispatcher role to view and coordinate loads/trucks
 *
 * CRITICAL FOUNDATION RULES:
 * - Dispatcher can VIEW loads and posted trucks (availability)
 * - Dispatcher can PROPOSE matches (carrier must approve)
 * - Dispatcher CANNOT directly assign, accept, or start trips
 * - Carrier is FINAL authority on execution
 */

import { UserRole } from "@prisma/client";

export interface DispatcherUser {
  role: UserRole;
  organizationId?: string | null;
  userId: string;
}

/**
 * Check if user can view all loads
 *
 * Dispatchers can view all loads in the system (company-owned)
 * Platform ops and admins also have this permission
 *
 * @param user - User with role information
 * @returns True if user can view all loads
 */
export function canViewAllLoads(user: DispatcherUser): boolean {
  return (
    user.role === "DISPATCHER" ||
    user.role === "ADMIN" ||
    user.role === "SUPER_ADMIN"
  );
}

/**
 * Check if user can view all trucks
 *
 * Dispatchers can view all trucks in the system (company-owned)
 * Platform ops and admins also have this permission
 *
 * @param user - User with role information
 * @returns True if user can view all trucks
 */
export function canViewAllTrucks(user: DispatcherUser): boolean {
  return (
    user.role === "DISPATCHER" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN"
  );
}

/**
 * Check if user can DIRECTLY assign loads to trucks
 *
 * PHASE 2 UPDATE - Foundation Rule: DISPATCHER_COORDINATION_ONLY
 * - Dispatchers CANNOT directly assign (they can only PROPOSE)
 * - Only Admin/SuperAdmin can directly assign
 * - Shippers can request their own loads be assigned (requires carrier approval)
 * - Carriers approve requests on their own trucks
 *
 * @param user - User with role information
 * @param loadShipperId - Optional: Organization ID of the load's shipper
 * @returns True if user can DIRECTLY assign the load
 */
export function canAssignLoads(
  user: DispatcherUser,
  loadShipperId?: string
): boolean {
  // FOUNDATION RULE: Dispatcher CANNOT directly assign loads
  // They can only PROPOSE matches that require carrier approval
  if (user.role === "DISPATCHER") {
    return false; // Use canProposeMatch() instead
  }

  // Platform ops and admin can directly assign (override for support)
  if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") {
    return true;
  }

  // Carriers can assign loads to their own trucks (they are final authority)
  if (user.role === "CARRIER") {
    return true; // Will be validated against their own trucks
  }

  // Shippers can only REQUEST assignment of their own loads (requires carrier approval)
  // This returns false because shippers don't directly assign - they request
  if (user.role === "SHIPPER" && loadShipperId) {
    // Shippers use request flow, not direct assignment
    return false;
  }

  return false;
}

/**
 * Check if user can PROPOSE a match (without direct assignment)
 *
 * PHASE 2 - Foundation Rule: DISPATCHER_COORDINATION_ONLY
 * Dispatcher can propose load-truck matches that require carrier approval
 *
 * H8-H9 SECURITY AUDIT NOTE:
 * Dispatchers can propose ANY load to ANY truck by design. This is intentional
 * for a freight marketplace model where dispatchers work for the platform
 * (not individual companies) and coordinate matches across all participants.
 *
 * The carrier MUST approve all proposals before assignment happens, so there's
 * no security risk - dispatchers can only PROPOSE, not ASSIGN.
 *
 * If per-organization dispatcher scoping is needed in the future, add:
 * - DispatcherAssignment table (dispatcherId, organizationId, scope)
 * - Update this function to check assignments
 *
 * @param user - User with role information
 * @returns True if user can propose matches
 */
export function canProposeMatch(user: DispatcherUser): boolean {
  return (
    user.role === "DISPATCHER" ||
    user.role === "ADMIN" ||
    user.role === "SUPER_ADMIN"
  );
}

// Alias for consistency
export const canPropose = canProposeMatch;

/**
 * Check if user can APPROVE/REJECT match proposals
 *
 * PHASE 2 - Foundation Rule: CARRIER_FINAL_AUTHORITY
 * Only carriers can approve proposals for their trucks
 *
 * @param user - User with role information
 * @param truckCarrierId - Organization ID of the truck's carrier
 * @returns True if user can approve/reject proposals
 */
export function canApproveProposals(
  user: DispatcherUser,
  truckCarrierId?: string
): boolean {
  // Carriers can approve proposals for their own trucks
  if (user.role === "CARRIER" && truckCarrierId) {
    return user.organizationId === truckCarrierId;
  }

  // Admin/SuperAdmin can approve (override for support)
  if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") {
    return true;
  }

  return false;
}

/**
 * Check if user can REQUEST a truck for a load
 *
 * PHASE 2 - Shipper-led matching: Shipper requests truck, carrier approves
 *
 * @param user - User with role information
 * @param loadShipperId - Organization ID of the load's shipper
 * @returns True if user can request trucks for this load
 */
export function canRequestTruck(
  user: DispatcherUser,
  loadShipperId?: string
): boolean {
  // Shippers can request trucks for their own loads
  if (user.role === "SHIPPER" && loadShipperId) {
    return user.organizationId === loadShipperId;
  }

  // Admin/SuperAdmin can request on behalf of shippers
  if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") {
    return true;
  }

  return false;
}

/**
 * Check if user can APPROVE/REJECT truck requests
 *
 * PHASE 2 - Foundation Rule: CARRIER_FINAL_AUTHORITY
 * Only carriers can approve requests for their trucks
 *
 * @param user - User with role information
 * @param truckCarrierId - Organization ID of the truck's carrier
 * @returns True if user can approve/reject requests
 */
export function canApproveRequests(
  user: DispatcherUser,
  truckCarrierId?: string
): boolean {
  // Carriers can approve requests for their own trucks
  if (user.role === "CARRIER" && truckCarrierId) {
    return user.organizationId === truckCarrierId;
  }

  // Admin/SuperAdmin can approve (override for support)
  if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") {
    return true;
  }

  return false;
}

/**
 * Check if user can update load status
 *
 * Dispatchers can update any load status
 * Platform ops and admins also have this permission
 * Shippers and carriers can update their own loads
 *
 * @param user - User with role information
 * @param loadShipperId - Optional: Organization ID of the load's shipper
 * @param loadCarrierId - Optional: Organization ID of the assigned carrier
 * @returns True if user can update load status
 */
export function canUpdateLoadStatus(
  user: DispatcherUser,
  loadShipperId?: string,
  loadCarrierId?: string
): boolean {
  // Dispatcher, platform ops, and admin can update any load
  if (
    user.role === "DISPATCHER" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN"
  ) {
    return true;
  }

  // Shippers can update their own loads
  if (user.role === "SHIPPER" && loadShipperId) {
    return user.organizationId === loadShipperId;
  }

  // Carriers can update loads assigned to their trucks
  if (user.role === "CARRIER" && loadCarrierId) {
    return user.organizationId === loadCarrierId;
  }

  return false;
}

/**
 * Check if user can access GPS tracking for all loads
 *
 * Dispatchers have access to GPS tracking for all loads
 * Platform ops and admins also have this permission
 * Shippers and carriers can access tracking for their own loads
 *
 * @param user - User with role information
 * @param loadShipperId - Optional: Organization ID of the load's shipper
 * @param loadCarrierId - Optional: Organization ID of the assigned carrier
 * @returns True if user can access GPS tracking
 */
export function canAccessGpsTracking(
  user: DispatcherUser,
  loadShipperId?: string,
  loadCarrierId?: string
): boolean {
  // Dispatcher, platform ops, and admin can access all GPS tracking
  if (
    user.role === "DISPATCHER" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN"
  ) {
    return true;
  }

  // Shippers can access tracking for their own loads
  if (user.role === "SHIPPER" && loadShipperId) {
    return user.organizationId === loadShipperId;
  }

  // Carriers can access tracking for loads assigned to their trucks
  if (user.role === "CARRIER" && loadCarrierId) {
    return user.organizationId === loadCarrierId;
  }

  return false;
}

/**
 * Check if user can create/edit trucks
 *
 * Dispatchers cannot create trucks (carrier-only functionality)
 * Only carriers can create and edit their own trucks
 * Platform ops and admins can edit any truck
 *
 * @param user - User with role information
 * @param truckCarrierId - Optional: Organization ID of the truck's carrier
 * @returns True if user can create/edit trucks
 */
export function canManageTrucks(
  user: DispatcherUser,
  truckCarrierId?: string
): boolean {
  // Platform ops and admin can manage any truck
  if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") {
    return true;
  }

  // Carriers can manage their own trucks
  if (user.role === "CARRIER" && truckCarrierId) {
    return user.organizationId === truckCarrierId;
  }

  // Dispatchers CANNOT create/edit trucks (read-only access)
  return false;
}

/**
 * Check if user can view system-wide dashboard
 *
 * Dispatchers have access to system-wide dashboard
 * Platform ops and admins also have this permission
 *
 * @param user - User with role information
 * @returns True if user can view system dashboard
 */
export function canViewSystemDashboard(user: DispatcherUser): boolean {
  return (
    user.role === "DISPATCHER" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN"
  );
}

/**
 * Check if user is a dispatcher
 *
 * @param user - User with role information
 * @returns True if user has DISPATCHER role
 */
export function isDispatcher(user: DispatcherUser): boolean {
  return user.role === "DISPATCHER";
}

/**
 * Check if user has elevated permissions (dispatcher, platform ops, or admin)
 *
 * @param user - User with role information
 * @returns True if user has elevated permissions
 */
export function hasElevatedPermissions(user: DispatcherUser): boolean {
  return (
    user.role === "DISPATCHER" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN"
  );
}

/**
 * Get permission summary for a user
 *
 * PHASE 2 UPDATE: Added proposal and request permissions
 *
 * @param user - User with role information
 * @returns Object with all permission flags
 */
export function getDispatcherPermissions(user: DispatcherUser) {
  return {
    // View permissions
    canViewAllLoads: canViewAllLoads(user),
    canViewAllTrucks: canViewAllTrucks(user),
    canViewSystemDashboard: canViewSystemDashboard(user),

    // Assignment permissions (Phase 2: Dispatcher cannot directly assign)
    canAssignLoads: canAssignLoads(user), // FALSE for DISPATCHER
    canProposeMatch: canProposeMatch(user), // TRUE for DISPATCHER - propose only
    canRequestTruck: canRequestTruck(user), // Shipper-led matching
    canApproveRequests: canApproveRequests(user), // Carrier authority

    // Other permissions
    canUpdateLoadStatus: canUpdateLoadStatus(user),
    canAccessGpsTracking: canAccessGpsTracking(user),
    canManageTrucks: canManageTrucks(user),

    // Role checks
    isDispatcher: isDispatcher(user),
    hasElevatedPermissions: hasElevatedPermissions(user),
  };
}
