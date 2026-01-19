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
    rate: number | null;
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
      <div className="flex gap-3">
        <button
          onClick={() => handleTabChange('shipper-requests')}
          className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
            activeTab === 'shipper-requests'
              ? 'bg-[#1e9c99] text-white shadow-md'
              : 'bg-gray-100 dark:bg-slate-700 text-[#064d51]/70 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
          }`}
        >
          Shipper Requests
          {pendingShipperRequests > 0 && (
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              activeTab === 'shipper-requests'
                ? 'bg-white/20 text-white'
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
            }`}>
              {pendingShipperRequests}
            </span>
          )}
        </button>
        <button
          onClick={() => handleTabChange('my-requests')}
          className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
            activeTab === 'my-requests'
              ? 'bg-[#1e9c99] text-white shadow-md'
              : 'bg-gray-100 dark:bg-slate-700 text-[#064d51]/70 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
          }`}
        >
          My Load Requests
          <span className={`px-2 py-0.5 text-xs rounded-full ${
            activeTab === 'my-requests'
              ? 'bg-white/20 text-white'
              : 'bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-gray-400'
          }`}>
            {loadRequests.length}
          </span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'shipper-requests' ? (
        <div>
          <p className="text-sm text-[#064d51]/60 dark:text-gray-400 mb-4">
            Truck booking requests from shippers who want to use your trucks
          </p>
          <ShipperRequestsClient requests={shipperRequests} />
        </div>
      ) : (
        <div>
          <p className="text-sm text-[#064d51]/60 dark:text-gray-400 mb-4">
            Your requests to transport shippers' loads
          </p>
          <MyLoadRequestsClient requests={loadRequests} />
        </div>
      )}
    </div>
  );
}
