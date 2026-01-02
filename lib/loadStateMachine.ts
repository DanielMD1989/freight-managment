/**
 * Sprint 3: Load Lifecycle State Machine
 *
 * Defines valid state transitions and validation logic for load status updates.
 * State machine ensures loads follow the correct workflow.
 */

export enum LoadStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  SEARCHING = 'SEARCHING',
  OFFERED = 'OFFERED',
  ASSIGNED = 'ASSIGNED',
  PICKUP_PENDING = 'PICKUP_PENDING',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  COMPLETED = 'COMPLETED',
  EXCEPTION = 'EXCEPTION',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  UNPOSTED = 'UNPOSTED',
}

/**
 * Valid state transitions map
 * Key: current status, Value: array of valid next statuses
 */
export const VALID_TRANSITIONS: Record<LoadStatus, LoadStatus[]> = {
  [LoadStatus.DRAFT]: [
    LoadStatus.POSTED,
    LoadStatus.CANCELLED,
  ],

  [LoadStatus.POSTED]: [
    LoadStatus.SEARCHING,
    LoadStatus.OFFERED,
    LoadStatus.ASSIGNED,
    LoadStatus.UNPOSTED,
    LoadStatus.CANCELLED,
    LoadStatus.EXPIRED,
  ],

  [LoadStatus.SEARCHING]: [
    LoadStatus.OFFERED,
    LoadStatus.ASSIGNED,
    LoadStatus.EXCEPTION,
    LoadStatus.CANCELLED,
    LoadStatus.EXPIRED,
  ],

  [LoadStatus.OFFERED]: [
    LoadStatus.ASSIGNED,
    LoadStatus.SEARCHING,  // Carrier rejected, back to searching
    LoadStatus.EXCEPTION,
    LoadStatus.CANCELLED,
    LoadStatus.EXPIRED,
  ],

  [LoadStatus.ASSIGNED]: [
    LoadStatus.PICKUP_PENDING,
    LoadStatus.IN_TRANSIT,  // Direct transition if pickup happens immediately
    LoadStatus.EXCEPTION,
    LoadStatus.CANCELLED,
  ],

  [LoadStatus.PICKUP_PENDING]: [
    LoadStatus.IN_TRANSIT,
    LoadStatus.EXCEPTION,
    LoadStatus.CANCELLED,
  ],

  [LoadStatus.IN_TRANSIT]: [
    LoadStatus.DELIVERED,
    LoadStatus.EXCEPTION,
  ],

  [LoadStatus.DELIVERED]: [
    LoadStatus.COMPLETED,
    LoadStatus.EXCEPTION,
  ],

  [LoadStatus.COMPLETED]: [
    LoadStatus.EXCEPTION,  // Can still report issues after completion
  ],

  [LoadStatus.EXCEPTION]: [
    LoadStatus.SEARCHING,     // Resolved, reassign
    LoadStatus.ASSIGNED,      // Resolved, same carrier
    LoadStatus.IN_TRANSIT,    // Resolved, continue journey
    LoadStatus.PICKUP_PENDING, // Resolved, waiting for pickup
    LoadStatus.CANCELLED,     // Unresolvable, cancel
    LoadStatus.COMPLETED,     // Issue resolved, mark complete
  ],

  [LoadStatus.CANCELLED]: [
    // Terminal state - no transitions
  ],

  [LoadStatus.EXPIRED]: [
    LoadStatus.POSTED,        // Repost load
    LoadStatus.CANCELLED,     // Permanently cancel
  ],

  [LoadStatus.UNPOSTED]: [
    LoadStatus.POSTED,        // Repost load
    LoadStatus.CANCELLED,     // Permanently cancel
  ],
};

/**
 * Roles that can trigger specific state transitions
 */
export const ROLE_PERMISSIONS: Record<string, LoadStatus[]> = {
  SHIPPER: [
    LoadStatus.DRAFT,
    LoadStatus.POSTED,
    LoadStatus.CANCELLED,
    LoadStatus.UNPOSTED,
  ],

  CARRIER: [
    LoadStatus.ASSIGNED,      // Accept load
    LoadStatus.PICKUP_PENDING,
    LoadStatus.IN_TRANSIT,
    LoadStatus.DELIVERED,
  ],

  DISPATCHER: [
    LoadStatus.SEARCHING,
    LoadStatus.OFFERED,
    LoadStatus.ASSIGNED,
    LoadStatus.PICKUP_PENDING,
    LoadStatus.EXCEPTION,
  ],

  ADMIN: [
    // Admin can set any status (for exception handling)
    ...Object.values(LoadStatus),
  ],

  SUPER_ADMIN: [
    // Super admin can set any status
    ...Object.values(LoadStatus),
  ],
};

/**
 * Validates if a state transition is allowed
 */
export function isValidTransition(
  currentStatus: LoadStatus,
  newStatus: LoadStatus
): boolean {
  const validNextStatuses = VALID_TRANSITIONS[currentStatus];
  return validNextStatuses.includes(newStatus);
}

/**
 * Validates if a role can trigger a specific status transition
 */
export function canRoleSetStatus(
  role: string,
  newStatus: LoadStatus
): boolean {
  const allowedStatuses = ROLE_PERMISSIONS[role] || [];
  return allowedStatuses.includes(newStatus);
}

/**
 * Gets all valid next states for a given current state
 */
export function getValidNextStates(
  currentStatus: LoadStatus
): LoadStatus[] {
  return VALID_TRANSITIONS[currentStatus] || [];
}

/**
 * Validates a state transition and returns error message if invalid
 */
export function validateStateTransition(
  currentStatus: string,
  newStatus: string,
  userRole: string
): { valid: boolean; error?: string } {
  // Convert to enum
  const current = currentStatus as LoadStatus;
  const next = newStatus as LoadStatus;

  // Check if transition is valid
  if (!isValidTransition(current, next)) {
    return {
      valid: false,
      error: `Invalid transition: ${currentStatus} → ${newStatus}. Valid transitions: ${getValidNextStates(current).join(', ')}`,
    };
  }

  // Check if role can set this status
  if (!canRoleSetStatus(userRole, next)) {
    return {
      valid: false,
      error: `Role ${userRole} cannot set status to ${newStatus}`,
    };
  }

  return { valid: true };
}

/**
 * Get human-readable description of status
 */
export function getStatusDescription(status: LoadStatus): string {
  const descriptions: Record<LoadStatus, string> = {
    [LoadStatus.DRAFT]: 'Load created but not yet posted to marketplace',
    [LoadStatus.POSTED]: 'Load posted to marketplace, carriers can search',
    [LoadStatus.SEARCHING]: 'Actively being matched with carriers',
    [LoadStatus.OFFERED]: 'Load offered to a specific carrier',
    [LoadStatus.ASSIGNED]: 'Carrier accepted, load assigned',
    [LoadStatus.PICKUP_PENDING]: 'Waiting for carrier to pick up load',
    [LoadStatus.IN_TRANSIT]: 'Load picked up, in transit to destination',
    [LoadStatus.DELIVERED]: 'Load delivered to destination',
    [LoadStatus.COMPLETED]: 'POD uploaded, payment processed',
    [LoadStatus.EXCEPTION]: 'Issue detected (late, rejected, etc.)',
    [LoadStatus.CANCELLED]: 'Load cancelled by shipper',
    [LoadStatus.EXPIRED]: 'Load expired (no carrier found)',
    [LoadStatus.UNPOSTED]: 'Load removed from marketplace',
  };

  return descriptions[status] || 'Unknown status';
}
