/**
 * Settlement Automation Utilities
 *
 * Sprint 16 - Story 16.7: Settlement Processing
 *
 * Automated workflows for POD verification and settlement processing
 *
 * Note: Service fees are handled via Corridor-based pricing in lib/serviceFeeManagement.ts
 */

import { db } from "./db";
import { LoadStatus } from "@prisma/client";
import { logger } from "./logger";

// Settlement status values (stored as String in database)
const SettlementStatus = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  PAID: "PAID",
  DISPUTED: "DISPUTED",
} as const;

/**
 * Auto-verify POD after configured timeout if shipper hasn't responded
 *
 * Checks loads with submitted POD that haven't been verified within the configured timeout
 * and automatically approves them to prevent blocking settlement.
 */
export async function autoVerifyExpiredPODs(): Promise<number> {
  // Get system settings for timeout configuration
  const settings = await db.systemSettings.findUnique({
    where: { id: "system" },
    select: {
      autoVerifyPodEnabled: true,
      autoVerifyPodTimeoutHours: true,
    },
  });

  // If auto-verify is disabled, return early
  if (!settings?.autoVerifyPodEnabled) {
    return 0;
  }

  const timeoutHours = settings.autoVerifyPodTimeoutHours || 24;
  const timeoutAgo = new Date(Date.now() - timeoutHours * 60 * 60 * 1000);

  // Find loads with POD submitted past timeout but not verified
  const loadsToVerify = await db.load.findMany({
    where: {
      podSubmitted: true,
      podVerified: false,
      podSubmittedAt: {
        lt: timeoutAgo,
      },
      settlementStatus: "PENDING",
    },
    select: {
      id: true,
      podSubmittedAt: true,
    },
  });

  if (loadsToVerify.length === 0) {
    return 0;
  }

  // Update all to verified
  await db.load.updateMany({
    where: {
      id: {
        in: loadsToVerify.map((l) => l.id),
      },
    },
    data: {
      podVerified: true,
      podVerifiedAt: new Date(),
    },
  });

  return loadsToVerify.length;
}

/**
 * Mark a load as settled
 *
 * Simply marks the load's settlement status as PAID.
 * Service fees are handled separately by serviceFeeManagement.ts
 */
async function markLoadAsSettled(loadId: string): Promise<void> {
  await db.load.update({
    where: { id: loadId },
    data: {
      settlementStatus: "PAID",
      settledAt: new Date(),
    },
  });
}

/**
 * Process settlements for loads with verified POD
 *
 * Finds loads that have verified POD and pending settlement,
 * then marks them as settled. Service fees are handled separately.
 */
export async function processReadySettlements(): Promise<number> {
  // Get system settings for batch size and automation toggle
  const settings = await db.systemSettings.findUnique({
    where: { id: "system" },
    select: {
      settlementAutomationEnabled: true,
      settlementBatchSize: true,
      autoSettlementMinAmount: true,
      autoSettlementMaxAmount: true,
    },
  });

  // If settlement automation is disabled, return early
  if (!settings?.settlementAutomationEnabled) {
    return 0;
  }

  const batchSize = settings.settlementBatchSize || 50;

  // Build where clause for loads ready for settlement
  // Note: Amount constraints removed since pricing is negotiated off-platform
  // Include both DELIVERED and COMPLETED loads (load may sync to COMPLETED before settlement)
  const whereClause: {
    status: { in: LoadStatus[] };
    podVerified: boolean;
    settlementStatus: string;
  } = {
    status: { in: [LoadStatus.DELIVERED, LoadStatus.COMPLETED] },
    podVerified: true,
    settlementStatus: SettlementStatus.PENDING,
  };

  // Find loads ready for settlement
  const loadsToSettle = await db.load.findMany({
    where: whereClause,
    select: {
      id: true,
      shipper: {
        select: {
          name: true,
        },
      },
      assignedTruck: {
        select: {
          carrier: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    take: batchSize, // Process in batches
  });

  if (loadsToSettle.length === 0) {
    return 0;
  }

  // Process settlements in parallel instead of sequentially
  const results = await Promise.allSettled(
    loadsToSettle.map((load) => markLoadAsSettled(load.id))
  );

  const errorIds: string[] = [];
  let successCount = 0;

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      successCount++;
    } else {
      errorIds.push(loadsToSettle[index].id);
      console.error(
        `✗ Failed to settle load ${loadsToSettle[index].id}:`,
        result.reason?.message || result.reason
      );
    }
  });

  // Batch update all failed loads to DISPUTE (single query instead of N)
  if (errorIds.length > 0) {
    await db.load.updateMany({
      where: { id: { in: errorIds } },
      data: { settlementStatus: "DISPUTE" },
    });
  }

  logger.info("Settlement batch complete", {
    successCount,
    failedCount: errorIds.length,
  });

  return successCount;
}

/**
 * Complete load and trigger automatic settlement workflow
 *
 * Called when a load is marked as delivered. This function:
 * 1. Updates load status to DELIVERED
 * 2. Waits for POD submission (carrier responsibility)
 * 3. Auto-verifies POD after 24h if shipper doesn't respond
 * 4. Marks settlement as complete
 *
 * Note: Service fees are handled separately by serviceFeeManagement.ts
 *
 * @param loadId - Load ID to complete
 * @returns Promise<void>
 */
export async function completeLoadWithSettlement(
  loadId: string
): Promise<void> {
  // Get load details
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      status: true,
      podSubmitted: true,
      podVerified: true,
      settlementStatus: true,
      shipperId: true,
      assignedTruck: {
        select: {
          carrierId: true,
        },
      },
    },
  });

  if (!load) {
    throw new Error("Load not found");
  }

  if (load.status === "DELIVERED") {
    return;
  }

  // Step 1: Mark load as delivered
  await db.load.update({
    where: { id: loadId },
    data: {
      status: "DELIVERED",
    },
  });

  // Step 2: Check if POD already submitted and verified
  if (load.podSubmitted && load.podVerified) {
    try {
      await markLoadAsSettled(loadId);
    } catch (error: unknown) {
      console.error(
        `✗ Settlement failed for load ${loadId}:`,
        error instanceof Error ? error.message : "Unknown error"
      );

      // Mark as dispute if settlement fails
      await db.load.update({
        where: { id: loadId },
        data: {
          settlementStatus: "DISPUTE",
        },
      });
    }
  } else {
  }
}

/**
 * Run all settlement automation tasks
 *
 * This function should be called periodically (e.g., via cron job)
 * to process pending settlements automatically.
 *
 * @returns Promise with counts of processed items
 */
export async function runSettlementAutomation(): Promise<{
  autoVerifiedCount: number;
  settledCount: number;
}> {
  // Step 1: Auto-verify expired PODs
  const autoVerifiedCount = await autoVerifyExpiredPODs();

  // Step 2: Process ready settlements
  const settledCount = await processReadySettlements();

  return {
    autoVerifiedCount,
    settledCount,
  };
}

/**
 * Get settlement statistics
 *
 * Returns counts of loads in various settlement states
 */
export async function getSettlementStats(): Promise<{
  pendingPODSubmission: number;
  pendingPODVerification: number;
  readyForSettlement: number;
  settled: number;
  disputes: number;
}> {
  const [
    pendingPODSubmission,
    pendingPODVerification,
    readyForSettlement,
    settled,
    disputes,
  ] = await Promise.all([
    // Delivered but no POD submitted
    db.load.count({
      where: {
        status: "DELIVERED",
        podSubmitted: false,
        settlementStatus: "PENDING",
      },
    }),
    // POD submitted but not verified
    db.load.count({
      where: {
        status: "DELIVERED",
        podSubmitted: true,
        podVerified: false,
        settlementStatus: "PENDING",
      },
    }),
    // POD verified, ready for settlement
    db.load.count({
      where: {
        status: "DELIVERED",
        podVerified: true,
        settlementStatus: "PENDING",
      },
    }),
    // Already settled
    db.load.count({
      where: {
        settlementStatus: "PAID",
      },
    }),
    // Disputes
    db.load.count({
      where: {
        settlementStatus: "DISPUTE",
      },
    }),
  ]);

  return {
    pendingPODSubmission,
    pendingPODVerification,
    readyForSettlement,
    settled,
    disputes,
  };
}
