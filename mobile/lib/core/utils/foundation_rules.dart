/// Foundation Rules - Global Business Logic Constraints
///
/// CRITICAL: These rules are the foundation of the freight management platform.
/// These match the rules defined in the web app's lib/foundation-rules.ts
///
/// All mobile app logic MUST respect these rules.
library;

import '../models/load.dart';
import '../models/truck.dart';

// =============================================================================
// RULE 1: CARRIER OWNS TRUCKS
// =============================================================================
/// Trucks are assets that belong to carriers.
/// - Only carriers can create, edit, delete trucks
/// - Truck ownership is permanent (carrierId on Truck model)
/// - Other roles can VIEW trucks but never modify ownership
const String RULE_CARRIER_OWNS_TRUCKS = 'CARRIER_OWNS_TRUCKS';

// =============================================================================
// RULE 2: POSTING = AVAILABILITY ONLY
// =============================================================================
/// Posting a truck means making it available for loads.
/// - Posting does NOT create a truck (truck must exist first)
/// - Location exists ONLY in TruckPosting, never in Truck master
/// - Posting is ephemeral; trucks are permanent assets
const String RULE_POSTING_IS_AVAILABILITY = 'POSTING_IS_AVAILABILITY';

// =============================================================================
// RULE 3: DISPATCHER SEES AVAILABILITY, NOT OWNERSHIP
// =============================================================================
/// Dispatchers coordinate but do not control.
/// - Dispatcher can SEE posted trucks (available)
/// - Dispatcher can SEE loads
/// - Dispatcher can PROPOSE matches
/// - Dispatcher CANNOT assign, accept, or start trips
const String RULE_DISPATCHER_COORDINATION_ONLY = 'DISPATCHER_COORDINATION_ONLY';

// =============================================================================
// RULE 4: ONE TRUCK → ONE ACTIVE POST
// =============================================================================
/// A truck can only have one active posting at a time.
/// - Prevents double-booking and confusion
/// - When creating new post, previous active post must be expired/cancelled
const String RULE_ONE_ACTIVE_POST_PER_TRUCK = 'ONE_ACTIVE_POST_PER_TRUCK';

// =============================================================================
// RULE 5: LOCATION ONLY IN DYNAMIC TABLES
// =============================================================================
/// Current location is transient, not part of master data.
/// - Truck master table: NO location fields
/// - TruckPosting: contains current location at time of posting
/// - GPSUpdate: contains real-time location during trips
const String RULE_LOCATION_IN_DYNAMIC_TABLES = 'LOCATION_IN_DYNAMIC_TABLES';

// =============================================================================
// RULE 6: CARRIER IS FINAL AUTHORITY ON EXECUTION
// =============================================================================
/// Only the carrier can commit a truck to a load.
/// - Shipper can REQUEST a truck
/// - Dispatcher can PROPOSE a match
/// - Carrier must APPROVE before load is assigned
/// - Carrier starts the trip
const String RULE_CARRIER_FINAL_AUTHORITY = 'CARRIER_FINAL_AUTHORITY';

// =============================================================================
// RULE 7: SHIPPER POSTS LOADS, DOES NOT BROWSE TRUCKS
// =============================================================================
/// Shippers focus on demand, not supply.
/// - Shipper posts loads (origin, destination, cargo, time)
/// - Shipper can search available trucks to REQUEST them
/// - Shipper cannot browse carrier fleet details
/// - Shipper sees only own loads
const String RULE_SHIPPER_DEMAND_FOCUS = 'SHIPPER_DEMAND_FOCUS';

// =============================================================================
// USER ROLE ENUM
// =============================================================================
enum UserRole {
  shipper,
  carrier,
  dispatcher,
  driver,
  admin,
  superAdmin,
  platformOps,
}

UserRole userRoleFromString(String? role) {
  switch (role?.toUpperCase()) {
    case 'SHIPPER':
      return UserRole.shipper;
    case 'CARRIER':
      return UserRole.carrier;
    case 'DISPATCHER':
      return UserRole.dispatcher;
    case 'DRIVER':
      return UserRole.driver;
    case 'ADMIN':
      return UserRole.admin;
    case 'SUPER_ADMIN':
      return UserRole.superAdmin;
    case 'PLATFORM_OPS':
      return UserRole.platformOps;
    default:
      return UserRole.shipper;
  }
}

// =============================================================================
// ENFORCEMENT HELPERS
// =============================================================================

/// Check if a role can modify truck ownership
/// Per RULE_CARRIER_OWNS_TRUCKS: Only CARRIER can own/modify trucks
bool canModifyTruckOwnership(UserRole role) {
  return role == UserRole.carrier;
}

/// Check if a role can directly assign loads (commit trucks)
/// Per RULE_DISPATCHER_COORDINATION_ONLY: Dispatcher CANNOT assign
/// Per RULE_CARRIER_FINAL_AUTHORITY: Only CARRIER commits
bool canDirectlyAssignLoads(UserRole role) {
  return role == UserRole.carrier ||
      role == UserRole.admin ||
      role == UserRole.superAdmin;
}

/// Check if a role can propose matches (without execution)
/// Per RULE_DISPATCHER_COORDINATION_ONLY: Dispatcher can propose
bool canProposeMatches(UserRole role) {
  return role == UserRole.dispatcher ||
      role == UserRole.admin ||
      role == UserRole.superAdmin;
}

/// Check if a role can start trips
/// Per RULE_CARRIER_FINAL_AUTHORITY: Only carrier executes
bool canStartTrips(UserRole role) {
  return role == UserRole.carrier;
}

/// Check if a role can accept load requests
/// Per RULE_CARRIER_FINAL_AUTHORITY: Only carrier accepts
bool canAcceptLoadRequests(UserRole role) {
  return role == UserRole.carrier;
}

/// Check if a role can accept truck requests (shipper accepting carrier's offer)
bool canAcceptTruckRequests(UserRole role) {
  return role == UserRole.shipper ||
      role == UserRole.admin ||
      role == UserRole.superAdmin;
}

// =============================================================================
// VISIBILITY RULES
// =============================================================================

class VisibilityRules {
  final bool canViewAllTrucks; // Fleet inventory
  final bool canViewPostedTrucks; // Availability only
  final bool canViewAllLoads; // All loads system-wide
  final bool canViewOwnLoads; // Own loads only
  final bool canViewFleetDetails; // Carrier fleet details

  const VisibilityRules({
    required this.canViewAllTrucks,
    required this.canViewPostedTrucks,
    required this.canViewAllLoads,
    required this.canViewOwnLoads,
    required this.canViewFleetDetails,
  });
}

VisibilityRules getVisibilityRules(UserRole role) {
  switch (role) {
    case UserRole.carrier:
      return const VisibilityRules(
        canViewAllTrucks: false, // Own trucks only
        canViewPostedTrucks: false, // No need to browse other trucks
        canViewAllLoads: false, // Posted loads only
        canViewOwnLoads: true, // Assigned loads
        canViewFleetDetails: true, // Own fleet
      );
    case UserRole.shipper:
      return const VisibilityRules(
        canViewAllTrucks: false, // No fleet browsing
        canViewPostedTrucks: true, // Available trucks only
        canViewAllLoads: false, // Own loads only
        canViewOwnLoads: true, // Own loads
        canViewFleetDetails: false, // No fleet access
      );
    case UserRole.dispatcher:
      return const VisibilityRules(
        canViewAllTrucks: false, // No fleet browsing
        canViewPostedTrucks: true, // Available trucks
        canViewAllLoads: true, // All loads for coordination
        canViewOwnLoads: false, // N/A
        canViewFleetDetails: false, // No fleet access
      );
    case UserRole.admin:
    case UserRole.superAdmin:
      return const VisibilityRules(
        canViewAllTrucks: true,
        canViewPostedTrucks: true,
        canViewAllLoads: true,
        canViewOwnLoads: true,
        canViewFleetDetails: true,
      );
    default:
      return const VisibilityRules(
        canViewAllTrucks: false,
        canViewPostedTrucks: false,
        canViewAllLoads: false,
        canViewOwnLoads: false,
        canViewFleetDetails: false,
      );
  }
}

// =============================================================================
// LOAD STATUS MACHINE
// =============================================================================

/// Valid load status transitions
/// Matches the web app's load state machine
class LoadStateMachine {
  static const Map<LoadStatus, List<LoadStatus>> validTransitions = {
    LoadStatus.draft: [LoadStatus.posted, LoadStatus.cancelled],
    LoadStatus.posted: [
      LoadStatus.unposted,
      LoadStatus.searching,
      LoadStatus.assigned,
      LoadStatus.cancelled,
      LoadStatus.expired
    ],
    LoadStatus.unposted: [LoadStatus.posted, LoadStatus.cancelled],
    LoadStatus.searching: [
      LoadStatus.offered,
      LoadStatus.assigned,
      LoadStatus.cancelled,
      LoadStatus.expired
    ],
    LoadStatus.offered: [
      LoadStatus.assigned,
      LoadStatus.searching,
      LoadStatus.cancelled
    ],
    LoadStatus.assigned: [
      LoadStatus.pickupPending,
      LoadStatus.cancelled,
      LoadStatus.exception
    ],
    LoadStatus.pickupPending: [
      LoadStatus.inTransit,
      LoadStatus.cancelled,
      LoadStatus.exception
    ],
    LoadStatus.inTransit: [
      LoadStatus.delivered,
      LoadStatus.exception
    ],
    LoadStatus.delivered: [LoadStatus.completed, LoadStatus.exception],
    LoadStatus.completed: [], // Terminal state
    LoadStatus.exception: [
      LoadStatus.inTransit,
      LoadStatus.delivered,
      LoadStatus.cancelled
    ],
    LoadStatus.cancelled: [], // Terminal state
    LoadStatus.expired: [LoadStatus.posted], // Can re-post
  };

  /// Check if a transition is valid
  static bool canTransition(LoadStatus from, LoadStatus to) {
    return validTransitions[from]?.contains(to) ?? false;
  }

  /// Get valid next statuses
  static List<LoadStatus> getValidNextStatuses(LoadStatus current) {
    return validTransitions[current] ?? [];
  }

  /// Check if load can be edited
  static bool canEdit(LoadStatus status) {
    return status == LoadStatus.draft ||
        status == LoadStatus.unposted ||
        status == LoadStatus.posted;
  }

  /// Check if load can be deleted
  static bool canDelete(LoadStatus status) {
    return status == LoadStatus.draft || status == LoadStatus.unposted;
  }

  /// Check if load is in a terminal state
  static bool isTerminal(LoadStatus status) {
    return status == LoadStatus.completed || status == LoadStatus.cancelled;
  }

  /// Check if load is active (visible in marketplace)
  static bool isActive(LoadStatus status) {
    return status == LoadStatus.posted ||
        status == LoadStatus.searching ||
        status == LoadStatus.offered;
  }

  /// Check if load is in-progress
  static bool isInProgress(LoadStatus status) {
    return status == LoadStatus.assigned ||
        status == LoadStatus.pickupPending ||
        status == LoadStatus.inTransit;
  }
}

// =============================================================================
// TRUCK POSTING VALIDATION
// =============================================================================

/// Validate that a truck can be posted
class TruckPostingValidator {
  /// Check if truck already has an active posting
  static bool hasActivePosting(
      Truck truck, List<TruckPosting> existingPostings) {
    return existingPostings.any((posting) =>
        posting.truckId == truck.id && posting.status.toUpperCase() == 'ACTIVE');
  }

  /// Validate posting dates
  static bool areDatesValid(DateTime availableFrom, DateTime availableTo) {
    final now = DateTime.now();
    return availableFrom.isAfter(now.subtract(const Duration(days: 1))) &&
        availableTo.isAfter(availableFrom);
  }

  /// Validate posting has required fields
  static List<String> validatePosting({
    required String? truckId,
    required String? originCityId,
    required DateTime? availableFrom,
    required DateTime? availableTo,
  }) {
    final errors = <String>[];

    if (truckId == null || truckId.isEmpty) {
      errors.add('Please select a truck');
    }
    if (originCityId == null || originCityId.isEmpty) {
      errors.add('Please select a city');
    }
    if (availableFrom == null) {
      errors.add('Please select availability start date');
    }
    if (availableTo == null) {
      errors.add('Please select availability end date');
    }
    if (availableFrom != null &&
        availableTo != null &&
        !areDatesValid(availableFrom, availableTo)) {
      errors.add('End date must be after start date');
    }

    return errors;
  }
}

// =============================================================================
// REQUEST VALIDATION
// =============================================================================

/// Validate request status transitions
class RequestStateMachine {
  static const List<String> validStatuses = [
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELLED',
    'EXPIRED'
  ];

  static const Map<String, List<String>> validTransitions = {
    'PENDING': ['APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'],
    'APPROVED': [], // Terminal
    'REJECTED': [], // Terminal
    'CANCELLED': [], // Terminal
    'EXPIRED': [], // Terminal
  };

  /// Check if request can be cancelled
  static bool canCancel(String status) {
    return status == 'PENDING';
  }

  /// Check if request can be responded to
  static bool canRespond(String status) {
    return status == 'PENDING';
  }
}
