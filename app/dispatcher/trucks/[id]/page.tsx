/**
 * Dispatcher Truck Detail Page
 *
 * Read-only truck detail view for dispatchers.
 * G-D7-3: Dispatcher full visibility per Blueprint §5.
 *
 * §7 B1 FIX: Fetches data via /api/trucks/[id] instead of direct DB access,
 * ensuring API-level data filtering (IMEI stripping for non-owners) is applied.
 */

import Link from "next/link";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";

const STATUS_COLORS: Record<string, string> = {
  APPROVED: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  REJECTED: "bg-red-100 text-red-700",
};

const POSTING_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  MATCHED: "bg-blue-100 text-blue-700",
  EXPIRED: "bg-slate-100 text-slate-600",
  CANCELLED: "bg-red-100 text-red-700",
};

export default async function DispatcherTruckDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/dispatcher/trucks");
  }

  const session = await verifyToken(sessionCookie.value);

  if (
    !session ||
    (session.role !== "DISPATCHER" &&
      session.role !== "ADMIN" &&
      session.role !== "SUPER_ADMIN")
  ) {
    redirect("/unauthorized");
  }

  const { id } = await params;

  // §7 B1 FIX: Fetch via API to apply data filtering (IMEI stripped for dispatchers).
  // Server components can fetch the internal API using localhost.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const apiResponse = await fetch(`${baseUrl}/api/trucks/${id}`, {
    headers: {
      Cookie: `session=${sessionCookie.value}`,
    },
    cache: "no-store",
  });

  if (!apiResponse.ok) {
    notFound();
  }

  const truck = await apiResponse.json();

  // Fetch active posting and trip separately (lightweight queries the API doesn't include)
  const [postings, trips] = await Promise.all([
    db.truckPosting.findMany({
      where: { truckId: id, status: { in: ["ACTIVE", "MATCHED"] } },
      select: { id: true, status: true },
      take: 1,
      orderBy: { createdAt: "desc" },
    }),
    db.trip.findMany({
      where: {
        truckId: id,
        status: {
          in: [
            "ASSIGNED",
            "PICKUP_PENDING",
            "IN_TRANSIT",
            "DELIVERED",
            "EXCEPTION",
          ],
        },
      },
      select: { id: true, status: true },
      take: 1,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const activePosting = postings[0] ?? null;
  const activeTrip = trips[0] ?? null;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-8">
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
          <Link href="/dispatcher/trucks" className="hover:text-blue-600">
            Trucks
          </Link>
          <span>/</span>
          <span className="font-mono">{truck.licensePlate}</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Truck Details</h1>
        <p className="mt-2 text-gray-600">
          Read-only view — dispatchers cannot modify truck registrations
        </p>
      </div>

      {/* Truck Info */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Truck Information
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">License Plate</p>
            <p className="font-mono font-medium">{truck.licensePlate}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Truck Type</p>
            <p className="font-medium">
              {truck.truckType?.replace(/_/g, " ") ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Capacity (tons)</p>
            <p className="font-medium">
              {truck.capacity ? Number(truck.capacity) : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Length (m)</p>
            <p className="font-medium">
              {truck.lengthM ? Number(truck.lengthM) : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Approval Status</p>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[truck.approvalStatus] ?? "bg-gray-100 text-gray-700"}`}
            >
              {truck.approvalStatus}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Availability</p>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${truck.isAvailable ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}
            >
              {truck.isAvailable ? "Available" : "Unavailable"}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Current Location</p>
            <p className="font-medium">
              {truck.currentCity ?? "Unknown"}
              {truck.currentRegion ? `, ${truck.currentRegion}` : ""}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">GPS Status</p>
            <p className="text-sm text-gray-600">
              {truck.gpsStatus ?? "No device registered"}
            </p>
          </div>
        </div>
      </div>

      {/* Carrier */}
      {truck.carrier && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Carrier Organization
          </h2>
          <p className="font-medium">{truck.carrier.name}</p>
          <p className="text-sm text-gray-500">ID: {truck.carrier.id}</p>
        </div>
      )}

      {/* Active Trip */}
      {activeTrip && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-blue-900">
            Active Trip
          </h2>
          <div className="flex items-center gap-3">
            <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
              {activeTrip.status.replace(/_/g, " ")}
            </span>
            <Link
              href={`/dispatcher/trips/${activeTrip.id}`}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              View Trip
            </Link>
          </div>
        </div>
      )}

      {/* Active Posting */}
      {activePosting && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-emerald-900">
            Active Posting
          </h2>
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${POSTING_COLORS[activePosting.status] ?? "bg-gray-100 text-gray-700"}`}
          >
            {activePosting.status}
          </span>
        </div>
      )}

      {/* Registered */}
      <div className="text-sm text-gray-500">
        Registered: {new Date(truck.createdAt).toLocaleDateString()}
      </div>
    </div>
  );
}
