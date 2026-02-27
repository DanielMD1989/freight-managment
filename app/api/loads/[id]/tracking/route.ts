import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getTrackingStatus,
  canAccessTracking,
  checkGeofenceEvents,
} from "@/lib/gpsTracking";

/**
 * GET /api/loads/[id]/tracking
 *
 * Get GPS tracking status for a load
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
        {
          error: "You do not have permission to access tracking for this load",
        },
        { status: 403 }
      );
    }

    // Get tracking status
    const status = await getTrackingStatus(loadId);

    if (!status) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    // Check for geofence events
    const events = await checkGeofenceEvents(loadId);

    return NextResponse.json({
      tracking: status,
      events,
    });
  } catch (error) {
    console.error("Get tracking status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
