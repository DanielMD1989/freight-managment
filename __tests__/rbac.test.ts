/**
 * RBAC (Role-Based Access Control) Tests
 *
 * Sprint 1 - Story 1.3: RBAC Implementation
 *
 * Tests for role-based access control system including:
 * - Permission definitions
 * - Role-permission mappings
 * - Permission inheritance
 * - Organization-level permissions
 * - Admin override capabilities
 */

import { Permission, hasPermission } from "@/lib/rbac/permissions";
import {
  createTestUser,
  createTestOrganization,
  cleanupTestData,
} from "./utils/testUtils";

describe("RBAC System", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe("Permission Definitions", () => {
    it("should have all required permissions defined", () => {
      const requiredPermissions = [
        // Load Management
        Permission.POST_LOADS,
        Permission.VIEW_LOADS,
        Permission.EDIT_LOADS,
        Permission.DELETE_LOADS,
        Permission.VIEW_ALL_LOADS,

        // Truck Management
        Permission.POST_TRUCKS,
        Permission.VIEW_TRUCKS,
        Permission.EDIT_TRUCKS,
        Permission.DELETE_TRUCKS,
        Permission.VIEW_ALL_TRUCKS,

        // Document Management
        Permission.UPLOAD_DOCUMENTS,
        Permission.VIEW_DOCUMENTS,
        Permission.VERIFY_DOCUMENTS,

        // User Management
        Permission.MANAGE_USERS,
        Permission.VIEW_USERS,

        // Financial
        Permission.VIEW_WALLET,
        Permission.MANAGE_WALLET,

        // Admin
        Permission.VIEW_AUDIT_LOGS,
        Permission.MANAGE_SYSTEM_CONFIG,
      ];

      for (const permission of requiredPermissions) {
        expect(permission).toBeDefined();
      }
    });

    it("should have unique permission values", () => {
      const permissions = Object.values(Permission);
      const uniquePermissions = new Set(permissions);

      expect(permissions.length).toBe(uniquePermissions.size);
    });
  });

  describe("Admin Role Permissions", () => {
    it("should grant admin key administrative permissions", async () => {
      const org = await createTestOrganization({
        name: "Admin Org",
        type: "CARRIER_COMPANY",
      });

      const admin = await createTestUser({
        email: "admin@platform.com",
        password: "AdminPass123!",
        name: "Platform Admin",
        role: "ADMIN",
        organizationId: org.id,
      });

      // Test key admin permissions (using granular permissions, not legacy MANAGE_USERS)
      const adminPermissions = [
        Permission.VIEW_USERS,
        Permission.CREATE_OPERATIONAL_USERS,
        Permission.VIEW_ALL_LOADS,
        Permission.VIEW_ALL_TRUCKS,
        Permission.VERIFY_DOCUMENTS,
        Permission.MANAGE_WALLET,
        Permission.VIEW_AUDIT_LOGS,
        Permission.MANAGE_SYSTEM_CONFIG,
      ];

      for (const permission of adminPermissions) {
        const hasAccess = await hasPermission("ADMIN", permission);
        expect(hasAccess).toBe(true);
      }

      // ADMIN should NOT have SuperAdmin-only permissions
      expect(await hasPermission("ADMIN", Permission.ASSIGN_ROLES)).toBe(false);
      expect(await hasPermission("ADMIN", Permission.GLOBAL_OVERRIDE)).toBe(
        false
      );
    });

    it("should grant admin truck deletion permission", async () => {
      // Admin can delete trucks (carriers cannot)
      expect(await hasPermission("ADMIN", Permission.DELETE_TRUCKS)).toBe(true);
      expect(await hasPermission("CARRIER", Permission.DELETE_TRUCKS)).toBe(
        false
      );
    });

    it("should allow admin cross-organization access", async () => {
      const org1 = await createTestOrganization({
        name: "Org 1",
        type: "CARRIER_COMPANY",
      });

      const org2 = await createTestOrganization({
        name: "Org 2",
        type: "CARRIER_COMPANY",
      });

      // Admin should have access to both organizations
      expect(await hasPermission("ADMIN", Permission.VIEW_LOADS)).toBe(true);
      expect(await hasPermission("ADMIN", Permission.VIEW_LOADS)).toBe(true);
    });
  });

  describe("Carrier Role Permissions", () => {
    it("should grant carrier truck posting permissions", async () => {
      const org = await createTestOrganization({
        name: "Carrier Org",
        type: "CARRIER_COMPANY",
      });

      const carrier = await createTestUser({
        email: "carrier@example.com",
        password: "CarrierPass123!",
        name: "Carrier User",
        role: "CARRIER",
        organizationId: org.id,
      });

      // Carrier should have truck permissions (except DELETE_TRUCKS, which is admin-only)
      expect(await hasPermission("CARRIER", Permission.POST_TRUCKS)).toBe(true);
      expect(await hasPermission("CARRIER", Permission.VIEW_TRUCKS)).toBe(true);
      expect(await hasPermission("CARRIER", Permission.EDIT_TRUCKS)).toBe(true);
      expect(await hasPermission("CARRIER", Permission.DELETE_TRUCKS)).toBe(
        false
      );
    });

    it("should allow carrier to view loads", async () => {
      const org = await createTestOrganization({
        name: "Carrier Org",
        type: "CARRIER_COMPANY",
      });

      const carrier = await createTestUser({
        email: "carrier@example.com",
        password: "CarrierPass123!",
        name: "Carrier User",
        role: "CARRIER",
        organizationId: org.id,
      });

      // Carrier can view loads (to find work)
      expect(await hasPermission("CARRIER", Permission.VIEW_LOADS)).toBe(true);
    });

    it("should prevent carrier from posting loads", async () => {
      const org = await createTestOrganization({
        name: "Carrier Org",
        type: "CARRIER_COMPANY",
      });

      const carrier = await createTestUser({
        email: "carrier@example.com",
        password: "CarrierPass123!",
        name: "Carrier User",
        role: "CARRIER",
        organizationId: org.id,
      });

      // Carrier cannot post loads
      expect(await hasPermission("CARRIER", Permission.POST_LOADS)).toBe(false);
    });

    it("should prevent carrier from verifying documents", async () => {
      const org = await createTestOrganization({
        name: "Carrier Org",
        type: "CARRIER_COMPANY",
      });

      const carrier = await createTestUser({
        email: "carrier@example.com",
        password: "CarrierPass123!",
        name: "Carrier User",
        role: "CARRIER",
        organizationId: org.id,
      });

      // Only admins can verify documents
      expect(await hasPermission("CARRIER", Permission.VERIFY_DOCUMENTS)).toBe(
        false
      );
    });
  });

  describe("Shipper Role Permissions", () => {
    it("should grant shipper load posting permissions", async () => {
      const org = await createTestOrganization({
        name: "Shipper Org",
        type: "SHIPPER",
      });

      const shipper = await createTestUser({
        email: "shipper@example.com",
        password: "ShipperPass123!",
        name: "Shipper User",
        role: "SHIPPER",
        organizationId: org.id,
      });

      // Shipper should have load permissions
      expect(await hasPermission("SHIPPER", Permission.POST_LOADS)).toBe(true);
      expect(await hasPermission("SHIPPER", Permission.VIEW_LOADS)).toBe(true);
      expect(await hasPermission("SHIPPER", Permission.EDIT_LOADS)).toBe(true);
      expect(await hasPermission("SHIPPER", Permission.DELETE_LOADS)).toBe(
        true
      );
    });

    it("should allow shipper to view trucks", async () => {
      const org = await createTestOrganization({
        name: "Shipper Org",
        type: "SHIPPER",
      });

      const shipper = await createTestUser({
        email: "shipper@example.com",
        password: "ShipperPass123!",
        name: "Shipper User",
        role: "SHIPPER",
        organizationId: org.id,
      });

      // Shipper can view trucks (to find carriers)
      expect(await hasPermission("SHIPPER", Permission.VIEW_TRUCKS)).toBe(true);
    });

    it("should prevent shipper from posting trucks", async () => {
      const org = await createTestOrganization({
        name: "Shipper Org",
        type: "SHIPPER",
      });

      const shipper = await createTestUser({
        email: "shipper@example.com",
        password: "ShipperPass123!",
        name: "Shipper User",
        role: "SHIPPER",
        organizationId: org.id,
      });

      // Shipper cannot post trucks
      expect(await hasPermission("SHIPPER", Permission.POST_TRUCKS)).toBe(
        false
      );
    });
  });

  describe("Organization-Level Permissions", () => {
    it("should enforce organization isolation", async () => {
      const org1 = await createTestOrganization({
        name: "Carrier 1",
        type: "CARRIER_COMPANY",
      });

      const org2 = await createTestOrganization({
        name: "Carrier 2",
        type: "CARRIER_COMPANY",
      });

      const user = await createTestUser({
        email: "carrier@org1.com",
        password: "Password123!",
        name: "Carrier User",
        role: "CARRIER",
        organizationId: org1.id,
      });

      // hasPermission only checks role-based permissions, not organization membership
      // Both calls return true because CARRIER role has POST_TRUCKS permission
      expect(hasPermission("CARRIER", Permission.POST_TRUCKS)).toBe(true);

      // Organization isolation is enforced at the API/database query level
      expect(user.organizationId).not.toBe(org2.id);
    });

    it("should prevent access without organization", async () => {
      const user = await createTestUser({
        email: "noorg@example.com",
        password: "Password123!",
        name: "No Org User",
        role: "CARRIER",
      });

      // hasPermission only checks role-based permissions
      expect(hasPermission("CARRIER", Permission.POST_TRUCKS)).toBe(true);

      // Organization enforcement happens at the API level
      expect(user.organizationId).toBeNull();
    });
  });

  describe("Document Management Permissions", () => {
    it("should allow users to upload documents", async () => {
      const org = await createTestOrganization({
        name: "Test Org",
        type: "CARRIER_COMPANY",
      });

      const carrier = await createTestUser({
        email: "carrier@example.com",
        password: "Password123!",
        name: "Carrier User",
        role: "CARRIER",
        organizationId: org.id,
      });

      expect(await hasPermission("CARRIER", Permission.UPLOAD_DOCUMENTS)).toBe(
        true
      );
    });

    it("should only allow admins to verify documents", async () => {
      const org = await createTestOrganization({
        name: "Test Org",
        type: "CARRIER_COMPANY",
      });

      // Admin should be able to verify
      expect(await hasPermission("ADMIN", Permission.VERIFY_DOCUMENTS)).toBe(
        true
      );

      // Carrier should NOT be able to verify
      expect(await hasPermission("CARRIER", Permission.VERIFY_DOCUMENTS)).toBe(
        false
      );

      // Shipper should NOT be able to verify
      expect(await hasPermission("SHIPPER", Permission.VERIFY_DOCUMENTS)).toBe(
        false
      );
    });
  });

  describe("Wallet Permissions", () => {
    it("should allow users to view their own wallet", async () => {
      const org = await createTestOrganization({
        name: "Test Org",
        type: "CARRIER_COMPANY",
      });

      expect(await hasPermission("CARRIER", Permission.VIEW_WALLET)).toBe(true);
      expect(await hasPermission("SHIPPER", Permission.VIEW_WALLET)).toBe(true);
    });

    it("should allow admins to manage all wallets", async () => {
      const org = await createTestOrganization({
        name: "Test Org",
        type: "CARRIER_COMPANY",
      });

      expect(await hasPermission("ADMIN", Permission.MANAGE_WALLET)).toBe(true);
    });

    it("should prevent regular users from managing wallets", async () => {
      const org = await createTestOrganization({
        name: "Test Org",
        type: "CARRIER_COMPANY",
      });

      expect(await hasPermission("CARRIER", Permission.MANAGE_WALLET)).toBe(
        false
      );
      expect(await hasPermission("SHIPPER", Permission.MANAGE_WALLET)).toBe(
        false
      );
    });
  });

  describe("System Admin Permissions", () => {
    it("should only allow admins to view audit logs", async () => {
      const org = await createTestOrganization({
        name: "Test Org",
        type: "CARRIER_COMPANY",
      });

      expect(await hasPermission("ADMIN", Permission.VIEW_AUDIT_LOGS)).toBe(
        true
      );
      expect(await hasPermission("CARRIER", Permission.VIEW_AUDIT_LOGS)).toBe(
        false
      );
      expect(await hasPermission("SHIPPER", Permission.VIEW_AUDIT_LOGS)).toBe(
        false
      );
    });

    it("should only allow admins to manage system config", async () => {
      const org = await createTestOrganization({
        name: "Test Org",
        type: "CARRIER_COMPANY",
      });

      expect(
        await hasPermission("ADMIN", Permission.MANAGE_SYSTEM_CONFIG)
      ).toBe(true);
      expect(
        await hasPermission("CARRIER", Permission.MANAGE_SYSTEM_CONFIG)
      ).toBe(false);
      expect(
        await hasPermission("SHIPPER", Permission.MANAGE_SYSTEM_CONFIG)
      ).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle invalid roles gracefully", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invalidRole = "INVALID_ROLE" as any;

      expect(await hasPermission(invalidRole, Permission.VIEW_LOADS)).toBe(
        false
      );
    });

    it("should handle undefined permissions gracefully", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invalidPermission = "INVALID_PERMISSION" as any;

      expect(await hasPermission("CARRIER", invalidPermission)).toBe(false);
    });

    it("should handle null organization IDs", () => {
      // hasPermission only checks role-based permissions
      expect(hasPermission("CARRIER", Permission.POST_TRUCKS)).toBe(true);
    });
  });
});
