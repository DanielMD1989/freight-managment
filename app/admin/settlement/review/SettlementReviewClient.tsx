/**
 * Settlement Review Client Component
 *
 * Sprint 16 - Story 16.9A: SuperAdmin Tools
 * Task 16.9A.4: Global Settlement Review Dashboard
 *
 * Allows SuperAdmins to review and manage settlements globally
 */

"use client";

import { useEffect, useState } from "react";
import { getCSRFToken } from "@/lib/csrfFetch";

// Simple time-ago utility function
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12)
    return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} year${diffYears > 1 ? "s" : ""} ago`;
}

type SettlementStatus = "PENDING" | "PAID" | "DISPUTE";

interface Load {
  id: string;
  pickupCity: string | null;
  deliveryCity: string | null;
  cargoDescription: string;
  status: string;
  settlementStatus: string;
  podSubmittedAt: Date | null;
  podVerifiedAt: Date | null;
  createdAt: Date;
  shipper: {
    id: string;
    name: string;
    isVerified: boolean;
  } | null;
  assignedTruck: {
    id: string;
    licensePlate: string;
    carrier: {
      id: string;
      name: string;
      isVerified: boolean;
    };
  } | null;
  settlementRecord: {
    id: string;
    grossAmount: number;
    serviceFeeAmount: number;
    netAmount: number;
    paymentStatus: string;
    processedAt: Date;
  } | null;
}

interface SettlementResponse {
  loads: Load[];
  totalCount: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export default function SettlementReviewClient() {
  const [activeTab, setActiveTab] = useState<SettlementStatus>("PENDING");
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedLoad, setSelectedLoad] = useState<Load | null>(null);
  const [approving, setApproving] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [approvalSuccess, setApprovalSuccess] = useState<string | null>(null);
  // L41 FIX: Add fetch error state to surface API failures
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettlements();
  }, [activeTab]);

  const fetchSettlements = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const response = await fetch(
        `/api/admin/settlements?status=${activeTab}&limit=100`
      );

      if (response.ok) {
        const data: SettlementResponse = await response.json();
        setLoads(data.loads);
        setTotalCount(data.totalCount);
      } else {
        // L41 FIX: Set error state instead of just logging
        setFetchError("Failed to fetch settlements");
        console.error("Failed to fetch settlements");
      }
    } catch (error) {
      // L41 FIX: Set error state instead of just logging
      setFetchError("Network error while fetching settlements");
      console.error("Error fetching settlements:", error);
    } finally {
      setLoading(false);
    }
  };

  const getSettlementAmount = (load: Load) => {
    if (load.settlementRecord) {
      return load.settlementRecord.grossAmount;
    }
    return 0; // Freight price negotiated off-platform
  };

  const getServiceFeeAmount = (load: Load) => {
    if (load.settlementRecord) {
      return load.settlementRecord.serviceFeeAmount;
    }
    return 0;
  };

  const getNetAmount = (load: Load) => {
    if (load.settlementRecord) {
      return load.settlementRecord.netAmount;
    }
    return 0; // Will be calculated when settlement record is created
  };

  const handleApproveSettlement = async (loadId: string) => {
    setApproving(true);
    setApprovalError(null);
    setApprovalSuccess(null);

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/admin/settlements/${loadId}/approve`, {
        method: "POST",
        headers: { ...(csrfToken && { "X-CSRF-Token": csrfToken }) },
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to approve settlement");
      }

      setApprovalSuccess("Settlement approved successfully!");

      // Refresh the settlements list
      await fetchSettlements();

      // Close modal after a short delay
      setTimeout(() => {
        setSelectedLoad(null);
        setApprovalSuccess(null);
      }, 2000);
    } catch (error) {
      setApprovalError(
        error instanceof Error ? error.message : "Failed to approve settlement"
      );
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-[#064d51]/10 bg-white p-12 text-center shadow-sm">
        <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-[#1e9c99]"></div>
        <p className="mt-4 text-[#064d51]/70">Loading settlements...</p>
      </div>
    );
  }

  // L41 FIX: Show error state to user
  if (fetchError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h3 className="mb-2 font-semibold text-red-800">Error</h3>
        <p className="text-red-700">{fetchError}</p>
        <button
          onClick={fetchSettlements}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="rounded-xl border border-[#064d51]/10 bg-white shadow-sm">
        <div className="border-b border-[#064d51]/10">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab("PENDING")}
              className={`border-b-2 px-6 py-3 text-sm font-medium ${
                activeTab === "PENDING"
                  ? "border-[#1e9c99] text-[#064d51]"
                  : "border-transparent text-[#064d51]/60 hover:border-[#064d51]/30 hover:text-[#064d51]"
              }`}
            >
              Pending Review
              {activeTab === "PENDING" && totalCount > 0 && (
                <span className="ml-2 rounded-full bg-[#1e9c99]/15 px-2 py-0.5 text-xs text-[#0d6b69]">
                  {totalCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("PAID")}
              className={`border-b-2 px-6 py-3 text-sm font-medium ${
                activeTab === "PAID"
                  ? "border-[#1e9c99] text-[#064d51]"
                  : "border-transparent text-[#064d51]/60 hover:border-[#064d51]/30 hover:text-[#064d51]"
              }`}
            >
              Settled
              {activeTab === "PAID" && totalCount > 0 && (
                <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                  {totalCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("DISPUTE")}
              className={`border-b-2 px-6 py-3 text-sm font-medium ${
                activeTab === "DISPUTE"
                  ? "border-[#1e9c99] text-[#064d51]"
                  : "border-transparent text-[#064d51]/60 hover:border-[#064d51]/30 hover:text-[#064d51]"
              }`}
            >
              Disputes
              {activeTab === "DISPUTE" && totalCount > 0 && (
                <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800">
                  {totalCount}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[#064d51]/10 bg-white p-6 shadow-sm">
          <p className="text-sm text-[#064d51]/70">Total Settlements</p>
          <p className="mt-1 text-3xl font-bold text-[#064d51]">{totalCount}</p>
        </div>
        <div className="rounded-xl border border-[#064d51]/10 bg-white p-6 shadow-sm">
          <p className="text-sm text-[#064d51]/70">Total Gross Amount</p>
          <p className="mt-1 text-3xl font-bold text-[#064d51]">
            {loads
              .reduce((sum, load) => sum + getSettlementAmount(load), 0)
              .toLocaleString()}{" "}
            ETB
          </p>
        </div>
        <div className="rounded-xl border border-[#064d51]/10 bg-white p-6 shadow-sm">
          <p className="text-sm text-[#064d51]/70">Total Service Fees</p>
          <p className="mt-1 text-3xl font-bold text-[#1e9c99]">
            {loads
              .reduce((sum, load) => sum + getServiceFeeAmount(load), 0)
              .toLocaleString()}{" "}
            ETB
          </p>
        </div>
      </div>

      {/* Settlements Table */}
      <div className="overflow-hidden rounded-xl border border-[#064d51]/10 bg-white shadow-sm">
        {loads.length === 0 ? (
          <div className="p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-[#064d51]/40"
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
            <h3 className="mt-2 text-sm font-medium text-[#064d51]">
              No {activeTab.toLowerCase()} settlements
            </h3>
            <p className="mt-1 text-sm text-[#064d51]/60">
              {activeTab === "PENDING"
                ? "All settlements have been processed"
                : activeTab === "PAID"
                  ? "No settlements have been completed yet"
                  : "No disputes at this time"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#064d51]/10">
              <thead className="bg-[#064d51]/5">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-[#064d51]/70 uppercase">
                    Load ID / Route
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-[#064d51]/70 uppercase">
                    Shipper
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-[#064d51]/70 uppercase">
                    Carrier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-[#064d51]/70 uppercase">
                    Gross Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-[#064d51]/70 uppercase">
                    Service Fee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-[#064d51]/70 uppercase">
                    Net to Carrier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-[#064d51]/70 uppercase">
                    POD Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-[#064d51]/70 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#064d51]/10 bg-white">
                {loads.map((load) => (
                  <tr
                    key={load.id}
                    className="cursor-pointer hover:bg-[#f0fdfa]"
                    onClick={() => setSelectedLoad(load)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-[#064d51]">
                        {load.id.substring(0, 8)}
                      </div>
                      <div className="text-sm text-[#064d51]/60">
                        {load.pickupCity} → {load.deliveryCity}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-[#064d51]">
                        {load.shipper?.name || "N/A"}
                      </div>
                      {load.shipper?.isVerified && (
                        <span className="inline-flex items-center rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          Verified
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-[#064d51]">
                        {load.assignedTruck?.carrier.name || "N/A"}
                      </div>
                      <div className="text-xs text-[#064d51]/60">
                        {load.assignedTruck?.licensePlate}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-[#064d51]">
                        {getSettlementAmount(load).toLocaleString()} ETB
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-[#1e9c99]">
                        {getServiceFeeAmount(load).toLocaleString()} ETB
                      </div>
                      <div className="text-xs text-[#064d51]/60">
                        Corridor fee
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-[#064d51]">
                        {getNetAmount(load).toLocaleString()} ETB
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {load.podVerifiedAt ? (
                        <div>
                          <span className="inline-flex items-center rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            Verified
                          </span>
                          <div className="mt-1 text-xs text-[#064d51]/60">
                            {getTimeAgo(new Date(load.podVerifiedAt))}
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLoad(load);
                        }}
                        className="text-[#1e9c99] hover:text-[#0d6b69]"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Settlement Detail Modal */}
      {selectedLoad && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSelectedLoad(null)}
        >
          <div
            className="mx-4 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-[#064d51]/10 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[#064d51]/10 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-[#064d51]">
                  Settlement Details
                </h2>
                <button
                  onClick={() => setSelectedLoad(null)}
                  className="text-[#064d51]/50 hover:text-[#064d51]"
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

            <div className="space-y-6 p-6">
              {/* Approval Messages */}
              {approvalError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-sm text-rose-800">{approvalError}</p>
                </div>
              )}

              {approvalSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm text-emerald-800">{approvalSuccess}</p>
                </div>
              )}

              {/* Load Info */}
              <div>
                <h3 className="mb-3 text-sm font-semibold text-[#064d51]">
                  Load Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-[#064d51]/70">Load ID:</span>
                    <p className="font-medium text-[#064d51]">
                      {selectedLoad.id}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#064d51]/70">Status:</span>
                    <p className="font-medium text-[#064d51]">
                      {selectedLoad.status}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#064d51]/70">Route:</span>
                    <p className="font-medium text-[#064d51]">
                      {selectedLoad.pickupCity} → {selectedLoad.deliveryCity}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#064d51]/70">Cargo:</span>
                    <p className="font-medium text-[#064d51]">
                      {selectedLoad.cargoDescription}
                    </p>
                  </div>
                </div>
              </div>

              {/* Parties */}
              <div>
                <h3 className="mb-3 text-sm font-semibold text-[#064d51]">
                  Parties Involved
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-[#064d51]/70">Shipper:</span>
                    <p className="font-medium text-[#064d51]">
                      {selectedLoad.shipper?.name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#064d51]/70">Carrier:</span>
                    <p className="font-medium text-[#064d51]">
                      {selectedLoad.assignedTruck?.carrier.name || "N/A"}
                    </p>
                    <p className="text-xs text-[#064d51]/60">
                      {selectedLoad.assignedTruck?.licensePlate}
                    </p>
                  </div>
                </div>
              </div>

              {/* Settlement Breakdown */}
              <div>
                <h3 className="mb-3 text-sm font-semibold text-[#064d51]">
                  Settlement Breakdown
                </h3>
                <div className="space-y-3 rounded-xl border border-[#064d51]/10 bg-[#f0fdfa] p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#064d51]/70">Gross Amount:</span>
                    <span className="font-bold text-[#064d51]">
                      {getSettlementAmount(selectedLoad).toLocaleString()} ETB
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#064d51]/70">
                      Platform Service Fee (Corridor-based):
                    </span>
                    <span className="font-medium text-rose-600">
                      -{getServiceFeeAmount(selectedLoad).toLocaleString()} ETB
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-[#064d51]/20 pt-2 text-sm">
                    <span className="font-semibold text-[#064d51]">
                      Net to Carrier:
                    </span>
                    <span className="font-bold text-[#1e9c99]">
                      {getNetAmount(selectedLoad).toLocaleString()} ETB
                    </span>
                  </div>
                </div>
              </div>

              {/* POD Status */}
              <div>
                <h3 className="mb-3 text-sm font-semibold text-[#064d51]">
                  POD Verification
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#064d51]/70">POD Submitted:</span>
                    <span className="font-medium text-[#064d51]">
                      {selectedLoad.podSubmittedAt
                        ? new Date(
                            selectedLoad.podSubmittedAt
                          ).toLocaleDateString()
                        : "Not submitted"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#064d51]/70">POD Verified:</span>
                    <span className="font-medium text-[#064d51]">
                      {selectedLoad.podVerifiedAt
                        ? new Date(
                            selectedLoad.podVerifiedAt
                          ).toLocaleDateString()
                        : "Not verified"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Settlement Record */}
              {selectedLoad.settlementRecord && (
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-[#064d51]">
                    Settlement Record
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#064d51]/70">Settlement ID:</span>
                      <span className="font-medium text-[#064d51]">
                        {selectedLoad.settlementRecord.id}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#064d51]/70">Payment Status:</span>
                      <span className="font-medium text-[#064d51]">
                        {selectedLoad.settlementRecord.paymentStatus}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#064d51]/70">Processed:</span>
                      <span className="font-medium text-[#064d51]">
                        {new Date(
                          selectedLoad.settlementRecord.processedAt
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-[#064d51]/10 bg-[#f0fdfa] p-6">
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setSelectedLoad(null);
                    setApprovalError(null);
                    setApprovalSuccess(null);
                  }}
                  disabled={approving}
                  className="rounded-lg border border-[#064d51]/20 px-4 py-2 text-[#064d51] hover:bg-[#064d51]/5 disabled:opacity-50"
                >
                  Close
                </button>
                {selectedLoad.settlementStatus === "PENDING" && (
                  <button
                    onClick={() => handleApproveSettlement(selectedLoad.id)}
                    disabled={approving}
                    className="rounded-lg bg-[#064d51] px-4 py-2 text-white hover:bg-[#053d40] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {approving ? (
                      <span className="flex items-center gap-2">
                        <svg
                          className="h-4 w-4 animate-spin"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      "Approve Settlement"
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
