"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Truck {
  id: string;
  licensePlate: string;
  truckType: string;
  capacity: number;
  currentLocation?: string;
  availabilityStatus: string;
  gpsDeviceId?: string;
  gpsDevice?: {
    imei: string;
    status: string;
  };
  carrier: {
    name: string;
  };
}

export default function TruckDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [truck, setTruck] = useState<Truck | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    currentLocation: "",
    availabilityStatus: "AVAILABLE",
  });

  useEffect(() => {
    if (params.id) {
      fetchTruck();
    }
  }, [params.id]);

  const fetchTruck = async () => {
    try {
      const response = await fetch(`/api/trucks?id=${params.id}`);
      if (response.ok) {
        const data = await response.json();
        const foundTruck = data.trucks?.[0];
        if (foundTruck) {
          setTruck(foundTruck);
          setEditForm({
            currentLocation: foundTruck.currentLocation || "",
            availabilityStatus: foundTruck.availabilityStatus,
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch truck:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateTruck = async () => {
    try {
      const response = await fetch(`/api/trucks/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      if (response.ok) {
        setEditing(false);
        fetchTruck();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to update truck");
      }
    } catch (error) {
      console.error("Failed to update truck:", error);
      alert("Failed to update truck");
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      AVAILABLE: "bg-green-100 text-green-800",
      IN_USE: "bg-yellow-100 text-yellow-800",
      MAINTENANCE: "bg-red-100 text-red-800",
      OFFLINE: "bg-gray-100 text-gray-800",
    };
    return badges[status] || "bg-gray-100 text-gray-800";
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!truck) {
    return <div className="text-center py-12">Truck not found</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/dashboard/trucks"
          className="mb-2 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to My Fleet
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {truck.licensePlate}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {truck.truckType.replace(/_/g, " ")}
            </p>
          </div>
          <span
            className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getStatusBadge(
              truck.availabilityStatus
            )}`}
          >
            {truck.availabilityStatus}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Truck Information */}
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Truck Information
              </h2>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-500"
                >
                  Edit
                </button>
              )}
            </div>

            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Current Location
                  </label>
                  <input
                    type="text"
                    value={editForm.currentLocation}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        currentLocation: e.target.value,
                      })
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    placeholder="e.g., Addis Ababa"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Availability Status
                  </label>
                  <select
                    value={editForm.availabilityStatus}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        availabilityStatus: e.target.value,
                      })
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  >
                    <option value="AVAILABLE">Available</option>
                    <option value="IN_USE">In Use</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="OFFLINE">Offline</option>
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={updateTruck}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setEditForm({
                        currentLocation: truck.currentLocation || "",
                        availabilityStatus: truck.availabilityStatus,
                      });
                    }}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    License Plate
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {truck.licensePlate}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Truck Type
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {truck.truckType.replace(/_/g, " ")}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Capacity
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {truck.capacity.toLocaleString()} kg
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Current Location
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {truck.currentLocation || "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Carrier</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {truck.carrier.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusBadge(
                        truck.availabilityStatus
                      )}`}
                    >
                      {truck.availabilityStatus}
                    </span>
                  </dd>
                </div>
              </dl>
            )}
          </div>

          {/* GPS Device */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              GPS Device
            </h2>
            {truck.gpsDevice ? (
              <div>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">IMEI</dt>
                    <dd className="mt-1 text-sm font-mono text-gray-900">
                      {truck.gpsDevice.imei}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Status
                    </dt>
                    <dd className="mt-1">
                      <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                        {truck.gpsDevice.status}
                      </span>
                    </dd>
                  </div>
                </dl>
                <div className="mt-4">
                  <Link
                    href={`/dashboard/gps?truck=${truck.id}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-500"
                  >
                    View GPS Tracking →
                  </Link>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  No GPS device assigned to this truck yet. Assign a GPS device
                  to enable real-time tracking.
                </p>
                <p className="text-xs text-gray-500">
                  Contact admin to assign a GPS device.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              Quick Actions
            </h3>
            <div className="space-y-2">
              <Link
                href="/dashboard/loads/search"
                className="block w-full rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
              >
                Find Loads
              </Link>
              {truck.gpsDevice && (
                <Link
                  href={`/dashboard/gps?truck=${truck.id}`}
                  className="block w-full rounded-md border border-blue-600 px-3 py-2 text-center text-sm font-semibold text-blue-600 hover:bg-blue-50"
                >
                  View on Map
                </Link>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              Recent Activity
            </h3>
            <p className="text-sm text-gray-500">
              Activity tracking coming soon
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
