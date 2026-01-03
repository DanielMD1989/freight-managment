/**
 * Settlement Review Client Component
 *
 * Sprint 16 - Story 16.9A: SuperAdmin Tools
 * Task 16.9A.4: Global Settlement Review Dashboard
 *
 * Allows SuperAdmins to review and manage settlements globally
 */

'use client';

import { useEffect, useState } from 'react';

// Simple time-ago utility function
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
}

type SettlementStatus = 'PENDING' | 'PAID' | 'DISPUTE';

interface Load {
  id: string;
  pickupCity: string | null;
  deliveryCity: string | null;
  cargoDescription: string;
  rate: number;
  totalFareEtb: number | null;
  baseFareEtb: number | null;
  perKmEtb: number | null;
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
    commissionAmount: number;
    netAmount: number;
    commissionRate: number;
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
  const [activeTab, setActiveTab] = useState<SettlementStatus>('PENDING');
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedLoad, setSelectedLoad] = useState<Load | null>(null);

  useEffect(() => {
    fetchSettlements();
  }, [activeTab]);

  const fetchSettlements = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/admin/settlements?status=${activeTab}&limit=100`
      );

      if (response.ok) {
        const data: SettlementResponse = await response.json();
        setLoads(data.loads);
        setTotalCount(data.totalCount);
      } else {
        console.error('Failed to fetch settlements');
      }
    } catch (error) {
      console.error('Error fetching settlements:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSettlementAmount = (load: Load) => {
    if (load.settlementRecord) {
      return load.settlementRecord.grossAmount;
    }
    return load.totalFareEtb || load.rate;
  };

  const getCommissionAmount = (load: Load) => {
    if (load.settlementRecord) {
      return load.settlementRecord.commissionAmount;
    }
    // Default 15% commission if not settled yet
    const grossAmount = load.totalFareEtb || load.rate;
    return grossAmount * 0.15;
  };

  const getNetAmount = (load: Load) => {
    if (load.settlementRecord) {
      return load.settlementRecord.netAmount;
    }
    const grossAmount = load.totalFareEtb || load.rate;
    return grossAmount * 0.85;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 mt-4">Loading settlements...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('PENDING')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'PENDING'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pending Review
              {activeTab === 'PENDING' && totalCount > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                  {totalCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('PAID')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'PAID'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Settled
              {activeTab === 'PAID' && totalCount > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                  {totalCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('DISPUTE')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'DISPUTE'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Disputes
              {activeTab === 'DISPUTE' && totalCount > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full">
                  {totalCount}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <p className="text-sm text-gray-600">Total Settlements</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{totalCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <p className="text-sm text-gray-600">Total Gross Amount</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {loads
              .reduce((sum, load) => sum + getSettlementAmount(load), 0)
              .toLocaleString()}{' '}
            ETB
          </p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <p className="text-sm text-gray-600">Total Commission</p>
          <p className="text-3xl font-bold text-green-600 mt-1">
            {loads
              .reduce((sum, load) => sum + getCommissionAmount(load), 0)
              .toLocaleString()}{' '}
            ETB
          </p>
        </div>
      </div>

      {/* Settlements Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        {loads.length === 0 ? (
          <div className="p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
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
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No {activeTab.toLowerCase()} settlements
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {activeTab === 'PENDING'
                ? 'All settlements have been processed'
                : activeTab === 'PAID'
                ? 'No settlements have been completed yet'
                : 'No disputes at this time'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Load ID / Route
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shipper
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Carrier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gross Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Commission
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Net to Carrier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    POD Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loads.map((load) => (
                  <tr
                    key={load.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedLoad(load)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {load.id.substring(0, 8)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {load.pickupCity} → {load.deliveryCity}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {load.shipper?.name || 'N/A'}
                      </div>
                      {load.shipper?.isVerified && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Verified
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {load.assignedTruck?.carrier.name || 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {load.assignedTruck?.licensePlate}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">
                        {getSettlementAmount(load).toLocaleString()} ETB
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-green-600">
                        {getCommissionAmount(load).toLocaleString()} ETB
                      </div>
                      <div className="text-xs text-gray-500">
                        {load.settlementRecord
                          ? `${(load.settlementRecord.commissionRate * 100).toFixed(1)}%`
                          : '15%'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {getNetAmount(load).toLocaleString()} ETB
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {load.podVerifiedAt ? (
                        <div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Verified
                          </span>
                          <div className="text-xs text-gray-500 mt-1">
                            {getTimeAgo(new Date(load.podVerifiedAt))}
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLoad(load);
                        }}
                        className="text-blue-600 hover:text-blue-900"
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
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setSelectedLoad(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  Settlement Details
                </h2>
                <button
                  onClick={() => setSelectedLoad(null)}
                  className="text-gray-400 hover:text-gray-600"
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

            <div className="p-6 space-y-6">
              {/* Load Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Load Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Load ID:</span>
                    <p className="font-medium text-gray-900">
                      {selectedLoad.id}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <p className="font-medium text-gray-900">
                      {selectedLoad.status}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Route:</span>
                    <p className="font-medium text-gray-900">
                      {selectedLoad.pickupCity} → {selectedLoad.deliveryCity}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Cargo:</span>
                    <p className="font-medium text-gray-900">
                      {selectedLoad.cargoDescription}
                    </p>
                  </div>
                </div>
              </div>

              {/* Parties */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Parties Involved
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Shipper:</span>
                    <p className="font-medium text-gray-900">
                      {selectedLoad.shipper?.name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Carrier:</span>
                    <p className="font-medium text-gray-900">
                      {selectedLoad.assignedTruck?.carrier.name || 'N/A'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedLoad.assignedTruck?.licensePlate}
                    </p>
                  </div>
                </div>
              </div>

              {/* Settlement Breakdown */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Settlement Breakdown
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Gross Amount:</span>
                    <span className="font-bold text-gray-900">
                      {getSettlementAmount(selectedLoad).toLocaleString()} ETB
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      Platform Commission (
                      {selectedLoad.settlementRecord
                        ? `${(selectedLoad.settlementRecord.commissionRate * 100).toFixed(1)}%`
                        : '15%'}
                      ):
                    </span>
                    <span className="font-medium text-red-600">
                      -{getCommissionAmount(selectedLoad).toLocaleString()} ETB
                    </span>
                  </div>
                  <div className="border-t border-gray-300 pt-2 flex justify-between text-sm">
                    <span className="font-semibold text-gray-900">
                      Net to Carrier:
                    </span>
                    <span className="font-bold text-green-600">
                      {getNetAmount(selectedLoad).toLocaleString()} ETB
                    </span>
                  </div>
                </div>
              </div>

              {/* POD Status */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  POD Verification
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">POD Submitted:</span>
                    <span className="font-medium text-gray-900">
                      {selectedLoad.podSubmittedAt
                        ? new Date(
                            selectedLoad.podSubmittedAt
                          ).toLocaleDateString()
                        : 'Not submitted'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">POD Verified:</span>
                    <span className="font-medium text-gray-900">
                      {selectedLoad.podVerifiedAt
                        ? new Date(
                            selectedLoad.podVerifiedAt
                          ).toLocaleDateString()
                        : 'Not verified'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Settlement Record */}
              {selectedLoad.settlementRecord && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    Settlement Record
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Settlement ID:</span>
                      <span className="font-medium text-gray-900">
                        {selectedLoad.settlementRecord.id}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Payment Status:</span>
                      <span className="font-medium text-gray-900">
                        {selectedLoad.settlementRecord.paymentStatus}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Processed:</span>
                      <span className="font-medium text-gray-900">
                        {new Date(
                          selectedLoad.settlementRecord.processedAt
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setSelectedLoad(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
                >
                  Close
                </button>
                {selectedLoad.settlementStatus === 'PENDING' && (
                  <button
                    onClick={() => {
                      // TODO: Implement manual settlement approval
                      alert('Manual settlement approval - Coming soon');
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Approve Settlement
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
