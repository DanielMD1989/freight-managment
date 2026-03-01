/**
 * Load Details Page
 *
 * View single load details including service fee info
 * Sprint 11 - Story 11.3: Load Management
 */

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";

interface LoadDetailsProps {
  params: Promise<{ id: string }>;
}

/**
 * Load Details Page
 */
export default async function LoadDetailsPage({ params }: LoadDetailsProps) {
  const { id } = await params;

  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect(`/login?redirect=/shipper/loads/${id}`);
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== "SHIPPER" && session.role !== "ADMIN")) {
    redirect("/unauthorized");
  }

  // Fetch load with related data
  const load = await db.load.findUnique({
    where: { id },
    include: {
      shipper: {
        select: {
          id: true,
          name: true,
        },
      },
      corridor: {
        select: {
          id: true,
          name: true,
          distanceKm: true,
          pricePerKm: true,
          originRegion: true,
          destinationRegion: true,
        },
      },
      assignedTruck: {
        include: {
          carrier: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      events: {
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      },
    },
  });

  if (!load) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
          <h1 className="mb-2 text-2xl font-bold text-red-900">
            Load Not Found
          </h1>
          <p className="mb-4 text-red-700">
            The load you are looking for does not exist or has been deleted.
          </p>
          <Link href="/shipper/loads" className="text-blue-600 hover:underline">
            ← Back to My Loads
          </Link>
        </div>
      </div>
    );
  }

  // Check if user owns this load
  if (load.shipperId !== session.organizationId && session.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ET", {
      style: "currency",
      currency: "ETB",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(date));
  };

  // Status colors from StatusBadge.tsx (source of truth)
  const getStatusColor = (status: string) => {
    switch (status) {
      case "POSTED":
        return "bg-blue-500/10 text-blue-600";
      case "ASSIGNED":
        return "bg-amber-500/10 text-amber-600";
      case "IN_TRANSIT":
        return "bg-indigo-500/10 text-indigo-600";
      case "DELIVERED":
        return "bg-emerald-500/10 text-emerald-600";
      case "CANCELLED":
        return "bg-rose-500/10 text-rose-600";
      case "DRAFT":
        return "bg-slate-500/10 text-slate-600";
      default:
        return "bg-slate-500/10 text-slate-600";
    }
  };

  // Service fee status colors (consistent with StatusBadge.tsx pattern)
  const getServiceFeeStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-amber-500/10 text-amber-600";
      case "RESERVED":
        return "bg-indigo-500/10 text-indigo-600";
      case "DEDUCTED":
        return "bg-emerald-500/10 text-emerald-600";
      case "REFUNDED":
        return "bg-blue-500/10 text-blue-600";
      default:
        return "bg-slate-500/10 text-slate-600";
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/shipper/loads"
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to My Loads
        </Link>
      </div>

      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {load.pickupCity} → {load.deliveryCity}
          </h1>
          <p className="mt-2 text-gray-600">
            Load ID: {load.id.slice(0, 8)}...
          </p>
        </div>
        <span
          className={`rounded-full px-4 py-2 text-sm font-medium ${getStatusColor(load.status)}`}
        >
          {load.status}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Details */}
        <div className="space-y-6 lg:col-span-2">
          {/* Route Details */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Route Details
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Pickup</div>
                <div className="font-medium">{load.pickupCity}</div>
                {load.pickupAddress && (
                  <div className="text-sm text-gray-500">
                    {load.pickupAddress}
                  </div>
                )}
              </div>
              <div>
                <div className="text-sm text-gray-600">Delivery</div>
                <div className="font-medium">{load.deliveryCity}</div>
                {load.deliveryAddress && (
                  <div className="text-sm text-gray-500">
                    {load.deliveryAddress}
                  </div>
                )}
              </div>
              <div>
                <div className="text-sm text-gray-600">Pickup Date</div>
                <div className="font-medium">{formatDate(load.pickupDate)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Delivery Date</div>
                <div className="font-medium">
                  {formatDate(load.deliveryDate)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Distance</div>
                <div className="font-medium">
                  {load.tripKm ? `${Number(load.tripKm).toFixed(0)} km` : "N/A"}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Truck Type</div>
                <div className="font-medium">{load.truckType}</div>
              </div>
            </div>
          </div>

          {/* Cargo Details */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Cargo Details
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Weight</div>
                <div className="font-medium">
                  {Number(load.weight).toLocaleString()} kg
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Load Type</div>
                <div className="font-medium">{load.fullPartial}</div>
              </div>
              {load.cargoDescription && (
                <div className="col-span-2">
                  <div className="text-sm text-gray-600">Description</div>
                  <div className="font-medium">{load.cargoDescription}</div>
                </div>
              )}
              {load.specialInstructions && (
                <div className="col-span-2">
                  <div className="text-sm text-gray-600">
                    Special Instructions
                  </div>
                  <div className="font-medium">{load.specialInstructions}</div>
                </div>
              )}
            </div>
          </div>

          {/* Assigned Truck */}
          {load.assignedTruck && (
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-semibold text-gray-900">
                Assigned Truck
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Carrier</div>
                  <div className="font-medium">
                    {load.assignedTruck.carrier?.name || "Unknown"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Plate Number</div>
                  <div className="font-medium">
                    {load.assignedTruck.licensePlate}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Truck Type</div>
                  <div className="font-medium">
                    {load.assignedTruck.truckType}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Capacity</div>
                  <div className="font-medium">
                    {Number(load.assignedTruck.capacity).toLocaleString()} kg
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Events Timeline */}
          {load.events.length > 0 && (
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-semibold text-gray-900">
                Activity Timeline
              </h2>
              <div className="space-y-4">
                {load.events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-4 border-b border-gray-100 pb-4 last:border-0"
                  >
                    <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                    <div>
                      <div className="font-medium text-gray-900">
                        {event.eventType}
                      </div>
                      {event.description && (
                        <div className="text-sm text-gray-600">
                          {event.description}
                        </div>
                      )}
                      <div className="mt-1 text-xs text-gray-400">
                        {formatDate(event.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Service Fee */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Service Fee
            </h2>
            {load.corridor ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Status</span>
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium ${getServiceFeeStatusColor(load.serviceFeeStatus)}`}
                  >
                    {load.serviceFeeStatus || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount</span>
                  <span className="text-lg font-bold">
                    {formatCurrency(Number(load.serviceFeeEtb || 0))}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <div className="mb-2 text-sm text-gray-600">Corridor</div>
                  <div className="font-medium">{load.corridor.name}</div>
                  <div className="text-sm text-gray-500">
                    {load.corridor.originRegion} →{" "}
                    {load.corridor.destinationRegion}
                  </div>
                  <div className="mt-1 text-sm text-gray-500">
                    {Number(load.corridor.distanceKm)} km @{" "}
                    {Number(load.corridor.pricePerKm)} ETB/km
                  </div>
                </div>
                {load.serviceFeeReservedAt && (
                  <div className="text-xs text-gray-400">
                    Reserved: {formatDate(load.serviceFeeReservedAt)}
                  </div>
                )}
                {load.serviceFeeDeductedAt && (
                  <div className="text-xs text-gray-400">
                    Deducted: {formatDate(load.serviceFeeDeductedAt)}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                No corridor assigned. Service fee will be calculated when the
                load matches a configured corridor.
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Dates</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Created</span>
                <span>{formatDate(load.createdAt)}</span>
              </div>
              {load.postedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Posted</span>
                  <span>{formatDate(load.postedAt)}</span>
                </div>
              )}
              {load.assignedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Assigned</span>
                  <span>{formatDate(load.assignedAt)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Updated</span>
                <span>{formatDate(load.updatedAt)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Actions
            </h2>
            <div className="space-y-3">
              {load.status === "POSTED" && (
                <Link
                  href={`/shipper/loadboard?tab=SEARCH_TRUCKS&origin=${encodeURIComponent(load.pickupCity || "")}&destination=${encodeURIComponent(load.deliveryCity || "")}`}
                  className="block w-full rounded-lg bg-blue-600 px-4 py-2 text-center text-white transition-colors hover:bg-blue-700"
                >
                  Find Trucks
                </Link>
              )}
              {(load.status === "DRAFT" || load.status === "POSTED") && (
                <Link
                  href={`/shipper/loads/${load.id}/edit`}
                  className="block w-full rounded-lg bg-gray-100 px-4 py-2 text-center text-gray-700 transition-colors hover:bg-gray-200"
                >
                  Edit Load
                </Link>
              )}
              <Link
                href="/shipper/loads"
                className="block w-full rounded-lg border border-gray-300 px-4 py-2 text-center text-gray-700 transition-colors hover:bg-gray-50"
              >
                Back to List
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
