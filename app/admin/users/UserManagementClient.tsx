"use client";

/**
 * User Management Client Component
 *
 * Interactive user management with search, filtering, and table
 * Sprint 10 - Story 10.2: User Management
 */

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface User {
  id: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isActive: boolean;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  organizationId: string | null;
  organization: {
    id: string;
    name: string;
    type: string;
    isVerified: boolean;
  } | null;
  createdAt: string;
  lastLoginAt: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const ROLES = [
  { value: "", label: "All Roles" },
  { value: "SHIPPER", label: "Shipper" },
  { value: "CARRIER", label: "Carrier" },
  { value: "LOGISTICS_AGENT", label: "Logistics Agent" },
  { value: "DRIVER", label: "Driver" },
  { value: "SUPER_ADMIN", label: "Platform Ops" },
  { value: "ADMIN", label: "Admin" },
];

function formatDate(dateString: string | null): string {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getRoleBadgeColor(role: string): string {
  const colors: Record<string, string> = {
    ADMIN: "bg-purple-100 text-purple-800",
    PLATFORM_OPS: "bg-blue-100 text-blue-800",
    SHIPPER: "bg-green-100 text-green-800",
    CARRIER: "bg-yellow-100 text-yellow-800",
    LOGISTICS_AGENT: "bg-pink-100 text-pink-800",
    DRIVER: "bg-gray-100 text-gray-800",
  };
  return colors[role] || "bg-gray-100 text-gray-800";
}

export default function UserManagementClient({
  initialUsers,
  pagination,
  initialRole,
  initialSearch,
}: {
  initialUsers: User[];
  pagination: Pagination;
  initialRole?: string;
  initialSearch?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(initialSearch || "");
  const [roleFilter, setRoleFilter] = useState(initialRole || "");

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

    params.delete("page"); // Reset to page 1 on new search
    router.push(`/admin/users?${params.toString()}`);
  };

  /**
   * Handle role filter change
   */
  const handleRoleChange = (role: string) => {
    setRoleFilter(role);
    const params = new URLSearchParams(searchParams.toString());

    if (role) {
      params.set("role", role);
    } else {
      params.delete("role");
    }

    params.delete("page"); // Reset to page 1 on filter change
    router.push(`/admin/users?${params.toString()}`);
  };

  /**
   * Handle pagination
   */
  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/admin/users?${params.toString()}`);
  };

  /**
   * Clear all filters
   */
  const handleClearFilters = () => {
    setSearchInput("");
    setRoleFilter("");
    router.push("/admin/users");
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Search */}
          <form onSubmit={handleSearch} className="lg:col-span-2">
            <label
              htmlFor="search"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Search Users
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by email, name..."
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

          {/* Role Filter */}
          <div>
            <label
              htmlFor="role"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Filter by Role
            </label>
            <select
              id="role"
              value={roleFilter}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            >
              {ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filters */}
        {(searchInput || roleFilter) && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm text-gray-600">Active filters:</span>
            {searchInput && (
              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">
                Search: &quot;{searchInput}&quot;
              </span>
            )}
            {roleFilter && (
              <span className="rounded-full bg-purple-100 px-3 py-1 text-sm text-purple-800">
                Role: {ROLES.find((r) => r.value === roleFilter)?.label}
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

      {/* Users Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Organization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {initialUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  {/* User */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-gray-900">
                        {user.firstName && user.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user.email}
                      </div>
                      {user.firstName && user.lastName && (
                        <div className="text-xs text-gray-500">
                          {user.email}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Contact */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col text-sm">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-900">{user.email}</span>
                        {user.isEmailVerified && (
                          <span
                            className="text-green-600"
                            title="Email verified"
                          >
                            ✓
                          </span>
                        )}
                      </div>
                      {user.phone && (
                        <div className="flex items-center gap-1 text-gray-500">
                          <span>{user.phone}</span>
                          {user.isPhoneVerified && (
                            <span
                              className="text-green-600"
                              title="Phone verified"
                            >
                              ✓
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs leading-5 font-semibold ${getRoleBadgeColor(
                        user.role
                      )}`}
                    >
                      {user.role.replace(/_/g, " ")}
                    </span>
                  </td>

                  {/* Organization */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.organization ? (
                      <div className="flex flex-col text-sm">
                        <div className="flex items-center gap-1">
                          <span className="text-gray-900">
                            {user.organization.name}
                          </span>
                          {user.organization.isVerified && (
                            <span
                              className="text-blue-600"
                              title="Verified organization"
                            >
                              ✓
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {user.organization.type}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">
                        No organization
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs leading-5 font-semibold ${
                        user.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>

                  {/* Last Login */}
                  <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                    {formatDate(user.lastLoginAt)}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                    <button
                      onClick={() => router.push(`/admin/users/${user.id}`)}
                      className="mr-3 text-blue-600 hover:text-blue-900"
                    >
                      View
                    </button>
                    <button
                      onClick={() =>
                        router.push(`/admin/users/${user.id}?edit=true`)
                      }
                      className="text-gray-600 hover:text-gray-900"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}

              {initialUsers.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    No users found. Try adjusting your filters.
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
              of <span className="font-medium">{pagination.total}</span> users
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
