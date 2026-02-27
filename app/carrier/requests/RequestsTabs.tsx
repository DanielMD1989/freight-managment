/**
 * Carrier Requests Tabs Component
 *
 * Client component to switch between incoming and outgoing requests
 * - Shipper Requests: Incoming TruckRequests from shippers
 * - My Load Requests: Outgoing LoadRequests to shippers
 * - Match Proposals: Incoming proposals from dispatchers
 */

"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ShipperRequestsClient from "./ShipperRequestsClient";
import MyLoadRequestsClient from "./MyLoadRequestsClient";
import MatchProposalsClient from "./MatchProposalsClient";

interface TruckRequest {
  id: string;
  status: string;
  notes: string | null;
  offeredRate: number | null;
  expiresAt: string;
  createdAt: string;
  respondedAt: string | null;
  load: {
    id: string;
    referenceNumber: string;
    status: string;
    weight: number;
    truckType: string;
    cargoType: string;
    pickupCity: string;
    deliveryCity: string;
    pickupDate: string;
    deliveryDate: string;
    shipper: {
      id: string;
      name: string;
      isVerified: boolean;
    } | null;
  };
  truck: {
    id: string;
    plateNumber: string;
    truckType: string;
    capacity: number;
  };
  requestedBy: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface LoadRequest {
  id: string;
  status: string;
  notes: string | null;
  proposedRate: number | null;
  responseNotes: string | null;
  expiresAt: string;
  createdAt: string;
  respondedAt: string | null;
  load: {
    id: string;
    referenceNumber: string;
    status: string;
    weight: number;
    truckType: string;
    pickupCity: string;
    deliveryCity: string;
    pickupDate: string;
  };
  truck: {
    id: string;
    plateNumber: string;
    truckType: string;
    capacity: number;
  };
  shipper: {
    id: string;
    name: string;
    isVerified: boolean;
  } | null;
  requestedBy: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface MatchProposal {
  id: string;
  status: string;
  notes: string | null;
  proposedRate: number | null;
  expiresAt: string;
  createdAt: string;
  respondedAt: string | null;
  load: {
    id: string;
    pickupCity: string;
    deliveryCity: string;
    pickupDate: string;
    weight: number;
    truckType: string;
    status: string;
  };
  truck: {
    id: string;
    licensePlate: string;
    truckType: string;
    capacity: number;
  };
  proposedBy: {
    name: string;
  } | null;
}

interface Props {
  shipperRequests: TruckRequest[];
  loadRequests: LoadRequest[];
  matchProposals: MatchProposal[];
  pendingShipperRequests: number;
  pendingMatchProposals: number;
}

type TabType = "shipper-requests" | "my-requests" | "match-proposals";

export default function RequestsTabs({
  shipperRequests,
  loadRequests,
  matchProposals,
  pendingShipperRequests,
  pendingMatchProposals,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as TabType | null;

  const [activeTab, setActiveTab] = useState<TabType>(
    tabParam === "my-requests"
      ? "my-requests"
      : tabParam === "match-proposals"
        ? "match-proposals"
        : "shipper-requests"
  );

  // Sync tab with URL
  useEffect(() => {
    if (
      tabParam &&
      (tabParam === "shipper-requests" ||
        tabParam === "my-requests" ||
        tabParam === "match-proposals")
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    router.push(`/carrier/requests?tab=${tab}`);
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="inline-flex flex-wrap gap-1 rounded-2xl border border-slate-200/60 bg-white p-1.5 shadow-sm">
        <button
          onClick={() => handleTabChange("shipper-requests")}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${
            activeTab === "shipper-requests"
              ? "bg-gradient-to-r from-teal-600 to-teal-500 text-white shadow-md shadow-teal-500/25"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          Shipper Requests
          {pendingShipperRequests > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                activeTab === "shipper-requests"
                  ? "bg-white/20 text-white"
                  : "animate-pulse bg-amber-100 text-amber-700"
              }`}
            >
              {pendingShipperRequests}
            </span>
          )}
        </button>
        <button
          onClick={() => handleTabChange("match-proposals")}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${
            activeTab === "match-proposals"
              ? "bg-gradient-to-r from-teal-600 to-teal-500 text-white shadow-md shadow-teal-500/25"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
          Match Proposals
          {pendingMatchProposals > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                activeTab === "match-proposals"
                  ? "bg-white/20 text-white"
                  : "animate-pulse bg-amber-100 text-amber-700"
              }`}
            >
              {pendingMatchProposals}
            </span>
          )}
        </button>
        <button
          onClick={() => handleTabChange("my-requests")}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${
            activeTab === "my-requests"
              ? "bg-gradient-to-r from-teal-600 to-teal-500 text-white shadow-md shadow-teal-500/25"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
          My Load Requests
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              activeTab === "my-requests"
                ? "bg-white/20 text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {loadRequests.length}
          </span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "shipper-requests" ? (
        <div>
          <p className="mb-4 text-sm text-slate-500">
            Truck booking requests from shippers who want to use your trucks
          </p>
          <ShipperRequestsClient requests={shipperRequests} />
        </div>
      ) : activeTab === "match-proposals" ? (
        <div>
          <p className="mb-4 text-sm text-slate-500">
            Load-truck match proposals from dispatchers. Accept to assign the
            load to your truck.
          </p>
          <MatchProposalsClient proposals={matchProposals} />
        </div>
      ) : (
        <div>
          <p className="mb-4 text-sm text-slate-500">
            Your requests to transport shippers&apos; loads
          </p>
          <MyLoadRequestsClient requests={loadRequests} />
        </div>
      )}
    </div>
  );
}
