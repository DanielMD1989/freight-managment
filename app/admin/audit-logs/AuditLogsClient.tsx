'use client';

/**
 * Audit Logs Client Component
 *
 * Interactive audit log viewer with filtering and search
 * Sprint 10 - Story 10.5: Audit Logs Viewer
 */

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface AuditLog {
  id: string;
  eventType: string;
  severity: string;
  userId: string | null;
  userEmail: string | null;
  organizationId: string | null;
  organizationName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  resource: string | null;
  resourceId: string | null;
  action: string | null;
  result: 'SUCCESS' | 'FAILURE';
  details: Record<string, any> | null;
  timestamp: string;
}

const SEVERITY_OPTIONS = [
  { value: '', label: 'All Severities' },
  { value: 'INFO', label: 'Info', color: 'blue' },
  { value: 'WARNING', label: 'Warning', color: 'yellow' },
  { value: 'ERROR', label: 'Error', color: 'red' },
  { value: 'CRITICAL', label: 'Critical', color: 'purple' },
];

const EVENT_TYPE_OPTIONS = [
  { value: '', label: 'All Events' },
  { value: 'AUTH_LOGIN_SUCCESS', label: 'Login Success' },
  { value: 'AUTH_LOGIN_FAILURE', label: 'Login Failure' },
  { value: 'AUTH_LOGOUT', label: 'Logout' },
  { value: 'AUTHZ_ACCESS_DENIED', label: 'Access Denied' },
  { value: 'FILE_UPLOAD', label: 'File Upload' },
  { value: 'FILE_DOWNLOAD', label: 'File Download' },
  { value: 'DOCUMENT_VERIFIED', label: 'Document Verified' },
  { value: 'DOCUMENT_REJECTED', label: 'Document Rejected' },
  { value: 'RATE_LIMIT_EXCEEDED', label: 'Rate Limit Exceeded' },
  { value: 'CSRF_VALIDATION_FAILED', label: 'CSRF Validation Failed' },
];

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    INFO: 'bg-blue-100 text-blue-800',
    WARNING: 'bg-yellow-100 text-yellow-800',
    ERROR: 'bg-red-100 text-red-800',
    CRITICAL: 'bg-purple-100 text-purple-800',
  };
  return colors[severity] || 'bg-gray-100 text-gray-800';
}

function getResultColor(result: string): string {
  return result === 'SUCCESS'
    ? 'bg-green-100 text-green-800'
    : 'bg-red-100 text-red-800';
}

export default function AuditLogsClient({
  initialLogs,
  total,
  limit,
  offset,
  initialFilters,
}: {
  initialLogs: AuditLog[];
  total: number;
  limit: number;
  offset: number;
  initialFilters?: {
    severity?: string;
    eventType?: string;
    userId?: string;
    organizationId?: string;
    startDate?: string;
    endDate?: string;
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [severityFilter, setSeverityFilter] = useState(
    initialFilters?.severity || ''
  );
  const [eventTypeFilter, setEventTypeFilter] = useState(
    initialFilters?.eventType || ''
  );
  const [startDate, setStartDate] = useState(initialFilters?.startDate || '');
  const [endDate, setEndDate] = useState(initialFilters?.endDate || '');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  /**
   * Apply filters
   */
  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());

    if (severityFilter) {
      params.set('severity', severityFilter);
    } else {
      params.delete('severity');
    }

    if (eventTypeFilter) {
      params.set('eventType', eventTypeFilter);
    } else {
      params.delete('eventType');
    }

    if (startDate) {
      params.set('startDate', startDate);
    } else {
      params.delete('startDate');
    }

    if (endDate) {
      params.set('endDate', endDate);
    } else {
      params.delete('endDate');
    }

    params.delete('offset'); // Reset to first page
    router.push(`/admin/audit-logs?${params.toString()}`);
  };

  /**
   * Clear filters
   */
  const clearFilters = () => {
    setSeverityFilter('');
    setEventTypeFilter('');
    setStartDate('');
    setEndDate('');
    router.push('/admin/audit-logs');
  };

  /**
   * Handle pagination
   */
  const handlePageChange = (newOffset: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('offset', newOffset.toString());
    router.push(`/admin/audit-logs?${params.toString()}`);
  };

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const hasActiveFilters =
    severityFilter || eventTypeFilter || startDate || endDate;

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Events</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {total.toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Info</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {initialLogs.filter((log) => log.severity === 'INFO').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Warnings</div>
          <div className="text-2xl font-bold text-yellow-600 mt-1">
            {initialLogs.filter((log) => log.severity === 'WARNING').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Errors</div>
          <div className="text-2xl font-bold text-red-600 mt-1">
            {
              initialLogs.filter(
                (log) => log.severity === 'ERROR' || log.severity === 'CRITICAL'
              ).length
            }
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Severity Filter */}
          <div>
            <label
              htmlFor="severity"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Severity
            </label>
            <select
              id="severity"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {SEVERITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Event Type Filter */}
          <div>
            <label
              htmlFor="eventType"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Event Type
            </label>
            <select
              id="eventType"
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {EVENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label
              htmlFor="startDate"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Start Date
            </label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* End Date */}
          <div>
            <label
              htmlFor="endDate"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              End Date
            </label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Filter Actions */}
        <div className="mt-4 flex gap-3">
          <button
            onClick={applyFilters}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Apply Filters
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Organization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Severity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Result
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {initialLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  {/* Timestamp */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(log.timestamp)}
                  </td>

                  {/* Event */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col text-sm">
                      <div className="font-medium text-gray-900">
                        {log.eventType.replace(/_/g, ' ')}
                      </div>
                      {log.resource && (
                        <div className="text-xs text-gray-500">
                          {log.resource}
                          {log.resourceId && `: ${log.resourceId.slice(0, 8)}`}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* User */}
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {log.userEmail || 'System'}
                  </td>

                  {/* Organization */}
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {log.organizationName || '-'}
                  </td>

                  {/* Severity */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getSeverityColor(
                        log.severity
                      )}`}
                    >
                      {log.severity}
                    </span>
                  </td>

                  {/* Result */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getResultColor(
                        log.result
                      )}`}
                    >
                      {log.result}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}

              {initialLogs.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    No audit logs found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
            <div className="text-sm text-gray-700">
              Showing{' '}
              <span className="font-medium">{offset + 1}</span> to{' '}
              <span className="font-medium">
                {Math.min(offset + limit, total)}
              </span>{' '}
              of <span className="font-medium">{total.toLocaleString()}</span>{' '}
              events
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(offset + limit)}
                disabled={offset + limit >= total}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Audit Log Details
                </h3>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-gray-500">
                    Event Type
                  </div>
                  <div className="text-sm text-gray-900 mt-1">
                    {selectedLog.eventType.replace(/_/g, ' ')}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-500">
                    Timestamp
                  </div>
                  <div className="text-sm text-gray-900 mt-1">
                    {formatDate(selectedLog.timestamp)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-500">
                      Severity
                    </div>
                    <span
                      className={`mt-1 px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getSeverityColor(
                        selectedLog.severity
                      )}`}
                    >
                      {selectedLog.severity}
                    </span>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-gray-500">
                      Result
                    </div>
                    <span
                      className={`mt-1 px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getResultColor(
                        selectedLog.result
                      )}`}
                    >
                      {selectedLog.result}
                    </span>
                  </div>
                </div>

                {selectedLog.userEmail && (
                  <div>
                    <div className="text-sm font-medium text-gray-500">
                      User
                    </div>
                    <div className="text-sm text-gray-900 mt-1">
                      {selectedLog.userEmail}
                    </div>
                  </div>
                )}

                {selectedLog.organizationName && (
                  <div>
                    <div className="text-sm font-medium text-gray-500">
                      Organization
                    </div>
                    <div className="text-sm text-gray-900 mt-1">
                      {selectedLog.organizationName}
                    </div>
                  </div>
                )}

                {selectedLog.ipAddress && (
                  <div>
                    <div className="text-sm font-medium text-gray-500">
                      IP Address
                    </div>
                    <div className="text-sm text-gray-900 mt-1">
                      {selectedLog.ipAddress}
                    </div>
                  </div>
                )}

                {selectedLog.resource && (
                  <div>
                    <div className="text-sm font-medium text-gray-500">
                      Resource
                    </div>
                    <div className="text-sm text-gray-900 mt-1">
                      {selectedLog.resource}
                      {selectedLog.resourceId && ` (${selectedLog.resourceId})`}
                    </div>
                  </div>
                )}

                {selectedLog.details && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-2">
                      Additional Details
                    </div>
                    <pre className="text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
