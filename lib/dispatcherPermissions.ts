/**
 * Dispatcher Permissions Utility
 *
 * Sprint 16 - Story 16.4: Dispatcher System
 *
 * Manages permissions for dispatcher role to view and manage loads/trucks
 */

import { UserRole } from '@prisma/client';

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
    user.role === 'DISPATCHER' ||
    user.role === 'ADMIN' ||
    user.role === 'SUPER_ADMIN'
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
    user.role === 'DISPATCHER' ||
    user.role === 'SUPER_ADMIN' ||
    user.role === 'ADMIN'
  );
}

/**
 * Check if user can assign loads to trucks
 *
 * Dispatchers can assign any load to any truck
 * Platform ops and admins also have this permission
 * Shippers can only assign their own loads
 *
 * @param user - User with role information
 * @param loadShipperId - Optional: Organization ID of the load's shipper
 * @returns True if user can assign the load
 */
export function canAssignLoads(
  user: DispatcherUser,
  loadShipperId?: string
): boolean {
  // Dispatcher, platform ops, and admin can assign any load
  if (
    user.role === 'DISPATCHER' ||
    user.role === 'SUPER_ADMIN' ||
    user.role === 'ADMIN'
  ) {
    return true;
  }

  // Shippers can only assign their own loads
  if (user.role === 'SHIPPER' && loadShipperId) {
    return user.organizationId === loadShipperId;
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
    user.role === 'DISPATCHER' ||
    user.role === 'SUPER_ADMIN' ||
    user.role === 'ADMIN'
  ) {
    return true;
  }

  // Shippers can update their own loads
  if (user.role === 'SHIPPER' && loadShipperId) {
    return user.organizationId === loadShipperId;
  }

  // Carriers can update loads assigned to their trucks
  if (user.role === 'CARRIER' && loadCarrierId) {
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
    user.role === 'DISPATCHER' ||
    user.role === 'SUPER_ADMIN' ||
    user.role === 'ADMIN'
  ) {
    return true;
  }

  // Shippers can access tracking for their own loads
  if (user.role === 'SHIPPER' && loadShipperId) {
    return user.organizationId === loadShipperId;
  }

  // Carriers can access tracking for loads assigned to their trucks
  if (user.role === 'CARRIER' && loadCarrierId) {
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
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
    return true;
  }

  // Carriers can manage their own trucks
  if (user.role === 'CARRIER' && truckCarrierId) {
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
    user.role === 'DISPATCHER' ||
    user.role === 'SUPER_ADMIN' ||
    user.role === 'ADMIN'
  );
}

/**
 * Check if user is a dispatcher
 *
 * @param user - User with role information
 * @returns True if user has DISPATCHER role
 */
export function isDispatcher(user: DispatcherUser): boolean {
  return user.role === 'DISPATCHER';
}

/**
 * Check if user has elevated permissions (dispatcher, platform ops, or admin)
 *
 * @param user - User with role information
 * @returns True if user has elevated permissions
 */
export function hasElevatedPermissions(user: DispatcherUser): boolean {
  return (
    user.role === 'DISPATCHER' ||
    user.role === 'SUPER_ADMIN' ||
    user.role === 'ADMIN'
  );
}

/**
 * Get permission summary for a user
 *
 * @param user - User with role information
 * @returns Object with all permission flags
 */
export function getDispatcherPermissions(user: DispatcherUser) {
  return {
    canViewAllLoads: canViewAllLoads(user),
    canViewAllTrucks: canViewAllTrucks(user),
    canAssignLoads: canAssignLoads(user),
    canUpdateLoadStatus: canUpdateLoadStatus(user),
    canAccessGpsTracking: canAccessGpsTracking(user),
    canManageTrucks: canManageTrucks(user),
    canViewSystemDashboard: canViewSystemDashboard(user),
    isDispatcher: isDispatcher(user),
    hasElevatedPermissions: hasElevatedPermissions(user),
  };
}
