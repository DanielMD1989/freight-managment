/**
 * PHASE 2: FOUNDATION AUTHORITY TESTS
 *
 * Tests for Phase 2 Foundation Rules enforcement:
 * - CARRIER_FINAL_AUTHORITY: Only carrier can assign trucks
 * - DISPATCHER_COORDINATION_ONLY: Can propose but not assign
 * - SHIPPER_DEMAND_FOCUS: Cannot browse fleet inventory
 * - ONE_ACTIVE_POST_PER_TRUCK: Single active posting rule
 *
 * These tests verify the authority boundaries are correctly enforced.
 */

import { hasPermission, Permission } from "@/lib/rbac/permissions";
import {
  canAssignLoads,
  canPropose,
  canApproveProposals,
  canRequestTruck,
  canApproveRequests,
} from "@/lib/dispatcherPermissions";
import {
  FOUNDATION_RULES,
  RULE_CARRIER_FINAL_AUTHORITY,
  RULE_DISPATCHER_COORDINATION_ONLY,
  RULE_SHIPPER_DEMAND_FOCUS,
  RULE_ONE_ACTIVE_POST_PER_TRUCK,
  getVisibilityRules,
} from "@/lib/foundation-rules";
import { UserRole } from "@prisma/client";

describe("Phase 2: Foundation Authority Rules", () => {
  describe("CARRIER_FINAL_AUTHORITY", () => {
    it("should define carrier as final authority on truck execution", () => {
      expect(RULE_CARRIER_FINAL_AUTHORITY).toBeDefined();
      expect(RULE_CARRIER_FINAL_AUTHORITY.id).toBe("CARRIER_FINAL_AUTHORITY");
      expect(RULE_CARRIER_FINAL_AUTHORITY.description).toContain("carrier");
    });

    it("should allow carrier role to assign loads (role-level check)", () => {
      const user = {
        role: "CARRIER" as UserRole,
        organizationId: "carrier-org-1",
        userId: "carrier-user-1",
      };

      // canAssignLoads is a role-level check - carriers can assign
      // Actual ownership validation happens at API level
      expect(canAssignLoads(user)).toBe(true);
    });

    it("should allow carrier to approve proposals for their trucks", () => {
      const user = {
        role: "CARRIER" as UserRole,
        organizationId: "carrier-org-1",
        userId: "carrier-user-1",
      };

      expect(canApproveProposals(user, "carrier-org-1")).toBe(true);
    });

    it("should allow carrier to approve requests for their trucks", () => {
      const user = {
        role: "CARRIER" as UserRole,
        organizationId: "carrier-org-1",
        userId: "carrier-user-1",
      };

      expect(canApproveRequests(user, "carrier-org-1")).toBe(true);
    });

    it("should prevent carrier from approving proposals for trucks they do not own", () => {
      const user = {
        role: "CARRIER" as UserRole,
        organizationId: "carrier-org-1",
        userId: "carrier-user-1",
      };

      // Carrier cannot approve proposals for another carrier's trucks
      expect(canApproveProposals(user, "carrier-org-2")).toBe(false);
    });

    it("should prevent carrier from approving requests for trucks they do not own", () => {
      const user = {
        role: "CARRIER" as UserRole,
        organizationId: "carrier-org-1",
        userId: "carrier-user-1",
      };

      // Carrier cannot approve requests for another carrier's trucks
      expect(canApproveRequests(user, "carrier-org-2")).toBe(false);
    });
  });

  describe("DISPATCHER_COORDINATION_ONLY", () => {
    it("should define dispatcher as coordinator only", () => {
      expect(RULE_DISPATCHER_COORDINATION_ONLY).toBeDefined();
      expect(RULE_DISPATCHER_COORDINATION_ONLY.id).toBe(
        "DISPATCHER_COORDINATION_ONLY"
      );
    });

    it("should allow dispatcher to create proposals", () => {
      const user = {
        role: "DISPATCHER" as UserRole,
        organizationId: "platform-org",
        userId: "dispatcher-user-1",
      };

      expect(canPropose(user)).toBe(true);
    });

    it("should prevent dispatcher from directly assigning loads", () => {
      const user = {
        role: "DISPATCHER" as UserRole,
        organizationId: "platform-org",
        userId: "dispatcher-user-1",
      };

      expect(canAssignLoads(user, "any-carrier-org")).toBe(false);
    });

    it("should prevent dispatcher from approving proposals", () => {
      const user = {
        role: "DISPATCHER" as UserRole,
        organizationId: "platform-org",
        userId: "dispatcher-user-1",
      };

      expect(canApproveProposals(user, "carrier-org-1")).toBe(false);
    });

    it("should prevent dispatcher from approving requests", () => {
      const user = {
        role: "DISPATCHER" as UserRole,
        organizationId: "platform-org",
        userId: "dispatcher-user-1",
      };

      expect(canApproveRequests(user, "carrier-org-1")).toBe(false);
    });

    it("should NOT have ASSIGN_LOADS permission", async () => {
      // DISPATCHER should only be able to propose, not assign
      const canAssign = await hasPermission(
        "DISPATCHER",
        Permission.ASSIGN_LOADS
      );
      expect(canAssign).toBe(false);
    });

    it("should have PROPOSE_MATCH permission", async () => {
      const canProposeMatch = await hasPermission(
        "DISPATCHER",
        Permission.PROPOSE_MATCH
      );
      expect(canProposeMatch).toBe(true);
    });
  });

  describe("SHIPPER_DEMAND_FOCUS", () => {
    it("should define shipper as demand-focused", () => {
      expect(RULE_SHIPPER_DEMAND_FOCUS).toBeDefined();
      expect(RULE_SHIPPER_DEMAND_FOCUS.id).toBe("SHIPPER_DEMAND_FOCUS");
    });

    it("should allow shipper to request trucks for their loads", () => {
      const user = {
        role: "SHIPPER" as UserRole,
        organizationId: "shipper-org-1",
        userId: "shipper-user-1",
      };

      expect(canRequestTruck(user, "shipper-org-1")).toBe(true);
    });

    it("should prevent shipper from requesting trucks for loads they do not own", () => {
      const user = {
        role: "SHIPPER" as UserRole,
        organizationId: "shipper-org-1",
        userId: "shipper-user-1",
      };

      expect(canRequestTruck(user, "shipper-org-2")).toBe(false);
    });

    it("should restrict shipper visibility to own loads and assigned trucks only", () => {
      const visibility = getVisibilityRules("SHIPPER");

      expect(visibility.canViewAllTrucks).toBe(false);
      expect(visibility.canViewAllLoads).toBe(false);
      expect(visibility.canViewOwnLoads).toBe(true);
    });

    it("should prevent shipper from browsing fleet inventory", () => {
      // Shipper should use truck postings, not browse trucks directly
      const visibility = getVisibilityRules("SHIPPER");

      expect(visibility.canViewFleetDetails).toBe(false);
      expect(visibility.canViewAllTrucks).toBe(false);
    });
  });

  describe("ONE_ACTIVE_POST_PER_TRUCK", () => {
    it("should define one active post rule", () => {
      expect(RULE_ONE_ACTIVE_POST_PER_TRUCK).toBeDefined();
      expect(RULE_ONE_ACTIVE_POST_PER_TRUCK.id).toBe(
        "ONE_ACTIVE_POST_PER_TRUCK"
      );
    });

    it("should enforce single active posting constraint", () => {
      // Rule defines enforcement strategy
      expect(RULE_ONE_ACTIVE_POST_PER_TRUCK.enforcement).toBeDefined();
      expect(RULE_ONE_ACTIVE_POST_PER_TRUCK.enforcement).toContain("ACTIVE");
    });
  });

  describe("Visibility Rules by Role", () => {
    it("should grant ADMIN full visibility", () => {
      const visibility = getVisibilityRules("ADMIN");

      expect(visibility.canViewAllTrucks).toBe(true);
      expect(visibility.canViewAllLoads).toBe(true);
      expect(visibility.canViewFleetDetails).toBe(true);
    });

    it("should grant SUPER_ADMIN full visibility", () => {
      const visibility = getVisibilityRules("SUPER_ADMIN");

      expect(visibility.canViewAllTrucks).toBe(true);
      expect(visibility.canViewAllLoads).toBe(true);
      expect(visibility.canViewFleetDetails).toBe(true);
    });

    it("should grant CARRIER visibility to own fleet only", () => {
      const visibility = getVisibilityRules("CARRIER");

      expect(visibility.canViewAllTrucks).toBe(false); // Not all trucks, own only
      expect(visibility.canViewAllLoads).toBe(false); // Posted loads only
      expect(visibility.canViewFleetDetails).toBe(true); // Own fleet
      expect(visibility.canViewOwnLoads).toBe(true); // Assigned loads
    });

    it("should grant DISPATCHER visibility for coordination", () => {
      const visibility = getVisibilityRules("DISPATCHER");

      expect(visibility.canViewAllTrucks).toBe(false); // No fleet browsing per rules
      expect(visibility.canViewPostedTrucks).toBe(true); // Available trucks only
      expect(visibility.canViewAllLoads).toBe(true); // All loads for coordination
    });

    it("should restrict SHIPPER visibility", () => {
      const visibility = getVisibilityRules("SHIPPER");

      expect(visibility.canViewOwnLoads).toBe(true);
      expect(visibility.canViewAllLoads).toBe(false);
      expect(visibility.canViewAllTrucks).toBe(false);
      expect(visibility.canViewPostedTrucks).toBe(true); // Can request available trucks
      expect(visibility.canViewFleetDetails).toBe(false); // No fleet access
    });
  });

  describe("Foundation Rules Registry", () => {
    it("should contain all required foundation rules", () => {
      const ruleIds = FOUNDATION_RULES.map((rule) => rule.id);

      expect(ruleIds).toContain("CARRIER_OWNS_TRUCKS");
      expect(ruleIds).toContain("CARRIER_FINAL_AUTHORITY");
      expect(ruleIds).toContain("DISPATCHER_COORDINATION_ONLY");
      expect(ruleIds).toContain("SHIPPER_DEMAND_FOCUS");
      expect(ruleIds).toContain("ONE_ACTIVE_POST_PER_TRUCK");
      expect(ruleIds).toContain("POSTING_IS_AVAILABILITY");
    });

    it("should have enforcement defined for all rules", () => {
      for (const rule of FOUNDATION_RULES) {
        expect(rule.enforcement).toBeDefined();
        expect(rule.enforcement.length).toBeGreaterThan(0);
      }
    });

    it("should have descriptions for all rules", () => {
      for (const rule of FOUNDATION_RULES) {
        expect(rule.description).toBeDefined();
        expect(rule.description.length).toBeGreaterThan(10);
      }
    });
  });

  describe("Authority Hierarchy", () => {
    it("should not allow shipper to approve proposals", () => {
      const user = {
        role: "SHIPPER" as UserRole,
        organizationId: "shipper-org-1",
        userId: "shipper-user-1",
      };

      expect(canApproveProposals(user, "carrier-org-1")).toBe(false);
    });

    it("should not allow shipper to approve requests", () => {
      const user = {
        role: "SHIPPER" as UserRole,
        organizationId: "shipper-org-1",
        userId: "shipper-user-1",
      };

      // Shippers cannot approve - they CREATE requests
      expect(canApproveRequests(user, "carrier-org-1")).toBe(false);
    });

    it("should allow admin to approve on behalf of carrier (emergency)", () => {
      const user = {
        role: "ADMIN" as UserRole,
        organizationId: "platform-org",
        userId: "admin-user-1",
      };

      // Admins have override capability
      expect(canApproveProposals(user, "carrier-org-1")).toBe(true);
      expect(canApproveRequests(user, "carrier-org-1")).toBe(true);
    });
  });

  describe("Workflow Permissions", () => {
    describe("Match Proposal Workflow", () => {
      it("should allow only DISPATCHER to create proposals", () => {
        expect(
          canPropose({
            role: "DISPATCHER" as UserRole,
            organizationId: "",
            userId: "",
          })
        ).toBe(true);
        expect(
          canPropose({
            role: "SHIPPER" as UserRole,
            organizationId: "",
            userId: "",
          })
        ).toBe(false);
        expect(
          canPropose({
            role: "CARRIER" as UserRole,
            organizationId: "",
            userId: "",
          })
        ).toBe(false);
      });

      it("should allow only CARRIER (owner) to approve proposals", () => {
        const carrierOwner = {
          role: "CARRIER" as UserRole,
          organizationId: "carrier-1",
          userId: "",
        };
        const differentCarrier = {
          role: "CARRIER" as UserRole,
          organizationId: "carrier-2",
          userId: "",
        };

        expect(canApproveProposals(carrierOwner, "carrier-1")).toBe(true);
        expect(canApproveProposals(differentCarrier, "carrier-1")).toBe(false);
      });
    });

    describe("Truck Request Workflow", () => {
      it("should allow only SHIPPER (load owner) to create requests", () => {
        const shipperOwner = {
          role: "SHIPPER" as UserRole,
          organizationId: "shipper-1",
          userId: "",
        };
        const differentShipper = {
          role: "SHIPPER" as UserRole,
          organizationId: "shipper-2",
          userId: "",
        };

        expect(canRequestTruck(shipperOwner, "shipper-1")).toBe(true);
        expect(canRequestTruck(differentShipper, "shipper-1")).toBe(false);
      });

      it("should allow only CARRIER (truck owner) to approve requests", () => {
        const carrierOwner = {
          role: "CARRIER" as UserRole,
          organizationId: "carrier-1",
          userId: "",
        };
        const differentCarrier = {
          role: "CARRIER" as UserRole,
          organizationId: "carrier-2",
          userId: "",
        };

        expect(canApproveRequests(carrierOwner, "carrier-1")).toBe(true);
        expect(canApproveRequests(differentCarrier, "carrier-1")).toBe(false);
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle null organization ID for approval checks", () => {
      const user = {
        role: "CARRIER" as UserRole,
        organizationId: null as any,
        userId: "user-1",
      };

      // Carrier without org cannot approve (org mismatch check fails)
      expect(canApproveProposals(user, "carrier-org-1")).toBe(false);
      expect(canApproveRequests(user, "carrier-org-1")).toBe(false);
    });

    it("should handle undefined organization ID for approval checks", () => {
      const user = {
        role: "CARRIER" as UserRole,
        organizationId: undefined as any,
        userId: "user-1",
      };

      expect(canApproveProposals(user, "carrier-org-1")).toBe(false);
      expect(canApproveRequests(user, "carrier-org-1")).toBe(false);
    });

    it("should allow carrier to assign at role level even without org", () => {
      const user = {
        role: "CARRIER" as UserRole,
        organizationId: null as any,
        userId: "user-1",
      };

      // canAssignLoads is role-level - carrier role can assign
      // API level will validate ownership
      expect(canAssignLoads(user)).toBe(true);
    });

    it("should treat SUPER_ADMIN same as ADMIN for authority", () => {
      const admin = {
        role: "ADMIN" as UserRole,
        organizationId: "platform",
        userId: "",
      };
      const superAdmin = {
        role: "SUPER_ADMIN" as UserRole,
        organizationId: "platform",
        userId: "",
      };

      // Both ADMIN and SUPER_ADMIN have override authority
      expect(canApproveProposals(admin, "carrier-1")).toBe(true);
      expect(canApproveProposals(superAdmin, "carrier-1")).toBe(true);
      expect(canApproveRequests(admin, "carrier-1")).toBe(true);
      expect(canApproveRequests(superAdmin, "carrier-1")).toBe(true);
    });
  });
});
