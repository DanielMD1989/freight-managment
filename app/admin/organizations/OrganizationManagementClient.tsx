'use client';

/**
 * Organization Management Client Component
 *
 * Interactive organization management with search, filtering, and table
 * Sprint 10 - Story 10.3: Organization Management
 */

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCSRFToken } from '@/lib/csrfFetch';

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
  { value: '', label: 'All Types' },
  { value: 'SHIPPER', label: 'Shipper' },
  { value: 'CARRIER_COMPANY', label: 'Carrier Company' },
  { value: 'CARRIER_INDIVIDUAL', label: 'Carrier Individual' },
  { value: 'LOGISTICS_AGENT', label: 'Logistics Agent' },
];

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function getTypeBadgeColor(type: string): string {
  const colors: Record<string, string> = {
    SHIPPER: 'bg-blue-100 text-blue-800',
    CARRIER_COMPANY: 'bg-green-100 text-green-800',
    CARRIER_INDIVIDUAL: 'bg-yellow-100 text-yellow-800',
    LOGISTICS_AGENT: 'bg-purple-100 text-purple-800',
  };
  return colors[type] || 'bg-gray-100 text-gray-800';
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

  const [searchInput, setSearchInput] = useState(initialSearch || '');
  const [typeFilter, setTypeFilter] = useState(initialType || '');

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

    params.delete('page');
    router.push(`/admin/organizations?${params.toString()}`);
  };

  /**
   * Handle type filter change
   */
  const handleTypeChange = (type: string) => {
    setTypeFilter(type);
    const params = new URLSearchParams(searchParams.toString());

    if (type) {
      params.set('type', type);
    } else {
      params.delete('type');
    }

    params.delete('page');
    router.push(`/admin/organizations?${params.toString()}`);
  };

  /**
   * Handle pagination
   */
  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`/admin/organizations?${params.toString()}`);
  };

  /**
   * Clear all filters
   */
  const handleClearFilters = () => {
    setSearchInput('');
    setTypeFilter('');
    router.push('/admin/organizations');
  };

  /**
   * Handle organization verification
   */
  const handleVerify = async (orgId: string, orgName: string) => {
    if (
      !confirm(
        `Are you sure you want to verify "${orgName}"?`
      )
    ) {
      return;
    }

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/admin/organizations/${orgId}/verify`, {
        method: 'POST',
        headers: { ...(csrfToken && { 'X-CSRF-Token': csrfToken }) },
      });

      if (response.ok) {
        alert('Organization verified successfully!');
        router.refresh();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to verify organization');
      }
    } catch (error) {
      alert('An error occurred while verifying the organization');
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

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/admin/organizations/${orgId}/verify`, {
        method: 'DELETE',
        headers: { ...(csrfToken && { 'X-CSRF-Token': csrfToken }) },
      });

      if (response.ok) {
        alert('Organization verification removed!');
        router.refresh();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to remove verification');
      }
    } catch (error) {
      alert('An error occurred while removing verification');
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Search */}
          <form onSubmit={handleSearch} className="lg:col-span-2">
            <label
              htmlFor="search"
              className="block text-sm font-medium text-gray-700 mb-2"
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

          {/* Type Filter */}
          <div>
            <label
              htmlFor="type"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Filter by Type
            </label>
            <select
              id="type"
              value={typeFilter}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                Search: "{searchInput}"
              </span>
            )}
            {typeFilter && (
              <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                Type:{' '}
                {
                  ORGANIZATION_TYPES.find((t) => t.value === typeFilter)
                    ?.label
                }
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

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Organizations</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {pagination.total}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Verified</div>
          <div className="text-2xl font-bold text-green-600 mt-1">
            {
              initialOrganizations.filter((org) => org.isVerified).length
            }
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Pending Verification</div>
          <div className="text-2xl font-bold text-yellow-600 mt-1">
            {
              initialOrganizations.filter((org) => !org.isVerified).length
            }
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Users</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {initialOrganizations.reduce(
              (sum, org) => sum + org._count.users,
              0
            )}
          </div>
        </div>
      </div>

      {/* Organizations Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Organization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Resources
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
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
                      className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeBadgeColor(
                        org.type
                      )}`}
                    >
                      {org.type.replace(/_/g, ' ')}
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
                    {org.isVerified ? (
                      <div className="flex flex-col">
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Verified
                        </span>
                        {org.verifiedAt && (
                          <span className="text-xs text-gray-500 mt-1">
                            {formatDate(org.verifiedAt)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                    )}
                  </td>

                  {/* Created */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(org.createdAt)}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() =>
                        router.push(`/admin/organizations/${org.id}`)
                      }
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      View
                    </button>
                    {!org.isVerified ? (
                      <button
                        onClick={() => handleVerify(org.id, org.name)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Verify
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUnverify(org.id, org.name)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Unverify
                      </button>
                    )}
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
              of <span className="font-medium">{pagination.total}</span>{' '}
              organizations
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
