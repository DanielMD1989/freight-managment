"use client";

/**
 * Shipper Disputes List Page
 *
 * Shows disputes where the shipper is a party (either created by them or involving their loads).
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

async function fetchCsrfToken(): Promise<string> {
  const res = await fetch("/api/csrf-token");
  const data = await res.json();
  return data.csrfToken;
}

export default function ShipperDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    type: "PAYMENT_ISSUE",
    description: "",
    loadId: "",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.loadId || !createForm.description) {
      setCreateError("Load ID and description are required");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const csrfToken = await fetchCsrfToken();
      const res = await fetch("/api/disputes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify(createForm),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create dispute");
      }
      setShowCreate(false);
      setCreateForm({ type: "PAYMENT_ISSUE", description: "", loadId: "" });
      await loadDisputes();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Disputes
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Manage and track your disputes
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          File Dispute
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-lg bg-white p-6 shadow dark:bg-slate-800"
        >
          <h3 className="font-semibold text-gray-900 dark:text-white">
            File a New Dispute
          </h3>
          {createError && <p className="text-sm text-red-600">{createError}</p>}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Load ID
            </label>
            <input
              type="text"
              value={createForm.loadId}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, loadId: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="Enter Load ID"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Type
            </label>
            <select
              value={createForm.type}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, type: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="PAYMENT_ISSUE">Payment Issue</option>
              <option value="DAMAGE">Damage</option>
              <option value="LATE_DELIVERY">Late Delivery</option>
              <option value="QUALITY_ISSUE">Quality Issue</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description
            </label>
            <textarea
              value={createForm.description}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, description: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              rows={4}
              placeholder="Describe the issue (min 10 characters)"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {creating ? "Submitting..." : "Submit Dispute"}
            </button>
          </div>
        </form>
      )}

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
              href={`/shipper/disputes/${d.id}`}
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
