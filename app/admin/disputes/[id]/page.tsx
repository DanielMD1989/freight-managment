"use client";

/**
 * Admin Dispute Detail Page
 *
 * Admins can view full details and update status/resolution.
 */

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

interface DisputeDetail {
  id: string;
  type: string;
  status: string;
  description: string;
  evidenceUrls: string[];
  resolution?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  load?: {
    id: string;
    referenceNumber?: string;
    origin?: string;
    destination?: string;
    status?: string;
  };
  createdBy?: { firstName?: string; lastName?: string; email?: string };
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

async function fetchCsrfToken(): Promise<string> {
  const res = await fetch("/api/csrf-token");
  const data = await res.json();
  return data.csrfToken;
}

export default function AdminDisputeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updateForm, setUpdateForm] = useState({ status: "", resolution: "" });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/disputes/${params.id}`);
        if (!res.ok) throw new Error("Failed to fetch dispute");
        const data = await res.json();
        const d = data.dispute ?? data;
        setDispute(d);
        setUpdateForm({ status: d.status, resolution: d.resolution || "" });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    try {
      const csrfToken = await fetchCsrfToken();
      const body: Record<string, string> = {};
      if (updateForm.status !== dispute?.status)
        body.status = updateForm.status;
      if (updateForm.resolution !== (dispute?.resolution || ""))
        body.resolution = updateForm.resolution;

      if (Object.keys(body).length === 0) {
        setUpdating(false);
        return;
      }

      const res = await fetch(`/api/disputes/${params.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Update failed");
      }
      const data = await res.json();
      setDispute(data.dispute ?? data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setUpdating(false);
    }
  };

  if (loading)
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (error && !dispute)
    return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!dispute)
    return (
      <div className="p-8 text-center text-gray-500">Dispute not found</div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="text-gray-500 hover:text-gray-700"
        >
          &larr; Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Dispute Details</h1>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <span className="text-sm text-red-800">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="mb-4 flex items-center gap-3">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${STATUS_STYLES[dispute.status] || ""}`}
              >
                {dispute.status.replace("_", " ")}
              </span>
              <span className="text-sm text-gray-500">
                {TYPE_LABELS[dispute.type] || dispute.type}
              </span>
            </div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              Description
            </h2>
            <p className="whitespace-pre-wrap text-gray-700">
              {dispute.description}
            </p>

            {dispute.evidenceUrls.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-medium text-gray-900">
                  Evidence
                </h3>
                <ul className="space-y-1">
                  {dispute.evidenceUrls.map((url, i) => (
                    <li key={i}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Evidence {i + 1}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {dispute.resolution && (
              <div className="mt-6 rounded-lg bg-green-50 p-4">
                <h3 className="mb-1 text-sm font-medium text-green-800">
                  Resolution
                </h3>
                <p className="text-green-700">{dispute.resolution}</p>
                {dispute.resolvedAt && (
                  <p className="mt-1 text-xs text-green-600">
                    Resolved: {new Date(dispute.resolvedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Admin Update Form */}
          <form
            onSubmit={handleUpdate}
            className="space-y-4 rounded-lg bg-white p-6 shadow"
          >
            <h3 className="font-semibold text-gray-900">Update Dispute</h3>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                value={updateForm.status}
                onChange={(e) =>
                  setUpdateForm((f) => ({ ...f, status: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="OPEN">Open</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Resolution Notes
              </label>
              <textarea
                value={updateForm.resolution}
                onChange={(e) =>
                  setUpdateForm((f) => ({ ...f, resolution: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                rows={4}
                placeholder="Enter resolution details..."
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={updating}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {updating ? "Saving..." : "Update Dispute"}
              </button>
            </div>
          </form>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 font-semibold text-gray-900">Details</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Filed</dt>
                <dd className="text-gray-900">
                  {new Date(dispute.createdAt).toLocaleString()}
                </dd>
              </div>
              {dispute.createdBy && (
                <div>
                  <dt className="text-gray-500">Filed By</dt>
                  <dd className="text-gray-900">
                    {dispute.createdBy.firstName} {dispute.createdBy.lastName}
                  </dd>
                  {dispute.createdBy.email && (
                    <dd className="text-xs text-gray-500">
                      {dispute.createdBy.email}
                    </dd>
                  )}
                </div>
              )}
              {dispute.disputedOrg && (
                <div>
                  <dt className="text-gray-500">Against</dt>
                  <dd className="text-gray-900">{dispute.disputedOrg.name}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500">Last Updated</dt>
                <dd className="text-gray-900">
                  {new Date(dispute.updatedAt).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>

          {dispute.load && (
            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="mb-4 font-semibold text-gray-900">Related Load</h3>
              <dl className="space-y-3 text-sm">
                {dispute.load.referenceNumber && (
                  <div>
                    <dt className="text-gray-500">Reference</dt>
                    <dd className="text-gray-900">
                      {dispute.load.referenceNumber}
                    </dd>
                  </div>
                )}
                {dispute.load.origin && (
                  <div>
                    <dt className="text-gray-500">Route</dt>
                    <dd className="text-gray-900">
                      {dispute.load.origin} &rarr; {dispute.load.destination}
                    </dd>
                  </div>
                )}
                {dispute.load.status && (
                  <div>
                    <dt className="text-gray-500">Load Status</dt>
                    <dd className="text-gray-900">{dispute.load.status}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
