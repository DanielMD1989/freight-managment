/**
 * Carrier Requests Tabs Component
 *
 * Client component to switch between incoming and outgoing requests
 * - Shipper Requests: Incoming TruckRequests from shippers
 * - My Load Requests: Outgoing LoadRequests to shippers
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ShipperRequestsClient from './ShipperRequestsClient';
import MyLoadRequestsClient from './MyLoadRequestsClient';

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

interface Props {
  shipperRequests: TruckRequest[];
  loadRequests: LoadRequest[];
  pendingShipperRequests: number;
}

type TabType = 'shipper-requests' | 'my-requests';

export default function RequestsTabs({
  shipperRequests,
  loadRequests,
  pendingShipperRequests,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as TabType | null;

  const [activeTab, setActiveTab] = useState<TabType>(
    tabParam === 'my-requests' ? 'my-requests' : 'shipper-requests'
  );

  // Sync tab with URL
  useEffect(() => {
    if (tabParam && (tabParam === 'shipper-requests' || tabParam === 'my-requests')) {
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
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-1.5 inline-flex gap-1">
        <button
          onClick={() => handleTabChange('shipper-requests')}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === 'shipper-requests'
              ? 'bg-gradient-to-r from-teal-600 to-teal-500 text-white shadow-md shadow-teal-500/25'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          Shipper Requests
          {pendingShipperRequests > 0 && (
            <span className={`px-2 py-0.5 text-xs rounded-full font-bold ${
              activeTab === 'shipper-requests'
                ? 'bg-white/20 text-white'
                : 'bg-amber-100 text-amber-700 animate-pulse'
            }`}>
              {pendingShipperRequests}
            </span>
          )}
        </button>
        <button
          onClick={() => handleTabChange('my-requests')}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === 'my-requests'
              ? 'bg-gradient-to-r from-teal-600 to-teal-500 text-white shadow-md shadow-teal-500/25'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          My Load Requests
          <span className={`px-2 py-0.5 text-xs rounded-full font-bold ${
            activeTab === 'my-requests'
              ? 'bg-white/20 text-white'
              : 'bg-slate-100 text-slate-600'
          }`}>
            {loadRequests.length}
          </span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'shipper-requests' ? (
        <div>
          <p className="text-sm text-slate-500 mb-4">
            Truck booking requests from shippers who want to use your trucks
          </p>
          <ShipperRequestsClient requests={shipperRequests} />
        </div>
      ) : (
        <div>
          <p className="text-sm text-slate-500 mb-4">
            Your requests to transport shippers&apos; loads
          </p>
          <MyLoadRequestsClient requests={loadRequests} />
        </div>
      )}
    </div>
  );
}
