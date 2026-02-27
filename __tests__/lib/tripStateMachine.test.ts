/**
 * Trip State Machine Tests
 *
 * Tests for trip lifecycle state transitions
 */

import {
  TripStatus,
  VALID_TRIP_TRANSITIONS,
  TRIP_ROLE_PERMISSIONS,
  isValidTripStatus,
  isValidTripTransition,
  canRoleSetTripStatus,
  getValidNextTripStates,
  validateTripStateTransition,
  getTripStatusDescription,
  isTerminalTripStatus,
  isActiveTripStatus,
  ACTIVE_TRIP_STATUSES,
} from "@/lib/tripStateMachine";

describe("lib/tripStateMachine", () => {
  // ============================================================================
  // isValidTripStatus
  // ============================================================================
  describe("isValidTripStatus", () => {
    it("should return true for valid statuses", () => {
      expect(isValidTripStatus("ASSIGNED")).toBe(true);
      expect(isValidTripStatus("PICKUP_PENDING")).toBe(true);
      expect(isValidTripStatus("IN_TRANSIT")).toBe(true);
      expect(isValidTripStatus("DELIVERED")).toBe(true);
      expect(isValidTripStatus("COMPLETED")).toBe(true);
      expect(isValidTripStatus("CANCELLED")).toBe(true);
    });

    it("should return false for invalid statuses", () => {
      expect(isValidTripStatus("INVALID")).toBe(false);
      expect(isValidTripStatus("DRAFT")).toBe(false);
      expect(isValidTripStatus("")).toBe(false);
    });
  });

  // ============================================================================
  // isValidTripTransition
  // ============================================================================
  describe("isValidTripTransition", () => {
    describe("ASSIGNED transitions", () => {
      it("should allow ASSIGNED → PICKUP_PENDING", () => {
        expect(
          isValidTripTransition(TripStatus.ASSIGNED, TripStatus.PICKUP_PENDING)
        ).toBe(true);
      });

      it("should allow ASSIGNED → CANCELLED", () => {
        expect(
          isValidTripTransition(TripStatus.ASSIGNED, TripStatus.CANCELLED)
        ).toBe(true);
      });

      it("should NOT allow ASSIGNED → IN_TRANSIT directly", () => {
        expect(
          isValidTripTransition(TripStatus.ASSIGNED, TripStatus.IN_TRANSIT)
        ).toBe(false);
      });
    });

    describe("PICKUP_PENDING transitions", () => {
      it("should allow PICKUP_PENDING → IN_TRANSIT", () => {
        expect(
          isValidTripTransition(
            TripStatus.PICKUP_PENDING,
            TripStatus.IN_TRANSIT
          )
        ).toBe(true);
      });

      it("should allow PICKUP_PENDING → CANCELLED", () => {
        expect(
          isValidTripTransition(TripStatus.PICKUP_PENDING, TripStatus.CANCELLED)
        ).toBe(true);
      });
    });

    describe("IN_TRANSIT transitions", () => {
      it("should allow IN_TRANSIT → DELIVERED", () => {
        expect(
          isValidTripTransition(TripStatus.IN_TRANSIT, TripStatus.DELIVERED)
        ).toBe(true);
      });

      it("should allow IN_TRANSIT → CANCELLED", () => {
        expect(
          isValidTripTransition(TripStatus.IN_TRANSIT, TripStatus.CANCELLED)
        ).toBe(true);
      });
    });

    describe("DELIVERED transitions", () => {
      it("should allow DELIVERED → COMPLETED", () => {
        expect(
          isValidTripTransition(TripStatus.DELIVERED, TripStatus.COMPLETED)
        ).toBe(true);
      });

      it("should allow DELIVERED → CANCELLED", () => {
        expect(
          isValidTripTransition(TripStatus.DELIVERED, TripStatus.CANCELLED)
        ).toBe(true);
      });
    });

    describe("terminal states", () => {
      it("COMPLETED should have no valid transitions", () => {
        expect(
          isValidTripTransition(TripStatus.COMPLETED, TripStatus.CANCELLED)
        ).toBe(false);
        expect(
          isValidTripTransition(TripStatus.COMPLETED, TripStatus.ASSIGNED)
        ).toBe(false);
      });

      it("CANCELLED should have no valid transitions", () => {
        expect(
          isValidTripTransition(TripStatus.CANCELLED, TripStatus.COMPLETED)
        ).toBe(false);
        expect(
          isValidTripTransition(TripStatus.CANCELLED, TripStatus.ASSIGNED)
        ).toBe(false);
      });
    });
  });

  // ============================================================================
  // canRoleSetTripStatus
  // ============================================================================
  describe("canRoleSetTripStatus", () => {
    describe("CARRIER permissions", () => {
      it("CARRIER can set PICKUP_PENDING", () => {
        expect(canRoleSetTripStatus("CARRIER", TripStatus.PICKUP_PENDING)).toBe(
          true
        );
      });

      it("CARRIER can set IN_TRANSIT", () => {
        expect(canRoleSetTripStatus("CARRIER", TripStatus.IN_TRANSIT)).toBe(
          true
        );
      });

      it("CARRIER can set DELIVERED", () => {
        expect(canRoleSetTripStatus("CARRIER", TripStatus.DELIVERED)).toBe(
          true
        );
      });

      it("CARRIER cannot set ASSIGNED", () => {
        expect(canRoleSetTripStatus("CARRIER", TripStatus.ASSIGNED)).toBe(
          false
        );
      });

      it("CARRIER cannot set CANCELLED", () => {
        expect(canRoleSetTripStatus("CARRIER", TripStatus.CANCELLED)).toBe(
          false
        );
      });
    });

    describe("DISPATCHER permissions", () => {
      it("DISPATCHER can set ASSIGNED", () => {
        expect(canRoleSetTripStatus("DISPATCHER", TripStatus.ASSIGNED)).toBe(
          true
        );
      });

      it("DISPATCHER can set CANCELLED", () => {
        expect(canRoleSetTripStatus("DISPATCHER", TripStatus.CANCELLED)).toBe(
          true
        );
      });

      it("DISPATCHER cannot set IN_TRANSIT", () => {
        expect(canRoleSetTripStatus("DISPATCHER", TripStatus.IN_TRANSIT)).toBe(
          false
        );
      });
    });

    describe("ADMIN permissions", () => {
      it("ADMIN can set any status", () => {
        Object.values(TripStatus).forEach((status) => {
          expect(canRoleSetTripStatus("ADMIN", status)).toBe(true);
        });
      });
    });

    describe("SUPER_ADMIN permissions", () => {
      it("SUPER_ADMIN can set any status", () => {
        Object.values(TripStatus).forEach((status) => {
          expect(canRoleSetTripStatus("SUPER_ADMIN", status)).toBe(true);
        });
      });
    });

    describe("unknown role", () => {
      it("unknown role cannot set any status", () => {
        expect(canRoleSetTripStatus("UNKNOWN", TripStatus.ASSIGNED)).toBe(
          false
        );
        expect(canRoleSetTripStatus("SHIPPER", TripStatus.DELIVERED)).toBe(
          false
        );
      });
    });
  });

  // ============================================================================
  // getValidNextTripStates
  // ============================================================================
  describe("getValidNextTripStates", () => {
    it("should return valid next states for ASSIGNED", () => {
      const next = getValidNextTripStates(TripStatus.ASSIGNED);
      expect(next).toContain(TripStatus.PICKUP_PENDING);
      expect(next).toContain(TripStatus.CANCELLED);
      expect(next).not.toContain(TripStatus.IN_TRANSIT);
    });

    it("should return empty array for COMPLETED", () => {
      const next = getValidNextTripStates(TripStatus.COMPLETED);
      expect(next).toHaveLength(0);
    });

    it("should return empty array for CANCELLED", () => {
      const next = getValidNextTripStates(TripStatus.CANCELLED);
      expect(next).toHaveLength(0);
    });
  });

  // ============================================================================
  // validateTripStateTransition
  // ============================================================================
  describe("validateTripStateTransition", () => {
    it("should return valid for allowed transition by role", () => {
      const result = validateTripStateTransition(
        "ASSIGNED",
        "PICKUP_PENDING",
        "CARRIER"
      );
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should return invalid for invalid current status", () => {
      const result = validateTripStateTransition(
        "INVALID",
        "IN_TRANSIT",
        "CARRIER"
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid current status");
    });

    it("should return invalid for invalid new status", () => {
      const result = validateTripStateTransition(
        "ASSIGNED",
        "INVALID",
        "CARRIER"
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid new status");
    });

    it("should return invalid for disallowed transition", () => {
      const result = validateTripStateTransition(
        "ASSIGNED",
        "DELIVERED",
        "CARRIER"
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid transition");
    });

    it("should return invalid when role cannot set status", () => {
      const result = validateTripStateTransition(
        "PICKUP_PENDING",
        "CANCELLED",
        "CARRIER"
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("CARRIER cannot set trip status");
    });

    it("should include terminal state info in error", () => {
      const result = validateTripStateTransition(
        "COMPLETED",
        "ASSIGNED",
        "ADMIN"
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("terminal state");
    });
  });

  // ============================================================================
  // getTripStatusDescription
  // ============================================================================
  describe("getTripStatusDescription", () => {
    it("should return description for ASSIGNED", () => {
      expect(getTripStatusDescription(TripStatus.ASSIGNED)).toContain(
        "accepted"
      );
    });

    it("should return description for IN_TRANSIT", () => {
      expect(getTripStatusDescription(TripStatus.IN_TRANSIT)).toContain(
        "in transit"
      );
    });

    it("should return description for COMPLETED", () => {
      expect(getTripStatusDescription(TripStatus.COMPLETED)).toContain(
        "POD verified"
      );
    });

    it("should return unknown for invalid status", () => {
      expect(getTripStatusDescription("INVALID" as TripStatus)).toBe(
        "Unknown status"
      );
    });
  });

  // ============================================================================
  // isTerminalTripStatus
  // ============================================================================
  describe("isTerminalTripStatus", () => {
    it("should return true for COMPLETED", () => {
      expect(isTerminalTripStatus(TripStatus.COMPLETED)).toBe(true);
    });

    it("should return true for CANCELLED", () => {
      expect(isTerminalTripStatus(TripStatus.CANCELLED)).toBe(true);
    });

    it("should return false for ASSIGNED", () => {
      expect(isTerminalTripStatus(TripStatus.ASSIGNED)).toBe(false);
    });

    it("should return false for IN_TRANSIT", () => {
      expect(isTerminalTripStatus(TripStatus.IN_TRANSIT)).toBe(false);
    });
  });

  // ============================================================================
  // isActiveTripStatus
  // ============================================================================
  describe("isActiveTripStatus", () => {
    it("should return true for ASSIGNED", () => {
      expect(isActiveTripStatus(TripStatus.ASSIGNED)).toBe(true);
    });

    it("should return true for PICKUP_PENDING", () => {
      expect(isActiveTripStatus(TripStatus.PICKUP_PENDING)).toBe(true);
    });

    it("should return true for IN_TRANSIT", () => {
      expect(isActiveTripStatus(TripStatus.IN_TRANSIT)).toBe(true);
    });

    it("should return false for DELIVERED", () => {
      expect(isActiveTripStatus(TripStatus.DELIVERED)).toBe(false);
    });

    it("should return false for COMPLETED", () => {
      expect(isActiveTripStatus(TripStatus.COMPLETED)).toBe(false);
    });

    it("should return false for CANCELLED", () => {
      expect(isActiveTripStatus(TripStatus.CANCELLED)).toBe(false);
    });

    it("should work with string input", () => {
      expect(isActiveTripStatus("ASSIGNED")).toBe(true);
      expect(isActiveTripStatus("COMPLETED")).toBe(false);
    });
  });

  // ============================================================================
  // ACTIVE_TRIP_STATUSES
  // ============================================================================
  describe("ACTIVE_TRIP_STATUSES", () => {
    it("should contain only active statuses", () => {
      expect(ACTIVE_TRIP_STATUSES).toContain(TripStatus.ASSIGNED);
      expect(ACTIVE_TRIP_STATUSES).toContain(TripStatus.PICKUP_PENDING);
      expect(ACTIVE_TRIP_STATUSES).toContain(TripStatus.IN_TRANSIT);
    });

    it("should not contain terminal statuses", () => {
      expect(ACTIVE_TRIP_STATUSES).not.toContain(TripStatus.DELIVERED);
      expect(ACTIVE_TRIP_STATUSES).not.toContain(TripStatus.COMPLETED);
      expect(ACTIVE_TRIP_STATUSES).not.toContain(TripStatus.CANCELLED);
    });
  });

  // ============================================================================
  // Workflow scenarios
  // ============================================================================
  describe("complete workflow scenarios", () => {
    it("should support happy path: ASSIGNED → PICKUP_PENDING → IN_TRANSIT → DELIVERED → COMPLETED", () => {
      expect(
        isValidTripTransition(TripStatus.ASSIGNED, TripStatus.PICKUP_PENDING)
      ).toBe(true);
      expect(
        isValidTripTransition(TripStatus.PICKUP_PENDING, TripStatus.IN_TRANSIT)
      ).toBe(true);
      expect(
        isValidTripTransition(TripStatus.IN_TRANSIT, TripStatus.DELIVERED)
      ).toBe(true);
      expect(
        isValidTripTransition(TripStatus.DELIVERED, TripStatus.COMPLETED)
      ).toBe(true);
    });

    it("should support cancellation at any non-terminal state", () => {
      expect(
        isValidTripTransition(TripStatus.ASSIGNED, TripStatus.CANCELLED)
      ).toBe(true);
      expect(
        isValidTripTransition(TripStatus.PICKUP_PENDING, TripStatus.CANCELLED)
      ).toBe(true);
      expect(
        isValidTripTransition(TripStatus.IN_TRANSIT, TripStatus.CANCELLED)
      ).toBe(true);
      expect(
        isValidTripTransition(TripStatus.DELIVERED, TripStatus.CANCELLED)
      ).toBe(true);
    });

    it("should not allow backward transitions", () => {
      expect(
        isValidTripTransition(TripStatus.IN_TRANSIT, TripStatus.PICKUP_PENDING)
      ).toBe(false);
      expect(
        isValidTripTransition(TripStatus.DELIVERED, TripStatus.IN_TRANSIT)
      ).toBe(false);
    });
  });
});
