/**
 * Insurance Validation Service
 *
 * P0 Insurance: Validates truck insurance status from TruckDocument records.
 * Single source of truth for computing and persisting insurance status.
 *
 * Status values:
 *   MISSING  — No approved insurance document exists
 *   VALID    — Approved doc with expiresAt > 30 days from now
 *   EXPIRING — Approved doc with expiresAt within 30 days (still valid for posting)
 *   EXPIRED  — Approved doc with expiresAt in the past
 */

import { db } from "./db";

/** Number of days before expiry to transition from VALID → EXPIRING */
export const INSURANCE_EXPIRING_DAYS = 30;

export interface InsuranceValidationResult {
  status: "MISSING" | "VALID" | "EXPIRING" | "EXPIRED";
  expiresAt: Date | null;
  valid: boolean;
  daysRemaining: number | null;
  error?: string;
}

/**
 * Validate a truck's insurance status by checking its latest approved
 * INSURANCE-type TruckDocument.
 */
export async function validateTruckInsurance(
  truckId: string
): Promise<InsuranceValidationResult> {
  const insuranceDoc = await db.truckDocument.findFirst({
    where: {
      truckId,
      type: "INSURANCE",
      verificationStatus: "APPROVED",
      deletedAt: null,
    },
    select: {
      expiresAt: true,
    },
    orderBy: { expiresAt: "desc" },
  });

  if (!insuranceDoc) {
    return {
      status: "MISSING",
      expiresAt: null,
      valid: false,
      daysRemaining: null,
      error: "No approved insurance document found for this truck",
    };
  }

  if (!insuranceDoc.expiresAt) {
    // Approved doc without expiry date — treat as valid (admin verified)
    return {
      status: "VALID",
      expiresAt: null,
      valid: true,
      daysRemaining: null,
    };
  }

  const now = new Date();
  const expiresAt = new Date(insuranceDoc.expiresAt);
  const msRemaining = expiresAt.getTime() - now.getTime();
  const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));

  if (daysRemaining <= 0) {
    return {
      status: "EXPIRED",
      expiresAt,
      valid: false,
      daysRemaining: 0,
      error: "Insurance has expired. Upload a renewed insurance document.",
    };
  }

  if (daysRemaining <= INSURANCE_EXPIRING_DAYS) {
    return {
      status: "EXPIRING",
      expiresAt,
      valid: true, // Still valid for posting — just a warning
      daysRemaining,
    };
  }

  return {
    status: "VALID",
    expiresAt,
    valid: true,
    daysRemaining,
  };
}

/**
 * Sync a truck's denormalized insurance fields from its latest document.
 * Called after: document approval, document rejection, cron expiry check.
 */
export async function syncTruckInsuranceStatus(truckId: string): Promise<void> {
  const result = await validateTruckInsurance(truckId);
  await db.truck.update({
    where: { id: truckId },
    data: {
      insuranceStatus: result.status,
      insuranceExpiresAt: result.expiresAt,
    },
  });
}
