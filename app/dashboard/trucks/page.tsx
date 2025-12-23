"use client";

import { useEffect, useState } from "react";
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
}

export default function MyTrucksPage() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTruckForm, setShowNewTruckForm] = useState(false);

  useEffect(() => {
    fetchTrucks();
  }, []);

  const fetchTrucks = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/trucks");
      if (response.ok) {
        const data = await response.json();
        setTrucks(data.trucks || []);
      }
    } catch (error) {
      console.error("Failed to fetch trucks:", error);
    } finally {
      setLoading(false);
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

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Fleet</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your trucks and their availability
          </p>
        </div>
        <button
          onClick={() => setShowNewTruckForm(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
        >
          + Add Truck
        </button>
      </div>

      {/* New Truck Form Modal */}
      {showNewTruckForm && (
        <NewTruckModal
          onClose={() => setShowNewTruckForm(false)}
          onSuccess={() => {
            setShowNewTruckForm(false);
            fetchTrucks();
          }}
        />
      )}

      {/* Trucks List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading...</p>
        </div>
      ) : trucks.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 mb-4">No trucks in your fleet yet</p>
          <button
            onClick={() => setShowNewTruckForm(true)}
            className="text-blue-600 hover:text-blue-500 font-medium"
          >
            Add your first truck →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {trucks.map((truck) => (
            <div
              key={truck.id}
              className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {truck.licensePlate}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {truck.truckType.replace(/_/g, " ")}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusBadge(
                    truck.availabilityStatus
                  )}`}
                >
                  {truck.availabilityStatus}
                </span>
              </div>

              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-gray-500">Capacity</dt>
                  <dd className="font-medium text-gray-900">
                    {truck.capacity.toLocaleString()} kg
                  </dd>
                </div>
                {truck.currentLocation && (
                  <div>
                    <dt className="text-gray-500">Current Location</dt>
                    <dd className="font-medium text-gray-900">
                      {truck.currentLocation}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-500">GPS Device</dt>
                  <dd className="font-medium text-gray-900">
                    {truck.gpsDevice ? (
                      <span className="text-green-600">
                        ✓ {truck.gpsDevice.imei}
                      </span>
                    ) : (
                      <span className="text-gray-400">Not assigned</span>
                    )}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <Link
                  href={`/dashboard/trucks/${truck.id}`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-500"
                >
                  View Details →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// New Truck Modal Component
function NewTruckModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    licensePlate: "",
    truckType: "FLATBED",
    capacity: "",
    currentLocation: "",
  });

  const truckTypes = [
    "FLATBED",
    "REFRIGERATED",
    "TANKER",
    "CONTAINER",
    "DRY_VAN",
    "LOWBOY",
    "DUMP_TRUCK",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        capacity: parseFloat(formData.capacity),
      };

      const response = await fetch("/api/trucks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to create truck");
      }
    } catch (error) {
      console.error("Failed to create truck:", error);
      alert("Failed to create truck");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900">Add New Truck</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                License Plate *
              </label>
              <input
                type="text"
                required
                value={formData.licensePlate}
                onChange={(e) =>
                  setFormData({ ...formData, licensePlate: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="e.g., ET-1234"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Truck Type *
              </label>
              <select
                required
                value={formData.truckType}
                onChange={(e) =>
                  setFormData({ ...formData, truckType: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              >
                {truckTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Capacity (kg) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.capacity}
                onChange={(e) =>
                  setFormData({ ...formData, capacity: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="e.g., 10000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Current Location
              </label>
              <input
                type="text"
                value={formData.currentLocation}
                onChange={(e) =>
                  setFormData({ ...formData, currentLocation: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="e.g., Addis Ababa"
              />
            </div>

            <div className="flex items-center justify-end space-x-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
              >
                {loading ? "Adding..." : "Add Truck"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
