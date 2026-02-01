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
      <div className="flex gap-3">
        <button
          onClick={() => setActiveTab('carrier-requests')}
          className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
            activeTab === 'carrier-requests'
              ? 'bg-teal-600 text-white shadow-md'
              : 'bg-gray-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
          }`}
        >
          Carrier Requests
          {pendingLoadRequests > 0 && (
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              activeTab === 'carrier-requests'
                ? 'bg-white/20 text-white'
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
            }`}>
              {pendingLoadRequests}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('my-requests')}
          className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
            activeTab === 'my-requests'
              ? 'bg-teal-600 text-white shadow-md'
              : 'bg-gray-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
          }`}
        >
          My Truck Requests
          <span className={`px-2 py-0.5 text-xs rounded-full ${
            activeTab === 'my-requests'
              ? 'bg-white/20 text-white'
              : 'bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-gray-400'
          }`}>
            {truckRequests.length}
          </span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'carrier-requests' ? (
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-gray-400 mb-4">
            Requests from carriers who want to transport your loads
          </p>
          <LoadRequestsClient requests={loadRequests} />
        </div>
      ) : (
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-gray-400 mb-4">
            Your requests to book trucks for your loads
          </p>
          <TruckRequestsClient requests={truckRequests} />
        </div>
      )}
    </div>
  );
}
