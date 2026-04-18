"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface DriverProfile {
  id: string;
  cdlNumber: string | null;
  cdlState: string | null;
  cdlExpiry: string | null;
  medicalCertExp: string | null;
  endorsements: Record<string, unknown> | null;
  cdlFrontUrl: string | null;
  cdlBackUrl: string | null;
  medicalCertUrl: string | null;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ActiveTrip {
  id: string;
  status: string;
  createdAt: string;
  load: {
    id: string;
    pickupCity: string | null;
    deliveryCity: string | null;
  } | null;
  truck: { id: string; licensePlate: string; truckType: string } | null;
}

interface DriverData {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string;
  status: string;
  createdAt: string;
  driverProfile: DriverProfile | null;
  activeTrips: ActiveTrip[];
}

const STATUS_LABELS: Record<string, { text: string; className: string }> = {
  INVITED: { text: "Invited", className: "bg-gray-100 text-gray-700" },
  PENDING_VERIFICATION: {
    text: "Pending Approval",
    className: "bg-yellow-100 text-yellow-700",
  },
  ACTIVE: { text: "Active", className: "bg-green-100 text-green-700" },
  SUSPENDED: { text: "Suspended", className: "bg-red-100 text-red-700" },
  REJECTED: { text: "Rejected", className: "bg-red-100 text-red-600" },
};

export default function DriverDetailClient({
  driver: initialDriver,
}: {
  driver: DriverData;
}) {
  const router = useRouter();
  const [driver, setDriver] = useState(initialDriver);
  const [error, setError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [toggling, setToggling] = useState(false);

  const name =
    [driver.firstName, driver.lastName].filter(Boolean).join(" ") ||
    "(no name)";
  const statusBadge = STATUS_LABELS[driver.status] ?? {
    text: driver.status,
    className: "bg-gray-100 text-gray-600",
  };

  async function csrfToken() {
    const res = await fetch("/api/csrf-token", { credentials: "include" });
    const data = await res.json();
    return (data.csrfToken ?? data.token) as string;
  }

  async function handleApprove() {
    try {
      const token = await csrfToken();
      const res = await fetch(`/api/drivers/${driver.id}/approve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Approve failed");
      }
      setDriver((d) => ({ ...d, status: "ACTIVE" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      setError("Rejection reason is required");
      return;
    }
    try {
      const token = await csrfToken();
      const res = await fetch(`/api/drivers/${driver.id}/reject`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Reject failed");
      }
      setDriver((d) => ({ ...d, status: "REJECTED" }));
      setShowRejectModal(false);
      setRejectReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    }
  }

  async function handleSuspend() {
    if (!confirm("Are you sure you want to suspend this driver?")) return;
    try {
      const token = await csrfToken();
      const res = await fetch(`/api/drivers/${driver.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "X-CSRF-Token": token },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Suspend failed");
      }
      setDriver((d) => ({ ...d, status: "SUSPENDED" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suspend failed");
    }
  }

  async function handleReactivate() {
    if (
      !confirm(
        "Reactivate this driver? They will be able to receive trip assignments again."
      )
    )
      return;
    try {
      const token = await csrfToken();
      const res = await fetch(`/api/drivers/${driver.id}/reactivate`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": token },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to reactivate");
      }
      setDriver((d) => ({ ...d, status: "ACTIVE" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reactivate failed");
    }
  }

  async function toggleAvailability() {
    if (!driver.driverProfile) return;
    setToggling(true);
    try {
      const token = await csrfToken();
      const res = await fetch(`/api/drivers/${driver.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
        body: JSON.stringify({
          isAvailable: !driver.driverProfile.isAvailable,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Update failed");
      }
      setDriver((d) => ({
        ...d,
        driverProfile: d.driverProfile
          ? { ...d.driverProfile, isAvailable: !d.driverProfile.isAvailable }
          : d.driverProfile,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setToggling(false);
    }
  }

  function fmtDate(d: string | null) {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/carrier/drivers"
        className="text-sm text-slate-500 hover:text-slate-300"
      >
        &larr; Back to Drivers
      </Link>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            dismiss
          </button>
        </div>
      )}

      {/* Header card */}
      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-800">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
              {name}
            </h1>
            <p className="text-sm text-slate-500">{driver.phone ?? "-"}</p>
            <p className="text-sm text-slate-400">{driver.email}</p>
            <p className="mt-1 text-xs text-slate-400">
              Joined {fmtDate(driver.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadge.className}`}
            >
              {statusBadge.text}
            </span>
            {driver.status === "PENDING_VERIFICATION" && (
              <div className="flex gap-2">
                <button
                  onClick={handleApprove}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  Approve
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Reject
                </button>
              </div>
            )}
            {driver.status === "ACTIVE" && (
              <button
                onClick={handleSuspend}
                className="rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200"
              >
                Suspend
              </button>
            )}
            {driver.status === "SUSPENDED" && (
              <button
                onClick={handleReactivate}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Reactivate
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CDL / Profile card */}
      {driver.driverProfile && (
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-800">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
              Driver Profile
            </h2>
            <button
              onClick={toggleAvailability}
              disabled={toggling || driver.status !== "ACTIVE"}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                driver.driverProfile.isAvailable
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : "bg-red-100 text-red-700 hover:bg-red-200"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {toggling
                ? "Updating..."
                : driver.driverProfile.isAvailable
                  ? "Available"
                  : "Unavailable"}
            </button>
          </div>

          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">CDL Number</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-200">
                {driver.driverProfile.cdlNumber ?? "-"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">CDL State</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-200">
                {driver.driverProfile.cdlState ?? "-"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">CDL Expiry</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-200">
                {fmtDate(driver.driverProfile.cdlExpiry)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">
                Medical Cert Expiry
              </dt>
              <dd className="font-medium text-slate-800 dark:text-slate-200">
                {fmtDate(driver.driverProfile.medicalCertExp)}
              </dd>
            </div>
          </dl>

          {/* CDL Photos */}
          <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              CDL Documents
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {(
                [
                  { label: "CDL Front", url: driver.driverProfile.cdlFrontUrl },
                  { label: "CDL Back", url: driver.driverProfile.cdlBackUrl },
                  {
                    label: "Medical Cert",
                    url: driver.driverProfile.medicalCertUrl,
                  },
                ] as const
              ).map(({ label, url }) => (
                <div key={label} className="text-center">
                  <p className="mb-1 text-xs text-slate-500">{label}</p>
                  {url ? (
                    <img
                      src={url}
                      alt={label}
                      className="h-24 w-full rounded-lg border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-900">
                      <span className="text-xs text-slate-400">
                        Not uploaded
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active trips */}
      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-800">
        <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-white">
          Active Trips ({driver.activeTrips?.length ?? 0})
        </h2>
        {!driver.activeTrips || driver.activeTrips.length === 0 ? (
          <p className="text-sm text-slate-500">No active trips.</p>
        ) : (
          <div className="space-y-3">
            {driver.activeTrips.map((trip) => (
              <div
                key={trip.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-700"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {trip.load?.pickupCity ?? "?"} &rarr;{" "}
                    {trip.load?.deliveryCity ?? "?"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Truck: {trip.truck?.licensePlate ?? "-"} | Status:{" "}
                    {trip.status}
                  </p>
                </div>
                <Link
                  href={`/carrier/trips/${trip.id}`}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  View Trip
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-800 dark:text-white">
              Reject Driver
            </h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (required)"
              className="mb-4 w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-indigo-500 focus:outline-none"
              rows={3}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
