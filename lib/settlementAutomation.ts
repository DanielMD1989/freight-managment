/**
 * Settlement Automation Utilities
 *
 * Sprint 16 - Story 16.7: Settlement Processing
 *
 * Automated workflows for POD verification and settlement processing
 *
 * Note: Service fees are handled via Corridor-based pricing in lib/serviceFeeManagement.ts
 */

import { db } from './db';

/**
 * Auto-verify POD after configured timeout if shipper hasn't responded
 *
 * Checks loads with submitted POD that haven't been verified within the configured timeout
 * and automatically approves them to prevent blocking settlement.
 */
export async function autoVerifyExpiredPODs(): Promise<number> {
  // Get system settings for timeout configuration
  const settings = await db.systemSettings.findUnique({
    where: { id: 'system' },
    select: {
      autoVerifyPodEnabled: true,
      autoVerifyPodTimeoutHours: true,
    },
  });

  // If auto-verify is disabled, return early
  if (!settings?.autoVerifyPodEnabled) {
    console.log('Auto-verify POD is disabled in system settings');
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
      settlementStatus: 'PENDING',
    },
    select: {
      id: true,
      podSubmittedAt: true,
    },
  });

  if (loadsToVerify.length === 0) {
    return 0;
  }

  console.log(`Auto-verifying ${loadsToVerify.length} expired PODs...`);

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

  console.log(`✓ Auto-verified ${loadsToVerify.length} PODs`);

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
      settlementStatus: 'PAID',
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
    where: { id: 'system' },
    select: {
      settlementAutomationEnabled: true,
      settlementBatchSize: true,
      autoSettlementMinAmount: true,
      autoSettlementMaxAmount: true,
    },
  });

  // If settlement automation is disabled, return early
  if (!settings?.settlementAutomationEnabled) {
    console.log('Settlement automation is disabled in system settings');
    return 0;
  }

  const batchSize = settings.settlementBatchSize || 50;
  const minAmount = Number(settings.autoSettlementMinAmount || 0);
  const maxAmount = Number(settings.autoSettlementMaxAmount || 0);

  // Build where clause with amount constraints
  const whereClause: any = {
    status: 'DELIVERED',
    podVerified: true,
    settlementStatus: 'PENDING',
  };

  // Add amount constraints if configured
  if (minAmount > 0) {
    whereClause.OR = [
      { totalFareEtb: { gte: minAmount } },
      { AND: [{ totalFareEtb: null }, { rate: { gte: minAmount } }] },
    ];
  }

  if (maxAmount > 0) {
    whereClause.AND = [
      {
        OR: [
          { totalFareEtb: { lte: maxAmount } },
          { AND: [{ totalFareEtb: null }, { rate: { lte: maxAmount } }] },
        ],
      },
    ];
  }

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

  console.log(`Processing ${loadsToSettle.length} ready settlements...`);

  let successCount = 0;
  let errorCount = 0;

  for (const load of loadsToSettle) {
    try {
      await markLoadAsSettled(load.id);
      successCount++;
      console.log(`✓ Settled load ${load.id}`);
    } catch (error: any) {
      errorCount++;
      console.error(`✗ Failed to settle load ${load.id}:`, error.message);

      // Mark as DISPUTE if settlement fails
      await db.load.update({
        where: { id: load.id },
        data: {
          settlementStatus: 'DISPUTE',
        },
      });
    }
  }

  console.log(
    `Settlement batch complete: ${successCount} succeeded, ${errorCount} failed`
  );

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
export async function completeLoadWithSettlement(loadId: string): Promise<void> {
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
    throw new Error('Load not found');
  }

  if (load.status === 'DELIVERED') {
    console.log(`Load ${loadId} already marked as delivered`);
    return;
  }

  // Step 1: Mark load as delivered
  await db.load.update({
    where: { id: loadId },
    data: {
      status: 'DELIVERED',
    },
  });

  console.log(`✓ Load ${loadId} marked as DELIVERED`);

  // Step 2: Check if POD already submitted and verified
  if (load.podSubmitted && load.podVerified) {
    console.log(`Load ${loadId} has verified POD, marking as settled...`);

    try {
      await markLoadAsSettled(loadId);
      console.log(`✓ Load ${loadId} settlement processed`);
    } catch (error: any) {
      console.error(`✗ Settlement failed for load ${loadId}:`, error.message);

      // Mark as dispute if settlement fails
      await db.load.update({
        where: { id: loadId },
        data: {
          settlementStatus: 'DISPUTE',
        },
      });
    }
  } else {
    console.log(
      `Load ${loadId} waiting for POD submission and verification before settlement`
    );
    console.log(
      `POD will auto-verify after 24 hours if shipper doesn't respond`
    );
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
  console.log('=== Running Settlement Automation ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // Step 1: Auto-verify expired PODs
  const autoVerifiedCount = await autoVerifyExpiredPODs();

  // Step 2: Process ready settlements
  const settledCount = await processReadySettlements();

  console.log('=== Settlement Automation Complete ===');
  console.log(`Auto-verified PODs: ${autoVerifiedCount}`);
  console.log(`Processed settlements: ${settledCount}`);

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
        status: 'DELIVERED',
        podSubmitted: false,
        settlementStatus: 'PENDING',
      },
    }),
    // POD submitted but not verified
    db.load.count({
      where: {
        status: 'DELIVERED',
        podSubmitted: true,
        podVerified: false,
        settlementStatus: 'PENDING',
      },
    }),
    // POD verified, ready for settlement
    db.load.count({
      where: {
        status: 'DELIVERED',
        podVerified: true,
        settlementStatus: 'PENDING',
      },
    }),
    // Already settled
    db.load.count({
      where: {
        settlementStatus: 'PAID',
      },
    }),
    // Disputes
    db.load.count({
      where: {
        settlementStatus: 'DISPUTE',
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
