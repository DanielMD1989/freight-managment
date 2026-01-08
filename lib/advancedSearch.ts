/**
 * Advanced Search Utilities
 * Sprint 3 - Story 3.2: Advanced Search & Filters
 *
 * Multi-criteria search for loads and trucks
 */

import { Prisma, TruckType } from '@prisma/client';

export interface LoadSearchFilters {
  pickupCity?: string;
  deliveryCity?: string;
  truckType?: string[];
  loadType?: string;
  minWeight?: number;
  maxWeight?: number;
  minRate?: number;
  maxRate?: number;
  pickupDateFrom?: Date;
  pickupDateTo?: Date;
  status?: string[];
  hasGPS?: boolean;
  verified?: boolean;
}

export interface TruckSearchFilters {
  currentCity?: string;
  truckType?: string[];
  minCapacity?: number;
  maxCapacity?: number;
  available?: boolean;
  hasGPS?: boolean;
  verified?: boolean;
}

/**
 * Build Prisma where clause for load search
 */
export function buildLoadSearchWhere(filters: LoadSearchFilters): Prisma.LoadWhereInput {
  const where: Prisma.LoadWhereInput = {};

  // Location filters
  if (filters.pickupCity) {
    where.pickupCity = { contains: filters.pickupCity, mode: 'insensitive' };
  }
  if (filters.deliveryCity) {
    where.deliveryCity = { contains: filters.deliveryCity, mode: 'insensitive' };
  }

  // Truck type filter
  if (filters.truckType && filters.truckType.length > 0) {
    where.truckType = { in: filters.truckType as TruckType[] };
  }

  // Load type filter (search in cargo description)
  if (filters.loadType) {
    where.cargoDescription = { contains: filters.loadType, mode: 'insensitive' };
  }

  // Weight filters
  if (filters.minWeight !== undefined || filters.maxWeight !== undefined) {
    where.weight = {};
    if (filters.minWeight !== undefined) {
      where.weight.gte = filters.minWeight;
    }
    if (filters.maxWeight !== undefined) {
      where.weight.lte = filters.maxWeight;
    }
  }

  // Rate filters
  if (filters.minRate !== undefined || filters.maxRate !== undefined) {
    where.totalFareEtb = {};
    if (filters.minRate !== undefined) {
      where.totalFareEtb.gte = filters.minRate;
    }
    if (filters.maxRate !== undefined) {
      where.totalFareEtb.lte = filters.maxRate;
    }
  }

  // Pickup date filters
  if (filters.pickupDateFrom || filters.pickupDateTo) {
    where.pickupDate = {};
    if (filters.pickupDateFrom) {
      where.pickupDate.gte = filters.pickupDateFrom;
    }
    if (filters.pickupDateTo) {
      where.pickupDate.lte = filters.pickupDateTo;
    }
  }

  // Status filter
  if (filters.status && filters.status.length > 0) {
    where.status = { in: filters.status as any[] };
  }

  // GPS filter
  if (filters.hasGPS !== undefined) {
    where.trackingEnabled = filters.hasGPS;
  }

  // Verified shipper filter
  if (filters.verified !== undefined) {
    where.shipper = {
      isVerified: filters.verified,
    };
  }

  return where;
}

/**
 * Build Prisma where clause for truck search
 */
export function buildTruckSearchWhere(filters: TruckSearchFilters): Prisma.TruckWhereInput {
  const where: Prisma.TruckWhereInput = {};

  // Current location
  if (filters.currentCity) {
    where.currentCity = { contains: filters.currentCity, mode: 'insensitive' };
  }

  // Truck type filter
  if (filters.truckType && filters.truckType.length > 0) {
    where.truckType = { in: filters.truckType as TruckType[] };
  }

  // Capacity filters
  if (filters.minCapacity !== undefined || filters.maxCapacity !== undefined) {
    where.capacity = {};
    if (filters.minCapacity !== undefined) {
      where.capacity.gte = filters.minCapacity;
    }
    if (filters.maxCapacity !== undefined) {
      where.capacity.lte = filters.maxCapacity;
    }
  }

  // Availability filter
  if (filters.available !== undefined) {
    where.isAvailable = filters.available;
  }

  // GPS filter
  if (filters.hasGPS !== undefined) {
    if (filters.hasGPS) {
      where.imei = { not: null };
    } else {
      where.imei = null;
    }
  }

  // Verified carrier filter
  if (filters.verified !== undefined) {
    where.carrier = {
      isVerified: filters.verified,
    };
  }

  return where;
}

/**
 * Calculate profile completion percentage
 */
export interface ProfileCompletion {
  percentage: number;
  missing: string[];
  completed: string[];
}

export function calculateUserProfileCompletion(user: any): ProfileCompletion {
  const fields = [
    { name: 'firstName', value: user.firstName, label: 'First Name' },
    { name: 'lastName', value: user.lastName, label: 'Last Name' },
    { name: 'phone', value: user.phone, label: 'Phone Number' },
    { name: 'email', value: user.email, label: 'Email' },
    { name: 'isEmailVerified', value: user.isEmailVerified, label: 'Email Verification' },
    { name: 'organizationId', value: user.organizationId, label: 'Organization' },
  ];

  const completed = fields.filter((f) => f.value).map((f) => f.label);
  const missing = fields.filter((f) => !f.value).map((f) => f.label);
  const percentage = Math.round((completed.length / fields.length) * 100);

  return {
    percentage,
    completed,
    missing,
  };
}

export function calculateOrganizationProfileCompletion(org: any): ProfileCompletion {
  const fields = [
    { name: 'name', value: org.name, label: 'Organization Name' },
    { name: 'type', value: org.type, label: 'Organization Type' },
    { name: 'contactEmail', value: org.contactEmail, label: 'Contact Email' },
    { name: 'contactPhone', value: org.contactPhone, label: 'Contact Phone' },
    { name: 'address', value: org.address, label: 'Address' },
    { name: 'city', value: org.city, label: 'City' },
    { name: 'licenseNumber', value: org.licenseNumber, label: 'License Number' },
    { name: 'taxId', value: org.taxId, label: 'Tax ID' },
    { name: 'description', value: org.description, label: 'Description' },
    { name: 'isVerified', value: org.isVerified, label: 'Verification' },
  ];

  const completed = fields.filter((f) => f.value).map((f) => f.label);
  const missing = fields.filter((f) => !f.value).map((f) => f.label);
  const percentage = Math.round((completed.length / fields.length) * 100);

  return {
    percentage,
    completed,
    missing,
  };
}
