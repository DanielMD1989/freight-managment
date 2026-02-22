"use client";

/**
 * Shipper Dispute Detail Page
 */

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

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
  };
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

export default function ShipperDisputeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/disputes/${params.id}`);
        if (!res.ok) throw new Error("Failed to fetch dispute");
        const data = await res.json();
        setDispute(data.dispute ?? data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  if (loading)
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Dispute Details
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-lg bg-white p-6 shadow dark:bg-slate-800">
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
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
              Description
            </h2>
            <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
              {dispute.description}
            </p>

            {dispute.evidenceUrls.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-medium text-gray-900 dark:text-white">
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
              <div className="mt-6 rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
                <h3 className="mb-1 text-sm font-medium text-green-800 dark:text-green-300">
                  Resolution
                </h3>
                <p className="text-green-700 dark:text-green-400">
                  {dispute.resolution}
                </p>
                {dispute.resolvedAt && (
                  <p className="mt-1 text-xs text-green-600">
                    Resolved: {new Date(dispute.resolvedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg bg-white p-6 shadow dark:bg-slate-800">
            <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">
              Details
            </h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Filed</dt>
                <dd className="text-gray-900 dark:text-white">
                  {new Date(dispute.createdAt).toLocaleString()}
                </dd>
              </div>
              {dispute.createdBy && (
                <div>
                  <dt className="text-gray-500">Filed By</dt>
                  <dd className="text-gray-900 dark:text-white">
                    {dispute.createdBy.firstName} {dispute.createdBy.lastName}
                  </dd>
                </div>
              )}
              {dispute.disputedOrg && (
                <div>
                  <dt className="text-gray-500">Against</dt>
                  <dd className="text-gray-900 dark:text-white">
                    {dispute.disputedOrg.name}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500">Last Updated</dt>
                <dd className="text-gray-900 dark:text-white">
                  {new Date(dispute.updatedAt).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>

          {dispute.load && (
            <div className="rounded-lg bg-white p-6 shadow dark:bg-slate-800">
              <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">
                Related Load
              </h3>
              <dl className="space-y-3 text-sm">
                {dispute.load.referenceNumber && (
                  <div>
                    <dt className="text-gray-500">Reference</dt>
                    <dd className="text-gray-900 dark:text-white">
                      {dispute.load.referenceNumber}
                    </dd>
                  </div>
                )}
                {dispute.load.origin && (
                  <div>
                    <dt className="text-gray-500">Route</dt>
                    <dd className="text-gray-900 dark:text-white">
                      {dispute.load.origin} &rarr; {dispute.load.destination}
                    </dd>
                  </div>
                )}
              </dl>
              <Link
                href={`/shipper/loads/${dispute.load.id}`}
                className="mt-3 block text-sm text-blue-600 hover:underline"
              >
                View Load
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
