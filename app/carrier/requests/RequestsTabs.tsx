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
      <div className="flex gap-2 border-b border-[#064d51]/15 dark:border-slate-700">
        <button
          onClick={() => handleTabChange('shipper-requests')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors relative ${
            activeTab === 'shipper-requests'
              ? 'border-[#1e9c99] text-[#1e9c99]'
              : 'border-transparent text-[#064d51]/60 dark:text-gray-400 hover:text-[#064d51] dark:hover:text-gray-300'
          }`}
        >
          Shipper Requests
          {pendingShipperRequests > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-full">
              {pendingShipperRequests} pending
            </span>
          )}
        </button>
        <button
          onClick={() => handleTabChange('my-requests')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'my-requests'
              ? 'border-[#1e9c99] text-[#1e9c99]'
              : 'border-transparent text-[#064d51]/60 dark:text-gray-400 hover:text-[#064d51] dark:hover:text-gray-300'
          }`}
        >
          My Load Requests
          <span className="ml-2 text-xs text-[#064d51]/40 dark:text-gray-500">
            ({loadRequests.length})
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
