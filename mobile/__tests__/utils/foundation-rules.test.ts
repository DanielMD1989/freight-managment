/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for foundation rules - business logic, state machines
 */
import {
  getValidNextTripStatuses,
  canCancelTrip,
  canTransitionTrip,
  isTripTerminal,
  isTripActive,
  getValidNextLoadStatuses,
  canTransitionLoad,
  canEditLoad,
  canDeleteLoad,
  isLoadTerminal,
  isLoadActive,
  isLoadInProgress,
  canModifyTruckOwnership,
  canDirectlyAssignLoads,
  canProposeMatches,
  canStartTrips,
  canAcceptLoadRequests,
  canAcceptTruckRequests,
  getVisibilityRules,
  canCancelRequest,
  canRespondToRequest,
  FoundationRuleViolation,
  assertCanModifyTruck,
  assertCanStartTrip,
} from "../../src/utils/foundation-rules";

describe("Foundation Rules", () => {
  describe("Trip State Machine", () => {
    it("should return valid next statuses for ASSIGNED", () => {
      const next = getValidNextTripStatuses("ASSIGNED");
      expect(next).toContain("PICKUP_PENDING");
      expect(next).toContain("CANCELLED");
      expect(next).not.toContain("DELIVERED");
      expect(next).not.toContain("IN_TRANSIT");
    });

    it("should return valid next statuses for PICKUP_PENDING", () => {
      const next = getValidNextTripStatuses("PICKUP_PENDING");
      expect(next).toContain("IN_TRANSIT");
      expect(next).toContain("CANCELLED");
    });

    it("should return valid next statuses for IN_TRANSIT", () => {
      const next = getValidNextTripStatuses("IN_TRANSIT");
      expect(next).toContain("DELIVERED");
      expect(next).toContain("CANCELLED");
    });

    it("should allow DELIVERED -> COMPLETED", () => {
      const next = getValidNextTripStatuses("DELIVERED");
      expect(next).toContain("COMPLETED");
    });

    it("should return empty array for COMPLETED (terminal state)", () => {
      const next = getValidNextTripStatuses("COMPLETED");
      expect(next).toHaveLength(0);
    });

    it("should return empty array for CANCELLED (terminal state)", () => {
      const next = getValidNextTripStatuses("CANCELLED");
      expect(next).toHaveLength(0);
    });

    it("should return empty for unknown status", () => {
      const next = getValidNextTripStatuses("UNKNOWN" as any);
      expect(next).toHaveLength(0);
    });

    it("should validate specific transitions", () => {
      expect(canTransitionTrip("ASSIGNED", "PICKUP_PENDING")).toBe(true);
      expect(canTransitionTrip("ASSIGNED", "DELIVERED")).toBe(false);
      expect(canTransitionTrip("IN_TRANSIT", "DELIVERED")).toBe(true);
      expect(canTransitionTrip("COMPLETED", "ASSIGNED")).toBe(false);
    });
  });

  describe("canCancelTrip", () => {
    it("should allow cancellation for ASSIGNED", () => {
      expect(canCancelTrip("ASSIGNED")).toBe(true);
    });

    it("should allow cancellation for PICKUP_PENDING", () => {
      expect(canCancelTrip("PICKUP_PENDING")).toBe(true);
    });

    it("should allow cancellation for IN_TRANSIT", () => {
      expect(canCancelTrip("IN_TRANSIT")).toBe(true);
    });

    it("should allow cancellation for DELIVERED", () => {
      expect(canCancelTrip("DELIVERED")).toBe(true);
    });

    it("should not allow cancellation for COMPLETED", () => {
      expect(canCancelTrip("COMPLETED")).toBe(false);
    });

    it("should not allow cancellation for CANCELLED", () => {
      expect(canCancelTrip("CANCELLED")).toBe(false);
    });
  });

  describe("Trip terminal/active checks", () => {
    it("should identify terminal states", () => {
      expect(isTripTerminal("COMPLETED")).toBe(true);
      expect(isTripTerminal("CANCELLED")).toBe(true);
      expect(isTripTerminal("IN_TRANSIT")).toBe(false);
      expect(isTripTerminal("ASSIGNED")).toBe(false);
    });

    it("should identify active states", () => {
      expect(isTripActive("ASSIGNED")).toBe(true);
      expect(isTripActive("PICKUP_PENDING")).toBe(true);
      expect(isTripActive("IN_TRANSIT")).toBe(true);
      expect(isTripActive("DELIVERED")).toBe(false);
      expect(isTripActive("COMPLETED")).toBe(false);
    });
  });

  describe("Load State Machine", () => {
    it("should allow DRAFT -> POSTED", () => {
      expect(canTransitionLoad("DRAFT", "POSTED")).toBe(true);
    });

    it("should allow POSTED -> SEARCHING", () => {
      expect(canTransitionLoad("POSTED", "SEARCHING")).toBe(true);
    });

    it("should not allow DRAFT -> DELIVERED", () => {
      expect(canTransitionLoad("DRAFT", "DELIVERED")).toBe(false);
    });

    it("should return empty for CANCELLED", () => {
      const next = getValidNextLoadStatuses("CANCELLED");
      expect(next).toHaveLength(0);
    });
  });

  describe("Load helpers", () => {
    it("should check editability", () => {
      expect(canEditLoad("DRAFT")).toBe(true);
      expect(canEditLoad("POSTED")).toBe(true);
      expect(canEditLoad("IN_TRANSIT")).toBe(false);
    });

    it("should check deletability", () => {
      expect(canDeleteLoad("DRAFT")).toBe(true);
      expect(canDeleteLoad("UNPOSTED")).toBe(true);
      expect(canDeleteLoad("POSTED")).toBe(false);
    });

    it("should check terminal state", () => {
      expect(isLoadTerminal("COMPLETED")).toBe(true);
      expect(isLoadTerminal("CANCELLED")).toBe(true);
      expect(isLoadTerminal("POSTED")).toBe(false);
    });

    it("should check active state", () => {
      expect(isLoadActive("POSTED")).toBe(true);
      expect(isLoadActive("SEARCHING")).toBe(true);
      expect(isLoadActive("ASSIGNED")).toBe(false);
    });

    it("should check in-progress state", () => {
      expect(isLoadInProgress("ASSIGNED")).toBe(true);
      expect(isLoadInProgress("IN_TRANSIT")).toBe(true);
      expect(isLoadInProgress("DELIVERED")).toBe(false);
    });
  });

  describe("Role Permission Checks", () => {
    it("should check truck ownership permissions", () => {
      expect(canModifyTruckOwnership("CARRIER")).toBe(true);
      expect(canModifyTruckOwnership("SHIPPER")).toBe(false);
      expect(canModifyTruckOwnership("ADMIN")).toBe(false);
    });

    it("should check direct load assignment", () => {
      expect(canDirectlyAssignLoads("CARRIER")).toBe(true);
      expect(canDirectlyAssignLoads("ADMIN")).toBe(true);
      expect(canDirectlyAssignLoads("SHIPPER")).toBe(false);
    });

    it("should check match proposal permissions", () => {
      expect(canProposeMatches("DISPATCHER")).toBe(true);
      expect(canProposeMatches("ADMIN")).toBe(true);
      expect(canProposeMatches("CARRIER")).toBe(false);
    });

    it("should check trip start permissions", () => {
      expect(canStartTrips("CARRIER")).toBe(true);
      expect(canStartTrips("SHIPPER")).toBe(false);
    });

    it("should check load request acceptance", () => {
      expect(canAcceptLoadRequests("CARRIER")).toBe(true);
      expect(canAcceptLoadRequests("SHIPPER")).toBe(false);
    });

    it("should check truck request acceptance", () => {
      expect(canAcceptTruckRequests("SHIPPER")).toBe(true);
      expect(canAcceptTruckRequests("ADMIN")).toBe(true);
      expect(canAcceptTruckRequests("CARRIER")).toBe(false);
    });
  });

  describe("Visibility Rules", () => {
    it("should give carriers fleet visibility", () => {
      const rules = getVisibilityRules("CARRIER");
      expect(rules.canViewFleetDetails).toBe(true);
      expect(rules.canViewOwnLoads).toBe(true);
      expect(rules.canViewAllTrucks).toBe(false);
    });

    it("should give shippers posted truck visibility", () => {
      const rules = getVisibilityRules("SHIPPER");
      expect(rules.canViewPostedTrucks).toBe(true);
      expect(rules.canViewFleetDetails).toBe(false);
    });

    it("should give admins full visibility", () => {
      const rules = getVisibilityRules("ADMIN");
      expect(rules.canViewAllTrucks).toBe(true);
      expect(rules.canViewAllLoads).toBe(true);
      expect(rules.canViewFleetDetails).toBe(true);
    });
  });

  describe("Request Status", () => {
    it("should check cancel eligibility", () => {
      expect(canCancelRequest("PENDING")).toBe(true);
      expect(canCancelRequest("APPROVED")).toBe(false);
    });

    it("should check response eligibility", () => {
      expect(canRespondToRequest("PENDING")).toBe(true);
      expect(canRespondToRequest("REJECTED")).toBe(false);
    });
  });

  describe("FoundationRuleViolation", () => {
    it("should create error with rule details", () => {
      const error = new FoundationRuleViolation(
        "RULE_1",
        "Test message",
        "test action"
      );
      expect(error.message).toContain("RULE_1");
      expect(error.message).toContain("Test message");
      expect(error.message).toContain("test action");
      expect(error.ruleId).toBe("RULE_1");
      expect(error.attemptedAction).toBe("test action");
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("Assertion Helpers", () => {
    it("should not throw for valid truck modification", () => {
      expect(() => assertCanModifyTruck("CARRIER")).not.toThrow();
    });

    it("should throw for invalid truck modification", () => {
      expect(() => assertCanModifyTruck("SHIPPER")).toThrow(
        FoundationRuleViolation
      );
    });

    it("should not throw for valid trip start", () => {
      expect(() => assertCanStartTrip("CARRIER")).not.toThrow();
    });

    it("should throw for invalid trip start", () => {
      expect(() => assertCanStartTrip("SHIPPER")).toThrow(
        FoundationRuleViolation
      );
    });
  });
});
