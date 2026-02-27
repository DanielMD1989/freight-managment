/**
 * Shipper Requests Page
 *
 * Phase 2 - Story 16.15: Shipper-Led Truck Matching
 * Task 16.15.4: Booking History
 *
 * View and manage:
 * - Truck requests (outgoing - shipper requested trucks)
 * - Load requests (incoming - carriers requesting shipper's loads)
 */

import { Suspense } from "react";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import RequestsTabs from "./RequestsTabs";

async function getTruckRequests(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });

  if (!user?.organizationId) {
    return [];
  }

  const requests = await db.truckRequest.findMany({
    where: {
      shipperId: user.organizationId,
    },
    include: {
      load: {
        include: {
          pickupLocation: true,
          deliveryLocation: true,
        },
      },
      truck: {
        include: {
          carrier: {
            select: {
              id: true,
              name: true,
              isVerified: true,
            },
          },
        },
      },
      requestedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return requests;
}

async function getLoadRequests(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });

  if (!user?.organizationId) {
    return [];
  }

  // Get incoming load requests from carriers for this shipper's loads
  const requests = await db.loadRequest.findMany({
    where: {
      load: {
        shipperId: user.organizationId,
      },
    },
    include: {
      load: {
        include: {
          pickupLocation: true,
          deliveryLocation: true,
        },
      },
      truck: {
        include: {
          carrier: {
            select: {
              id: true,
              name: true,
              isVerified: true,
            },
          },
        },
      },
      requestedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return requests;
}

export default async function ShipperRequestsPage() {
  const session = await requireAuth();

  if (session.role !== "SHIPPER") {
    redirect("/shipper");
  }

  // Fetch both types of requests in parallel
  const [truckRequests, loadRequests] = await Promise.all([
    getTruckRequests(session.userId),
    getLoadRequests(session.userId),
  ]);

  // Transform truck requests (outgoing - shipper requested trucks)
  const transformedTruckRequests = truckRequests.map((req) => ({
    id: req.id,
    status: req.status,
    notes: req.notes,
    offeredRate: req.offeredRate ? Number(req.offeredRate) : null,
    expiresAt: req.expiresAt.toISOString(),
    createdAt: req.createdAt.toISOString(),
    respondedAt: req.respondedAt?.toISOString() || null,
    load: {
      id: req.load.id,
      referenceNumber: `LOAD-${req.load.id.slice(-8).toUpperCase()}`,
      status: req.load.status,
      weight: Number(req.load.weight),
      truckType: req.load.truckType,
      // Use location relation name OR direct city string field as fallback
      pickupCity:
        req.load.pickupLocation?.name || req.load.pickupCity || "Unknown",
      deliveryCity:
        req.load.deliveryLocation?.name || req.load.deliveryCity || "Unknown",
      pickupDate: req.load.pickupDate.toISOString(),
    },
    truck: {
      id: req.truck.id,
      plateNumber: req.truck.licensePlate,
      truckType: req.truck.truckType,
      capacity: Number(req.truck.capacity),
      carrier: req.truck.carrier,
    },
    requestedBy: req.requestedBy
      ? {
          id: req.requestedBy.id,
          name: [req.requestedBy.firstName, req.requestedBy.lastName]
            .filter(Boolean)
            .join(" "),
        }
      : null,
  }));

  // Transform load requests (incoming - carriers requesting shipper's loads)
  const transformedLoadRequests = loadRequests.map((req) => ({
    id: req.id,
    status: req.status,
    notes: req.notes,
    proposedRate: req.proposedRate ? Number(req.proposedRate) : null,
    expiresAt: req.expiresAt.toISOString(),
    createdAt: req.createdAt.toISOString(),
    respondedAt: req.respondedAt?.toISOString() || null,
    load: {
      id: req.load.id,
      referenceNumber: `LOAD-${req.load.id.slice(-8).toUpperCase()}`,
      status: req.load.status,
      weight: Number(req.load.weight),
      truckType: req.load.truckType,
      // Use location relation name OR direct city string field as fallback
      pickupCity:
        req.load.pickupLocation?.name || req.load.pickupCity || "Unknown",
      deliveryCity:
        req.load.deliveryLocation?.name || req.load.deliveryCity || "Unknown",
      pickupDate: req.load.pickupDate.toISOString(),
    },
    truck: {
      id: req.truck.id,
      plateNumber: req.truck.licensePlate,
      truckType: req.truck.truckType,
      capacity: Number(req.truck.capacity),
    },
    carrier: req.truck.carrier,
    requestedBy: req.requestedBy
      ? {
          id: req.requestedBy.id,
          name: [req.requestedBy.firstName, req.requestedBy.lastName]
            .filter(Boolean)
            .join(" "),
          email: req.requestedBy.email,
        }
      : null,
  }));

  const pendingLoadRequests = transformedLoadRequests.filter(
    (r) => r.status === "PENDING"
  ).length;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Requests
        </h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Manage truck booking requests and carrier load requests
        </p>
      </div>

      <Suspense fallback={<RequestsSkeleton />}>
        <RequestsTabs
          truckRequests={transformedTruckRequests}
          loadRequests={transformedLoadRequests}
          pendingLoadRequests={pendingLoadRequests}
        />
      </Suspense>
    </div>
  );
}

function RequestsSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-12 w-1/3 rounded bg-gray-200 dark:bg-gray-700"></div>
      <div className="h-64 rounded bg-gray-200 dark:bg-gray-700"></div>
    </div>
  );
}
