/**
 * Sprint 4: Dispatcher Escalation System
 * API endpoints for managing escalations across all loads
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { canViewSystemDashboard } from "@/lib/dispatcherPermissions";
import { UserRole, Prisma } from "@prisma/client";

// GET /api/escalations - List all escalations (dispatcher queue)
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Only dispatchers, admins can view all escalations
    // FIX: Use proper enum type
    const canView = canViewSystemDashboard({
      role: session.role as UserRole,
      organizationId: null,
      userId: session.userId,
    });

    if (!canView) {
      return NextResponse.json(
        { error: "You do not have permission to view escalations" },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const escalationType = searchParams.get("escalationType");
    const assignedTo = searchParams.get("assignedTo");
    // M1 FIX: Add pagination bounds to prevent DoS
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "50", 10), 1),
      100
    );
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    // Build where clause
    const where: Prisma.LoadEscalationWhereInput = {};

    if (status) {
      where.status = status as Prisma.EnumEscalationStatusFilter;
    }

    if (priority) {
      where.priority = priority as Prisma.EnumEscalationPriorityFilter;
    }

    if (escalationType) {
      where.escalationType = escalationType as Prisma.EnumEscalationTypeFilter;
    }

    if (assignedTo) {
      where.assignedTo = assignedTo;
    }

    // Get escalations
    const [escalations, total] = await Promise.all([
      db.loadEscalation.findMany({
        where,
        orderBy: [
          { priority: "desc" }, // CRITICAL first
          { status: "asc" }, // OPEN first
          { createdAt: "desc" },
        ],
        take: limit,
        skip: offset,
        include: {
          load: {
            select: {
              id: true,
              status: true,
              pickupCity: true,
              pickupCityId: true,
              deliveryCity: true,
              deliveryCityId: true,
              assignedTruckId: true,
              assignedTruck: {
                select: {
                  licensePlate: true,
                  carrier: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
              shipper: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      db.loadEscalation.count({ where }),
    ]);

    // Get statistics
    const stats = await db.loadEscalation.groupBy({
      by: ["status"],
      _count: true,
    });

    const priorityStats = await db.loadEscalation.groupBy({
      by: ["priority"],
      _count: true,
    });

    return NextResponse.json({
      escalations,
      total,
      limit,
      offset,
      stats: {
        byStatus: stats.reduce(
          (acc, s) => {
            acc[s.status] = s._count;
            return acc;
          },
          {} as Record<string, number>
        ),
        byPriority: priorityStats.reduce(
          (acc, p) => {
            acc[p.priority] = p._count;
            return acc;
          },
          {} as Record<string, number>
        ),
      },
    });
  } catch (error) {
    console.error("Escalations fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch escalations" },
      { status: 500 }
    );
  }
}
