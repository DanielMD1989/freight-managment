"use client";

/**
 * Carrier Disputes List Page
 *
 * Shows disputes where the carrier is a party (either created by them or involving their loads).
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

export default function CarrierDisputesPage() {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Disputes
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            View and track your disputes
          </p>
        </div>
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
                : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-300"
            }`}
          >
            {s ? s.replace("_", " ") : "All"}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-4">
        {loading ? (
          <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow dark:bg-slate-800">
            Loading...
          </div>
        ) : disputes.length === 0 ? (
          <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow dark:bg-slate-800">
            No disputes found
          </div>
        ) : (
          disputes.map((d) => (
            <Link
              key={d.id}
              href={`/carrier/disputes/${d.id}`}
              className="block rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-md dark:bg-slate-800"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[d.status] || ""}`}
                    >
                      {d.status.replace("_", " ")}
                    </span>
                    <span className="text-sm text-gray-500">
                      {TYPE_LABELS[d.type] || d.type}
                    </span>
                  </div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {d.description.slice(0, 120)}
                    {d.description.length > 120 ? "..." : ""}
                  </p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                    {d.load?.referenceNumber && (
                      <span>Load: {d.load.referenceNumber}</span>
                    )}
                    <span>{new Date(d.createdAt).toLocaleDateString()}</span>
                    {d.createdBy && (
                      <span>
                        By: {d.createdBy.firstName} {d.createdBy.lastName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
