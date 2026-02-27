/**
 * Company Settings Client Component
 *
 * Phase 2 - Story 16.9B: Company Admin Tools
 * Task 16.9B.5: Company Preference Settings
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getCSRFToken } from "@/lib/csrfFetch";

interface Organization {
  id: string;
  name: string;
  type: string;
  description: string | null;
  contactEmail: string;
  contactPhone: string;
  address: string | null;
  city: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
  licenseNumber: string | null;
  taxId: string | null;
  allowNameDisplay: boolean;
  createdAt: string;
}

interface Props {
  organization: Organization;
}

export default function CompanySettingsClient({ organization }: Props) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: organization.name,
    description: organization.description || "",
    contactEmail: organization.contactEmail,
    contactPhone: organization.contactPhone,
    address: organization.address || "",
    city: organization.city || "",
    licenseNumber: organization.licenseNumber || "",
    taxId: organization.taxId || "",
    allowNameDisplay: organization.allowNameDisplay,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasChanges =
    JSON.stringify({
      name: organization.name,
      description: organization.description || "",
      contactEmail: organization.contactEmail,
      contactPhone: organization.contactPhone,
      address: organization.address || "",
      city: organization.city || "",
      licenseNumber: organization.licenseNumber || "",
      taxId: organization.taxId || "",
      allowNameDisplay: organization.allowNameDisplay,
    }) !== JSON.stringify(formData);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/organizations/${organization.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify(formData),
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update settings");
      }

      setSuccess("Settings updated successfully");
      setTimeout(() => setSuccess(null), 3000);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      name: organization.name,
      description: organization.description || "",
      contactEmail: organization.contactEmail,
      contactPhone: organization.contactPhone,
      address: organization.address || "",
      city: organization.city || "",
      licenseNumber: organization.licenseNumber || "",
      taxId: organization.taxId || "",
      allowNameDisplay: organization.allowNameDisplay,
    });
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm text-rose-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm text-emerald-800">{success}</p>
        </div>
      )}

      {/* Verification Status */}
      <div className="rounded-xl border border-[#064d51]/10 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#064d51]">
              Verification Status
            </h2>
            <p className="mt-1 text-sm text-[#064d51]/70">
              Verified organizations get priority matching and display a
              verified badge
            </p>
          </div>
          <div>
            {organization.isVerified ? (
              <span className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1 text-sm font-semibold text-white">
                <svg
                  className="mr-1.5 h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Verified
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
                Pending Verification
              </span>
            )}
          </div>
        </div>
        {organization.verifiedAt && (
          <p className="mt-2 text-xs text-gray-500">
            Verified on {new Date(organization.verifiedAt).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Company Profile Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-[#064d51]/10 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[#064d51]">
            Company Profile
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#064d51]">
                Company Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
                className="w-full rounded-lg border border-[#064d51]/20 px-3 py-2 focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#064d51]">
                Organization Type
              </label>
              <input
                type="text"
                value={organization.type}
                disabled
                className="w-full rounded-lg border border-[#064d51]/20 bg-[#064d51]/5 px-3 py-2 text-[#064d51]/70"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-[#064d51]">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
                className="w-full rounded-lg border border-[#064d51]/20 px-3 py-2 focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
                placeholder="Brief description of your company..."
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#064d51]/10 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[#064d51]">
            Contact Information
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#064d51]">
                Contact Email *
              </label>
              <input
                type="email"
                value={formData.contactEmail}
                onChange={(e) =>
                  setFormData({ ...formData, contactEmail: e.target.value })
                }
                required
                className="w-full rounded-lg border border-[#064d51]/20 px-3 py-2 focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#064d51]">
                Contact Phone *
              </label>
              <input
                type="tel"
                value={formData.contactPhone}
                onChange={(e) =>
                  setFormData({ ...formData, contactPhone: e.target.value })
                }
                required
                className="w-full rounded-lg border border-[#064d51]/20 px-3 py-2 focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#064d51]">
                Address
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                className="w-full rounded-lg border border-[#064d51]/20 px-3 py-2 focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#064d51]">
                City
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                className="w-full rounded-lg border border-[#064d51]/20 px-3 py-2 focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#064d51]/10 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[#064d51]">
            Legal Information
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#064d51]">
                License Number
              </label>
              <input
                type="text"
                value={formData.licenseNumber}
                onChange={(e) =>
                  setFormData({ ...formData, licenseNumber: e.target.value })
                }
                className="w-full rounded-lg border border-[#064d51]/20 px-3 py-2 focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#064d51]">
                Tax ID
              </label>
              <input
                type="text"
                value={formData.taxId}
                onChange={(e) =>
                  setFormData({ ...formData, taxId: e.target.value })
                }
                className="w-full rounded-lg border border-[#064d51]/20 px-3 py-2 focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#064d51]/10 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[#064d51]">
            Privacy Settings
          </h2>
          <div className="flex items-center justify-between rounded-lg bg-[#f0fdfa] p-4">
            <div>
              <h3 className="text-sm font-medium text-[#064d51]">
                Display Company Name
              </h3>
              <p className="text-sm text-[#064d51]/70">
                Show your company name to other platform users
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={formData.allowNameDisplay}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    allowNameDisplay: e.target.checked,
                  })
                }
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-[#064d51]/20 peer-checked:bg-[#1e9c99] peer-focus:ring-4 peer-focus:ring-[#1e9c99]/30 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-[#064d51]/20 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between rounded-xl border border-[#064d51]/10 bg-[#f0fdfa] p-4">
          <div className="text-sm text-[#064d51]/70">
            {hasChanges ? (
              <span className="font-medium text-amber-600">
                You have unsaved changes
              </span>
            ) : (
              <span>All changes saved</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={!hasChanges || loading}
              className="rounded-lg border border-[#064d51]/30 px-4 py-2 font-medium text-[#064d51] hover:bg-[#064d51]/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={!hasChanges || loading}
              className="rounded-lg bg-[#064d51] px-4 py-2 font-medium text-white hover:bg-[#053d40] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </form>

      {/* Account Info */}
      <div className="rounded-xl border border-[#064d51]/10 bg-[#064d51]/5 p-4">
        <p className="text-xs text-[#064d51]/60">
          Organization created on{" "}
          {new Date(organization.createdAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
