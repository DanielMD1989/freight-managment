/**
 * Trip API - Individual Trip Routes
 *
 * GET /api/trips/[tripId] - Get trip details
 * PATCH /api/trips/[tripId] - Update trip status
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { getAccessRoles } from "@/lib/rbac";
import { TripStatus, LoadStatus, Prisma } from "@prisma/client";
import {
  VALID_TRIP_TRANSITIONS,
  canRoleSetTripStatus,
  TripStatus as LocalTripStatus,
} from "@/lib/tripStateMachine";
import { z } from "zod";
// P1-002 FIX: Import CacheInvalidation for post-update cache clearing
import { CacheInvalidation } from "@/lib/cache";
import { handleApiError } from "@/lib/apiErrors";
import { refundServiceFee } from "@/lib/serviceFeeManagement";

const updateTripSchema = z.object({
  status: z
    .enum([
      "ASSIGNED",
      "PICKUP_PENDING",
      "IN_TRANSIT",
      "DELIVERED",
      "COMPLETED",
      "EXCEPTION",
      "CANCELLED",
    ])
    .optional(),
  // Receiver info (for DELIVERED status)
  receiverName: z.string().max(100).optional(),
  receiverPhone: z.string().max(20).optional(),
  deliveryNotes: z.string().max(500).optional(),
});

// Use canonical trip state machine (lib/tripStateMachine.ts)
// Cast to Record<string, string[]> for Prisma TripStatus compatibility
const validTransitions = VALID_TRIP_TRANSITIONS as Record<string, string[]>;

/**
 * GET /api/trips/[tripId]
 *
 * Get trip details with role-based access control
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const session = await requireActiveUser();
    const { tripId } = await params;

    const trip = await db.trip.findUnique({
      where: { id: tripId },
      include: {
        load: {
          select: {
            id: true,
            status: true,
            pickupCity: true,
            pickupAddress: true,
            pickupDate: true,
            deliveryCity: true,
            deliveryAddress: true,
            deliveryDate: true,
            cargoDescription: true,
            weight: true,
            truckType: true,
            podUrl: true,
            podSubmitted: true,
            podVerified: true,
          },
        },
        truck: {
          select: {
            id: true,
            licensePlate: true,
            truckType: true,
            contactName: true,
            contactPhone: true,
            currentLocationLat: true,
            currentLocationLon: true,
          },
        },
        carrier: {
          select: {
            id: true,
            name: true,
            contactPhone: true,
            isVerified: true,
          },
        },
        shipper: {
          select: {
            id: true,
            name: true,
            contactPhone: true,
          },
        },
        routeHistory: {
          select: {
            id: true,
            latitude: true,
            longitude: true,
            speed: true,
            heading: true,
            timestamp: true,
          },
          orderBy: { timestamp: "desc" },
          take: 100, // Latest 100 positions
        },
      },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Check permissions using centralized access helper
    const {
      isShipper,
      isCarrier: isCarrierView,
      isAdmin: isAdminView,
      isDispatcher,
    } = getAccessRoles(session, {
      shipperOrgId: trip.shipperId,
      carrierOrgId: trip.carrierId,
    });

    // Scope dispatcher access to their organization's trips
    const isScopedDispatcher =
      isDispatcher &&
      (trip.carrierId === session.organizationId ||
        trip.shipperId === session.organizationId);

    if (!isShipper && !isCarrierView && !isAdminView && !isScopedDispatcher) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // For shippers, only show carrier contact info and route when trip is IN_TRANSIT or later
    let responseTrip: typeof trip | Record<string, unknown> = trip;
    if (isShipper && trip.status === "ASSIGNED") {
      // Hide carrier contact and route history until pickup begins
      responseTrip = {
        ...trip,
        truck: { ...trip.truck, contactPhone: "(hidden)" },
        carrier: { ...trip.carrier, contactPhone: "(hidden)" },
        routeHistory: [], // Don't expose GPS data before trip starts
      };
    }

    return NextResponse.json({ trip: responseTrip });
  } catch (error) {
    return handleApiError(error, "Get trip error");
  }
}

/**
 * PATCH /api/trips/[tripId]
 *
 * Update trip status. Only carrier can update status.
 * Status transitions are validated.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    // Fix 2e: Consolidated CSRF with mobile bypass
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    // Fix 3g: Require ACTIVE user (not just authenticated)
    const session = await requireActiveUser();
    const { tripId } = await params;

    const body = await request.json();
    // Fix 4d: Use safeParse to avoid leaking schema details
    const parseResult = updateTripSchema.safeParse(body);
    if (!parseResult.success) {
      const { zodErrorResponse } = await import("@/lib/validation");
      return zodErrorResponse(parseResult.error);
    }
    const validatedData = parseResult.data;

    // Get current trip
    const trip = await db.trip.findUnique({
      where: { id: tripId },
      include: {
        load: true,
        truck: true,
      },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Check carrier ownership first — return 404 for non-owned trips
    if (
      session.role === "CARRIER" &&
      trip.carrierId !== session.organizationId
    ) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Carrier, admin, or dispatcher can update trip status
    const isCarrier =
      session.role === "CARRIER" && trip.carrierId === session.organizationId;
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
    // Dispatcher scoped to trips belonging to their org (carrier or shipper side)
    const isDispatcher =
      session.role === "DISPATCHER" &&
      (trip.carrierId === session.organizationId ||
        trip.shipperId === session.organizationId);

    if (!isCarrier && !isAdmin && !isDispatcher) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Build update data
    const updateData: Prisma.TripUpdateInput = {
      updatedAt: new Date(),
    };

    // Handle status update
    if (validatedData.status) {
      // Validate status transition
      const allowedTransitions = validTransitions[trip.status];
      if (!allowedTransitions.includes(validatedData.status)) {
        return NextResponse.json(
          {
            error: `Invalid status transition from ${trip.status} to ${validatedData.status}`,
            allowedTransitions,
          },
          { status: 400 }
        );
      }

      // M11 FIX: Check role-based permission for this status change
      if (
        !canRoleSetTripStatus(
          session.role,
          validatedData.status as LocalTripStatus
        )
      ) {
        return NextResponse.json(
          {
            error: `Role ${session.role} cannot set trip status to ${validatedData.status}`,
          },
          { status: 403 }
        );
      }

      // COMPLETED requires POD to be submitted (podVerified not required —
      // carrier can complete after upload; shipper can confirm via /confirm)
      if (validatedData.status === "COMPLETED") {
        if (!trip.load?.podSubmitted) {
          return NextResponse.json(
            {
              error: "POD must be uploaded before completing the trip",
              requiresPod: true,
            },
            { status: 400 }
          );
        }
      }

      updateData.status = validatedData.status;

      // Set timestamps based on status
      switch (validatedData.status) {
        case "PICKUP_PENDING":
          updateData.startedAt = new Date();
          break;
        case "IN_TRANSIT":
          updateData.pickedUpAt = new Date();
          break;
        case "DELIVERED":
          updateData.deliveredAt = new Date();
          // Add receiver info if provided
          if (validatedData.receiverName) {
            updateData.receiverName = validatedData.receiverName;
          }
          if (validatedData.receiverPhone) {
            updateData.receiverPhone = validatedData.receiverPhone;
          }
          if (validatedData.deliveryNotes) {
            updateData.deliveryNotes = validatedData.deliveryNotes;
          }
          break;
        case "COMPLETED":
          updateData.completedAt = new Date();
          updateData.trackingEnabled = false; // GPS stops on completion
          break;
        case "CANCELLED":
          updateData.cancelledAt = new Date();
          updateData.trackingEnabled = false;
          updateData.cancelledBy = session.userId; // mirrors cancel route for auditability
          break;
      }
    }

    // P1-002 FIX: Wrap trip update and load sync in single transaction
    // to ensure atomic status synchronization
    let updatedTrip;
    let loadSynced: boolean;
    try {
      ({ updatedTrip, loadSynced } = await db.$transaction(async (tx) => {
        // Update trip with optimistic concurrency control:
        // Include current status in WHERE clause so Prisma throws P2025
        // if another request changed the status between our read and write.
        const updatedTrip = await tx.trip.update({
          where: {
            id: tripId,
            status: trip.status, // Optimistic lock — fails if status changed concurrently
          },
          data: updateData,
          include: {
            load: {
              select: {
                id: true,
                status: true,
                pickupCity: true,
                pickupAddress: true,
                pickupDate: true,
                deliveryCity: true,
                deliveryAddress: true,
                deliveryDate: true,
                cargoDescription: true,
                weight: true,
                truckType: true,
                podUrl: true,
                podSubmitted: true,
                podVerified: true,
              },
            },
            truck: {
              select: {
                id: true,
                licensePlate: true,
                truckType: true,
                contactName: true,
                contactPhone: true,
              },
            },
            carrier: {
              select: {
                id: true,
                name: true,
                contactPhone: true,
                isVerified: true,
              },
            },
            shipper: {
              select: {
                id: true,
                name: true,
                contactPhone: true,
              },
            },
          },
        });

        // Sync trip status with load status (inside transaction)
        let loadSynced = false;
        if (validatedData.status) {
          if (validatedData.status === "CANCELLED") {
            // Blueprint §7: cancel reverts load to POSTED so shipper can find new carrier.
            // Also clears assignment fields — mirrors cancel route exactly.
            await tx.load.update({
              where: { id: trip.loadId },
              data: {
                status: LoadStatus.POSTED,
                assignedTruckId: null,
                assignedAt: null,
                postedAt: new Date(),
              },
            });
            loadSynced = true;
          } else {
            const loadStatus = mapTripStatusToLoadStatus(validatedData.status);
            if (loadStatus) {
              await tx.load.update({
                where: { id: trip.loadId },
                data: { status: loadStatus },
              });
              loadSynced = true;
            }
          }
        }

        // Create load event inside transaction
        await tx.loadEvent.create({
          data: {
            loadId: trip.loadId,
            eventType: "TRIP_STATUS_UPDATED",
            description: `Trip status changed to ${validatedData.status}`,
            userId: session.userId,
            metadata: {
              tripId,
              previousStatus: trip.status,
              newStatus: validatedData.status,
              loadStatusSynced: loadSynced,
            },
          },
        });

        // Restore truck availability on trip completion or cancellation
        if (
          validatedData.status === "COMPLETED" ||
          validatedData.status === "CANCELLED"
        ) {
          // Only restore availability if no other active trips exist for this truck
          const otherActiveTrips = await tx.trip.count({
            where: {
              truckId: trip.truckId,
              id: { not: tripId },
              status: { in: ["ASSIGNED", "PICKUP_PENDING", "IN_TRANSIT"] },
            },
          });
          if (otherActiveTrips === 0) {
            await tx.truck.update({
              where: { id: trip.truckId },
              data: { isAvailable: true },
            });
          }
          // Always revert MATCHED postings regardless
          await tx.truckPosting.updateMany({
            where: { truckId: trip.truckId, status: "MATCHED" },
            data: { status: "ACTIVE", updatedAt: new Date() },
          });
        }

        return { updatedTrip, loadSynced };
      }));
    } catch (error) {
      // P2025: "Record to update not found" — means another request changed
      // the trip status between our read and the transactional write
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return NextResponse.json(
          { error: "Trip status was modified concurrently. Please retry." },
          { status: 409 }
        );
      }
      throw error;
    }

    // Refund service fee if trip is CANCELLED after fees were already deducted.
    // refundServiceFee() owns its own $transaction — must be outside this route's tx.
    // Pattern mirrors BUG-R9-2 fix in loads/[id]/status/route.ts.
    if (validatedData.status === "CANCELLED") {
      const loadFeeStatus = await db.load.findUnique({
        where: { id: trip.loadId },
        select: { shipperFeeStatus: true },
      });
      if (loadFeeStatus?.shipperFeeStatus === "DEDUCTED") {
        try {
          await refundServiceFee(trip.loadId);
        } catch (refundError) {
          // Non-blocking: trip is already cancelled; ops team handles via audit log
          console.error("Refund failed after trip cancellation:", refundError);
        }
      }
    }

    // Cache invalidation MUST happen after transaction commits (not inside tx)
    // Reason: If tx rolls back, we don't want to invalidate cache for uncommitted data
    // This ensures cache consistency: only invalidate when data is durably written
    await CacheInvalidation.trip(tripId, trip.carrierId, trip.shipperId);
    if (loadSynced) {
      await CacheInvalidation.load(trip.loadId, trip.shipperId);
    }

    return NextResponse.json({
      message: "Trip updated successfully",
      trip: updatedTrip,
      loadSynced,
    });
  } catch (error) {
    return handleApiError(error, "Update trip error");
  }
}

// Map trip status to load status
function mapTripStatusToLoadStatus(tripStatus: TripStatus): LoadStatus | null {
  switch (tripStatus) {
    case "ASSIGNED":
      return LoadStatus.ASSIGNED;
    case "PICKUP_PENDING":
      return LoadStatus.PICKUP_PENDING;
    case "IN_TRANSIT":
      return LoadStatus.IN_TRANSIT;
    case "DELIVERED":
      return LoadStatus.DELIVERED;
    case "COMPLETED":
      return LoadStatus.COMPLETED;
    case "EXCEPTION":
      return LoadStatus.EXCEPTION;
    case "CANCELLED":
      return LoadStatus.CANCELLED;
    default:
      return null;
  }
}
