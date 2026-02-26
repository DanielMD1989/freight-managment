/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Financial Lifecycle Test Helpers
 *
 * Seed data and assertion utilities for financial lifecycle tests.
 * Uses the jest.setup.js in-memory Prisma stores (NOT manual mocks).
 */

import { db } from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FinancialSeedData {
  shipperOrg: any;
  carrierOrg: any;
  shipperUser: any;
  carrierUser: any;
  shipperWallet: any;
  carrierWallet: any;
  platformAccount: any;
  corridor: any;
  truck: any;
  load: any;
}

// ─── Seed Data ───────────────────────────────────────────────────────────────

/**
 * Seed all entities needed for a complete financial lifecycle test.
 * Uses "fin-" prefix on IDs to avoid collisions with other test seeds.
 */
export async function seedFinancialTestData(
  overrides: {
    shipperBalance?: number;
    carrierBalance?: number;
    platformBalance?: number;
    corridorOverrides?: Record<string, any>;
    loadOverrides?: Record<string, any>;
    skipPlatformAccount?: boolean;
  } = {}
): Promise<FinancialSeedData> {
  const {
    shipperBalance = 10000,
    carrierBalance = 5000,
    platformBalance = 0,
    corridorOverrides = {},
    loadOverrides = {},
    skipPlatformAccount = false,
  } = overrides;

  // Organizations
  const shipperOrg = await db.organization.create({
    data: {
      id: "fin-shipper-org",
      name: "Financial Test Shipper",
      type: "SHIPPER",
      contactEmail: "fin-shipper@test.com",
      contactPhone: "+251911100001",
      isVerified: true,
      verificationStatus: "APPROVED",
    },
  });

  const carrierOrg = await db.organization.create({
    data: {
      id: "fin-carrier-org",
      name: "Financial Test Carrier",
      type: "CARRIER_COMPANY",
      contactEmail: "fin-carrier@test.com",
      contactPhone: "+251911100002",
      isVerified: true,
      verificationStatus: "APPROVED",
    },
  });

  // Users
  const shipperUser = await db.user.create({
    data: {
      id: "fin-shipper-user",
      email: "fin-shipper@test.com",
      passwordHash: "hashed_Test1234!",
      firstName: "Fin",
      lastName: "Shipper",
      phone: "+251911100001",
      role: "SHIPPER",
      status: "ACTIVE",
      organizationId: shipperOrg.id,
    },
  });

  const carrierUser = await db.user.create({
    data: {
      id: "fin-carrier-user",
      email: "fin-carrier@test.com",
      passwordHash: "hashed_Test1234!",
      firstName: "Fin",
      lastName: "Carrier",
      phone: "+251911100002",
      role: "CARRIER",
      status: "ACTIVE",
      organizationId: carrierOrg.id,
    },
  });

  // Financial accounts
  const shipperWallet = await db.financialAccount.create({
    data: {
      id: "fin-wallet-shipper",
      organizationId: shipperOrg.id,
      accountType: "SHIPPER_WALLET",
      balance: shipperBalance,
      currency: "ETB",
      isActive: true,
    },
  });

  const carrierWallet = await db.financialAccount.create({
    data: {
      id: "fin-wallet-carrier",
      organizationId: carrierOrg.id,
      accountType: "CARRIER_WALLET",
      balance: carrierBalance,
      currency: "ETB",
      isActive: true,
    },
  });

  let platformAccount: any = null;
  if (!skipPlatformAccount) {
    platformAccount = await db.financialAccount.create({
      data: {
        id: "fin-platform-revenue",
        accountType: "PLATFORM_REVENUE",
        balance: platformBalance,
        currency: "ETB",
        isActive: true,
      },
    });
  }

  // Corridor: Addis Ababa → Dire Dawa, 515km
  const corridor = await db.corridor.create({
    data: {
      id: "fin-corridor-1",
      name: "Addis Ababa - Dire Dawa",
      originRegion: "Addis Ababa",
      destinationRegion: "Dire Dawa",
      distanceKm: 515,
      direction: "ONE_WAY",
      isActive: true,
      pricePerKm: 5,
      shipperPricePerKm: 5,
      carrierPricePerKm: 3,
      promoFlag: false,
      shipperPromoFlag: false,
      carrierPromoFlag: false,
      promoDiscountPct: null,
      shipperPromoPct: null,
      carrierPromoPct: null,
      ...corridorOverrides,
    },
  });

  // Truck
  const truck = await db.truck.create({
    data: {
      id: "fin-truck-1",
      truckType: "DRY_VAN",
      licensePlate: "FIN-12345",
      capacity: 10000,
      isAvailable: true,
      carrierId: carrierOrg.id,
      createdById: carrierUser.id,
      approvalStatus: "APPROVED",
    },
  });

  // Load
  const load = await db.load.create({
    data: {
      id: "fin-load-1",
      status: "DELIVERED",
      pickupCity: "Addis Ababa",
      pickupDate: new Date(),
      deliveryCity: "Dire Dawa",
      deliveryDate: new Date(),
      truckType: "DRY_VAN",
      weight: 5000,
      cargoDescription: "Financial test cargo",
      shipperId: shipperOrg.id,
      createdById: shipperUser.id,
      corridorId: corridor.id,
      assignedTruckId: truck.id,
      estimatedTripKm: 515,
      shipperFeeStatus: "PENDING",
      carrierFeeStatus: "PENDING",
      serviceFeeStatus: "PENDING",
      ...loadOverrides,
    },
  });

  return {
    shipperOrg,
    carrierOrg,
    shipperUser,
    carrierUser,
    shipperWallet,
    carrierWallet,
    platformAccount,
    corridor,
    truck,
    load,
  };
}

// ─── Store Assertion Utilities ──────────────────────────────────────────────

/**
 * Read current balance from the in-memory financialAccounts store.
 */
export function getBalance(walletId: string): number {
  const stores = (db as any).__stores;
  const account = stores.financialAccounts.get(walletId);
  return account ? Number(account.balance) : 0;
}

/**
 * Read current fee status fields from the in-memory loads store.
 */
export function getLoadFeeStatus(loadId: string): {
  shipperFeeStatus: string | null;
  carrierFeeStatus: string | null;
  shipperServiceFee: number | null;
  carrierServiceFee: number | null;
  serviceFeeEtb: number | null;
  serviceFeeStatus: string | null;
  shipperFeeDeductedAt: Date | null;
  carrierFeeDeductedAt: Date | null;
} {
  const stores = (db as any).__stores;
  const load = stores.loads.get(loadId);
  if (!load) {
    return {
      shipperFeeStatus: null,
      carrierFeeStatus: null,
      shipperServiceFee: null,
      carrierServiceFee: null,
      serviceFeeEtb: null,
      serviceFeeStatus: null,
      shipperFeeDeductedAt: null,
      carrierFeeDeductedAt: null,
    };
  }
  return {
    shipperFeeStatus: load.shipperFeeStatus ?? null,
    carrierFeeStatus: load.carrierFeeStatus ?? null,
    shipperServiceFee: load.shipperServiceFee ?? null,
    carrierServiceFee: load.carrierServiceFee ?? null,
    serviceFeeEtb: load.serviceFeeEtb ?? null,
    serviceFeeStatus: load.serviceFeeStatus ?? null,
    shipperFeeDeductedAt: load.shipperFeeDeductedAt ?? null,
    carrierFeeDeductedAt: load.carrierFeeDeductedAt ?? null,
  };
}

/**
 * Get all journal entries for a given loadId from the in-memory store.
 */
export function getJournalEntries(loadId: string): any[] {
  const stores = (db as any).__stores;
  return Array.from(stores.journalEntries.values()).filter(
    (entry: any) => entry.loadId === loadId || entry.reference === loadId
  );
}

/**
 * Clear all in-memory stores.
 */
export function clearStores(): void {
  (db as any)._clearStores();
}
