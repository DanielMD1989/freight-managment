/**
 * Notification System - Sprint 16 Story 16.10
 * Phase 2 - Story 15.13: Real-time WebSocket Notifications
 * Handles creation and management of user notifications
 */

import { db } from '@/lib/db';
import { sendRealtimeNotification } from '@/lib/websocket-server';

/**
 * Notification Types
 */
export const NotificationType = {
  // GPS Events
  GPS_OFFLINE: 'GPS_OFFLINE',
  TRUCK_AT_PICKUP: 'TRUCK_AT_PICKUP',
  TRUCK_AT_DELIVERY: 'TRUCK_AT_DELIVERY',

  // Settlement Events
  POD_SUBMITTED: 'POD_SUBMITTED',
  POD_VERIFIED: 'POD_VERIFIED',
  COMMISSION_DEDUCTED: 'COMMISSION_DEDUCTED',
  SETTLEMENT_COMPLETE: 'SETTLEMENT_COMPLETE',

  // User Status
  USER_STATUS_CHANGED: 'USER_STATUS_CHANGED',

  // Exceptions
  EXCEPTION_CREATED: 'EXCEPTION_CREATED',
  EXCEPTION_ESCALATED: 'EXCEPTION_ESCALATED',
  ESCALATION_ASSIGNED: 'ESCALATION_ASSIGNED',
  ESCALATION_RESOLVED: 'ESCALATION_RESOLVED',

  // Automation
  AUTOMATION_TRIGGERED: 'AUTOMATION_TRIGGERED',

  // Bypass Detection
  BYPASS_WARNING: 'BYPASS_WARNING',
  ACCOUNT_FLAGGED: 'ACCOUNT_FLAGGED',

  // Matching Events
  MATCH_PROPOSAL: 'MATCH_PROPOSAL',
  LOAD_REQUEST: 'LOAD_REQUEST',
  TRUCK_REQUEST: 'TRUCK_REQUEST',
  REQUEST_APPROVED: 'REQUEST_APPROVED',
  REQUEST_REJECTED: 'REQUEST_REJECTED',

  // Return Load Notifications (Service Fee Implementation)
  RETURN_LOAD_AVAILABLE: 'RETURN_LOAD_AVAILABLE',
  RETURN_LOAD_MATCHED: 'RETURN_LOAD_MATCHED',
  TRIP_PROGRESS_80: 'TRIP_PROGRESS_80',

  // Service Fee Notifications (Service Fee Implementation)
  SERVICE_FEE_RESERVED: 'SERVICE_FEE_RESERVED',
  SERVICE_FEE_DEDUCTED: 'SERVICE_FEE_DEDUCTED',
  SERVICE_FEE_REFUNDED: 'SERVICE_FEE_REFUNDED',
} as const;

/**
 * Create a notification for a specific user
 */
export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<{ id: string; userId: string; type: string } | null> {
  const { userId, type, title, message, metadata } = params;

  try {
    const notification = await db.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        read: false,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
      },
    });

    // Send real-time notification via WebSocket
    await sendRealtimeNotification(userId, {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      metadata: notification.metadata,
      createdAt: notification.createdAt,
    });

    return {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
    };
  } catch (error) {
    console.error('Failed to create notification:', error);
    // Don't throw - notifications are non-critical
    return null;
  }
}

/**
 * Create notifications for all users with a specific role
 */
export async function createNotificationForRole(params: {
  role: string;
  type: string;
  title: string;
  message: string;
  metadata?: any;
  organizationId?: string; // Optional: scope to specific organization
}) {
  const { role, type, title, message, metadata, organizationId } = params;

  try {
    const where: any = { role, isActive: true };
    if (organizationId) {
      where.organizationId = organizationId;
    }

    const users = await db.user.findMany({ where, select: { id: true } });

    // Create notifications in parallel
    await Promise.all(
      users.map((user) =>
        createNotification({
          userId: user.id,
          type,
          title,
          message,
          metadata,
        })
      )
    );
  } catch (error) {
    console.error('Failed to create role notifications:', error);
  }
}

/**
 * Notify all stakeholders of a load (shipper and carrier)
 */
export async function notifyLoadStakeholders(
  loadId: string,
  type: string,
  title: string,
  message: string
) {
  try {
    const load = await db.load.findUnique({
      where: { id: loadId },
      select: {
        shipperId: true,
        assignedTruck: {
          select: {
            carrierId: true,
          },
        },
      },
    });

    if (!load) return;

    const notifications = [];

    // Notify shipper
    if (load.shipperId) {
      notifications.push(
        createNotification({
          userId: load.shipperId,
          type,
          title,
          message,
          metadata: { loadId },
        })
      );
    }

    // Notify carrier (through assigned truck's carrier organization)
    if (load.assignedTruck?.carrierId) {
      notifications.push(
        createNotification({
          userId: load.assignedTruck.carrierId,
          type,
          title,
          message,
          metadata: { loadId },
        })
      );
    }

    await Promise.all(notifications);
  } catch (error) {
    console.error('Failed to notify load stakeholders:', error);
  }
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  try {
    return await db.notification.count({
      where: { userId, read: false },
    });
  } catch (error) {
    console.error('Failed to get unread count:', error);
    return 0;
  }
}

/**
 * Mark a single notification as read
 */
export async function markAsRead(notificationId: string) {
  try {
    await db.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string) {
  try {
    await db.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  } catch (error) {
    console.error('Failed to mark all as read:', error);
  }
}

/**
 * Get recent notifications for a user
 */
export async function getRecentNotifications(userId: string, limit: number = 20) {
  try {
    return await db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  } catch (error) {
    console.error('Failed to get notifications:', error);
    return [];
  }
}

/**
 * Delete old notifications (cleanup utility)
 * Keeps last 90 days by default
 */
export async function cleanupOldNotifications(daysToKeep: number = 90) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await db.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        read: true, // Only delete read notifications
      },
    });

    return result.count;
  } catch (error) {
    console.error('Failed to cleanup notifications:', error);
    return 0;
  }
}

// ============================================================================
// SPECIFIC NOTIFICATION HELPERS
// ============================================================================

/**
 * Notify organization users about an event
 */
export async function notifyOrganization(params: {
  organizationId: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const { organizationId, type, title, message, metadata } = params;

  try {
    const users = await db.user.findMany({
      where: { organizationId, status: 'ACTIVE' },
      select: { id: true },
    });

    await Promise.all(
      users.map((user) =>
        createNotification({
          userId: user.id,
          type,
          title,
          message,
          metadata,
        })
      )
    );
  } catch (error) {
    console.error('Failed to notify organization:', error);
  }
}

/**
 * Notify carrier about a new truck request from shipper
 */
export async function notifyTruckRequest(params: {
  carrierId: string;
  shipperName: string;
  loadReference: string;
  truckPlate: string;
  requestId: string;
}) {
  const { carrierId, shipperName, loadReference, truckPlate, requestId } = params;

  await notifyOrganization({
    organizationId: carrierId,
    type: 'TRUCK_REQUEST_RECEIVED',
    title: 'New Truck Request',
    message: `${shipperName} has requested truck ${truckPlate} for load ${loadReference}. Please respond within 24 hours.`,
    metadata: { requestId, shipperName, loadReference, truckPlate },
  });
}

/**
 * Notify shipper about truck request response
 */
export async function notifyTruckRequestResponse(params: {
  shipperId: string;
  carrierName: string;
  truckPlate: string;
  approved: boolean;
  requestId: string;
  loadId?: string; // Include loadId for navigation to trip/load page
}) {
  const { shipperId, carrierName, truckPlate, approved, requestId, loadId } = params;

  await notifyOrganization({
    organizationId: shipperId,
    type: approved ? 'TRUCK_REQUEST_APPROVED' : 'TRUCK_REQUEST_REJECTED',
    title: approved ? 'Truck Request Approved' : 'Truck Request Rejected',
    message: approved
      ? `${carrierName} has approved your request for truck ${truckPlate}. The truck is now booked for your load.`
      : `${carrierName} has declined your request for truck ${truckPlate}.`,
    metadata: { requestId, carrierName, truckPlate, approved, loadId },
  });
}

/**
 * Notify carrier about a new load match proposal
 */
export async function notifyMatchProposal(params: {
  carrierId: string;
  shipperName: string;
  loadReference: string;
  proposalId: string;
  offeredRate?: number;
}) {
  const { carrierId, shipperName, loadReference, proposalId, offeredRate } = params;

  await notifyOrganization({
    organizationId: carrierId,
    type: 'LOAD_MATCHED',
    title: 'New Load Match Proposal',
    message: offeredRate
      ? `${shipperName} has proposed load ${loadReference} at ${offeredRate.toLocaleString()} ETB.`
      : `${shipperName} has proposed load ${loadReference}.`,
    metadata: { proposalId, shipperName, loadReference, offeredRate },
  });
}

/**
 * Notify about exception assignment
 */
export async function notifyExceptionAssigned(params: {
  userId: string;
  exceptionType: string;
  loadReference: string;
  exceptionId: string;
}) {
  const { userId, exceptionType, loadReference, exceptionId } = params;

  await createNotification({
    userId,
    type: NotificationType.EXCEPTION_CREATED,
    title: 'Exception Assigned to You',
    message: `You have been assigned a ${exceptionType.replace(/_/g, ' ').toLowerCase()} exception for load ${loadReference}.`,
    metadata: { exceptionId, exceptionType, loadReference },
  });
}

/**
 * Notify parties about exception resolution
 */
export async function notifyExceptionResolved(params: {
  exceptionId: string;
  loadId: string;
  resolution: string;
}) {
  const { exceptionId, loadId, resolution } = params;

  try {
    const load = await db.load.findUnique({
      where: { id: loadId },
      select: {
        shipperId: true,
        assignedTruck: {
          select: { carrierId: true },
        },
      },
    });

    if (!load) return;

    const notifications = [];

    if (load.shipperId) {
      notifications.push(
        notifyOrganization({
          organizationId: load.shipperId,
          type: 'EXCEPTION_RESOLVED',
          title: 'Exception Resolved',
          message: `An exception for your load has been resolved: ${resolution}`,
          metadata: { exceptionId, loadId, resolution },
        })
      );
    }

    if (load.assignedTruck?.carrierId) {
      notifications.push(
        notifyOrganization({
          organizationId: load.assignedTruck.carrierId,
          type: 'EXCEPTION_RESOLVED',
          title: 'Exception Resolved',
          message: `An exception for your assigned load has been resolved: ${resolution}`,
          metadata: { exceptionId, loadId, resolution },
        })
      );
    }

    await Promise.all(notifications);
  } catch (error) {
    console.error('Failed to notify exception resolution:', error);
  }
}

/**
 * Notify about load status change
 */
export async function notifyLoadStatusChange(params: {
  loadId: string;
  newStatus: string;
  loadReference: string;
}) {
  const { loadId, newStatus, loadReference } = params;

  await notifyLoadStakeholders(
    loadId,
    'LOAD_STATUS_CHANGED',
    'Load Status Updated',
    `Load ${loadReference} status changed to ${newStatus.replace(/_/g, ' ')}.`
  );
}

/**
 * Notify carrier about truck approval (admin action)
 */
export async function notifyTruckApproval(params: {
  carrierId: string;
  truckPlate: string;
  approved: boolean;
  reason?: string;
}) {
  const { carrierId, truckPlate, approved, reason } = params;

  await notifyOrganization({
    organizationId: carrierId,
    type: approved ? 'TRUCK_APPROVED' : 'TRUCK_REJECTED',
    title: approved ? 'Truck Approved' : 'Truck Registration Rejected',
    message: approved
      ? `Your truck ${truckPlate} has been approved and is now visible on the DAT board.`
      : `Your truck ${truckPlate} registration was rejected. ${reason || 'Please contact support for details.'}`,
    metadata: { truckPlate, approved, reason },
  });
}

/**
 * Notify user about verification status change
 */
export async function notifyUserVerification(params: {
  userId: string;
  verified: boolean;
  reason?: string;
}) {
  const { userId, verified, reason } = params;

  await createNotification({
    userId,
    type: NotificationType.USER_STATUS_CHANGED,
    title: verified ? 'Account Verified' : 'Verification Update',
    message: verified
      ? 'Your account has been verified. You now have full access to the platform.'
      : `Your verification status has been updated. ${reason || 'Please check your profile for details.'}`,
    metadata: { verified, reason },
  });
}
