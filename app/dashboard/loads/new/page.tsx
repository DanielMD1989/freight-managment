"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateLoadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    // Location & Schedule
    origin: "",
    destination: "",
    pickupDate: "",
    deliveryDate: "",
    pickupDockHours: "",
    deliveryDockHours: "",
    appointmentRequired: false,
    // [NEW] Logistics
    tripKm: "",
    dhToOriginKm: "",
    dhAfterDeliveryKm: "",
    // Load Details
    truckType: "FLATBED",
    weight: "",
    cargoDescription: "",
    isFullLoad: true,  // Keep for backward compatibility
    fullPartial: "FULL" as "FULL" | "PARTIAL",  // [NEW]
    // [NEW] Cargo Details
    lengthM: "",
    casesCount: "",
    // Pricing
    rate: "",
    bookMode: "REQUEST" as "REQUEST" | "INSTANT",  // [NEW]
    // [NEW] Market Pricing
    dtpReference: "",
    factorRating: "",
    // Privacy & Safety
    isAnonymous: false,
    shipperContactName: "",  // [NEW]
    shipperContactPhone: "",  // [NEW]
    safetyNotes: "",
    status: "DRAFT",
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

  const handleSubmit = async (e: React.FormEvent, postImmediately = false) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        // Location & Schedule
        pickupCity: formData.origin,
        deliveryCity: formData.destination,
        pickupDate: formData.pickupDate,
        deliveryDate: formData.deliveryDate,
        pickupDockHours: formData.pickupDockHours || undefined,
        deliveryDockHours: formData.deliveryDockHours || undefined,
        appointmentRequired: formData.appointmentRequired,
        // [NEW] Logistics
        tripKm: formData.tripKm ? parseFloat(formData.tripKm) : undefined,
        dhToOriginKm: formData.dhToOriginKm ? parseFloat(formData.dhToOriginKm) : undefined,
        dhAfterDeliveryKm: formData.dhAfterDeliveryKm ? parseFloat(formData.dhAfterDeliveryKm) : undefined,
        // Load Details
        truckType: formData.truckType,
        weight: formData.weight ? parseFloat(formData.weight) : 1,
        cargoDescription: formData.cargoDescription,
        isFullLoad: formData.isFullLoad,
        fullPartial: formData.fullPartial,  // [NEW]
        // [NEW] Cargo Details
        lengthM: formData.lengthM ? parseFloat(formData.lengthM) : undefined,
        casesCount: formData.casesCount ? parseInt(formData.casesCount) : undefined,
        // Pricing
        rate: parseFloat(formData.rate),
        bookMode: formData.bookMode,  // [NEW]
        // [NEW] Market Pricing
        dtpReference: formData.dtpReference || undefined,
        factorRating: formData.factorRating || undefined,
        // Privacy & Safety
        isAnonymous: formData.isAnonymous,
        shipperContactName: formData.shipperContactName || undefined,  // [NEW]
        shipperContactPhone: formData.shipperContactPhone || undefined,  // [NEW]
        safetyNotes: formData.safetyNotes || undefined,
        // Status
        status: postImmediately ? "POSTED" : "DRAFT",
      };

      const response = await fetch("/api/loads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/dashboard/loads/${data.id}`);
      } else {
        const data = await response.json();
        alert(data.error || "Failed to create load");
      }
    } catch (error) {
      console.error("Failed to create load:", error);
      alert("Failed to create load");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="mb-8 text-3xl font-bold text-gray-900">
        Create New Load
      </h1>

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
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
                placeholder="e.g., Addis Ababa"
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
                placeholder="e.g., Dire Dawa"
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

        {/* Logistics & Distance */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Logistics &amp; Distance
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Trip Distance (km) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.tripKm}
                onChange={(e) =>
                  setFormData({ ...formData, tripKm: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="e.g., 450"
              />
              <p className="mt-1 text-xs text-gray-500">
                Required for posting loads
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Deadhead to Origin (km)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.dhToOriginKm}
                onChange={(e) =>
                  setFormData({ ...formData, dhToOriginKm: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="e.g., 50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Deadhead after Delivery (km)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.dhAfterDeliveryKm}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    dhAfterDeliveryKm: e.target.value,
                  })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="e.g., 30"
              />
            </div>
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
                placeholder="e.g., 5000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Load Type *
              </label>
              <select
                required
                value={formData.fullPartial}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    fullPartial: e.target.value as "FULL" | "PARTIAL",
                  })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              >
                <option value="FULL">Full Load</option>
                <option value="PARTIAL">Partial Load</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Booking Mode *
              </label>
              <select
                required
                value={formData.bookMode}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    bookMode: e.target.value as "REQUEST" | "INSTANT",
                  })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              >
                <option value="REQUEST">Request (Approval Required)</option>
                <option value="INSTANT">Instant Book</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Cargo Length (m)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.lengthM}
                onChange={(e) =>
                  setFormData({ ...formData, lengthM: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="e.g., 12.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Cases/Pallets Count
              </label>
              <input
                type="number"
                value={formData.casesCount}
                onChange={(e) =>
                  setFormData({ ...formData, casesCount: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="e.g., 20"
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
                placeholder="Describe the cargo..."
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
                placeholder="e.g., 15000"
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
                placeholder="Any safety considerations or special instructions..."
              />
            </div>
          </div>
        </div>

        {/* Market Pricing */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Market Pricing
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                DTP Reference
              </label>
              <input
                type="text"
                value={formData.dtpReference}
                onChange={(e) =>
                  setFormData({ ...formData, dtpReference: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="e.g., DTP-2024-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Factor Rating
              </label>
              <input
                type="text"
                value={formData.factorRating}
                onChange={(e) =>
                  setFormData({ ...formData, factorRating: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="e.g., A+"
              />
            </div>
          </div>
        </div>

        {/* Privacy */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Privacy &amp; Contact
          </h2>
          <div className="space-y-4">
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
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Contact Name
                </label>
                <input
                  type="text"
                  value={formData.shipperContactName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      shipperContactName: e.target.value,
                    })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  placeholder="Your name"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Hidden until load is assigned to a carrier
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={formData.shipperContactPhone}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      shipperContactPhone: e.target.value,
                    })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  placeholder="+251 9XX XXX XXX"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Hidden until load is assigned to a carrier
                </p>
              </div>
            </div>
          </div>
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
            disabled={loading}
            className="rounded-md bg-gray-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-500 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save as Draft"}
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? "Posting..." : "Post Load"}
          </button>
        </div>
      </form>
    </div>
  );
}
