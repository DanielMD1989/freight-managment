"use client";

/**
 * Audit Logs Client Component
 *
 * Interactive audit log viewer with filtering and search
 * Sprint 10 - Story 10.5: Audit Logs Viewer
 */

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
  result: "SUCCESS" | "FAILURE";
  details: Record<string, unknown> | null;
  timestamp: string;
}

const SEVERITY_OPTIONS = [
  { value: "", label: "All Severities" },
  { value: "INFO", label: "Info", color: "blue" },
  { value: "WARNING", label: "Warning", color: "yellow" },
  { value: "ERROR", label: "Error", color: "red" },
  { value: "CRITICAL", label: "Critical", color: "purple" },
];

const EVENT_TYPE_OPTIONS = [
  { value: "", label: "All Events" },
  { value: "AUTH_LOGIN_SUCCESS", label: "Login Success" },
  { value: "AUTH_LOGIN_FAILURE", label: "Login Failure" },
  { value: "AUTH_LOGOUT", label: "Logout" },
  { value: "AUTHZ_ACCESS_DENIED", label: "Access Denied" },
  { value: "FILE_UPLOAD", label: "File Upload" },
  { value: "FILE_DOWNLOAD", label: "File Download" },
  { value: "DOCUMENT_VERIFIED", label: "Document Verified" },
  { value: "DOCUMENT_REJECTED", label: "Document Rejected" },
  { value: "RATE_LIMIT_EXCEEDED", label: "Rate Limit Exceeded" },
  { value: "CSRF_VALIDATION_FAILED", label: "CSRF Validation Failed" },
];

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    INFO: "bg-blue-100 text-blue-800",
    WARNING: "bg-yellow-100 text-yellow-800",
    ERROR: "bg-red-100 text-red-800",
    CRITICAL: "bg-purple-100 text-purple-800",
  };
  return colors[severity] || "bg-gray-100 text-gray-800";
}

function getResultColor(result: string): string {
  return result === "SUCCESS"
    ? "bg-green-100 text-green-800"
    : "bg-red-100 text-red-800";
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
    initialFilters?.severity || ""
  );
  const [eventTypeFilter, setEventTypeFilter] = useState(
    initialFilters?.eventType || ""
  );
  const [startDate, setStartDate] = useState(initialFilters?.startDate || "");
  const [endDate, setEndDate] = useState(initialFilters?.endDate || "");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  /**
   * Apply filters
   */
  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());

    if (severityFilter) {
      params.set("severity", severityFilter);
    } else {
      params.delete("severity");
    }

    if (eventTypeFilter) {
      params.set("eventType", eventTypeFilter);
    } else {
      params.delete("eventType");
    }

    if (startDate) {
      params.set("startDate", startDate);
    } else {
      params.delete("startDate");
    }

    if (endDate) {
      params.set("endDate", endDate);
    } else {
      params.delete("endDate");
    }

    params.delete("offset"); // Reset to first page
    router.push(`/admin/audit-logs?${params.toString()}`);
  };

  /**
   * Clear filters
   */
  const clearFilters = () => {
    setSeverityFilter("");
    setEventTypeFilter("");
    setStartDate("");
    setEndDate("");
    router.push("/admin/audit-logs");
  };

  /**
   * Handle pagination
   */
  const handlePageChange = (newOffset: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("offset", newOffset.toString());
    router.push(`/admin/audit-logs?${params.toString()}`);
  };

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const hasActiveFilters =
    severityFilter || eventTypeFilter || startDate || endDate;

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-sm text-gray-600">Total Events</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">
            {total.toLocaleString()}
          </div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-sm text-gray-600">Info</div>
          <div className="mt-1 text-2xl font-bold text-blue-600">
            {initialLogs.filter((log) => log.severity === "INFO").length}
          </div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-sm text-gray-600">Warnings</div>
          <div className="mt-1 text-2xl font-bold text-yellow-600">
            {initialLogs.filter((log) => log.severity === "WARNING").length}
          </div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-sm text-gray-600">Errors</div>
          <div className="mt-1 text-2xl font-bold text-red-600">
            {
              initialLogs.filter(
                (log) => log.severity === "ERROR" || log.severity === "CRITICAL"
              ).length
            }
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Severity Filter */}
          <div>
            <label
              htmlFor="severity"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Severity
            </label>
            <select
              id="severity"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
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
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Event Type
            </label>
            <select
              id="eventType"
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
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
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Start Date
            </label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label
              htmlFor="endDate"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              End Date
            </label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Filter Actions */}
        <div className="mt-4 flex gap-3">
          <button
            onClick={applyFilters}
            className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700"
          >
            Apply Filters
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="rounded-lg border border-gray-300 px-6 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
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
                  Organization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Severity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Result
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {initialLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  {/* Timestamp */}
                  <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                    {formatDate(log.timestamp)}
                  </td>

                  {/* Event */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col text-sm">
                      <div className="font-medium text-gray-900">
                        {log.eventType.replace(/_/g, " ")}
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
                    {log.userEmail || "System"}
                  </td>

                  {/* Organization */}
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {log.organizationName || "-"}
                  </td>

                  {/* Severity */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs leading-5 font-semibold ${getSeverityColor(
                        log.severity
                      )}`}
                    >
                      {log.severity}
                    </span>
                  </td>

                  {/* Result */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs leading-5 font-semibold ${getResultColor(
                        log.result
                      )}`}
                    >
                      {log.result}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
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
          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-4">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{offset + 1}</span> to{" "}
              <span className="font-medium">
                {Math.min(offset + limit, total)}
              </span>{" "}
              of <span className="font-medium">{total.toLocaleString()}</span>{" "}
              events
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(offset + limit)}
                disabled={offset + limit >= total}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="mx-4 max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
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
                  <div className="mt-1 text-sm text-gray-900">
                    {selectedLog.eventType.replace(/_/g, " ")}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-500">
                    Timestamp
                  </div>
                  <div className="mt-1 text-sm text-gray-900">
                    {formatDate(selectedLog.timestamp)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-500">
                      Severity
                    </div>
                    <span
                      className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs leading-5 font-semibold ${getSeverityColor(
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
                      className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs leading-5 font-semibold ${getResultColor(
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
                    <div className="mt-1 text-sm text-gray-900">
                      {selectedLog.userEmail}
                    </div>
                  </div>
                )}

                {selectedLog.organizationName && (
                  <div>
                    <div className="text-sm font-medium text-gray-500">
                      Organization
                    </div>
                    <div className="mt-1 text-sm text-gray-900">
                      {selectedLog.organizationName}
                    </div>
                  </div>
                )}

                {selectedLog.ipAddress && (
                  <div>
                    <div className="text-sm font-medium text-gray-500">
                      IP Address
                    </div>
                    <div className="mt-1 text-sm text-gray-900">
                      {selectedLog.ipAddress}
                    </div>
                  </div>
                )}

                {selectedLog.resource && (
                  <div>
                    <div className="text-sm font-medium text-gray-500">
                      Resource
                    </div>
                    <div className="mt-1 text-sm text-gray-900">
                      {selectedLog.resource}
                      {selectedLog.resourceId && ` (${selectedLog.resourceId})`}
                    </div>
                  </div>
                )}

                {selectedLog.details && (
                  <div>
                    <div className="mb-2 text-sm font-medium text-gray-500">
                      Additional Details
                    </div>
                    <pre className="overflow-x-auto rounded border border-gray-200 bg-gray-50 p-3 text-xs">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="rounded-lg bg-gray-600 px-4 py-2 text-white transition-colors hover:bg-gray-700"
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
