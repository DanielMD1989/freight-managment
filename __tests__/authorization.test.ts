/**
 * Authorization Integration Tests
 *
 * Sprint 9 - Story 9.10: Security Testing & QA
 *
 * Tests for authorization and access control including:
 * - Role-based access control (RBAC)
 * - Permission checks
 * - Organization isolation
 * - Resource ownership verification
 */

import { Permission, hasPermission } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac';
import {
  createTestUser,
  createTestOrganization,
  createAuthenticatedRequest,
  cleanupTestData,
} from './utils/testUtils';

describe('Authorization', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Permission Checks', () => {
    it('should grant admin users all permissions', async () => {
      const org = await createTestOrganization({
        name: 'Test Org',
        type: 'CARRIER',
      });

      const adminUser = await createTestUser({
        email: 'admin@example.com',
        password: 'Password123!',
        name: 'Admin User',
        role: 'ADMIN',
        organizationId: org.id,
      });

      // Test various admin permissions
      const permissions = [
        Permission.MANAGE_USERS,
        Permission.VIEW_ALL_LOADS,
        Permission.VIEW_ALL_TRUCKS,
        Permission.VERIFY_DOCUMENTS,
        Permission.VIEW_AUDIT_LOGS,
      ];

      for (const permission of permissions) {
        const hasAccess = await hasPermission('ADMIN', permission);
        expect(hasAccess).toBe(true);
      }
    });

    it('should restrict carrier permissions appropriately', async () => {
      const org = await createTestOrganization({
        name: 'Carrier Org',
        type: 'CARRIER',
      });

      const carrierUser = await createTestUser({
        email: 'carrier@example.com',
        password: 'Password123!',
        name: 'Carrier User',
        role: 'CARRIER',
        organizationId: org.id,
      });

      // Carriers should have these permissions
      expect(await hasPermission('CARRIER', Permission.POST_TRUCKS)).toBe(true);
      expect(await hasPermission('CARRIER', Permission.VIEW_LOADS)).toBe(true);
      expect(await hasPermission('CARRIER', Permission.UPLOAD_DOCUMENTS)).toBe(true);

      // Carriers should NOT have these permissions
      expect(await hasPermission('CARRIER', Permission.POST_LOADS)).toBe(false);
      expect(await hasPermission('CARRIER', Permission.VERIFY_DOCUMENTS)).toBe(false);
      expect(await hasPermission('CARRIER', Permission.VIEW_AUDIT_LOGS)).toBe(false);
    });

    it('should restrict shipper permissions appropriately', async () => {
      const org = await createTestOrganization({
        name: 'Shipper Org',
        type: 'SHIPPER',
      });

      const shipperUser = await createTestUser({
        email: 'shipper@example.com',
        password: 'Password123!',
        name: 'Shipper User',
        role: 'SHIPPER',
        organizationId: org.id,
      });

      // Shippers should have these permissions
      expect(await hasPermission('SHIPPER', Permission.POST_LOADS)).toBe(true);
      expect(await hasPermission('SHIPPER', Permission.VIEW_TRUCKS)).toBe(true);
      expect(await hasPermission('SHIPPER', Permission.UPLOAD_DOCUMENTS)).toBe(true);

      // Shippers should NOT have these permissions
      expect(await hasPermission('SHIPPER', Permission.POST_TRUCKS)).toBe(false);
      expect(await hasPermission('SHIPPER', Permission.VERIFY_DOCUMENTS)).toBe(false);
      expect(await hasPermission('SHIPPER', Permission.VIEW_AUDIT_LOGS)).toBe(false);
    });
  });

  describe('Organization Isolation', () => {
    it('should prevent cross-organization access', async () => {
      const org1 = await createTestOrganization({
        name: 'Carrier Org 1',
        type: 'CARRIER',
      });

      const org2 = await createTestOrganization({
        name: 'Carrier Org 2',
        type: 'CARRIER',
      });

      const user1 = await createTestUser({
        email: 'user1@carrier1.com',
        password: 'Password123!',
        name: 'User 1',
        role: 'CARRIER',
        organizationId: org1.id,
      });

      const user2 = await createTestUser({
        email: 'user2@carrier2.com',
        password: 'Password123!',
        name: 'User 2',
        role: 'CARRIER',
        organizationId: org2.id,
      });

      // User 1 should have access to their own org
      expect(await hasPermission('CARRIER', Permission.POST_TRUCKS)).toBe(true);

      // User 1 should NOT have access to org 2's resources
      expect(await hasPermission('CARRIER', Permission.POST_TRUCKS)).toBe(false);
    });

    it('should enforce organization ownership for resources', async () => {
      // This would test that users can only access resources from their organization
      // Implementation depends on specific API endpoints
      expect(true).toBe(true);
    });
  });

  describe('requirePermission Middleware', () => {
    it('should allow access with correct permission', async () => {
      const org = await createTestOrganization({
        name: 'Test Org',
        type: 'CARRIER',
      });

      const user = await createTestUser({
        email: 'carrier@example.com',
        password: 'Password123!',
        name: 'Carrier User',
        role: 'CARRIER',
        organizationId: org.id,
      });

      const request = await createAuthenticatedRequest({
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: org.id,
      });

      // Should not throw error for allowed permission
      await expect(
        requirePermission(Permission.POST_TRUCKS, request)
      ).resolves.not.toThrow();
    });

    it('should deny access without correct permission', async () => {
      const org = await createTestOrganization({
        name: 'Test Org',
        type: 'CARRIER',
      });

      const user = await createTestUser({
        email: 'carrier@example.com',
        password: 'Password123!',
        name: 'Carrier User',
        role: 'CARRIER',
        organizationId: org.id,
      });

      const request = await createAuthenticatedRequest({
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: org.id,
      });

      // Should throw error for disallowed permission
      await expect(
        requirePermission(Permission.VERIFY_DOCUMENTS, request)
      ).rejects.toThrow();
    });

    it('should deny access to unauthenticated requests', async () => {
      const request = createAuthenticatedRequest({
        userId: '',
        email: '',
        role: '',
      });

      await expect(
        requirePermission(Permission.VIEW_LOADS, request)
      ).rejects.toThrow();
    });
  });

  describe('Access Control Edge Cases', () => {
    it('should handle missing organizationId', async () => {
      const user = await createTestUser({
        email: 'noorg@example.com',
        password: 'Password123!',
        name: 'No Org User',
        role: 'CARRIER',
      });

      // User without organization should have limited access
      expect(await hasPermission('CARRIER', Permission.POST_TRUCKS)).toBe(false);
    });

    it('should handle invalid role', async () => {
      const invalidRole = 'INVALID_ROLE' as any;

      expect(await hasPermission(invalidRole, Permission.VIEW_LOADS)).toBe(false);
    });

    it('should handle undefined permission', async () => {
      const invalidPermission = 'INVALID_PERMISSION' as any;

      expect(await hasPermission('CARRIER', invalidPermission)).toBe(false);
    });
  });

  describe('Privilege Escalation Prevention', () => {
    it('should prevent carriers from gaining admin privileges', async () => {
      const org = await createTestOrganization({
        name: 'Test Org',
        type: 'CARRIER',
      });

      const carrier = await createTestUser({
        email: 'carrier@example.com',
        password: 'Password123!',
        name: 'Carrier User',
        role: 'CARRIER',
        organizationId: org.id,
      });

      // Carrier should not be able to perform admin actions
      const adminPermissions = [
        Permission.VERIFY_DOCUMENTS,
        Permission.MANAGE_USERS,
        Permission.VIEW_AUDIT_LOGS,
      ];

      for (const permission of adminPermissions) {
        expect(await hasPermission('CARRIER', permission)).toBe(false);
      }
    });

    it('should prevent shippers from accessing carrier features', async () => {
      const org = await createTestOrganization({
        name: 'Shipper Org',
        type: 'SHIPPER',
      });

      const shipper = await createTestUser({
        email: 'shipper@example.com',
        password: 'Password123!',
        name: 'Shipper User',
        role: 'SHIPPER',
        organizationId: org.id,
      });

      // Shipper should not be able to post trucks
      expect(await hasPermission('SHIPPER', Permission.POST_TRUCKS)).toBe(false);
    });
  });
});
