/**
 * Mark Notification as Read - Sprint 16 Story 16.10
 * PUT /api/notifications/[id]/read
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { markAsRead } from '@/lib/notifications';
import { db } from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Await params (Next.js 15+)
    const { id } = await params;

    // Verify notification belongs to user before marking as read
    const notification = await db.notification.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!notification || notification.userId !== session.userId) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    await markAsRead(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    );
  }
}
