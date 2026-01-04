/**
 * FOUNDATION RULES - Global Business Logic Constraints
 *
 * CRITICAL: These rules are the foundation of the freight management platform.
 * DO NOT modify without explicit approval from product owner.
 * All modules MUST reference these rules for enforcement.
 *
 * Created: Phase 2, Sprint 17 - Task Group 0
 */

// =============================================================================
// RULE 1: CARRIER OWNS TRUCKS
// =============================================================================
/**
 * Trucks are assets that belong to carriers.
 * - Only carriers can create, edit, delete trucks
 * - Truck ownership is permanent (carrierId on Truck model)
 * - Other roles can VIEW trucks but never modify ownership
 */
export const RULE_CARRIER_OWNS_TRUCKS = {
  id: 'CARRIER_OWNS_TRUCKS',
  description: 'Carrier is the sole owner of trucks. Only carrier can modify truck records.',
  enforcement: 'Truck.carrierId is required and immutable after creation',
} as const;

// =============================================================================
// RULE 2: POSTING = AVAILABILITY ONLY
// =============================================================================
/**
 * Posting a truck means making it available for loads.
 * - Posting does NOT create a truck (truck must exist first)
 * - Location exists ONLY in TruckPosting, never in Truck master
 * - Posting is ephemeral; trucks are permanent assets
 */
export const RULE_POSTING_IS_AVAILABILITY = {
  id: 'POSTING_IS_AVAILABILITY',
  description: 'Posting expresses availability, not ownership. Location lives only in posting.',
  enforcement: 'TruckPosting references existing Truck; location fields only in TruckPosting',
} as const;

// =============================================================================
// RULE 3: DISPATCHER SEES AVAILABILITY, NOT OWNERSHIP
// =============================================================================
/**
 * Dispatchers coordinate but do not control.
 * - Dispatcher can SEE posted trucks (available)
 * - Dispatcher can SEE loads
 * - Dispatcher can PROPOSE matches
 * - Dispatcher CANNOT assign, accept, or start trips
 */
export const RULE_DISPATCHER_COORDINATION_ONLY = {
  id: 'DISPATCHER_COORDINATION_ONLY',
  description: 'Dispatcher coordinates availability but cannot execute assignments.',
  enforcement: 'Dispatcher has PROPOSE_MATCH permission, not ASSIGN_LOADS or ACCEPT_LOADS',
} as const;

// =============================================================================
// RULE 4: ONE TRUCK → ONE ACTIVE POST
// =============================================================================
/**
 * A truck can only have one active posting at a time.
 * - Prevents double-booking and confusion
 * - When creating new post, previous active post must be expired/cancelled
 * - Database constraint: unique(truckId, status='ACTIVE')
 */
export const RULE_ONE_ACTIVE_POST_PER_TRUCK = {
  id: 'ONE_ACTIVE_POST_PER_TRUCK',
  description: 'Each truck can have at most one active posting at any time.',
  enforcement: 'Unique constraint on TruckPosting(truckId) where status=ACTIVE',
} as const;

// =============================================================================
// RULE 5: LOCATION ONLY IN DYNAMIC TABLES
// =============================================================================
/**
 * Current location is transient, not part of master data.
 * - Truck master table: NO location fields
 * - TruckPosting: contains current location at time of posting
 * - GPSUpdate: contains real-time location during trips
 */
export const RULE_LOCATION_IN_DYNAMIC_TABLES = {
  id: 'LOCATION_IN_DYNAMIC_TABLES',
  description: 'Location data lives only in dynamic tables (posting, GPS), never in master.',
  enforcement: 'Truck model should not have currentCity, currentLocationLat, etc.',
} as const;

// =============================================================================
// RULE 6: CARRIER IS FINAL AUTHORITY ON EXECUTION
// =============================================================================
/**
 * Only the carrier can commit a truck to a load.
 * - Shipper can REQUEST a truck
 * - Dispatcher can PROPOSE a match
 * - Carrier must APPROVE before load is assigned
 * - Carrier starts the trip
 */
export const RULE_CARRIER_FINAL_AUTHORITY = {
  id: 'CARRIER_FINAL_AUTHORITY',
  description: 'Carrier is the final authority on truck execution. No assignment without carrier approval.',
  enforcement: 'TruckRequest requires carrier approval; Load.carrierApprovalStatus must be APPROVED',
} as const;

// =============================================================================
// RULE 7: SHIPPER POSTS LOADS, DOES NOT BROWSE TRUCKS
// =============================================================================
/**
 * Shippers focus on demand, not supply.
 * - Shipper posts loads (origin, destination, cargo, time)
 * - Shipper can search available trucks to REQUEST them
 * - Shipper cannot browse carrier fleet details
 * - Shipper sees only own loads
 */
export const RULE_SHIPPER_DEMAND_FOCUS = {
  id: 'SHIPPER_DEMAND_FOCUS',
  description: 'Shipper manages demand (loads). Can request available trucks but cannot browse fleets.',
  enforcement: 'Shipper can view posted trucks only, not carrier fleet inventory',
} as const;

// =============================================================================
// ALL FOUNDATION RULES
// =============================================================================
export const FOUNDATION_RULES = [
  RULE_CARRIER_OWNS_TRUCKS,
  RULE_POSTING_IS_AVAILABILITY,
  RULE_DISPATCHER_COORDINATION_ONLY,
  RULE_ONE_ACTIVE_POST_PER_TRUCK,
  RULE_LOCATION_IN_DYNAMIC_TABLES,
  RULE_CARRIER_FINAL_AUTHORITY,
  RULE_SHIPPER_DEMAND_FOCUS,
] as const;

// =============================================================================
// ENFORCEMENT HELPERS
// =============================================================================

import { Role } from './rbac/permissions';

/**
 * Check if a role can modify truck ownership
 * Per RULE_CARRIER_OWNS_TRUCKS: Only CARRIER can own/modify trucks
 */
export function canModifyTruckOwnership(role: Role): boolean {
  return role === 'CARRIER';
}

/**
 * Check if a role can directly assign loads (commit trucks)
 * Per RULE_DISPATCHER_COORDINATION_ONLY: Dispatcher CANNOT assign
 * Per RULE_CARRIER_FINAL_AUTHORITY: Only CARRIER commits
 */
export function canDirectlyAssignLoads(role: Role): boolean {
  // Only carrier can commit their own trucks
  // Admin/SuperAdmin can override for support purposes
  return role === 'CARRIER' || role === 'ADMIN' || role === 'SUPER_ADMIN';
}

/**
 * Check if a role can propose matches (without execution)
 * Per RULE_DISPATCHER_COORDINATION_ONLY: Dispatcher can propose
 */
export function canProposeMatches(role: Role): boolean {
  return role === 'DISPATCHER' || role === 'ADMIN' || role === 'SUPER_ADMIN';
}

/**
 * Check if a role can start trips
 * Per RULE_CARRIER_FINAL_AUTHORITY: Only carrier executes
 */
export function canStartTrips(role: Role): boolean {
  return role === 'CARRIER';
}

/**
 * Check if a role can accept load requests
 * Per RULE_CARRIER_FINAL_AUTHORITY: Only carrier accepts
 */
export function canAcceptLoadRequests(role: Role): boolean {
  return role === 'CARRIER';
}

/**
 * Validate that a truck posting doesn't create duplicate active posts
 * Per RULE_ONE_ACTIVE_POST_PER_TRUCK
 */
export interface ActivePostCheck {
  truckId: string;
  hasActivePost: boolean;
  activePostId?: string;
}

export function validateOneActivePostPerTruck(check: ActivePostCheck): {
  valid: boolean;
  error?: string;
} {
  if (check.hasActivePost) {
    return {
      valid: false,
      error: `Truck already has an active posting (ID: ${check.activePostId}). Expire or cancel existing post first.`,
    };
  }
  return { valid: true };
}

/**
 * Role-based data visibility rules
 */
export interface VisibilityRules {
  canViewAllTrucks: boolean;      // Fleet inventory
  canViewPostedTrucks: boolean;   // Availability only
  canViewAllLoads: boolean;       // All loads system-wide
  canViewOwnLoads: boolean;       // Own loads only
  canViewFleetDetails: boolean;   // Carrier fleet details
}

export function getVisibilityRules(role: Role): VisibilityRules {
  switch (role) {
    case 'CARRIER':
      return {
        canViewAllTrucks: false,       // Own trucks only
        canViewPostedTrucks: false,    // No need to browse other trucks
        canViewAllLoads: false,        // Posted loads only
        canViewOwnLoads: true,         // Assigned loads
        canViewFleetDetails: true,     // Own fleet
      };
    case 'SHIPPER':
      return {
        canViewAllTrucks: false,       // No fleet browsing
        canViewPostedTrucks: true,     // Available trucks only
        canViewAllLoads: false,        // Own loads only
        canViewOwnLoads: true,         // Own loads
        canViewFleetDetails: false,    // No fleet access
      };
    case 'DISPATCHER':
      return {
        canViewAllTrucks: false,       // No fleet browsing
        canViewPostedTrucks: true,     // Available trucks
        canViewAllLoads: true,         // All loads for coordination
        canViewOwnLoads: false,        // N/A
        canViewFleetDetails: false,    // No fleet access
      };
    case 'ADMIN':
    case 'SUPER_ADMIN':
      return {
        canViewAllTrucks: true,
        canViewPostedTrucks: true,
        canViewAllLoads: true,
        canViewOwnLoads: true,
        canViewFleetDetails: true,
      };
    default:
      return {
        canViewAllTrucks: false,
        canViewPostedTrucks: false,
        canViewAllLoads: false,
        canViewOwnLoads: false,
        canViewFleetDetails: false,
      };
  }
}

// =============================================================================
// RULE VIOLATION ERRORS
// =============================================================================

export class FoundationRuleViolation extends Error {
  constructor(
    public ruleId: string,
    public ruleDescription: string,
    public attemptedAction: string
  ) {
    super(`Foundation Rule Violation [${ruleId}]: ${ruleDescription}. Attempted: ${attemptedAction}`);
    this.name = 'FoundationRuleViolation';
  }
}

/**
 * Throw if dispatcher attempts to assign loads directly
 */
export function assertDispatcherCannotAssign(role: Role, action: string): void {
  if (role === 'DISPATCHER') {
    throw new FoundationRuleViolation(
      RULE_DISPATCHER_COORDINATION_ONLY.id,
      RULE_DISPATCHER_COORDINATION_ONLY.description,
      action
    );
  }
}

/**
 * Throw if non-carrier attempts to modify truck ownership
 */
export function assertCarrierOwnership(role: Role, action: string): void {
  if (!canModifyTruckOwnership(role)) {
    throw new FoundationRuleViolation(
      RULE_CARRIER_OWNS_TRUCKS.id,
      RULE_CARRIER_OWNS_TRUCKS.description,
      action
    );
  }
}

/**
 * Throw if attempting to create duplicate active post
 */
export function assertOneActivePost(check: ActivePostCheck, action: string): void {
  const result = validateOneActivePostPerTruck(check);
  if (!result.valid) {
    throw new FoundationRuleViolation(
      RULE_ONE_ACTIVE_POST_PER_TRUCK.id,
      result.error!,
      action
    );
  }
}
