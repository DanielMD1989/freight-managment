import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requirePermission, Permission } from "@/lib/rbac";
import { CacheInvalidation } from "@/lib/cache";
import { z } from "zod";
import { zodErrorResponse } from "@/lib/validation";

const dispatchSchema = z.object({
  loadId: z.string(),
  truckId: z.string(),
});

// POST /api/dispatch - Dispatch a load (assign truck to load)
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Check if user has permission (carrier self-dispatch or ops dispatch)
    const hasOpsPermission = await (async () => {
      try {
        await requirePermission(Permission.VIEW_DISPATCH_QUEUE);
        return true;
      } catch {
        return false;
      }
    })();

    const hasSelfDispatch = await (async () => {
      try {
        await requirePermission(Permission.ACCEPT_LOADS);
        return true;
      } catch {
        return false;
      }
    })();

    if (!hasOpsPermission && !hasSelfDispatch) {
      return NextResponse.json(
        { error: "You do not have permission to dispatch loads" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { loadId, truckId } = dispatchSchema.parse(body);

    // Get load
    const load = await db.load.findUnique({
      where: { id: loadId },
      include: {
        shipper: {
          select: {
            financialAccounts: {
              where: {
                accountType: "SHIPPER_WALLET",
              },
            },
          },
        },
      },
    });

    if (!load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    if (load.status !== "POSTED") {
      return NextResponse.json(
        { error: "Load must be in POSTED status to be dispatched" },
        { status: 400 }
      );
    }

    // Get truck
    const truck = await db.truck.findUnique({
      where: { id: truckId },
      include: {
        gpsDevice: true,
      },
    });

    if (!truck) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    // Validation: Truck type must match
    if (truck.truckType !== load.truckType) {
      return NextResponse.json(
        { error: "Truck type does not match load requirement" },
        { status: 400 }
      );
    }

    // Validation: Truck must have GPS device
    if (!truck.gpsDeviceId) {
      return NextResponse.json(
        { error: "Truck must have a GPS device assigned" },
        { status: 400 }
      );
    }

    // If self-dispatch, check if user owns the truck
    if (!hasOpsPermission) {
      const user = await db.user.findUnique({
        where: { id: session.userId },
        select: { organizationId: true },
      });

      if (user?.organizationId !== truck.carrierId) {
        return NextResponse.json(
          { error: "You can only dispatch with your own trucks" },
          { status: 403 }
        );
      }
    }

    // Check if truck is already assigned to another load (unique constraint on assignedTruckId)
    const existingAssignment = await db.load.findFirst({
      where: {
        assignedTruckId: truckId,
      },
      select: {
        id: true,
        status: true,
        pickupCity: true,
        deliveryCity: true,
      },
    });

    if (existingAssignment) {
      // If the existing load is completed/delivered/cancelled, unassign it first
      const inactiveStatuses = ['DELIVERED', 'COMPLETED', 'CANCELLED', 'EXPIRED'];
      if (!inactiveStatuses.includes(existingAssignment.status)) {
        return NextResponse.json(
          {
            error: `This truck is already assigned to an active load (${existingAssignment.pickupCity} → ${existingAssignment.deliveryCity})`,
            existingLoadId: existingAssignment.id,
            existingLoadStatus: existingAssignment.status,
          },
          { status: 400 }
        );
      }
    }

    // TD-001 FIX: Wrap all mutations in a transaction for atomicity
    const updatedLoad = await db.$transaction(async (tx) => {
      // Clear old assignment if exists
      if (existingAssignment) {
        await tx.load.update({
          where: { id: existingAssignment.id },
          data: { assignedTruckId: null },
        });
      }

      // Assign truck to load
      const updated = await tx.load.update({
        where: { id: loadId },
        data: {
          assignedTruckId: truckId,
          assignedAt: new Date(),
          status: "ASSIGNED",
        },
      });

      // Create load event
      await tx.loadEvent.create({
        data: {
          loadId,
          eventType: "ASSIGNED",
          description: `Load assigned to truck ${truck.licensePlate}`,
          userId: session.userId,
          metadata: {
            truckId,
            licensePlate: truck.licensePlate,
          },
        },
      });

      return updated;
    });

    // TD-005 FIX: Invalidate cache after assignment
    await CacheInvalidation.load(loadId, load.shipperId);
    await CacheInvalidation.truck(truckId, truck.carrierId);

    return NextResponse.json({
      message: "Load dispatched successfully",
      load: updatedLoad,
    });
  // FIX: Use unknown type with type guards
  } catch (error: unknown) {
    console.error("Dispatch error:", error);

    if (error instanceof z.ZodError) {
      return zodErrorResponse(error);
    }

    // Handle unique constraint violation (race condition) - Prisma error
    const prismaError = error as { code?: string; meta?: { target?: string[] } };
    if (prismaError?.code === 'P2002') {
      const field = prismaError?.meta?.target?.[0] || 'field';
      if (field === 'assignedTruckId') {
        return NextResponse.json(
          { error: 'This truck is already assigned to another load. Please refresh and try again.' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'A conflict occurred. Please refresh and try again.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
