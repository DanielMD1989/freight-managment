/**
 * Foundation Rules - Global Business Logic Constraints
 * Ported from Flutter's foundation_rules.dart
 *
 * CRITICAL: These rules are the foundation of the freight management platform.
 * Must match web app's lib/foundation-rules.ts
 */
import type { UserRole, LoadStatus, TripStatus, RequestStatus } from "../types";

// =============================================================================
// ENFORCEMENT HELPERS
// =============================================================================

/** Check if a role can modify truck ownership (Rule 1: CARRIER_OWNS_TRUCKS) */
export function canModifyTruckOwnership(role: UserRole): boolean {
  return role === "CARRIER";
}

/** Check if a role can directly assign loads (Rule 6: CARRIER_FINAL_AUTHORITY) */
export function canDirectlyAssignLoads(role: UserRole): boolean {
  return role === "CARRIER" || role === "ADMIN" || role === "SUPER_ADMIN";
}

/** Check if a role can propose matches (Rule 3: DISPATCHER_COORDINATION_ONLY) */
export function canProposeMatches(role: UserRole): boolean {
  return role === "DISPATCHER" || role === "ADMIN" || role === "SUPER_ADMIN";
}

/** Check if a role can start trips */
export function canStartTrips(role: UserRole): boolean {
  return role === "CARRIER";
}

/** Check if a role can accept load requests */
export function canAcceptLoadRequests(role: UserRole): boolean {
  return role === "CARRIER";
}

/** Check if a role can accept truck requests */
export function canAcceptTruckRequests(role: UserRole): boolean {
  return role === "SHIPPER" || role === "ADMIN" || role === "SUPER_ADMIN";
}

// =============================================================================
// VISIBILITY RULES
// =============================================================================

export interface VisibilityRules {
  canViewAllTrucks: boolean;
  canViewPostedTrucks: boolean;
  canViewAllLoads: boolean;
  canViewOwnLoads: boolean;
  canViewFleetDetails: boolean;
}

export function getVisibilityRules(role: UserRole): VisibilityRules {
  switch (role) {
    case "CARRIER":
      return {
        canViewAllTrucks: false,
        canViewPostedTrucks: false,
        canViewAllLoads: false,
        canViewOwnLoads: true,
        canViewFleetDetails: true,
      };
    case "SHIPPER":
      return {
        canViewAllTrucks: false,
        canViewPostedTrucks: true,
        canViewAllLoads: false,
        canViewOwnLoads: true,
        canViewFleetDetails: false,
      };
    case "DISPATCHER":
      return {
        canViewAllTrucks: false,
        canViewPostedTrucks: true,
        canViewAllLoads: true,
        canViewOwnLoads: false,
        canViewFleetDetails: false,
      };
    case "ADMIN":
    case "SUPER_ADMIN":
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
// LOAD STATUS STATE MACHINE
// =============================================================================

const VALID_LOAD_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["POSTED", "CANCELLED"],
  POSTED: [
    "SEARCHING",
    "OFFERED",
    "ASSIGNED",
    "UNPOSTED",
    "CANCELLED",
    "EXPIRED",
  ],
  UNPOSTED: ["POSTED", "CANCELLED"],
  SEARCHING: ["OFFERED", "ASSIGNED", "EXCEPTION", "CANCELLED", "EXPIRED"],
  OFFERED: ["ASSIGNED", "SEARCHING", "EXCEPTION", "CANCELLED", "EXPIRED"],
  ASSIGNED: ["PICKUP_PENDING", "IN_TRANSIT", "EXCEPTION", "CANCELLED"],
  PICKUP_PENDING: ["IN_TRANSIT", "EXCEPTION", "CANCELLED"],
  IN_TRANSIT: ["DELIVERED", "EXCEPTION"],
  DELIVERED: ["COMPLETED", "EXCEPTION"],
  COMPLETED: ["EXCEPTION"],
  EXCEPTION: [
    "SEARCHING",
    "ASSIGNED",
    "IN_TRANSIT",
    "PICKUP_PENDING",
    "CANCELLED",
    "COMPLETED",
  ],
  CANCELLED: [],
  EXPIRED: ["POSTED"],
};

export function canTransitionLoad(from: LoadStatus, to: LoadStatus): boolean {
  return VALID_LOAD_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getValidNextLoadStatuses(current: LoadStatus): LoadStatus[] {
  return (VALID_LOAD_TRANSITIONS[current] ?? []) as LoadStatus[];
}

export function canEditLoad(status: LoadStatus): boolean {
  return status === "DRAFT" || status === "UNPOSTED" || status === "POSTED";
}

export function canDeleteLoad(status: LoadStatus): boolean {
  return status === "DRAFT" || status === "UNPOSTED";
}

export function isLoadTerminal(status: LoadStatus): boolean {
  return status === "COMPLETED" || status === "CANCELLED";
}

export function isLoadActive(status: LoadStatus): boolean {
  return status === "POSTED" || status === "SEARCHING" || status === "OFFERED";
}

export function isLoadInProgress(status: LoadStatus): boolean {
  return (
    status === "ASSIGNED" ||
    status === "PICKUP_PENDING" ||
    status === "IN_TRANSIT"
  );
}

// =============================================================================
// TRIP STATUS STATE MACHINE
// =============================================================================

const VALID_TRIP_TRANSITIONS: Record<string, string[]> = {
  ASSIGNED: ["PICKUP_PENDING", "CANCELLED"],
  PICKUP_PENDING: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionTrip(from: TripStatus, to: TripStatus): boolean {
  return VALID_TRIP_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getValidNextTripStatuses(current: TripStatus): TripStatus[] {
  return (VALID_TRIP_TRANSITIONS[current] ?? []) as TripStatus[];
}

export function isTripTerminal(status: TripStatus): boolean {
  return status === "COMPLETED" || status === "CANCELLED";
}

export function isTripActive(status: TripStatus): boolean {
  return (
    status === "ASSIGNED" ||
    status === "PICKUP_PENDING" ||
    status === "IN_TRANSIT"
  );
}

export function canCancelTrip(status: TripStatus): boolean {
  return VALID_TRIP_TRANSITIONS[status]?.includes("CANCELLED") ?? false;
}

// =============================================================================
// REQUEST STATUS
// =============================================================================

export function canCancelRequest(status: RequestStatus): boolean {
  return status === "PENDING";
}

export function canRespondToRequest(status: RequestStatus): boolean {
  return status === "PENDING";
}

// =============================================================================
// ASSERTION HELPERS (throw on violation)
// =============================================================================

export class FoundationRuleViolation extends Error {
  constructor(
    public ruleId: string,
    message: string,
    public attemptedAction: string
  ) {
    super(`[${ruleId}]: ${message}. Attempted: ${attemptedAction}`);
    this.name = "FoundationRuleViolation";
  }
}

export function assertCanModifyTruck(role: UserRole): void {
  if (!canModifyTruckOwnership(role)) {
    throw new FoundationRuleViolation(
      "CARRIER_OWNS_TRUCKS",
      "Only carriers can create, edit, or delete trucks",
      "modify truck"
    );
  }
}

export function assertCanStartTrip(role: UserRole): void {
  if (!canStartTrips(role)) {
    throw new FoundationRuleViolation(
      "CARRIER_FINAL_AUTHORITY",
      "Only carriers can start trips",
      "start trip"
    );
  }
}
