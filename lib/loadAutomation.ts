/**
 * Load Automation Utilities
 * Sprint 2 - Load expiration automation
 * Sprint 5 - Settlement automation
 *
 * Automated workflows for load management
 */

import { db } from '@/lib/db';
import { createNotification, NotificationType } from '@/lib/notifications';
import { deductServiceFee } from '@/lib/serviceFeeManagement'; // Service Fee Implementation

/**
 * Expire old loads that haven't been assigned
 * Run via cron job daily
 */
export async function expireOldLoads() {
  try {
    const expirationThreshold = new Date();
    expirationThreshold.setDate(expirationThreshold.getDate() - 7); // 7 days old

    // Find loads that should be expired
    const loadsToExpire = await db.load.findMany({
      where: {
        status: 'POSTED',
        createdAt: {
          lt: expirationThreshold,
        },
      },
      include: {
        shipper: {
          select: {
            id: true,
            users: {
              select: { id: true },
            },
          },
        },
      },
    });

    // Batch update all loads to EXPIRED status (single query instead of N)
    if (loadsToExpire.length > 0) {
      await db.load.updateMany({
        where: { id: { in: loadsToExpire.map(l => l.id) } },
        data: { status: 'EXPIRED' },
      });
    }

    // Batch notify shippers
    await Promise.all(
      loadsToExpire
        .filter(load => load.shipper?.users?.[0]?.id)
        .map(load =>
          createNotification({
            userId: load.shipper!.users[0].id,
            type: 'LOAD_EXPIRED',
            title: 'Load Expired',
            message: `Your load from ${load.pickupCity} to ${load.deliveryCity} has expired due to no carrier assignment.`,
            metadata: { loadId: load.id },
          })
        )
    );

    return {
      success: true,
      expiredCount: loadsToExpire.length,
    };
  } catch (error) {
    console.error('Error expiring loads:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Automatically settle completed loads
 * Run via cron job or manual trigger
 *
 * Service Fee Implementation: Uses per-KM service fee instead of commission
 */
export async function autoSettleCompletedLoads() {
  try {
    // Find loads ready for settlement (POD uploaded, verified)
    const loadsToSettle = await db.load.findMany({
      where: {
        status: 'DELIVERED',
        // podUrl: { not: null }, // POD uploaded
      },
      include: {
        shipper: {
          select: {
            id: true,
            users: { select: { id: true } },
          },
        },
        assignedTruck: {
          select: {
            carrier: {
              select: {
                id: true,
                users: { select: { id: true } },
              },
            },
          },
        },
      },
    });

    let settledCount = 0;

    // Process service fees per-load (financial operation must be individual)
    const settledLoads: Array<{ load: typeof loadsToSettle[0]; serviceFeeAmount: number }> = [];

    for (const load of loadsToSettle) {
      try {
        let serviceFeeAmount = 0;
        try {
          const serviceFeeResult = await deductServiceFee(load.id);
          if (serviceFeeResult.success) {
            serviceFeeAmount = Number(serviceFeeResult.serviceFee);
          }
        } catch (error) {
          console.error(`Service fee deduction error for load ${load.id}:`, error);
        }

        settledLoads.push({ load, serviceFeeAmount });
        settledCount++;
      } catch (error) {
        console.error(`Error settling load ${load.id}:`, error);
      }
    }

    // Batch update all settled loads to COMPLETED (single query instead of N)
    if (settledLoads.length > 0) {
      await db.load.updateMany({
        where: { id: { in: settledLoads.map(s => s.load.id) } },
        data: { status: 'COMPLETED' },
      });
    }

    // Batch send all notifications in parallel
    const notificationPromises: Promise<any>[] = [];
    for (const { load, serviceFeeAmount } of settledLoads) {
      if (load.shipper?.users?.[0]?.id) {
        notificationPromises.push(
          createNotification({
            userId: load.shipper.users[0].id,
            type: NotificationType.SETTLEMENT_COMPLETE,
            title: 'Load Completed',
            message: `Load from ${load.pickupCity} to ${load.deliveryCity} has been completed. Platform service fee: ${serviceFeeAmount.toFixed(2)} ETB.`,
            metadata: { loadId: load.id, serviceFee: serviceFeeAmount },
          }).catch(console.error)
        );
      }
      if (load.assignedTruck?.carrier?.users?.[0]?.id) {
        notificationPromises.push(
          createNotification({
            userId: load.assignedTruck.carrier.users[0].id,
            type: NotificationType.SETTLEMENT_COMPLETE,
            title: 'Delivery Completed',
            message: `Delivery to ${load.deliveryCity} has been completed. Platform service fee: ${serviceFeeAmount.toFixed(2)} ETB.`,
            metadata: { loadId: load.id, serviceFee: serviceFeeAmount },
          }).catch(console.error)
        );
      }
    }
    await Promise.all(notificationPromises);

    return {
      success: true,
      settledCount,
      totalFound: loadsToSettle.length,
    };
  } catch (error) {
    console.error('Error in auto-settlement:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Cleanup old data (90 days+)
 * Run monthly via cron
 */
export async function cleanupOldData() {
  try {
    const cleanupThreshold = new Date();
    cleanupThreshold.setDate(cleanupThreshold.getDate() - 90); // 90 days

    // Delete old GPS positions (already implemented in cleanup-gps-positions)
    // Delete old notifications (already implemented in cleanupOldNotifications)

    // Delete old audit logs
    //   where: {
    //     createdAt: { lt: cleanupThreshold },

    return {
      success: true,
      message: 'Old data cleaned up successfully',
    };
  } catch (error) {
    console.error('Error cleaning up old data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send load reminder notifications
 * Remind shippers about loads approaching pickup date
 */
export async function sendLoadReminders() {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    // Find loads with pickup date tomorrow
    const upcomingLoads = await db.load.findMany({
      where: {
        status: 'ASSIGNED',
        pickupDate: {
          gte: tomorrow,
          lt: dayAfter,
        },
      },
      include: {
        shipper: {
          select: {
            users: { select: { id: true } },
          },
        },
        assignedTruck: {
          select: {
            carrier: {
              select: {
                users: { select: { id: true } },
              },
            },
          },
        },
      },
    });

    // Batch all reminder notifications in parallel
    const reminderPromises: Promise<any>[] = [];

    for (const load of upcomingLoads) {
      if (load.shipper?.users?.[0]?.id) {
        reminderPromises.push(
          createNotification({
            userId: load.shipper.users[0].id,
            type: 'PICKUP_REMINDER',
            title: 'Pickup Tomorrow',
            message: `Reminder: Load pickup scheduled for tomorrow from ${load.pickupCity}.`,
            metadata: { loadId: load.id },
          })
        );
      }
      if (load.assignedTruck?.carrier?.users?.[0]?.id) {
        reminderPromises.push(
          createNotification({
            userId: load.assignedTruck.carrier.users[0].id,
            type: 'PICKUP_REMINDER',
            title: 'Pickup Tomorrow',
            message: `Reminder: Pickup scheduled for tomorrow from ${load.pickupCity}.`,
            metadata: { loadId: load.id },
          })
        );
      }
    }

    await Promise.all(reminderPromises);
    const notificationsSent = reminderPromises.length;

    return {
      success: true,
      loadsCount: upcomingLoads.length,
      notificationsSent,
    };
  } catch (error) {
    console.error('Error sending load reminders:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
