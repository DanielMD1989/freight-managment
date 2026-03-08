/**
 * Shipper Route History Page
 *
 * Displays the full route from pickup to delivery after trip completion.
 * Blueprint v1.2: "After completion, Shipper can view full route from pickup to delivery"
 *
 * GET /api/gps/history?loadId= is fetched client-side on mount.
 */

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import RouteHistoryClient from "./RouteHistoryClient";

interface RouteHistoryPageProps {
  params: Promise<{ id: string }>;
}

export default async function ShipperRouteHistoryPage({
  params,
}: RouteHistoryPageProps) {
  const { id } = await params;

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect(`/login?redirect=/shipper/loads/${id}/route-history`);
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
        select: { id: true, completedAt: true },
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
          <Link href="/shipper/loads" className="text-blue-600 hover:underline">
            ← Back to My Loads
          </Link>
        </div>
      </div>
    );
  }

  if (load.shipperId !== session.organizationId) {
    redirect("/unauthorized");
  }

  // Route history only available after trip completion
  if (load.status !== "COMPLETED") {
    redirect(`/shipper/loads/${id}`);
  }

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "N/A";
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(date));
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <Link
          href={`/shipper/loads/${id}`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to Load Details
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Route History: {load.pickupCity} → {load.deliveryCity}
        </h1>
        {load.assignedTruck && (
          <p className="mt-1 text-gray-600">
            Truck: {load.assignedTruck.licensePlate} (
            {load.assignedTruck.truckType})
          </p>
        )}
        {load.trip?.completedAt && (
          <p className="mt-1 text-sm text-gray-500">
            Completed: {formatDate(load.trip.completedAt)}
          </p>
        )}
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <RouteHistoryClient loadId={id} />
      </div>
    </div>
  );
}
