/**
 * User Security Events API
 *
 * Sprint 19 - Security Activity Logging
 *
 * Allows users to view their security activity history.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserSecurityEvents, formatSecurityEvent } from '@/lib/security-events';

/**
 * GET /api/user/security-events
 * Retrieve user's security activity history
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 50;

    const events = await getUserSecurityEvents(session.userId, { limit });

    // Format events for response
    const formattedEvents = events.map((event) => ({
      id: event.id,
      type: event.eventType,
      description: formatSecurityEvent({
        eventType: event.eventType,
        deviceInfo: event.deviceInfo,
        ipAddress: event.ipAddress,
        createdAt: event.createdAt,
        success: event.success,
      }),
      deviceInfo: event.deviceInfo || 'Unknown device',
      ipAddress: event.ipAddress || 'Unknown',
      success: event.success,
      timestamp: event.createdAt,
    }));

    return NextResponse.json({
      events: formattedEvents,
      count: formattedEvents.length,
    });
  } catch (error) {
    console.error('Failed to get security events:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to retrieve security events' },
      { status: 500 }
    );
  }
}
