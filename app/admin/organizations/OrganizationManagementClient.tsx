"use client";

/**
 * Organization Management Client Component
 *
 * Interactive organization management with search, filtering, and table
 * Sprint 10 - Story 10.3: Organization Management
 */

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCSRFToken } from "@/lib/csrfFetch";

interface Organization {
  id: string;
  name: string;
  type: string;
  description: string | null;
  contactEmail: string;
  contactPhone: string;
  city: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
  verificationStatus: string;
  rejectionReason: string | null;
  createdAt: string;
  _count: {
    users: number;
    trucks: number;
    loads: number;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const ORGANIZATION_TYPES = [
  { value: "", label: "All Types" },
  { value: "SHIPPER", label: "Shipper" },
  { value: "CARRIER_COMPANY", label: "Carrier Company" },
  { value: "CARRIER_INDIVIDUAL", label: "Carrier Individual" },
  { value: "LOGISTICS_AGENT", label: "Logistics Agent" },
];

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function getTypeBadgeColor(type: string): string {
  const colors: Record<string, string> = {
    SHIPPER: "bg-blue-100 text-blue-800",
    CARRIER_COMPANY: "bg-green-100 text-green-800",
    CARRIER_INDIVIDUAL: "bg-yellow-100 text-yellow-800",
    LOGISTICS_AGENT: "bg-purple-100 text-purple-800",
  };
  return colors[type] || "bg-gray-100 text-gray-800";
}

export default function OrganizationManagementClient({
  initialOrganizations,
  pagination,
  initialType,
  initialSearch,
}: {
  initialOrganizations: Organization[];
  pagination: Pagination;
  initialType?: string;
  initialSearch?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(initialSearch || "");
  const [typeFilter, setTypeFilter] = useState(initialType || "");
  // L41 FIX: Add submitting state to prevent rapid clicks
  const [submittingOrgId, setSubmittingOrgId] = useState<string | null>(null);

  // Reject modal state
  const [rejectModalOrgId, setRejectModalOrgId] = useState<string | null>(null);
  const [rejectModalOrgName, setRejectModalOrgName] = useState<string>("");
  const [rejectReason, setRejectReason] = useState<string>("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [rejectLoading, setRejectLoading] = useState(false);

  /**
   * Handle search submit
   */
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());

    if (searchInput) {
      params.set("search", searchInput);
    } else {
      params.delete("search");
    }

    params.delete("page");
    router.push(`/admin/organizations?${params.toString()}`);
  };

  /**
   * Handle type filter change
   */
  const handleTypeChange = (type: string) => {
    setTypeFilter(type);
    const params = new URLSearchParams(searchParams.toString());

    if (type) {
      params.set("type", type);
    } else {
      params.delete("type");
    }

    params.delete("page");
    router.push(`/admin/organizations?${params.toString()}`);
  };

  /**
   * Handle pagination
   */
  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/admin/organizations?${params.toString()}`);
  };

  /**
   * Clear all filters
   */
  const handleClearFilters = () => {
    setSearchInput("");
    setTypeFilter("");
    router.push("/admin/organizations");
  };

  /**
   * Handle organization verification
   */
  const handleVerify = async (orgId: string, orgName: string) => {
    if (!confirm(`Are you sure you want to verify "${orgName}"?`)) {
      return;
    }

    // L41 FIX: Prevent rapid clicks
    if (submittingOrgId) return;
    setSubmittingOrgId(orgId);

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/admin/organizations/${orgId}/verify`, {
        method: "POST",
        headers: { ...(csrfToken && { "X-CSRF-Token": csrfToken }) },
      });

      if (response.ok) {
        alert("Organization verified successfully!");
        router.refresh();
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Failed to verify organization");
      }
    } catch {
      alert("An error occurred while verifying the organization");
    } finally {
      setSubmittingOrgId(null);
    }
  };

  /**
   * Handle organization unverification
   */
  const handleUnverify = async (orgId: string, orgName: string) => {
    if (
      !confirm(
        `Are you sure you want to remove verification from "${orgName}"?`
      )
    ) {
      return;
    }

    // L41 FIX: Prevent rapid clicks
    if (submittingOrgId) return;
    setSubmittingOrgId(orgId);

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/admin/organizations/${orgId}/verify`, {
        method: "DELETE",
        headers: { ...(csrfToken && { "X-CSRF-Token": csrfToken }) },
      });

      if (response.ok) {
        alert("Organization verification removed!");
        router.refresh();
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Failed to remove verification");
      }
    } catch {
      alert("An error occurred while removing verification");
    } finally {
      setSubmittingOrgId(null);
    }
  };

  /**
   * Open reject modal
   */
  const openRejectModal = (orgId: string, orgName: string) => {
    setRejectModalOrgId(orgId);
    setRejectModalOrgName(orgName);
    setRejectReason("");
    setRejectError(null);
  };

  /**
   * Submit organization rejection
   */
  const handleReject = async () => {
    if (!rejectModalOrgId || rejectReason.trim().length < 10) {
      setRejectError("Reason must be at least 10 characters.");
      return;
    }

    setRejectLoading(true);
    setRejectError(null);

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(
        `/api/admin/organizations/${rejectModalOrgId}/reject`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken && { "X-CSRF-Token": csrfToken }),
          },
          body: JSON.stringify({ reason: rejectReason }),
        }
      );

      if (response.ok) {
        setRejectModalOrgId(null);
        setRejectReason("");
        router.refresh();
      } else {
        const data = await response.json();
        setRejectError(data.error || "Failed to reject organization");
      }
    } catch {
      setRejectError("An error occurred while rejecting the organization");
    } finally {
      setRejectLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Reject Modal */}
      {rejectModalOrgId && (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              Reject Organization
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              Rejecting <strong>{rejectModalOrgName}</strong>. Members will be
              notified with the reason.
            </p>

            {rejectError && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-800">{rejectError}</p>
              </div>
            )}

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Rejection Reason *
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Provide a reason for rejection (min 10 characters)..."
                rows={3}
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-red-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                {rejectReason.length} / 10 minimum characters
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setRejectModalOrgId(null);
                  setRejectReason("");
                  setRejectError(null);
                }}
                disabled={rejectLoading}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={rejectLoading || rejectReason.trim().length < 10}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {rejectLoading ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Search */}
          <form onSubmit={handleSearch} className="lg:col-span-2">
            <label
              htmlFor="search"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Search Organizations
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by name, email..."
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700"
              >
                Search
              </button>
            </div>
          </form>

          {/* Type Filter */}
          <div>
            <label
              htmlFor="type"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Filter by Type
            </label>
            <select
              id="type"
              value={typeFilter}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            >
              {ORGANIZATION_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filters */}
        {(searchInput || typeFilter) && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm text-gray-600">Active filters:</span>
            {searchInput && (
              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">
                Search: &quot;{searchInput}&quot;
              </span>
            )}
            {typeFilter && (
              <span className="rounded-full bg-purple-100 px-3 py-1 text-sm text-purple-800">
                Type:{" "}
                {ORGANIZATION_TYPES.find((t) => t.value === typeFilter)?.label}
              </span>
            )}
            <button
              onClick={handleClearFilters}
              className="text-sm font-medium text-red-600 hover:text-red-700"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-sm text-gray-600">Total Organizations</div>
          <div
            data-testid="admin-orgs-total-count"
            className="mt-1 text-2xl font-bold text-gray-900"
          >
            {pagination.total}
          </div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-sm text-gray-600">Verified</div>
          <div className="mt-1 text-2xl font-bold text-green-600">
            {initialOrganizations.filter((org) => org.isVerified).length}
          </div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-sm text-gray-600">Pending Verification</div>
          <div className="mt-1 text-2xl font-bold text-yellow-600">
            {initialOrganizations.filter((org) => !org.isVerified).length}
          </div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-sm text-gray-600">Total Users</div>
          <div className="mt-1 text-2xl font-bold text-blue-600">
            {initialOrganizations.reduce(
              (sum, org) => sum + org._count.users,
              0
            )}
          </div>
        </div>
      </div>

      {/* Organizations Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Organization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Resources
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {initialOrganizations.map((org) => (
                <tr key={org.id} className="hover:bg-gray-50">
                  {/* Organization */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-gray-900">
                        {org.name}
                      </div>
                      {org.city && (
                        <div className="text-xs text-gray-500">{org.city}</div>
                      )}
                    </div>
                  </td>

                  {/* Type */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs leading-5 font-semibold ${getTypeBadgeColor(
                        org.type
                      )}`}
                    >
                      {org.type.replace(/_/g, " ")}
                    </span>
                  </td>

                  {/* Contact */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col text-sm">
                      <div className="text-gray-900">{org.contactEmail}</div>
                      <div className="text-gray-500">{org.contactPhone}</div>
                    </div>
                  </td>

                  {/* Resources */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col text-sm">
                      <div className="text-gray-700">
                        {org._count.users} users
                      </div>
                      <div className="text-gray-500">
                        {org._count.trucks} trucks, {org._count.loads} loads
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      {org.verificationStatus === "APPROVED" ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs leading-5 font-semibold text-green-800">
                          Approved
                        </span>
                      ) : org.verificationStatus === "REJECTED" ? (
                        <span className="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs leading-5 font-semibold text-red-800">
                          Rejected
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-yellow-100 px-2 py-1 text-xs leading-5 font-semibold text-yellow-800">
                          Pending
                        </span>
                      )}
                      {org.verificationStatus === "REJECTED" &&
                        org.rejectionReason && (
                          <span
                            className="max-w-[140px] truncate text-xs text-gray-500"
                            title={org.rejectionReason}
                          >
                            {org.rejectionReason}
                          </span>
                        )}
                    </div>
                  </td>

                  {/* Created */}
                  <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                    {formatDate(org.createdAt)}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() =>
                          router.push(`/admin/organizations/${org.id}`)
                        }
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </button>
                      {!org.isVerified ? (
                        <button
                          onClick={() => handleVerify(org.id, org.name)}
                          disabled={submittingOrgId === org.id}
                          className="text-green-600 hover:text-green-900 disabled:opacity-50"
                        >
                          Verify
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnverify(org.id, org.name)}
                          disabled={submittingOrgId === org.id}
                          className="text-orange-600 hover:text-orange-900 disabled:opacity-50"
                        >
                          Unverify
                        </button>
                      )}
                      {org.verificationStatus !== "REJECTED" && (
                        <button
                          onClick={() => openRejectModal(org.id, org.name)}
                          disabled={submittingOrgId === org.id}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {initialOrganizations.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    No organizations found. Try adjusting your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-4">
            <div className="text-sm text-gray-700">
              Showing{" "}
              <span className="font-medium">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>{" "}
              to{" "}
              <span className="font-medium">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{" "}
              of <span className="font-medium">{pagination.total}</span>{" "}
              organizations
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-700">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
