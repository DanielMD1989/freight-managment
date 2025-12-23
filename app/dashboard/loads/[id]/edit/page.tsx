"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function EditLoadPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    origin: "",
    destination: "",
    pickupDate: "",
    deliveryDate: "",
    pickupDockHours: "",
    deliveryDockHours: "",
    appointmentRequired: false,
    truckType: "FLATBED",
    weight: "",
    cargoDescription: "",
    rate: "",
    isFullLoad: true,
    safetyNotes: "",
    isAnonymous: false,
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

  useEffect(() => {
    if (params.id) {
      fetchLoad();
    }
  }, [params.id]);

  const fetchLoad = async () => {
    try {
      const response = await fetch(`/api/loads/${params.id}`);
      if (response.ok) {
        const load = await response.json();

        // Check if load can be edited
        if (load.status !== "DRAFT" && load.status !== "POSTED") {
          alert("This load cannot be edited");
          router.push(`/dashboard/loads/${params.id}`);
          return;
        }

        setFormData({
          origin: load.origin,
          destination: load.destination,
          pickupDate: load.pickupDate?.split("T")[0] || "",
          deliveryDate: load.deliveryDate?.split("T")[0] || "",
          pickupDockHours: load.pickupDockHours || "",
          deliveryDockHours: load.deliveryDockHours || "",
          appointmentRequired: load.appointmentRequired,
          truckType: load.truckType,
          weight: load.weight?.toString() || "",
          cargoDescription: load.cargoDescription,
          rate: load.rate?.toString() || "",
          isFullLoad: load.isFullLoad,
          safetyNotes: load.safetyNotes || "",
          isAnonymous: load.isAnonymous,
        });
      } else {
        alert("Load not found");
        router.push("/dashboard/loads");
      }
    } catch (error) {
      console.error("Failed to fetch load:", error);
      alert("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        ...formData,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        rate: parseFloat(formData.rate),
      };

      const response = await fetch(`/api/loads/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        router.push(`/dashboard/loads/${params.id}`);
      } else {
        const data = await response.json();
        alert(data.error || "Failed to update load");
      }
    } catch (error) {
      console.error("Failed to update load:", error);
      alert("Failed to update load");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-8 text-3xl font-bold text-gray-900">Edit Load</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Route Information */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Route Information
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Origin City *
              </label>
              <input
                type="text"
                required
                value={formData.origin}
                onChange={(e) =>
                  setFormData({ ...formData, origin: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Destination City *
              </label>
              <input
                type="text"
                required
                value={formData.destination}
                onChange={(e) =>
                  setFormData({ ...formData, destination: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Pickup Date *
              </label>
              <input
                type="date"
                required
                value={formData.pickupDate}
                onChange={(e) =>
                  setFormData({ ...formData, pickupDate: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Delivery Date *
              </label>
              <input
                type="date"
                required
                value={formData.deliveryDate}
                onChange={(e) =>
                  setFormData({ ...formData, deliveryDate: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Pickup Dock Hours
              </label>
              <input
                type="text"
                value={formData.pickupDockHours}
                onChange={(e) =>
                  setFormData({ ...formData, pickupDockHours: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="e.g., 8:00 AM - 5:00 PM"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Delivery Dock Hours
              </label>
              <input
                type="text"
                value={formData.deliveryDockHours}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    deliveryDockHours: e.target.value,
                  })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="e.g., 9:00 AM - 6:00 PM"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.appointmentRequired}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    appointmentRequired: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">
                Appointment required for delivery
              </span>
            </label>
          </div>
        </div>

        {/* Load Details */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Load Details
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
                Weight (kg)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.weight}
                onChange={(e) =>
                  setFormData({ ...formData, weight: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                Cargo Description *
              </label>
              <textarea
                required
                value={formData.cargoDescription}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    cargoDescription: e.target.value,
                  })
                }
                rows={3}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Rate (ETB) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.rate}
                onChange={(e) =>
                  setFormData({ ...formData, rate: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isFullLoad}
                  onChange={(e) =>
                    setFormData({ ...formData, isFullLoad: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Full Load</span>
              </label>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                Safety Notes
              </label>
              <textarea
                value={formData.safetyNotes}
                onChange={(e) =>
                  setFormData({ ...formData, safetyNotes: e.target.value })
                }
                rows={2}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Privacy */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Privacy</h2>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.isAnonymous}
              onChange={(e) =>
                setFormData({ ...formData, isAnonymous: e.target.checked })
              }
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">
              Post anonymously (hide my company information)
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
