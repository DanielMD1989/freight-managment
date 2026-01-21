/**
 * Truck Posting Automation Module
 *
 * Handles automatic expiration of truck postings that:
 * 1. Have availableTo date in the past
 * 2. Have expiresAt date in the past
 */

import { db } from './db';

export interface ExpirePostingsResult {
  success: boolean;
  expiredCount: number;
  error?: string;
  details?: {
    expiredByAvailableTo: number;
    expiredByExpiresAt: number;
  };
}

/**
 * Expire truck postings that have passed their availability or expiry date
 * Called by cron job daily
 */
export async function expireOldTruckPostings(): Promise<ExpirePostingsResult> {
  try {
    const now = new Date();

    // Find ACTIVE postings that should be expired
    // Either availableTo has passed or expiresAt has passed
    const postingsToExpire = await db.truckPosting.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          // availableTo has passed
          {
            availableTo: {
              lt: now,
            },
          },
          // expiresAt has passed
          {
            expiresAt: {
              lt: now,
            },
          },
        ],
      },
      select: {
        id: true,
        availableTo: true,
        expiresAt: true,
        truckId: true,
        truck: {
          select: {
            licensePlate: true,
          },
        },
        carrier: {
          select: {
            name: true,
          },
        },
      },
    });

    if (postingsToExpire.length === 0) {
      return {
        success: true,
        expiredCount: 0,
        details: {
          expiredByAvailableTo: 0,
          expiredByExpiresAt: 0,
        },
      };
    }

    // Track reason for expiration
    let expiredByAvailableTo = 0;
    let expiredByExpiresAt = 0;

    for (const posting of postingsToExpire) {
      if (posting.availableTo && posting.availableTo < now) {
        expiredByAvailableTo++;
      } else if (posting.expiresAt && posting.expiresAt < now) {
        expiredByExpiresAt++;
      }
    }

    // Update all postings to EXPIRED status
    const postingIds = postingsToExpire.map((p) => p.id);

    await db.truckPosting.updateMany({
      where: {
        id: {
          in: postingIds,
        },
      },
      data: {
        status: 'EXPIRED',
        updatedAt: now,
      },
    });

    console.log(`[TruckPostingAutomation] Expired ${postingsToExpire.length} truck postings:`, {
      expiredByAvailableTo,
      expiredByExpiresAt,
      postingIds,
    });

    return {
      success: true,
      expiredCount: postingsToExpire.length,
      details: {
        expiredByAvailableTo,
        expiredByExpiresAt,
      },
    };
  } catch (error) {
    console.error('[TruckPostingAutomation] Error expiring postings:', error);
    return {
      success: false,
      expiredCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Expire load requests and truck requests that have passed their expiresAt
 * Called by cron job to clean up stale requests
 */
export async function expireOldRequests(): Promise<{
  success: boolean;
  loadRequestsExpired: number;
  truckRequestsExpired: number;
  error?: string;
}> {
  try {
    const now = new Date();

    // Expire load requests
    const loadRequestResult = await db.loadRequest.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          lt: now,
        },
      },
      data: {
        status: 'EXPIRED',
        updatedAt: now,
      },
    });

    // Expire truck requests
    const truckRequestResult = await db.truckRequest.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          lt: now,
        },
      },
      data: {
        status: 'EXPIRED',
        updatedAt: now,
      },
    });

    console.log(`[TruckPostingAutomation] Expired ${loadRequestResult.count} load requests and ${truckRequestResult.count} truck requests`);

    return {
      success: true,
      loadRequestsExpired: loadRequestResult.count,
      truckRequestsExpired: truckRequestResult.count,
    };
  } catch (error) {
    console.error('[TruckPostingAutomation] Error expiring requests:', error);
    return {
      success: false,
      loadRequestsExpired: 0,
      truckRequestsExpired: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
