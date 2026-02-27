/**
 * Sprint 4: Dispatcher Audit Logging
 * API endpoint for dispatcher-specific audit logs
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { canViewSystemDashboard } from "@/lib/dispatcherPermissions";
import { UserRole, Prisma } from "@prisma/client";

// Dispatcher-specific event types
export const DISPATCHER_EVENT_TYPES: string[] = [
  "ASSIGNED",
  "UNASSIGNED",
  "STATUS_CHANGED",
  "ESCALATION_CREATED",
  "ESCALATION_UPDATED",
  "ESCALATION_RESOLVED",
  "ESCALATION_DELETED",
  "TRACKING_ENABLED",
  "TRACKING_DISABLED",
  "DISPATCHER_NOTE_ADDED",
];

// GET /api/audit-logs/dispatcher - Get dispatcher action audit logs
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Only dispatchers and admins can view dispatcher audit logs
    // FIX: Use proper enum type
    const canView = canViewSystemDashboard({
      role: session.role as UserRole,
      organizationId: null,
      userId: session.userId,
    });

    if (!canView) {
      return NextResponse.json(
        { error: "You do not have permission to view dispatcher audit logs" },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const eventType = searchParams.get("eventType");
    const userId = searchParams.get("userId");
    const loadId = searchParams.get("loadId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build where clause
    const where: Prisma.LoadEventWhereInput = {
      // Only dispatcher-related events
      eventType: {
        in: DISPATCHER_EVENT_TYPES,
      },
    };

    if (eventType) {
      where.eventType = eventType;
    }

    if (userId) {
      where.userId = userId;
    }

    if (loadId) {
      where.loadId = loadId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Get audit logs
    const [logs, total] = await Promise.all([
      db.loadEvent.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        skip: offset,
        include: {
          load: {
            select: {
              id: true,
              status: true,
              pickupCity: true,
              deliveryCity: true,
              shipper: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      db.loadEvent.count({ where }),
    ]);

    // Get event type statistics
    const eventStats = await db.loadEvent.groupBy({
      by: ["eventType"],
      where: {
        eventType: {
          in: DISPATCHER_EVENT_TYPES,
        },
        ...(startDate || endDate
          ? {
              createdAt: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
              },
            }
          : {}),
      },
      _count: true,
    });

    // Get top dispatchers by activity
    const topDispatchers = await db.loadEvent.groupBy({
      by: ["userId"],
      where: {
        eventType: {
          in: DISPATCHER_EVENT_TYPES,
        },
        userId: {
          not: null,
        },
        ...(startDate || endDate
          ? {
              createdAt: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
              },
            }
          : {}),
      },
      _count: true,
      orderBy: {
        _count: {
          userId: "desc",
        },
      },
      take: 10,
    });

    // Get user details for top dispatchers
    const userIds = topDispatchers
      .map((d) => d.userId)
      .filter((id): id is string => id !== null);
    const users = await db.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    const topDispatchersWithDetails = topDispatchers.map((dispatcher) => {
      const user = users.find((u) => u.id === dispatcher.userId);
      return {
        userId: dispatcher.userId,
        actionCount: dispatcher._count,
        user: user
          ? {
              email: user.email,
              name:
                `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
                user.email,
              role: user.role,
            }
          : null,
      };
    });

    return NextResponse.json({
      logs,
      total,
      limit,
      offset,
      stats: {
        byEventType: eventStats.reduce(
          (acc, s) => {
            acc[s.eventType] = s._count;
            return acc;
          },
          {} as Record<string, number>
        ),
        topDispatchers: topDispatchersWithDetails,
      },
    });
  } catch (error) {
    console.error("Dispatcher audit logs fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dispatcher audit logs" },
      { status: 500 }
    );
  }
}
