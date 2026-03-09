/**
 * Admin Trip Detail Page
 *
 * View and manage individual trip details, including exception resolution.
 */

import Link from "next/link";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import AdminTripDetailClient from "./AdminTripDetailClient";

export interface TripDetail {
  id: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  exceptionAt: string | null;
  shipperServiceFee: number | null;
  carrierServiceFee: number | null;
  shipperFeeStatus: string;
  carrierFeeStatus: string;
  load: {
    id: string;
    status: string;
    pickupCity: string;
    deliveryCity: string;
    shipper: { id: string; name: string } | null;
  } | null;
  carrier: { id: string; name: string } | null;
  truck: { id: string; licensePlate: string } | null;
}

async function getTrip(tripId: string): Promise<{ trip: TripDetail } | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session");

    if (!sessionCookie) return null;

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

    const response = await fetch(`${baseUrl}/api/trips/${tripId}`, {
      headers: { Cookie: `session=${sessionCookie.value}` },
      cache: "no-store",
    });

    if (response.status === 404) return null;
    if (!response.ok) return null;

    return await response.json();
  } catch {
    return null;
  }
}

export default async function AdminTripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/admin/trips");
  }

  const session = await verifyToken(sessionCookie.value);

  if (
    !session ||
    (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")
  ) {
    redirect("/unauthorized");
  }

  const { id } = await params;
  const data = await getTrip(id);

  if (!data) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
          <Link href="/admin/trips" className="hover:text-blue-600">
            Trips
          </Link>
          <span>/</span>
          <span className="font-mono">{data.trip.id.slice(0, 8)}...</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Trip Details</h1>
        <p className="mt-2 text-gray-600">View and manage trip status</p>
      </div>

      <AdminTripDetailClient trip={data.trip} />
    </div>
  );
}
