/**
 * Global Audit Log Viewer Page
 *
 * View and filter audit logs for security monitoring
 * Sprint 10 - Story 10.5: Audit Logs Viewer
 * Sprint 16 - Story 16.9A: SuperAdmin Tools (Enhanced)
 */

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AuditLogViewerClient from "./AuditLogViewerClient";

/**
 * Global Audit Log Viewer Page - SuperAdmin Access
 */
export default async function AdminAuditLogsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Only Super Admins can access
  if (user.role !== "SUPER_ADMIN") {
    redirect("/unauthorized");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Global Audit Log Viewer
          </h1>
          <p className="mt-2 text-gray-600">
            View and filter all platform activity and security events
          </p>
        </div>

        {/* Info Panel */}
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h3 className="mb-3 font-semibold text-blue-900">About Audit Logs</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="font-bold">&bull;</span>
              <span>
                <strong>Security Events:</strong> Authentication attempts,
                permission changes, and access violations
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">&bull;</span>
              <span>
                <strong>Data Operations:</strong> Create, update, and delete
                operations on critical resources
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">&bull;</span>
              <span>
                <strong>System Events:</strong> Configuration changes,
                automation runs, and system alerts
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">&bull;</span>
              <span>
                <strong>Compliance:</strong> All events are immutable and
                retained for audit and compliance purposes
              </span>
            </li>
          </ul>
        </div>

        {/* Client Component */}
        <AuditLogViewerClient />
      </div>
    </div>
  );
}
