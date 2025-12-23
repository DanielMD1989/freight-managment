"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OrganizationSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "SHIPPER",
    contactEmail: "",
    contactPhone: "",
    address: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert("Organization created successfully!");
        router.push("/dashboard");
        router.refresh();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to create organization");
      }
    } catch (error) {
      console.error("Failed to create organization:", error);
      alert("Failed to create organization");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Set Up Your Organization
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Create your organization to start posting loads or managing your fleet
        </p>
      </div>

      <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 mb-6">
        <p className="text-sm text-yellow-800">
          <strong>Required:</strong> You must create an organization before you
          can post loads or add trucks to your fleet.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Organization Details
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Organization Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="e.g., ABC Logistics"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Organization Type *
              </label>
              <select
                required
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              >
                <option value="SHIPPER">Shipper</option>
                <option value="CARRIER_COMPANY">Carrier Company</option>
                <option value="CARRIER_INDIVIDUAL">
                  Carrier (Individual)
                </option>
                <option value="LOGISTICS_AGENT">Logistics Agent (3PL)</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Shippers post loads, Carriers transport them, 3PLs do both
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Contact Email *
              </label>
              <input
                type="email"
                required
                value={formData.contactEmail}
                onChange={(e) =>
                  setFormData({ ...formData, contactEmail: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="contact@company.com"
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
                placeholder="+251 9XX XXX XXX"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Address
              </label>
              <textarea
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                rows={3}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="Full business address"
              />
            </div>
          </div>
        </div>

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
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Organization"}
          </button>
        </div>
      </form>
    </div>
  );
}
