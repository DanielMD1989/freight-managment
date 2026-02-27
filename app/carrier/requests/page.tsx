/**
 * Carrier Requests Page
 *
 * Combined view for:
 * - Shipper Requests: Incoming truck booking requests from shippers
 * - My Load Requests: Outgoing load requests to shippers
 */

import { Suspense } from "react";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import RequestsTabs from "./RequestsTabs";

// Get incoming truck requests from shippers
async function getShipperRequests(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });

  if (!user?.organizationId) {
    return [];
  }

  const requests = await db.truckRequest.findMany({
    where: {
      carrierId: user.organizationId,
    },
    include: {
      load: {
        include: {
          pickupLocation: true,
          deliveryLocation: true,
          shipper: {
            select: {
              id: true,
              name: true,
              isVerified: true,
            },
          },
        },
      },
      truck: true,
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

// Get outgoing load requests to shippers
async function getLoadRequests(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });

  if (!user?.organizationId) {
    return [];
  }

  const requests = await db.loadRequest.findMany({
    where: {
      carrierId: user.organizationId,
    },
    include: {
      load: {
        select: {
          id: true,
          status: true,
          weight: true,
          truckType: true,
          pickupCity: true,
          deliveryCity: true,
          pickupDate: true,
          pickupLocation: {
            select: {
              name: true,
            },
          },
          deliveryLocation: {
            select: {
              name: true,
            },
          },
          shipper: {
            select: {
              id: true,
              name: true,
              isVerified: true,
            },
          },
        },
      },
      truck: {
        select: {
          id: true,
          licensePlate: true,
          truckType: true,
          capacity: true,
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

// Get match proposals from dispatchers
async function getMatchProposals(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });

  if (!user?.organizationId) {
    return [];
  }

  const proposals = await db.matchProposal.findMany({
    where: {
      carrierId: user.organizationId,
    },
    include: {
      load: {
        select: {
          id: true,
          status: true,
          weight: true,
          truckType: true,
          pickupCity: true,
          deliveryCity: true,
          pickupDate: true,
        },
      },
      truck: {
        select: {
          id: true,
          licensePlate: true,
          truckType: true,
          capacity: true,
        },
      },
      proposedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return proposals;
}

export default async function CarrierRequestsPage() {
  const session = await requireAuth();

  if (
    session.role !== "CARRIER" &&
    session.role !== "ADMIN" &&
    session.role !== "SUPER_ADMIN"
  ) {
    redirect("/carrier");
  }

  // Fetch all types of requests in parallel
  const [shipperRequests, loadRequests, matchProposals] = await Promise.all([
    getShipperRequests(session.userId),
    getLoadRequests(session.userId),
    getMatchProposals(session.userId),
  ]);

  // Transform shipper requests (incoming truck booking requests)
  const transformedShipperRequests = shipperRequests.map((req) => ({
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
      cargoType: req.load.cargoDescription || "General",
      pickupCity:
        req.load.pickupLocation?.name || req.load.pickupCity || "Unknown",
      deliveryCity:
        req.load.deliveryLocation?.name || req.load.deliveryCity || "Unknown",
      pickupDate: req.load.pickupDate.toISOString(),
      deliveryDate: req.load.deliveryDate.toISOString(),
      shipper: req.load.shipper,
    },
    truck: {
      id: req.truck.id,
      plateNumber: req.truck.licensePlate,
      truckType: req.truck.truckType,
      capacity: Number(req.truck.capacity),
    },
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

  // Transform load requests (outgoing requests to shippers)
  const transformedLoadRequests = loadRequests.map((req) => ({
    id: req.id,
    status: req.status,
    notes: req.notes,
    proposedRate: req.proposedRate ? Number(req.proposedRate) : null,
    responseNotes: req.responseNotes,
    expiresAt: req.expiresAt.toISOString(),
    createdAt: req.createdAt.toISOString(),
    respondedAt: req.respondedAt?.toISOString() || null,
    load: {
      id: req.load.id,
      referenceNumber: `LOAD-${req.load.id.slice(-8).toUpperCase()}`,
      status: req.load.status,
      weight: Number(req.load.weight),
      truckType: req.load.truckType,
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
    shipper: req.load.shipper || null,
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

  // Transform match proposals
  const transformedMatchProposals = matchProposals.map((proposal) => ({
    id: proposal.id,
    status: proposal.status,
    notes: proposal.notes,
    proposedRate: proposal.proposedRate ? Number(proposal.proposedRate) : null,
    expiresAt: proposal.expiresAt.toISOString(),
    createdAt: proposal.createdAt.toISOString(),
    respondedAt: proposal.respondedAt?.toISOString() || null,
    load: {
      id: proposal.load.id,
      pickupCity: proposal.load.pickupCity || "Unknown",
      deliveryCity: proposal.load.deliveryCity || "Unknown",
      pickupDate: proposal.load.pickupDate.toISOString(),
      weight: Number(proposal.load.weight),
      truckType: proposal.load.truckType,
      status: proposal.load.status,
    },
    truck: {
      id: proposal.truck.id,
      licensePlate: proposal.truck.licensePlate,
      truckType: proposal.truck.truckType,
      capacity: Number(proposal.truck.capacity),
    },
    proposedBy: proposal.proposedBy
      ? {
          name:
            [proposal.proposedBy.firstName, proposal.proposedBy.lastName]
              .filter(Boolean)
              .join(" ") || "Dispatcher",
        }
      : null,
  }));

  const pendingShipperRequests = transformedShipperRequests.filter(
    (r) => r.status === "PENDING"
  ).length;
  const pendingMatchProposals = transformedMatchProposals.filter(
    (p) => p.status === "PENDING"
  ).length;

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-md shadow-teal-500/25">
            <svg
              className="h-5 w-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Requests</h1>
            <p className="text-sm text-slate-500">
              Manage shipper booking requests and your load requests
            </p>
          </div>
        </div>
      </div>

      <Suspense fallback={<RequestsSkeleton />}>
        <RequestsTabs
          shipperRequests={transformedShipperRequests}
          loadRequests={transformedLoadRequests}
          matchProposals={transformedMatchProposals}
          pendingShipperRequests={pendingShipperRequests}
          pendingMatchProposals={pendingMatchProposals}
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
