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

  // Automation
  AUTOMATION_TRIGGERED: 'AUTOMATION_TRIGGERED',

  // Bypass Detection
  BYPASS_WARNING: 'BYPASS_WARNING',
  ACCOUNT_FLAGGED: 'ACCOUNT_FLAGGED',
} as const;

/**
 * Create a notification for a specific user
 */
export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata?: any;
}) {
  const { userId, type, title, message, metadata } = params;

  try {
    const notification = await db.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        read: false,
        metadata: metadata || {},
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
  } catch (error) {
    console.error('Failed to create notification:', error);
    // Don't throw - notifications are non-critical
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
