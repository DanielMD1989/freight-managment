"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import LocationSelect from "@/components/LocationSelect";

export default function PostTruckPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loadingTrucks, setLoadingTrucks] = useState(true);

  const [formData, setFormData] = useState({
    truckId: "",
    originCityId: "",
    originName: "",
    destinationCityId: "",
    destinationName: "",
    availableFrom: "",
    availableTo: "",
    fullPartial: "FULL" as "FULL" | "PARTIAL",
    availableLength: "",
    availableWeight: "",
    preferredDhToOriginKm: "",
    preferredDhAfterDeliveryKm: "",
    contactName: "",
    contactPhone: "",
    ownerName: "",
    notes: "",
  });

  // Fetch user's trucks on mount
  useEffect(() => {
    fetchTrucks();
  }, []);

  const fetchTrucks = async () => {
    try {
      // TODO: Replace with actual API call filtered by user's organization
      // For MVP, we'll use a placeholder
      // const response = await fetch('/api/trucks?organizationId=...');

      // Placeholder: Empty array for now
      setTrucks([]);
      setLoadingTrucks(false);
    } catch (error) {
      console.error("Error fetching trucks:", error);
      setLoadingTrucks(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        truckId: formData.truckId,
        originCityId: formData.originCityId,
        destinationCityId: formData.destinationCityId || null,
        availableFrom: new Date(formData.availableFrom).toISOString(),
        availableTo: formData.availableTo
          ? new Date(formData.availableTo).toISOString()
          : null,
        fullPartial: formData.fullPartial,
        availableLength: formData.availableLength
          ? parseFloat(formData.availableLength)
          : null,
        availableWeight: formData.availableWeight
          ? parseFloat(formData.availableWeight)
          : null,
        preferredDhToOriginKm: formData.preferredDhToOriginKm
          ? parseFloat(formData.preferredDhToOriginKm)
          : null,
        preferredDhAfterDeliveryKm: formData.preferredDhAfterDeliveryKm
          ? parseFloat(formData.preferredDhAfterDeliveryKm)
          : null,
        contactName: formData.contactName,
        contactPhone: formData.contactPhone,
        ownerName: formData.ownerName || null,
        notes: formData.notes || null,
      };

      const response = await fetch("/api/truck-postings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        alert("Truck posted successfully!");
        router.push(`/dashboard/trucks/postings`);
      } else {
        const data = await response.json();
        alert(data.error || "Failed to post truck");
      }
    } catch (error) {
      console.error("Failed to post truck:", error);
      alert("Failed to post truck");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="mb-8 text-3xl font-bold text-gray-900">
        Post Available Truck
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Truck Selection */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Truck Information
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Select Truck *
              </label>
              {loadingTrucks ? (
                <div className="mt-1 text-sm text-gray-500">
                  Loading trucks...
                </div>
              ) : trucks.length === 0 ? (
                <div className="mt-1 rounded-md border border-yellow-200 bg-yellow-50 p-4">
                  <p className="text-sm text-yellow-800">
                    No trucks available. Please register a truck first.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/trucks/new")}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Register a truck →
                  </button>
                </div>
              ) : (
                <select
                  required
                  value={formData.truckId}
                  onChange={(e) =>
                    setFormData({ ...formData, truckId: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                >
                  <option value="">Select a truck...</option>
                  {trucks.map((truck) => (
                    <option key={truck.id} value={truck.id}>
                      {truck.licensePlate} - {truck.truckType} ({truck.capacity}
                      kg)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Temporary: Manual Truck ID input for MVP */}
            {trucks.length === 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Truck ID (Temporary for MVP) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.truckId}
                  onChange={(e) =>
                    setFormData({ ...formData, truckId: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  placeholder="Enter truck ID from database"
                />
                <p className="mt-1 text-xs text-gray-500">
                  MVP: Enter truck ID directly. Use truck list API in production.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Route Information */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Route & Availability
          </h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <LocationSelect
              label="Origin (Current Location)"
              value={formData.originCityId}
              onChange={(locationId, locationName) =>
                setFormData({
                  ...formData,
                  originCityId: locationId,
                  originName: locationName,
                })
              }
              required
              placeholder="Where is the truck now?"
            />

            <LocationSelect
              label="Destination (Optional)"
              value={formData.destinationCityId}
              onChange={(locationId, locationName) =>
                setFormData({
                  ...formData,
                  destinationCityId: locationId,
                  destinationName: locationName,
                })
              }
              placeholder="Preferred destination (flexible if empty)"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Available From *
              </label>
              <input
                type="datetime-local"
                required
                value={formData.availableFrom}
                onChange={(e) =>
                  setFormData({ ...formData, availableFrom: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Available Until (Optional)
              </label>
              <input
                type="datetime-local"
                value={formData.availableTo}
                onChange={(e) =>
                  setFormData({ ...formData, availableTo: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Leave empty for flexible availability
              </p>
            </div>
          </div>
        </div>

        {/* Capacity Information */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Available Capacity
          </h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
                <option value="FULL">Full Load Only</option>
                <option value="PARTIAL">Partial Load OK</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Available Weight (kg)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.availableWeight}
                onChange={(e) =>
                  setFormData({ ...formData, availableWeight: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="e.g., 15000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Available Length (m)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.availableLength}
                onChange={(e) =>
                  setFormData({ ...formData, availableLength: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="e.g., 12.5"
              />
            </div>
          </div>
        </div>

        {/* Deadhead Preferences */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Deadhead Preferences (Optional)
          </h2>
          <p className="mb-4 text-sm text-gray-600">
            Set maximum deadhead distances you're willing to travel empty
          </p>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Max Deadhead to Pickup (km)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.preferredDhToOriginKm}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    preferredDhToOriginKm: e.target.value,
                  })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="e.g., 50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Max Deadhead After Delivery (km)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.preferredDhAfterDeliveryKm}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    preferredDhAfterDeliveryKm: e.target.value,
                  })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="e.g., 30"
              />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Contact Information
          </h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Contact Name *
              </label>
              <input
                type="text"
                required
                value={formData.contactName}
                onChange={(e) =>
                  setFormData({ ...formData, contactName: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Contact Phone *
              </label>
              <input
                type="tel"
                required
                value={formData.contactPhone}
                onChange={(e) =>
                  setFormData({ ...formData, contactPhone: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="+251911234567"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Owner Name (if different)
              </label>
              <input
                type="text"
                value={formData.ownerName}
                onChange={(e) =>
                  setFormData({ ...formData, ownerName: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="Truck owner's name"
              />
            </div>
          </div>
        </div>

        {/* Additional Notes */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Additional Notes
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Notes / Special Requirements
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={4}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              placeholder="Any special notes about availability, preferences, or requirements..."
            />
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex items-center justify-end space-x-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-gray-300 bg-white px-6 py-2 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading || !formData.truckId}
            className="rounded-md bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Posting..." : "Post Truck"}
          </button>
        </div>
      </form>
    </div>
  );
}
