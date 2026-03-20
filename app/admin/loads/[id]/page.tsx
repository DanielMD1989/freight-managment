/**
 * Admin Load Detail Page
 *
 * View and manage individual load details, including status actions.
 * G-M32-5: Admin load detail page (was dead link from loads list).
 */

import Link from "next/link";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import AdminLoadDetailClient from "./AdminLoadDetailClient";

export interface LoadDetail {
  id: string;
  status: string;
  pickupCity: string | null;
  deliveryCity: string | null;
  pickupDate: string | null;
  deliveryDate: string | null;
  truckType: string | null;
  weight: number | null;
  cargoDescription: string | null;
  actualTripKm: number | null;
  podSubmitted: boolean;
  podVerifiedAt: string | null;
  shipperServiceFee: number | null;
  carrierServiceFee: number | null;
  shipperFeeStatus: string;
  carrierFeeStatus: string;
  settlementStatus: string | null;
  settledAt: string | null;
  createdAt: string;
  shipper: {
    id: string;
    name: string;
    contactPhone: string | null;
    contactEmail: string | null;
  } | null;
  assignedTruck: {
    id: string;
    licensePlate: string;
    truckType: string;
    carrier: {
      id: string;
      name: string;
      contactPhone: string | null;
    } | null;
  } | null;
  trip: {
    id: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
    cancelledAt: string | null;
    deliveredAt: string | null;
    trackingEnabled: boolean;
    exceptionAt: string | null;
    reassignedAt: string | null;
    reassignmentReason: string | null;
    previousTruckId: string | null;
  } | null;
  corridor: {
    name: string;
    distanceKm: number;
  } | null;
  podDocument: {
    id: string;
    fileName: string | null;
  } | null;
}

export default async function AdminLoadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/admin/loads");
  }

  const session = await verifyToken(sessionCookie.value);

  if (
    !session ||
    (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")
  ) {
    redirect("/unauthorized");
  }

  const { id } = await params;

  const load = await db.load.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      pickupCity: true,
      deliveryCity: true,
      pickupDate: true,
      deliveryDate: true,
      truckType: true,
      weight: true,
      cargoDescription: true,
      actualTripKm: true,
      podSubmitted: true,
      podVerifiedAt: true,
      shipperServiceFee: true,
      carrierServiceFee: true,
      shipperFeeStatus: true,
      carrierFeeStatus: true,
      settlementStatus: true,
      settledAt: true,
      createdAt: true,
      shipper: {
        select: {
          id: true,
          name: true,
          contactPhone: true,
          contactEmail: true,
        },
      },
      assignedTruck: {
        select: {
          id: true,
          licensePlate: true,
          truckType: true,
          carrier: {
            select: {
              id: true,
              name: true,
              contactPhone: true,
            },
          },
        },
      },
      trip: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          completedAt: true,
          cancelledAt: true,
          deliveredAt: true,
          trackingEnabled: true,
          exceptionAt: true,
          reassignedAt: true,
          reassignmentReason: true,
          previousTruckId: true,
        },
      },
      corridor: {
        select: {
          name: true,
          distanceKm: true,
        },
      },
      documents: {
        where: { type: "POD" },
        select: { id: true, fileName: true },
        take: 1,
      },
    },
  });

  if (!load) {
    notFound();
  }

  // Serialize dates for client component
  const serialized: LoadDetail = {
    ...load,
    pickupDate: load.pickupDate?.toISOString() ?? null,
    deliveryDate: load.deliveryDate?.toISOString() ?? null,
    podVerifiedAt: load.podVerifiedAt?.toISOString() ?? null,
    settledAt: load.settledAt?.toISOString() ?? null,
    createdAt: load.createdAt.toISOString(),
    weight: load.weight ? Number(load.weight) : null,
    actualTripKm: load.actualTripKm ? Number(load.actualTripKm) : null,
    shipperServiceFee: load.shipperServiceFee
      ? Number(load.shipperServiceFee)
      : null,
    carrierServiceFee: load.carrierServiceFee
      ? Number(load.carrierServiceFee)
      : null,
    trip: load.trip
      ? {
          ...load.trip,
          createdAt: load.trip.createdAt.toISOString(),
          completedAt: load.trip.completedAt?.toISOString() ?? null,
          cancelledAt: load.trip.cancelledAt?.toISOString() ?? null,
          deliveredAt: load.trip.deliveredAt?.toISOString() ?? null,
          exceptionAt: load.trip.exceptionAt?.toISOString() ?? null,
          reassignedAt: load.trip.reassignedAt?.toISOString() ?? null,
        }
      : null,
    corridor: load.corridor
      ? {
          name: load.corridor.name,
          distanceKm: Number(load.corridor.distanceKm),
        }
      : null,
    podDocument: load.documents[0] ?? null,
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
          <Link href="/admin/loads" className="hover:text-blue-600">
            Loads
          </Link>
          <span>/</span>
          <span className="font-mono">{load.id.slice(0, 8)}...</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Load Details</h1>
        <p className="mt-2 text-gray-600">View and manage load status</p>
      </div>

      <AdminLoadDetailClient load={serialized} />
    </div>
  );
}
