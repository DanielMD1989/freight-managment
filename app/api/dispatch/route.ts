import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requirePermission, Permission } from "@/lib/rbac";
import { z } from "zod";

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
        await requirePermission(Permission.DISPATCH_LOADS);
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

    // Validation: Shipper must have sufficient balance (MVP: simplified escrow)
    const shipperWallet = load.shipper.financialAccounts[0];
    if (!shipperWallet) {
      return NextResponse.json(
        { error: "Shipper wallet not found" },
        { status: 400 }
      );
    }

    const escrowAmount = load.rate; // Simplified: just the load rate
    if (parseFloat(shipperWallet.balance.toString()) < parseFloat(escrowAmount.toString())) {
      return NextResponse.json(
        { error: "Shipper has insufficient balance for escrow" },
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

    // Check if truck is already assigned to another active load
    const existingAssignment = await db.load.findFirst({
      where: {
        assignedTruckId: truckId,
        status: {
          in: ['ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT'],
        },
      },
      select: {
        id: true,
        referenceNumber: true,
        status: true,
      },
    });

    if (existingAssignment) {
      return NextResponse.json(
        {
          error: `This truck is already assigned to an active load (${existingAssignment.referenceNumber || existingAssignment.id.slice(-8)})`,
          existingLoadId: existingAssignment.id,
          existingLoadStatus: existingAssignment.status,
        },
        { status: 400 }
      );
    }

    // Assign truck to load
    const updatedLoad = await db.load.update({
      where: { id: loadId },
      data: {
        assignedTruckId: truckId,
        assignedAt: new Date(),
        status: "ASSIGNED",
        escrowFunded: true,
        escrowAmount,
      },
    });

    // Create load event
    await db.loadEvent.create({
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

    // Fund escrow (simplified for MVP)
    await db.financialAccount.update({
      where: { id: shipperWallet.id },
      data: {
        balance: {
          decrement: escrowAmount,
        },
      },
    });

    return NextResponse.json({
      message: "Load dispatched successfully",
      load: updatedLoad,
    });
  } catch (error: any) {
    console.error("Dispatch error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    // Handle unique constraint violation (race condition)
    if (error?.code === 'P2002') {
      const field = error?.meta?.target?.[0] || 'field';
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
