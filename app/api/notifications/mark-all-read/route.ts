/**
 * Mark All Notifications as Read - Sprint 16 Story 16.10
 * PUT /api/notifications/mark-all-read
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { markAllAsRead } from '@/lib/notifications';

export async function PUT() {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await markAllAsRead(session.userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
    return NextResponse.json(
      { error: 'Failed to update notifications' },
      { status: 500 }
    );
  }
}
