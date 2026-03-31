/**
 * Shipper Live GPS Tracking Page
 *
 * Displays real-time truck location during an active trip (IN_TRANSIT only).
 * Blueprint v1.2: "Shipper can see truck's real-time location during active trip"
 *
 * GET /api/gps/live?loadId= is polled client-side every 30s.
 */

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import LiveTrackingClient from "./LiveTrackingClient";

interface TrackingPageProps {
  params: Promise<{ id: string }>;
}

export default async function ShipperTrackingPage({
  params,
}: TrackingPageProps) {
  const { id } = await params;

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect(`/login?redirect=/shipper/loads/${id}/tracking`);
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || session.role !== "SHIPPER") {
    redirect("/unauthorized");
  }

  const load = await db.load.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      shipperId: true,
      pickupCity: true,
      deliveryCity: true,
      assignedTruck: {
        select: {
          id: true,
          licensePlate: true,
          truckType: true,
        },
      },
      trip: {
        select: { id: true },
      },
    },
  });

  if (!load) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
          <h1 className="mb-2 text-2xl font-bold text-red-900">
            Load Not Found
          </h1>
          <Link
            href="/shipper/loadboard"
            className="text-blue-600 hover:underline"
          >
            ← Back to Loadboard
          </Link>
        </div>
      </div>
    );
  }

  if (load.shipperId !== session.organizationId) {
    redirect("/unauthorized");
  }

  // GPS tracking only available during IN_TRANSIT
  if (load.status !== "IN_TRANSIT") {
    redirect(`/shipper/loads/${id}`);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/shipper/loads/${id}`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to Load Details
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Live Tracking: {load.pickupCity} → {load.deliveryCity}
        </h1>
        {load.assignedTruck && (
          <p className="mt-1 text-gray-600">
            Truck: {load.assignedTruck.licensePlate} (
            {load.assignedTruck.truckType})
          </p>
        )}
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <LiveTrackingClient loadId={id} />
      </div>
    </div>
  );
}
