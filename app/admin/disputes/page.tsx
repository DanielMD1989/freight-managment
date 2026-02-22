"use client";

/**
 * Admin Disputes Management Page
 *
 * Lists all disputes. Admin can update status and add resolutions.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Dispute {
  id: string;
  type: string;
  status: string;
  description: string;
  createdAt: string;
  load?: { id: string; referenceNumber?: string };
  createdBy?: { firstName?: string; lastName?: string };
  disputedOrg?: { name?: string };
}

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-yellow-100 text-yellow-800",
  UNDER_REVIEW: "bg-blue-100 text-blue-800",
  RESOLVED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-800",
};

const TYPE_LABELS: Record<string, string> = {
  PAYMENT_ISSUE: "Payment Issue",
  DAMAGE: "Damage",
  LATE_DELIVERY: "Late Delivery",
  QUALITY_ISSUE: "Quality Issue",
  OTHER: "Other",
};

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");

  const loadDisputes = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      const res = await fetch(`/api/disputes?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setDisputes(data.disputes || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    loadDisputes();
  }, [loadDisputes]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Disputes Management
        </h1>
        <p className="mt-1 text-gray-600">
          Review and resolve disputes across the platform
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {["OPEN", "UNDER_REVIEW", "RESOLVED", "CLOSED"].map((s) => (
          <div
            key={s}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="text-sm text-gray-600">{s.replace("_", " ")}</div>
            <div className="text-2xl font-bold text-gray-900">
              {disputes.filter((d) => d.status === s).length}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {["", "OPEN", "UNDER_REVIEW", "RESOLVED", "CLOSED"].map((s) => (
          <button
            key={s}
            onClick={() => {
              setFilterStatus(s);
              setLoading(true);
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              filterStatus === s
                ? "bg-blue-600 text-white"
                : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {s ? s.replace("_", " ") : "All"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : disputes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No disputes found</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Load
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Filed By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Against
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {disputes.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(d.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {TYPE_LABELS[d.type] || d.type}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {d.load?.referenceNumber || d.load?.id?.slice(0, 8) || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {d.createdBy
                      ? `${d.createdBy.firstName || ""} ${d.createdBy.lastName || ""}`.trim()
                      : "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {d.disputedOrg?.name || "-"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[d.status] || ""}`}
                    >
                      {d.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/admin/disputes/${d.id}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
