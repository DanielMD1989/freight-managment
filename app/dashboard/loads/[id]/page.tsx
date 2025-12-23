"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatAge } from "@/lib/loadUtils";

interface LoadEvent {
  id: string;
  eventType: string;
  createdAt: string;
  metadata?: any;
}

interface Load {
  id: string;
  pickupCity: string;
  deliveryCity: string;
  pickupDate: string;
  deliveryDate: string;
  pickupDockHours?: string;
  deliveryDockHours?: string;
  appointmentRequired: boolean;
  truckType: string;
  weight?: number;
  cargoDescription: string;
  rate: number;
  isFullLoad: boolean;
  safetyNotes?: string;
  isAnonymous: boolean;
  status: string;
  createdAt: string;
  postedAt?: string;
  // [NEW] Logistics & Distance
  tripKm?: number;
  dhToOriginKm?: number;
  dhAfterDeliveryKm?: number;
  // [NEW] Load Details
  fullPartial?: string;
  bookMode?: string;
  lengthM?: number;
  casesCount?: number;
  // [NEW] Market Pricing
  dtpReference?: string;
  factorRating?: string;
  // [NEW] Contact
  shipperContactName?: string;
  shipperContactPhone?: string;
  // [NEW] Computed
  ageMinutes?: number;
  rpmEtbPerKm?: number;
  trpmEtbPerKm?: number;
  shipper?: {
    id: string;
    name: string;
    verificationType?: string;
  };
  truck?: {
    id: string;
    licensePlate: string;
    carrier: {
      name: string;
    };
  };
  events?: LoadEvent[];
}

export default function LoadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [load, setLoad] = useState<Load | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchLoad();
    }
  }, [params.id]);

  const fetchLoad = async () => {
    try {
      const response = await fetch(`/api/loads/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setLoad(data);
      } else {
        alert("Load not found");
        router.push("/dashboard/loads");
      }
    } catch (error) {
      console.error("Failed to fetch load:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!confirm(`Change status to ${newStatus}?`)) return;

    try {
      const response = await fetch(`/api/loads/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchLoad(); // Refresh
      } else {
        const data = await response.json();
        alert(data.error || "Failed to update status");
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("Failed to update status");
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      DRAFT: "bg-gray-100 text-gray-800",
      POSTED: "bg-blue-100 text-blue-800",
      ASSIGNED: "bg-yellow-100 text-yellow-800",
      IN_TRANSIT: "bg-purple-100 text-purple-800",
      DELIVERED: "bg-green-100 text-green-800",
      CANCELLED: "bg-red-100 text-red-800",
    };
    return badges[status] || "bg-gray-100 text-gray-800";
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!load) {
    return <div className="text-center py-12">Load not found</div>;
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/loads"
            className="mb-2 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back to My Loads
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            {load.pickupCity} → {load.deliveryCity}
          </h1>
        </div>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getStatusBadge(
            load.status
          )}`}
        >
          {load.status}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Route Information */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Route Information
            </h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Origin</dt>
                <dd className="mt-1 text-sm text-gray-900">{load.pickupCity}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Destination
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {load.deliveryCity}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Pickup Date
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(load.pickupDate).toLocaleDateString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Delivery Date
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(load.deliveryDate).toLocaleDateString()}
                </dd>
              </div>
              {load.pickupDockHours && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Pickup Dock Hours
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {load.pickupDockHours}
                  </dd>
                </div>
              )}
              {load.deliveryDockHours && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Delivery Dock Hours
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {load.deliveryDockHours}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Appointment Required
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {load.appointmentRequired ? "Yes" : "No"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Logistics & Distance */}
          {(load.tripKm || load.dhToOriginKm || load.dhAfterDeliveryKm) && (
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Logistics &amp; Distance
              </h2>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {load.tripKm && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Trip Distance
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {load.tripKm} km
                    </dd>
                  </div>
                )}
                {load.dhToOriginKm && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Deadhead to Origin
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {load.dhToOriginKm} km
                    </dd>
                  </div>
                )}
                {load.dhAfterDeliveryKm && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Deadhead after Delivery
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {load.dhAfterDeliveryKm} km
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Pricing Metrics */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Pricing Metrics
            </h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Rate</dt>
                <dd className="mt-1 text-lg font-semibold text-gray-900">
                  ETB {load.rate.toLocaleString()}
                </dd>
              </div>
              {load.ageMinutes !== undefined && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Age</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {formatAge(load.ageMinutes)}
                  </dd>
                </div>
              )}
              {load.rpmEtbPerKm && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    RPM (Rate per km)
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {load.rpmEtbPerKm} ETB/km
                  </dd>
                </div>
              )}
              {load.trpmEtbPerKm && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    tRPM (Total rate per km)
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {load.trpmEtbPerKm} ETB/km
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Load Details */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Load Details
            </h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Truck Type
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {load.truckType.replace(/_/g, " ")}
                </dd>
              </div>
              {load.weight && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Weight</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {load.weight.toLocaleString()} kg
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500">Load Type</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {load.fullPartial || (load.isFullLoad ? "FULL" : "PARTIAL")}
                </dd>
              </div>
              {load.bookMode && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Booking Mode
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {load.bookMode}
                  </dd>
                </div>
              )}
              {load.lengthM && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Cargo Length
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {load.lengthM} meters
                  </dd>
                </div>
              )}
              {load.casesCount && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Cases/Pallets
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {load.casesCount}
                  </dd>
                </div>
              )}
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">
                  Cargo Description
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {load.cargoDescription}
                </dd>
              </div>
              {load.safetyNotes && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">
                    Safety Notes
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {load.safetyNotes}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Market Pricing */}
          {(load.dtpReference || load.factorRating) && (
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Market Pricing
              </h2>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {load.dtpReference && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      DTP Reference
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {load.dtpReference}
                    </dd>
                  </div>
                )}
                {load.factorRating && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Factor Rating
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {load.factorRating}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Contact Information */}
          {(load.shipperContactName || load.shipperContactPhone) && (
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Contact Information
              </h2>
              <p className="mb-4 text-sm text-gray-600">
                Contact details are visible because the load is assigned.
              </p>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {load.shipperContactName && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Contact Name
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {load.shipperContactName}
                    </dd>
                  </div>
                )}
                {load.shipperContactPhone && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Contact Phone
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {load.shipperContactPhone}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Assignment Info */}
          {load.truck && (
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Assignment
              </h2>
              <dl className="grid grid-cols-1 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Carrier
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {load.truck.carrier.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Truck</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {load.truck.licensePlate}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Event Timeline */}
          {load.events && load.events.length > 0 && (
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Timeline
              </h2>
              <div className="flow-root">
                <ul className="-mb-8">
                  {load.events.map((event, idx) => (
                    <li key={event.id}>
                      <div className="relative pb-8">
                        {idx !== load.events!.length - 1 && (
                          <span
                            className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
                            aria-hidden="true"
                          />
                        )}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 ring-8 ring-white">
                              <span className="text-xs text-white">
                                {idx + 1}
                              </span>
                            </span>
                          </div>
                          <div className="flex min-w-0 flex-1 justify-between space-x-4">
                            <div>
                              <p className="text-sm text-gray-900">
                                {event.eventType}
                              </p>
                            </div>
                            <div className="whitespace-nowrap text-right text-sm text-gray-500">
                              {new Date(event.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              Actions
            </h3>
            <div className="space-y-2">
              {(load.status === "DRAFT" || load.status === "POSTED") && (
                <Link
                  href={`/dashboard/loads/${load.id}/edit`}
                  className="block w-full rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                >
                  Edit Load
                </Link>
              )}
              {load.status === "DRAFT" && (
                <button
                  onClick={() => updateStatus("POSTED")}
                  className="block w-full rounded-md border border-blue-600 px-3 py-2 text-center text-sm font-semibold text-blue-600 hover:bg-blue-50"
                >
                  Post Load
                </button>
              )}
              {load.status === "POSTED" && (
                <button
                  onClick={() => updateStatus("UNPOSTED")}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Unpost Load
                </button>
              )}
            </div>
          </div>

          {/* Shipper Info */}
          {!load.isAnonymous && load.shipper && (
            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="mb-2 text-sm font-semibold text-gray-900">
                Shipper
              </h3>
              <p className="text-sm text-gray-900">{load.shipper.name}</p>
              {load.shipper.verificationType === "VERIFIED" && (
                <span className="mt-2 inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                  ✓ Verified
                </span>
              )}
            </div>
          )}

          {/* Metadata */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-2 text-sm font-semibold text-gray-900">
              Details
            </h3>
            <dl className="space-y-2">
              <div>
                <dt className="text-xs text-gray-500">Created</dt>
                <dd className="text-sm text-gray-900">
                  {new Date(load.createdAt).toLocaleDateString()}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Privacy</dt>
                <dd className="text-sm text-gray-900">
                  {load.isAnonymous ? "Anonymous" : "Public"}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
