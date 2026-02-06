'use client';

/**
 * User Management Client Component
 *
 * Interactive user management with search, filtering, and table
 * Sprint 10 - Story 10.2: User Management
 */

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

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
  { value: '', label: 'All Roles' },
  { value: 'SHIPPER', label: 'Shipper' },
  { value: 'CARRIER', label: 'Carrier' },
  { value: 'LOGISTICS_AGENT', label: 'Logistics Agent' },
  { value: 'DRIVER', label: 'Driver' },
  { value: 'SUPER_ADMIN', label: 'Platform Ops' },
  { value: 'ADMIN', label: 'Admin' },
];

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getRoleBadgeColor(role: string): string {
  const colors: Record<string, string> = {
    ADMIN: 'bg-purple-100 text-purple-800',
    PLATFORM_OPS: 'bg-blue-100 text-blue-800',
    SHIPPER: 'bg-green-100 text-green-800',
    CARRIER: 'bg-yellow-100 text-yellow-800',
    LOGISTICS_AGENT: 'bg-pink-100 text-pink-800',
    DRIVER: 'bg-gray-100 text-gray-800',
  };
  return colors[role] || 'bg-gray-100 text-gray-800';
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

  const [searchInput, setSearchInput] = useState(initialSearch || '');
  const [roleFilter, setRoleFilter] = useState(initialRole || '');

  /**
   * Handle search submit
   */
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());

    if (searchInput) {
      params.set('search', searchInput);
    } else {
      params.delete('search');
    }

    params.delete('page'); // Reset to page 1 on new search
    router.push(`/admin/users?${params.toString()}`);
  };

  /**
   * Handle role filter change
   */
  const handleRoleChange = (role: string) => {
    setRoleFilter(role);
    const params = new URLSearchParams(searchParams.toString());

    if (role) {
      params.set('role', role);
    } else {
      params.delete('role');
    }

    params.delete('page'); // Reset to page 1 on filter change
    router.push(`/admin/users?${params.toString()}`);
  };

  /**
   * Handle pagination
   */
  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`/admin/users?${params.toString()}`);
  };

  /**
   * Clear all filters
   */
  const handleClearFilters = () => {
    setSearchInput('');
    setRoleFilter('');
    router.push('/admin/users');
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Search */}
          <form onSubmit={handleSearch} className="lg:col-span-2">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Search Users
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by email, name..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Search
              </button>
            </div>
          </form>

          {/* Role Filter */}
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Role
            </label>
            <select
              id="role"
              value={roleFilter}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                Search: "{searchInput}"
              </span>
            )}
            {roleFilter && (
              <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                Role: {ROLES.find((r) => r.value === roleFilter)?.label}
              </span>
            )}
            <button
              onClick={handleClearFilters}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Organization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
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
                        <div className="text-xs text-gray-500">{user.email}</div>
                      )}
                    </div>
                  </td>

                  {/* Contact */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col text-sm">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-900">{user.email}</span>
                        {user.isEmailVerified && (
                          <span className="text-green-600" title="Email verified">
                            ✓
                          </span>
                        )}
                      </div>
                      {user.phone && (
                        <div className="flex items-center gap-1 text-gray-500">
                          <span>{user.phone}</span>
                          {user.isPhoneVerified && (
                            <span className="text-green-600" title="Phone verified">
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
                      className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(
                        user.role
                      )}`}
                    >
                      {user.role.replace(/_/g, ' ')}
                    </span>
                  </td>

                  {/* Organization */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.organization ? (
                      <div className="flex flex-col text-sm">
                        <div className="flex items-center gap-1">
                          <span className="text-gray-900">{user.organization.name}</span>
                          {user.organization.isVerified && (
                            <span className="text-blue-600" title="Verified organization">
                              ✓
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {user.organization.type}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">No organization</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  {/* Last Login */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(user.lastLoginAt)}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => router.push(`/admin/users/${user.id}`)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      View
                    </button>
                    <button
                      onClick={() => router.push(`/admin/users/${user.id}`)}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}

              {initialUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No users found. Try adjusting your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
            <div className="text-sm text-gray-700">
              Showing{' '}
              <span className="font-medium">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>{' '}
              to{' '}
              <span className="font-medium">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{' '}
              of <span className="font-medium">{pagination.total}</span> users
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-700">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
