/**
 * Trip Lifecycle State Machine
 *
 * Defines valid state transitions and validation logic for trip status updates.
 * Mirrors the pattern from loadStateMachine.ts for consistency.
 *
 * Single Source of Truth: lib/tripStateMachine.ts
 */

export enum TripStatus {
  ASSIGNED = 'ASSIGNED',
  PICKUP_PENDING = 'PICKUP_PENDING',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/**
 * Valid state transitions map
 * Key: current status, Value: array of valid next statuses
 */
export const VALID_TRIP_TRANSITIONS: Record<TripStatus, TripStatus[]> = {
  [TripStatus.ASSIGNED]: [
    TripStatus.PICKUP_PENDING,
    TripStatus.CANCELLED,
  ],

  [TripStatus.PICKUP_PENDING]: [
    TripStatus.IN_TRANSIT,
    TripStatus.CANCELLED,
  ],

  [TripStatus.IN_TRANSIT]: [
    TripStatus.DELIVERED,
    TripStatus.CANCELLED,
  ],

  [TripStatus.DELIVERED]: [
    TripStatus.COMPLETED,
    TripStatus.CANCELLED,
  ],

  [TripStatus.COMPLETED]: [
    // Terminal state - no transitions allowed
  ],

  [TripStatus.CANCELLED]: [
    // Terminal state - no transitions allowed
  ],
};

/**
 * Roles that can trigger specific trip status transitions
 */
export const TRIP_ROLE_PERMISSIONS: Record<string, TripStatus[]> = {
  CARRIER: [
    TripStatus.PICKUP_PENDING,
    TripStatus.IN_TRANSIT,
    TripStatus.DELIVERED,
  ],

  DISPATCHER: [
    TripStatus.ASSIGNED,
    TripStatus.CANCELLED,
  ],

  ADMIN: [
    // Admin can set any status (for exception handling)
    ...Object.values(TripStatus),
  ],

  SUPER_ADMIN: [
    // Super admin can set any status
    ...Object.values(TripStatus),
  ],
};

/**
 * Check if a status string is a valid TripStatus
 */
export function isValidTripStatus(status: string): status is TripStatus {
  return Object.values(TripStatus).includes(status as TripStatus);
}

/**
 * Validates if a state transition is allowed
 */
export function isValidTripTransition(
  currentStatus: TripStatus,
  newStatus: TripStatus
): boolean {
  const validNextStatuses = VALID_TRIP_TRANSITIONS[currentStatus];
  return validNextStatuses?.includes(newStatus) ?? false;
}

/**
 * Validates if a role can trigger a specific status transition
 */
export function canRoleSetTripStatus(
  role: string,
  newStatus: TripStatus
): boolean {
  const allowedStatuses = TRIP_ROLE_PERMISSIONS[role] || [];
  return allowedStatuses.includes(newStatus);
}

/**
 * Gets all valid next states for a given current state
 */
export function getValidNextTripStates(
  currentStatus: TripStatus
): TripStatus[] {
  return VALID_TRIP_TRANSITIONS[currentStatus] || [];
}

/**
 * Validates a state transition and returns error message if invalid
 */
export function validateTripStateTransition(
  currentStatus: string,
  newStatus: string,
  userRole: string
): { valid: boolean; error?: string } {
  // Check if both statuses are valid
  if (!isValidTripStatus(currentStatus)) {
    return {
      valid: false,
      error: `Invalid current status: ${currentStatus}`,
    };
  }

  if (!isValidTripStatus(newStatus)) {
    return {
      valid: false,
      error: `Invalid new status: ${newStatus}`,
    };
  }

  const current = currentStatus as TripStatus;
  const next = newStatus as TripStatus;

  // Check if transition is valid
  if (!isValidTripTransition(current, next)) {
    const validNext = getValidNextTripStates(current);
    return {
      valid: false,
      error: `Invalid transition: ${currentStatus} → ${newStatus}. Valid transitions: ${validNext.length > 0 ? validNext.join(', ') : 'none (terminal state)'}`,
    };
  }

  // Check if role can set this status
  if (!canRoleSetTripStatus(userRole, next)) {
    return {
      valid: false,
      error: `Role ${userRole} cannot set trip status to ${newStatus}`,
    };
  }

  return { valid: true };
}

/**
 * Get human-readable description of trip status
 */
export function getTripStatusDescription(status: TripStatus): string {
  const descriptions: Record<TripStatus, string> = {
    [TripStatus.ASSIGNED]: 'Carrier accepted, awaiting pickup',
    [TripStatus.PICKUP_PENDING]: 'Carrier en route to pickup location',
    [TripStatus.IN_TRANSIT]: 'Load picked up, in transit to destination',
    [TripStatus.DELIVERED]: 'Load delivered, awaiting POD verification',
    [TripStatus.COMPLETED]: 'Trip completed, POD verified, payment processed',
    [TripStatus.CANCELLED]: 'Trip cancelled',
  };

  return descriptions[status] || 'Unknown status';
}

/**
 * Check if a trip status is a terminal state (no further transitions)
 */
export function isTerminalTripStatus(status: TripStatus): boolean {
  return VALID_TRIP_TRANSITIONS[status]?.length === 0;
}

/**
 * Check if a trip is considered "active" (not completed or cancelled)
 */
export function isActiveTripStatus(status: TripStatus | string): boolean {
  return [
    TripStatus.ASSIGNED,
    TripStatus.PICKUP_PENDING,
    TripStatus.IN_TRANSIT,
  ].includes(status as TripStatus);
}

/**
 * Get the active trip statuses as an array
 * Useful for database queries
 */
export const ACTIVE_TRIP_STATUSES: TripStatus[] = [
  TripStatus.ASSIGNED,
  TripStatus.PICKUP_PENDING,
  TripStatus.IN_TRANSIT,
];
