/**
 * Admin Panel TypeScript Types
 *
 * Centralized type definitions for all admin components
 * Created to fix H1-H14 type safety issues
 */

import {
  Prisma,
  UserRole,
  UserStatus,
  VerificationStatus,
} from "@prisma/client";

// ============================================
// User Management Types
// ============================================

export interface AdminUserWhereInput {
  role?: UserRole;
  OR?: Array<{
    email?: { contains: string; mode: "insensitive" };
    firstName?: { contains: string; mode: "insensitive" };
    lastName?: { contains: string; mode: "insensitive" };
  }>;
}

export interface UserUpdateData {
  phone?: string;
  isPhoneVerified?: boolean;
  status?: UserStatus;
  isActive?: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  status: string;
  isActive: boolean;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  organizationId: string | null;
  organization: {
    id: string;
    name: string;
    type: string;
    isVerified: boolean;
  } | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

// ============================================
// Document Verification Types
// ============================================

export interface CompanyDocumentWithOrg {
  id: string;
  fileName: string;
  verificationStatus: VerificationStatus;
  organization: {
    id: string;
    name: string;
    contactEmail?: string | null;
  };
}

export interface TruckDocumentWithCarrier {
  id: string;
  fileName: string;
  verificationStatus: VerificationStatus;
  truck: {
    id: string;
    licensePlate: string;
    carrier: {
      id: string;
      name: string;
      contactEmail?: string | null;
    };
  };
}

export type VerificationDocument =
  | CompanyDocumentWithOrg
  | TruckDocumentWithCarrier;

// Type guard for company documents
export function isCompanyDocument(
  doc: VerificationDocument
): doc is CompanyDocumentWithOrg {
  return "organization" in doc;
}

// Type guard for truck documents
export function isTruckDocument(
  doc: VerificationDocument
): doc is TruckDocumentWithCarrier {
  return "truck" in doc;
}

// ============================================
// Wallet Types
// ============================================

export interface AdminWallet {
  id: string;
  accountType: string;
  balance: number;
  currency: string;
  lastTransactionAt: string | null;
  createdAt: string;
  shipper: {
    id: string;
    name: string;
  } | null;
  carrier: {
    id: string;
    name: string;
  } | null;
}

export interface WalletSummary {
  totalPlatformRevenue: number;
  totalShipperDeposits: number;
  totalCarrierEarnings: number;
}

// ============================================
// Corridor Types
// ============================================

export interface AdminCorridor {
  id: string;
  name: string;
  originRegion: string;
  destinationRegion: string;
  distanceKm: number;
  direction: "ONE_WAY" | "ROUND_TRIP" | "BIDIRECTIONAL";
  isActive: boolean;
  createdAt: string;
  loadsCount: number;
  shipperPricePerKm: number;
  shipperPromoFlag: boolean;
  shipperPromoPct: number | null;
  carrierPricePerKm: number;
  carrierPromoFlag: boolean;
  carrierPromoPct: number | null;
  feePreview: {
    shipper: FeePreview;
    carrier: FeePreview;
    totalPlatformFee: number;
  };
}

export interface FeePreview {
  baseFee: number;
  discount: number;
  finalFee: number;
}

// ============================================
// Feature Flag Types
// ============================================

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  category: "core" | "experimental" | "beta" | "deprecated";
  rolloutPercentage: number;
  lastModifiedAt: string;
  lastModifiedBy: string;
}

// ============================================
// Settlement Types
// ============================================

export interface SettlementLoad {
  id: string;
  status: string;
  podVerified: boolean;
  settlementStatus: string | null;
  pickupCity: string;
  deliveryCity: string;
  serviceFeeEtb: number | null;
  shipper: {
    id: string;
    name: string;
  } | null;
  assignedTruck: {
    carrier: {
      id: string;
      name: string;
    } | null;
  } | null;
}

// ============================================
// System Settings Types
// ============================================

export interface SystemSettings {
  id: string;
  rateLimitDocumentUpload: number;
  rateLimitTruckPosting: number;
  rateLimitFileDownload: number;
  rateLimitAuthAttempts: number;
  matchScoreMinimum: number;
  matchScoreGood: number;
  matchScoreExcellent: number;
  emailNotificationsEnabled: boolean;
  emailNotifyDocumentApproval: boolean;
  emailNotifyDocumentRejection: boolean;
  emailNotifyLoadAssignment: boolean;
  emailNotifyPodVerification: boolean;
  maxFileUploadSizeMb: number;
  maxDocumentsPerEntity: number;
  platformMaintenanceMode: boolean;
  platformMaintenanceMessage: string | null;
  requireEmailVerification: boolean;
  requirePhoneVerification: boolean;
  lastModifiedBy: string;
  lastModifiedAt: string;
  createdAt: string;
}

// ============================================
// Bypass Warning Types
// ============================================

export interface BypassWarningStats {
  firstTimeOffenders: number;
  multipleOffenders: number;
  flaggedOrganizations: number;
  totalSuspicious: number;
}

// ============================================
// Pagination Types
// ============================================

export interface AdminPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// ============================================
// Constants
// ============================================

// H15 FIX: Maximum wallet topup amount (1 million ETB)
export const MAX_WALLET_TOPUP_AMOUNT = 1000000;

// Rate limit for admin financial operations
export const ADMIN_FINANCIAL_OPS_RPS = 5;
export const ADMIN_FINANCIAL_OPS_BURST = 10;

// ============================================
// Error Handling Utility
// ============================================

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "An unknown error occurred";
}

// Prisma error type guard
export interface PrismaError {
  code?: string;
  meta?: { target?: string[] };
}

export function isPrismaError(error: unknown): error is PrismaError {
  return typeof error === "object" && error !== null && "code" in error;
}
