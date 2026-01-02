import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  getLoadLivePosition,
  canAccessTracking,
  isTrackingActive,
} from '@/lib/gpsTracking';

/**
 * GET /api/loads/[id]/live-position
 *
 * Get current live GPS position for a load
 *
 * Sprint 16 - Story 16.3: GPS Live Tracking
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loadId } = await params;
    const session = await requireAuth();

    // Check if user has access to tracking
    const hasAccess = await canAccessTracking(loadId, session.userId);

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have permission to access tracking for this load' },
        { status: 403 }
      );
    }

    // Check if tracking is enabled
    const trackingActive = await isTrackingActive(loadId);

    if (!trackingActive) {
      return NextResponse.json(
        { error: 'GPS tracking is not enabled for this load' },
        { status: 400 }
      );
    }

    // Get live position
    const position = await getLoadLivePosition(loadId);

    if (!position) {
      return NextResponse.json(
        { error: 'No GPS position available' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      position,
    });
  } catch (error) {
    console.error('Get live position error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
