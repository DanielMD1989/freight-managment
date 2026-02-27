/**
 * Audit Log Viewer Client Component
 *
 * Sprint 16 - Story 16.9A: SuperAdmin Tools
 * Task 16.9A.7: Global Audit Log Viewer
 *
 * Allows SuperAdmins to view and filter all platform audit logs
 */

"use client";

import { useEffect, useState } from "react";

interface AuditLogMetadata {
  [key: string]:
    | string
    | number
    | boolean
    | null
    | undefined
    | AuditLogMetadata;
}

interface AuditLog {
  id: string;
  eventType: string;
  severity: string;
  userId: string | null;
  organizationId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  resource: string | null;
  resourceId: string | null;
  action: string | null;
  result: string;
  message: string;
  metadata: AuditLogMetadata | null;
  timestamp: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  } | null;
  organization?: {
    id: string;
    name: string;
    type: string;
  } | null;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

export default function AuditLogViewerClient() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("");
  const [resultFilter, setResultFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    fetchAuditLogs();
  }, [severityFilter, eventTypeFilter, resultFilter, limit, offset]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (severityFilter) params.append("severity", severityFilter);
      if (eventTypeFilter) params.append("eventType", eventTypeFilter);
      if (resultFilter) params.append("result", resultFilter);
      params.append("limit", limit.toString());
      params.append("offset", offset.toString());

      const response = await fetch(`/api/admin/audit-logs?${params}`);

      if (response.ok) {
        const data: AuditLogsResponse = await response.json();
        setLogs(data.logs);
        setTotalCount(data.total);
      } else {
        console.error("Failed to fetch audit logs");
      }
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-red-100 text-red-800 border-red-300";
      case "ERROR":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "WARNING":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "INFO":
      default:
        return "bg-blue-100 text-blue-800 border-blue-300";
    }
  };

  const getResultColor = (result: string) => {
    return result === "SUCCESS" ? "text-green-600" : "text-red-600";
  };

  const handleSearch = () => {
    setOffset(0);
    fetchAuditLogs();
  };

  const handleNextPage = () => {
    setOffset(offset + limit);
  };

  const handlePreviousPage = () => {
    setOffset(Math.max(0, offset - limit));
  };

  if (loading && logs.length === 0) {
    return (
      <div className="rounded-lg bg-white p-12 text-center shadow">
        <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading audit logs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Filters</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Severity
            </label>
            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setOffset(0);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="CRITICAL">Critical</option>
              <option value="ERROR">Error</option>
              <option value="WARNING">Warning</option>
              <option value="INFO">Info</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Result
            </label>
            <select
              value={resultFilter}
              onChange={(e) => {
                setResultFilter(e.target.value);
                setOffset(0);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILURE">Failure</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Event Type
            </label>
            <input
              type="text"
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  setOffset(0);
                  fetchAuditLogs();
                }
              }}
              placeholder="e.g., AUTH_LOGIN"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Records per page
            </label>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(parseInt(e.target.value));
                setOffset(0);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
          <p className="text-sm text-gray-600">Total Logs</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {totalCount.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
          <p className="text-sm text-gray-600">Showing</p>
          <p className="mt-1 text-3xl font-bold text-blue-600">{logs.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
          <p className="text-sm text-gray-600">Page</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {Math.floor(offset / limit) + 1}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
          <p className="text-sm text-gray-600">Failures</p>
          <p className="mt-1 text-3xl font-bold text-red-600">
            {logs.filter((l) => l.result === "FAILURE").length}
          </p>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
        {logs.length === 0 ? (
          <div className="p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No audit logs found
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your filters
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Event
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Severity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Result
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Message
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setSelectedLog(log)}
                    >
                      <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {log.eventType}
                        </div>
                        {log.action && (
                          <div className="text-xs text-gray-500">
                            {log.action}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.user ? (
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">
                              {log.user.firstName} {log.user.lastName}
                            </div>
                            <div className="text-gray-500">
                              {log.user.email}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded border px-2 py-1 text-xs leading-5 font-semibold ${getSeverityColor(
                            log.severity
                          )}`}
                        >
                          {log.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`text-sm font-bold ${getResultColor(
                            log.result
                          )}`}
                        >
                          {log.result}
                        </span>
                      </td>
                      <td className="max-w-md truncate px-6 py-4 text-sm text-gray-900">
                        {log.message}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-3">
              <div className="flex flex-1 justify-between sm:hidden">
                <button
                  onClick={handlePreviousPage}
                  disabled={offset === 0}
                  className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={offset + limit >= totalCount}
                  className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{offset + 1}</span> to{" "}
                    <span className="font-medium">
                      {Math.min(offset + limit, totalCount)}
                    </span>{" "}
                    of <span className="font-medium">{totalCount}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex -space-x-px rounded-md shadow-sm">
                    <button
                      onClick={handlePreviousPage}
                      disabled={offset === 0}
                      className="relative inline-flex items-center rounded-l-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={handleNextPage}
                      disabled={offset + limit >= totalCount}
                      className="relative inline-flex items-center rounded-r-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div
          className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="mx-4 max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  Audit Log Details
                </h2>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Event Type:</span>
                  <p className="font-medium text-gray-900">
                    {selectedLog.eventType}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">Timestamp:</span>
                  <p className="font-medium text-gray-900">
                    {new Date(selectedLog.timestamp).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">Severity:</span>
                  <p>
                    <span
                      className={`inline-flex rounded border px-2 py-1 text-xs leading-5 font-semibold ${getSeverityColor(
                        selectedLog.severity
                      )}`}
                    >
                      {selectedLog.severity}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">Result:</span>
                  <p
                    className={`font-bold ${getResultColor(selectedLog.result)}`}
                  >
                    {selectedLog.result}
                  </p>
                </div>
                {selectedLog.user && (
                  <>
                    <div>
                      <span className="text-gray-600">User:</span>
                      <p className="font-medium text-gray-900">
                        {selectedLog.user.firstName} {selectedLog.user.lastName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {selectedLog.user.email}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Role:</span>
                      <p className="font-medium text-gray-900">
                        {selectedLog.user.role}
                      </p>
                    </div>
                  </>
                )}
                {selectedLog.organization && (
                  <div>
                    <span className="text-gray-600">Organization:</span>
                    <p className="font-medium text-gray-900">
                      {selectedLog.organization.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedLog.organization.type}
                    </p>
                  </div>
                )}
                {selectedLog.ipAddress && (
                  <div>
                    <span className="text-gray-600">IP Address:</span>
                    <p className="font-medium text-gray-900">
                      {selectedLog.ipAddress}
                    </p>
                  </div>
                )}
                {selectedLog.resource && (
                  <>
                    <div>
                      <span className="text-gray-600">Resource:</span>
                      <p className="font-medium text-gray-900">
                        {selectedLog.resource}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Resource ID:</span>
                      <p className="font-medium text-gray-900">
                        {selectedLog.resourceId || "N/A"}
                      </p>
                    </div>
                  </>
                )}
                {selectedLog.action && (
                  <div>
                    <span className="text-gray-600">Action:</span>
                    <p className="font-medium text-gray-900">
                      {selectedLog.action}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <span className="text-sm text-gray-600">Message:</span>
                <p className="mt-1 rounded bg-gray-50 p-3 text-sm font-medium text-gray-900">
                  {selectedLog.message}
                </p>
              </div>

              {selectedLog.userAgent && (
                <div>
                  <span className="text-sm text-gray-600">User Agent:</span>
                  <p className="mt-1 rounded bg-gray-50 p-3 text-xs break-all text-gray-700">
                    {selectedLog.userAgent}
                  </p>
                </div>
              )}

              {selectedLog.metadata &&
                Object.keys(selectedLog.metadata).length > 0 && (
                  <div>
                    <span className="text-sm text-gray-600">Metadata:</span>
                    <pre className="mt-1 max-h-64 overflow-auto rounded bg-gray-50 p-3 text-xs text-gray-700">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}
            </div>

            <div className="border-t border-gray-200 bg-gray-50 p-6">
              <button
                onClick={() => setSelectedLog(null)}
                className="w-full rounded-lg bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
