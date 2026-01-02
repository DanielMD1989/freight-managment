/**
 * Notifications API - Sprint 16 Story 16.10
 * GET /api/notifications - Get user notifications with unread count
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getRecentNotifications, getUnreadCount } from '@/lib/notifications';

export async function GET() {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notifications = await getRecentNotifications(session.userId, 20);
    const unreadCount = await getUnreadCount(session.userId);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}
