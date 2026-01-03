/**
 * Bypass Review Client Component
 *
 * Sprint 16 - Story 16.6: Anti-Bypass Detection & Incentives
 *
 * Client-side component for bypass review dashboard
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface FlaggedOrganization {
  id: string;
  name: string;
  type: string;
  isFlagged: boolean;
  flaggedAt: string | null;
  flagReason: string | null;
  suspiciousCancellationCount: number;
  bypassAttemptCount: number;
  cancellationRate: number;
  completionRate: number;
  totalLoadsCompleted: number;
  totalLoadsCancelled: number;
}

export default function BypassReviewClient() {
  const [organizations, setOrganizations] = useState<FlaggedOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'flagged'>('flagged');

  useEffect(() => {
    fetchFlaggedOrganizations();
  }, [filter]);

  const fetchFlaggedOrganizations = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use the new bypass warnings API endpoint
      const status = filter === 'flagged' ? 'flagged' : 'all';
      const response = await fetch(`/api/admin/bypass-warnings/organizations?status=${status}`);

      if (!response.ok) {
        throw new Error('Failed to fetch organizations');
      }

      const data = await response.json();
      setOrganizations(data.organizations || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const unflagOrganization = async (orgId: string) => {
    if (!confirm('Are you sure you want to unflag this organization?')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/bypass-warnings/organizations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          isFlagged: false,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to unflag organization');
      }

      // Refresh the list after successful unflag
      await fetchFlaggedOrganizations();
      alert('Organization unflagged successfully');
    } catch (err: any) {
      alert('Failed to unflag organization: ' + err.message);
    }
  };

  const getSeverityColor = (count: number) => {
    if (count >= 5) return 'text-red-600 bg-red-50 border-red-200';
    if (count >= 3) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 mt-4">Loading flagged organizations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold mb-2">Error</h3>
        <p className="text-red-700">{error}</p>
        <button
          onClick={fetchFlaggedOrganizations}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setFilter('flagged')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'flagged'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Flagged Only
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Organizations
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Flagged</p>
              <p className="text-3xl font-bold text-red-600 mt-1">
                {organizations.filter((o) => o.isFlagged).length}
              </p>
            </div>
            <svg
              className="w-12 h-12 text-red-200"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Bypass Reports</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">
                {organizations.reduce((sum, o) => sum + o.bypassAttemptCount, 0)}
              </p>
            </div>
            <svg
              className="w-12 h-12 text-orange-200"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Suspicious Cancellations</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">
                {organizations.reduce(
                  (sum, o) => sum + o.suspiciousCancellationCount,
                  0
                )}
              </p>
            </div>
            <svg
              className="w-12 h-12 text-yellow-200"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Organizations List */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {filter === 'flagged' ? 'Flagged Organizations' : 'All Organizations'}
          </h2>
        </div>

        {organizations.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-500">
              {filter === 'flagged'
                ? 'No flagged organizations found'
                : 'No organizations found'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {organizations.map((org) => (
              <div
                key={org.id}
                className={`px-6 py-4 hover:bg-gray-50 transition-colors ${
                  org.isFlagged ? 'bg-red-50/30' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {org.name}
                      </h3>
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                        {org.type}
                      </span>
                      {org.isFlagged && (
                        <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded font-medium">
                          FLAGGED
                        </span>
                      )}
                    </div>

                    {org.flagReason && (
                      <p className="text-sm text-red-700 mb-3 bg-red-50 border border-red-200 rounded px-3 py-2">
                        <strong>Reason:</strong> {org.flagReason}
                      </p>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Bypass Reports</p>
                        <p
                          className={`text-lg font-semibold ${
                            org.bypassAttemptCount >= 3
                              ? 'text-red-600'
                              : 'text-gray-900'
                          }`}
                        >
                          {org.bypassAttemptCount}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">
                          Suspicious Cancellations
                        </p>
                        <p
                          className={`text-lg font-semibold ${
                            org.suspiciousCancellationCount >= 3
                              ? 'text-orange-600'
                              : 'text-gray-900'
                          }`}
                        >
                          {org.suspiciousCancellationCount}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">Cancellation Rate</p>
                        <p
                          className={`text-lg font-semibold ${
                            org.cancellationRate > 50
                              ? 'text-red-600'
                              : org.cancellationRate > 30
                              ? 'text-yellow-600'
                              : 'text-green-600'
                          }`}
                        >
                          {org.cancellationRate.toFixed(1)}%
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">Completion Rate</p>
                        <p
                          className={`text-lg font-semibold ${
                            org.completionRate >= 90
                              ? 'text-green-600'
                              : org.completionRate >= 70
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }`}
                        >
                          {org.completionRate.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    {org.flaggedAt && (
                      <p className="text-xs text-gray-500 mt-2">
                        Flagged on{' '}
                        {new Date(org.flaggedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Link
                      href={`/admin/organizations/${org.id}`}
                      className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                    >
                      View Details
                    </Link>
                    {org.isFlagged && (
                      <button
                        onClick={() => unflagOrganization(org.id)}
                        className="px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded hover:bg-gray-200 transition-colors"
                      >
                        Unflag
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
