/**
 * Requests Tabs Component
 *
 * Client component to switch between truck requests and load requests
 */

'use client';

import { useState } from 'react';
import TruckRequestsClient from './TruckRequestsClient';
import LoadRequestsClient from './LoadRequestsClient';

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
    pickupCity: string;
    deliveryCity: string;
    pickupDate: string;
  };
  truck: {
    id: string;
    plateNumber: string;
    truckType: string;
    capacity: number;
    carrier: {
      id: string;
      name: string;
      isVerified: boolean;
    };
  };
  requestedBy: {
    id: string;
    name: string;
  } | null;
}

interface LoadRequest {
  id: string;
  status: string;
  notes: string | null;
  proposedRate: number | null;
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
  carrier: {
    id: string;
    name: string;
    isVerified: boolean;
  };
  requestedBy: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface Props {
  truckRequests: TruckRequest[];
  loadRequests: LoadRequest[];
  pendingLoadRequests: number;
}

type TabType = 'carrier-requests' | 'my-requests';

export default function RequestsTabs({
  truckRequests,
  loadRequests,
  pendingLoadRequests,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabType>(
    pendingLoadRequests > 0 ? 'carrier-requests' : 'my-requests'
  );

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-[#064d51]/15 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('carrier-requests')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors relative ${
            activeTab === 'carrier-requests'
              ? 'border-[#1e9c99] text-[#1e9c99]'
              : 'border-transparent text-[#064d51]/60 dark:text-gray-400 hover:text-[#064d51] dark:hover:text-gray-300'
          }`}
        >
          Carrier Requests
          {pendingLoadRequests > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-full">
              {pendingLoadRequests} pending
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('my-requests')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'my-requests'
              ? 'border-[#1e9c99] text-[#1e9c99]'
              : 'border-transparent text-[#064d51]/60 dark:text-gray-400 hover:text-[#064d51] dark:hover:text-gray-300'
          }`}
        >
          My Truck Requests
          <span className="ml-2 text-xs text-[#064d51]/40 dark:text-gray-500">
            ({truckRequests.length})
          </span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'carrier-requests' ? (
        <div>
          <p className="text-sm text-[#064d51]/60 dark:text-gray-400 mb-4">
            Requests from carriers who want to transport your loads
          </p>
          <LoadRequestsClient requests={loadRequests} />
        </div>
      ) : (
        <div>
          <p className="text-sm text-[#064d51]/60 dark:text-gray-400 mb-4">
            Your requests to book trucks for your loads
          </p>
          <TruckRequestsClient requests={truckRequests} />
        </div>
      )}
    </div>
  );
}
