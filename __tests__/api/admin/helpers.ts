/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Admin Test Helpers
 *
 * Shared seed data and session factories for admin API tests.
 */

import { db } from "@/lib/db";
import {
  createMockSession,
  setAuthSession,
  seedTestData,
  SeedData,
} from "../../utils/routeTestUtils";

// ─── Session Helpers ──────────────────────────────────────────────────────────

export function useAdminSession() {
  setAuthSession(
    createMockSession({
      userId: "admin-user-1",
      email: "admin@test.com",
      role: "ADMIN",
      status: "ACTIVE",
      organizationId: "admin-org-1",
      firstName: "Test",
      lastName: "Admin",
    })
  );
}

export function useSuperAdminSession() {
  setAuthSession(
    createMockSession({
      userId: "superadmin-user-1",
      email: "superadmin@test.com",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      organizationId: "admin-org-1",
      firstName: "Super",
      lastName: "Admin",
    })
  );
}

export function useShipperSession() {
  setAuthSession(
    createMockSession({
      userId: "shipper-user-1",
      email: "shipper@test.com",
      role: "SHIPPER",
      status: "ACTIVE",
      organizationId: "shipper-org-1",
    })
  );
}

export function useCarrierSession() {
  setAuthSession(
    createMockSession({
      userId: "carrier-user-1",
      email: "carrier@test.com",
      role: "CARRIER",
      status: "ACTIVE",
      organizationId: "carrier-org-1",
    })
  );
}

export function useDispatcherSession() {
  setAuthSession(
    createMockSession({
      userId: "dispatcher-user-1",
      email: "dispatcher@test.com",
      role: "DISPATCHER",
      status: "ACTIVE",
      organizationId: "dispatcher-org-1",
    })
  );
}

// ─── Extended Seed Data ───────────────────────────────────────────────────────

export interface AdminSeedData extends SeedData {
  adminOrg: any;
  adminUser: any;
  superAdminUser: any;
  dispatcherOrg: any;
  dispatcherUser: any;
  corridor: any;
  corridor2: any;
  withdrawalPending: any;
  withdrawalApproved: any;
  withdrawalRejected: any;
  deliveredLoad: any;
  systemSettings: any;
  companyDoc: any;
  truckDoc: any;
}

export async function seedAdminTestData(): Promise<AdminSeedData> {
  // Base seed data
  const base = await seedTestData();

  // Admin organization
  const adminOrg = await db.organization.create({
    data: {
      id: "admin-org-1",
      name: "Platform Admin Org",
      type: "SHIPPER",
      contactEmail: "admin@platform.com",
      contactPhone: "+251911000010",
      isVerified: true,
      verificationStatus: "APPROVED",
    },
  });

  // Dispatcher organization
  const dispatcherOrg = await db.organization.create({
    data: {
      id: "dispatcher-org-1",
      name: "Dispatch Center",
      type: "SHIPPER",
      contactEmail: "dispatch@test.com",
      contactPhone: "+251911000020",
      isVerified: true,
    },
  });

  // Admin user
  const adminUser = await db.user.create({
    data: {
      id: "admin-user-1",
      email: "admin@test.com",
      passwordHash: "hashed_Test1234!",
      firstName: "Test",
      lastName: "Admin",
      phone: "+251911000010",
      role: "ADMIN",
      status: "ACTIVE",
      organizationId: adminOrg.id,
    },
  });

  // Super admin user
  const superAdminUser = await db.user.create({
    data: {
      id: "superadmin-user-1",
      email: "superadmin@test.com",
      passwordHash: "hashed_Test1234!",
      firstName: "Super",
      lastName: "Admin",
      phone: "+251911000011",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      organizationId: adminOrg.id,
    },
  });

  // Dispatcher user
  const dispatcherUser = await db.user.create({
    data: {
      id: "dispatcher-user-1",
      email: "dispatcher@test.com",
      passwordHash: "hashed_Test1234!",
      firstName: "Test",
      lastName: "Dispatcher",
      phone: "+251911000020",
      role: "DISPATCHER",
      status: "ACTIVE",
      organizationId: dispatcherOrg.id,
    },
  });

  // Corridors
  const corridor = await db.corridor.create({
    data: {
      id: "corridor-1",
      name: "Addis-Dire Dawa",
      originRegion: "Addis Ababa",
      destinationRegion: "Dire Dawa",
      distanceKm: 450,
      pricePerKm: 5,
      shipperPricePerKm: 5,
      carrierPricePerKm: 3,
      direction: "ONE_WAY",
      isActive: true,
      createdById: adminUser.id,
    },
  });

  const corridor2 = await db.corridor.create({
    data: {
      id: "corridor-2",
      name: "Addis-Amhara",
      originRegion: "Addis Ababa",
      destinationRegion: "Amhara",
      distanceKm: 300,
      pricePerKm: 4,
      shipperPricePerKm: 4,
      carrierPricePerKm: 2.5,
      direction: "ONE_WAY",
      isActive: false,
      createdById: adminUser.id,
    },
  });

  // Withdrawal requests
  const withdrawalPending = await db.withdrawalRequest.create({
    data: {
      id: "withdrawal-pending-1",
      organizationId: base.shipperOrg.id,
      userId: base.shipperUser.id,
      amount: 5000,
      status: "PENDING",
      bankName: "CBE",
      accountNumber: "1234567890",
      accountHolderName: "Test Shipper",
    },
  });

  const withdrawalApproved = await db.withdrawalRequest.create({
    data: {
      id: "withdrawal-approved-1",
      organizationId: base.carrierOrg.id,
      userId: base.carrierUser.id,
      amount: 3000,
      status: "APPROVED",
      bankName: "Dashen",
      accountNumber: "9876543210",
      accountHolderName: "Test Carrier",
      approvedById: adminUser.id,
      approvedAt: new Date(),
      completedAt: new Date(),
    },
  });

  const withdrawalRejected = await db.withdrawalRequest.create({
    data: {
      id: "withdrawal-rejected-1",
      organizationId: base.shipperOrg.id,
      userId: base.shipperUser.id,
      amount: 2000,
      status: "REJECTED",
      bankName: "CBE",
      accountNumber: "1234567890",
      accountHolderName: "Test Shipper",
      rejectionReason: "Insufficient documentation",
    },
  });

  // Delivered load for settlement tests
  const deliveredLoad = await db.load.create({
    data: {
      id: "delivered-load-1",
      status: "DELIVERED",
      pickupCity: "Addis Ababa",
      deliveryCity: "Dire Dawa",
      pickupDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      deliveryDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      truckType: "DRY_VAN",
      weight: 8000,
      cargoDescription: "Delivered cargo for settlement",
      shipperId: base.shipperOrg.id,
      createdById: base.shipperUser.id,
      assignedTruckId: base.truck.id,
      podVerified: true,
      podVerifiedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      settlementStatus: "PENDING",
      serviceFeeEtb: 250,
      serviceFeeStatus: "DEDUCTED",
      corridorId: corridor.id,
    },
  });

  // Company document
  const companyDoc = await db.companyDocument.create({
    data: {
      id: "company-doc-1",
      organizationId: base.shipperOrg.id,
      type: "BUSINESS_LICENSE",
      fileName: "business_license.pdf",
      fileUrl: "https://storage.test/docs/bl.pdf",
      fileSize: 1024000,
      mimeType: "application/pdf",
      verificationStatus: "PENDING",
      uploadedById: base.shipperUser.id,
      uploadedAt: new Date(),
    },
  });

  // Truck document
  const truckDoc = await db.truckDocument.create({
    data: {
      id: "truck-doc-1",
      truckId: base.truck.id,
      type: "INSURANCE",
      fileName: "insurance.pdf",
      fileUrl: "https://storage.test/docs/ins.pdf",
      fileSize: 512000,
      mimeType: "application/pdf",
      verificationStatus: "PENDING",
      uploadedById: base.carrierUser.id,
      uploadedAt: new Date(),
    },
  });

  // System settings
  const systemSettings = await db.systemSettings.create({
    data: {
      id: "system",
      rateLimitDocumentUpload: 10,
      rateLimitTruckPosting: 100,
      rateLimitFileDownload: 100,
      rateLimitAuthAttempts: 5,
      matchScoreMinimum: 40,
      matchScoreGood: 70,
      matchScoreExcellent: 85,
      emailNotificationsEnabled: true,
      emailNotifyDocumentApproval: true,
      emailNotifyDocumentRejection: true,
      emailNotifyLoadAssignment: true,
      emailNotifyPodVerification: true,
      maxFileUploadSizeMb: 10,
      maxDocumentsPerEntity: 20,
      platformMaintenanceMode: false,
      requireEmailVerification: false,
      requirePhoneVerification: false,
      lastModifiedBy: adminUser.id,
    },
  });

  // Audit log entries
  await db.auditLog.create({
    data: {
      id: "audit-1",
      eventType: "AUTH_LOGIN_SUCCESS",
      severity: "INFO",
      userId: base.shipperUser.id,
      resource: "AUTH",
      action: "LOGIN",
      result: "SUCCESS",
      message: "User logged in",
      ipAddress: "127.0.0.1",
      userAgent: "TestAgent/1.0",
      timestamp: new Date(),
    },
  });

  await db.auditLog.create({
    data: {
      id: "audit-2",
      eventType: "SETTINGS_UPDATED",
      severity: "INFO",
      userId: adminUser.id,
      resource: "SYSTEM_SETTINGS",
      resourceId: "system",
      action: "UPDATE",
      result: "SUCCESS",
      message: "Settings updated",
      ipAddress: "127.0.0.1",
      userAgent: "TestAgent/1.0",
      timestamp: new Date(),
    },
  });

  // Disputes
  await db.dispute.create({
    data: {
      id: "dispute-open-1",
      loadId: base.load.id,
      createdById: base.carrierUser.id,
      disputedOrgId: base.carrierOrg.id,
      type: "PAYMENT_ISSUE",
      description: "Payment not received for completed delivery",
      evidenceUrls: [],
      status: "OPEN",
    },
  });

  await db.dispute.create({
    data: {
      id: "dispute-resolved-1",
      loadId: base.load.id,
      createdById: base.shipperUser.id,
      disputedOrgId: base.shipperOrg.id,
      type: "DAMAGE",
      description: "Cargo was damaged during transport",
      evidenceUrls: [],
      status: "RESOLVED",
    },
  });

  return {
    ...base,
    adminOrg,
    adminUser,
    superAdminUser,
    dispatcherOrg,
    dispatcherUser,
    corridor,
    corridor2,
    withdrawalPending,
    withdrawalApproved,
    withdrawalRejected,
    deliveredLoad,
    systemSettings,
    companyDoc,
    truckDoc,
  };
}
