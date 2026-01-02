'use client';

/**
 * Dispatcher Dashboard Client Component
 *
 * Sprint 16 - Story 16.4: Dispatcher System
 *
 * Features:
 * - System-wide load and truck views
 * - Load assignment to trucks
 * - GPS tracking access
 * - Advanced filtering
 */

import { useState, useEffect } from 'react';
import QuickAssignModal from '@/components/QuickAssignModal';
import StatusUpdateModal from '@/components/StatusUpdateModal';

type DashboardTab = 'loads' | 'trucks';

interface DispatcherDashboardClientProps {
  user: any;
}

export default function DispatcherDashboardClient({
  user,
}: DispatcherDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('loads');
  const [loads, setLoads] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch loads
  const fetchLoads = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: '50',
      });

      if (statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }

      if (searchQuery) {
        // Search by pickup or delivery city
        params.append('pickupCity', searchQuery);
      }

      const response = await fetch(`/api/loads?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch loads');
      }

      const data = await response.json();
      setLoads(data.loads || []);
    } catch (err: any) {
      console.error('Error fetching loads:', err);
      setError(err.message || 'Failed to fetch loads');
    } finally {
      setLoading(false);
    }
  };

  // Fetch trucks
  const fetchTrucks = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: '50',
      });

      const response = await fetch(`/api/truck-postings?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch trucks');
      }

      const data = await response.json();
      setTrucks(data.postings || []);
    } catch (err: any) {
      console.error('Error fetching trucks:', err);
      setError(err.message || 'Failed to fetch trucks');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when tab changes
  useEffect(() => {
    if (activeTab === 'loads') {
      fetchLoads();
    } else {
      fetchTrucks();
    }
  }, [activeTab, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex space-x-8 px-6">
          <button
            onClick={() => setActiveTab('loads')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'loads'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            ALL LOADS
          </button>
          <button
            onClick={() => setActiveTab('trucks')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'trucks'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            ALL TRUCKS
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="flex gap-4">
          {/* Status Filter (for loads) */}
          {activeTab === 'loads' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="POSTED">Posted</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_TRANSIT">In Transit</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          )}

          {/* Search */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'loads'
                  ? 'Search by city...'
                  : 'Search trucks...'
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          {/* Refresh Button */}
          <div className="flex items-end">
            <button
              onClick={() => (activeTab === 'loads' ? fetchLoads() : fetchTrucks())}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      ) : activeTab === 'loads' ? (
        <LoadsTable loads={loads} onRefresh={fetchLoads} />
      ) : (
        <TrucksTable trucks={trucks} onRefresh={fetchTrucks} />
      )}
    </div>
  );
}

// Loads Table Component
function LoadsTable({ loads, onRefresh }: { loads: any[]; onRefresh: () => void }) {
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedLoad, setSelectedLoad] = useState<any>(null);

  const handleAssignLoad = (load: any) => {
    setSelectedLoad(load);
    setAssignModalOpen(true);
  };

  const handleUpdateStatus = (load: any) => {
    setSelectedLoad(load);
    setStatusModalOpen(true);
  };

  const handleAssignSuccess = () => {
    onRefresh();
    setSelectedLoad(null);
  };

  const handleStatusUpdateSuccess = () => {
    onRefresh();
    setSelectedLoad(null);
  };

  if (loads.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <p className="text-gray-500">No loads found</p>
      </div>
    );
  }

  return (
    <>
      {/* Sprint 16: Story 16.4 - Quick Assignment Modal */}
      {selectedLoad && (
        <QuickAssignModal
          isOpen={assignModalOpen}
          onClose={() => {
            setAssignModalOpen(false);
            setSelectedLoad(null);
          }}
          loadId={selectedLoad.id}
          loadDetails={{
            pickupCity: selectedLoad.pickupCity,
            deliveryCity: selectedLoad.deliveryCity,
            truckType: selectedLoad.truckType,
            weight: selectedLoad.weight,
          }}
          onAssignSuccess={handleAssignSuccess}
        />
      )}

      {/* Sprint 16: Story 16.4 - Status Update Modal */}
      {selectedLoad && (
        <StatusUpdateModal
          isOpen={statusModalOpen}
          onClose={() => {
            setStatusModalOpen(false);
            setSelectedLoad(null);
          }}
          loadId={selectedLoad.id}
          currentStatus={selectedLoad.status}
          loadDetails={{
            pickupCity: selectedLoad.pickupCity,
            deliveryCity: selectedLoad.deliveryCity,
          }}
          onUpdateSuccess={handleStatusUpdateSuccess}
        />
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Load ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Pickup
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Delivery
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Truck Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Rate
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Shipper
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loads.map((load) => (
              <tr key={load.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">
                  {load.id.slice(0, 8)}...
                </td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      load.status === 'POSTED'
                        ? 'bg-green-100 text-green-800'
                        : load.status === 'ASSIGNED'
                        ? 'bg-blue-100 text-blue-800'
                        : load.status === 'IN_TRANSIT'
                        ? 'bg-purple-100 text-purple-800'
                        : load.status === 'DELIVERED'
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {load.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {load.pickupCity}
                  <div className="text-xs text-gray-500">
                    {new Date(load.pickupDate).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {load.deliveryCity}
                  <div className="text-xs text-gray-500">
                    {new Date(load.deliveryDate).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {load.truckType}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {load.rate?.toLocaleString()} {load.currency || 'ETB'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {load.shipper?.name || 'Unknown'}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex gap-2 flex-wrap">
                    {/* Sprint 16: Story 16.4 - Quick assignment interface */}
                    {load.status === 'POSTED' && (
                      <button
                        onClick={() => handleAssignLoad(load)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Assign
                      </button>
                    )}
                    {/* Sprint 16: Story 16.4 - Status update controls */}
                    {load.status !== 'DELIVERED' && load.status !== 'CANCELLED' && (
                      <button
                        onClick={() => handleUpdateStatus(load)}
                        className="text-purple-600 hover:text-purple-800 font-medium"
                      >
                        Update
                      </button>
                    )}
                    {/* Sprint 16: Story 16.4 - GPS tracking access */}
                    {(load.status === 'ASSIGNED' || load.status === 'IN_TRANSIT') && (
                      <a
                        href={`/tracking?loadId=${load.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:text-green-800 font-medium"
                      >
                        GPS
                      </a>
                    )}
                    <a
                      href={`/dashboard/loads/${load.id}`}
                      className="text-gray-600 hover:text-gray-800 font-medium"
                    >
                      View
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </>
  );
}

// Trucks Table Component
function TrucksTable({ trucks, onRefresh }: { trucks: any[]; onRefresh: () => void }) {
  if (trucks.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <p className="text-gray-500">No trucks found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                License Plate
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Truck Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Origin
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Destination
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Available From
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Carrier
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                GPS
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {trucks.map((posting) => (
              <tr key={posting.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {posting.truck?.licensePlate || 'N/A'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {posting.truck?.truckType || 'N/A'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {posting.originCity?.name || 'N/A'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {posting.destinationCity?.name || 'N/A'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {new Date(posting.availableFrom).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {posting.carrier?.name || 'Unknown'}
                </td>
                <td className="px-4 py-3 text-sm">
                  {posting.truck?.gpsStatus === 'ACTIVE' ? (
                    <span className="text-green-600 font-medium">Active</span>
                  ) : posting.truck?.imei ? (
                    <span className="text-yellow-600 font-medium">Registered</span>
                  ) : (
                    <span className="text-gray-400">No GPS</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  <a
                    href={`/carrier/postings/${posting.id}`}
                    className="text-gray-600 hover:text-gray-800 font-medium"
                  >
                    View
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
