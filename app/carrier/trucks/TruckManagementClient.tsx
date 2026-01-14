'use client';

/**
 * Truck Management Client Component
 *
 * Interactive truck list with filtering, tabs for approval status, and actions
 * Sprint 12 - Story 12.2: Truck Management
 * Sprint 18 - Updated: Tabs for Approved/Pending/Rejected trucks
 */

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { getCSRFToken } from '@/lib/csrfFetch';

interface Truck {
  id: string;
  truckType: string;
  licensePlate: string;
  capacity: number;
  volume: number | null;
  currentCity: string | null;
  currentRegion: string | null;
  isAvailable: boolean;
  status: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  carrier: {
    id: string;
    name: string;
    isVerified: boolean;
  };
  gpsDevice: {
    id: string;
    imei: string;
    status: string;
    lastSeenAt: string;
  } | null;
}

const TRUCK_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'FLATBED', label: 'Flatbed' },
  { value: 'REFRIGERATED', label: 'Refrigerated' },
  { value: 'TANKER', label: 'Tanker' },
  { value: 'CONTAINER', label: 'Container' },
  { value: 'DRY_VAN', label: 'Dry Van' },
  { value: 'LOWBOY', label: 'Lowboy' },
  { value: 'DUMP_TRUCK', label: 'Dump Truck' },
  { value: 'BOX_TRUCK', label: 'Box Truck' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'INACTIVE', label: 'Inactive' },
];

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    IN_TRANSIT: 'bg-teal-50 text-teal-700 border border-teal-200',
    MAINTENANCE: 'bg-amber-50 text-amber-700 border border-amber-200',
    INACTIVE: 'bg-slate-100 text-slate-600 border border-slate-200',
  };
  return colors[status] || 'bg-slate-100 text-slate-600 border border-slate-200';
}

function getApprovalStatusColor(status: string): string {
  const colors: Record<string, string> = {
    APPROVED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    PENDING: 'bg-amber-50 text-amber-700 border border-amber-200',
    REJECTED: 'bg-rose-50 text-rose-700 border border-rose-200',
    EXPIRED: 'bg-slate-100 text-slate-600 border border-slate-200',
  };
  return colors[status] || 'bg-slate-100 text-slate-600 border border-slate-200';
}

interface TruckManagementClientProps {
  initialApprovedTrucks: Truck[];
  initialPendingTrucks: Truck[];
  initialRejectedTrucks: Truck[];
  approvedPagination: any;
  pendingPagination: any;
  rejectedPagination: any;
  initialTab: string;
}

export default function TruckManagementClient({
  initialApprovedTrucks,
  initialPendingTrucks,
  initialRejectedTrucks,
  approvedPagination,
  pendingPagination,
  rejectedPagination,
  initialTab,
}: TruckManagementClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [approvedTrucks, setApprovedTrucks] = useState<Truck[]>(initialApprovedTrucks);
  const [pendingTrucks, setPendingTrucks] = useState<Truck[]>(initialPendingTrucks);
  const [rejectedTrucks, setRejectedTrucks] = useState<Truck[]>(initialRejectedTrucks);
  const [truckTypeFilter, setTruckTypeFilter] = useState(
    searchParams.get('truckType') || 'all'
  );
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get('status') || 'all'
  );
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get current trucks and pagination based on active tab
  const getCurrentTrucks = () => {
    switch (activeTab) {
      case 'pending':
        return pendingTrucks;
      case 'rejected':
        return rejectedTrucks;
      default:
        return approvedTrucks;
    }
  };

  const getCurrentPagination = () => {
    switch (activeTab) {
      case 'pending':
        return pendingPagination;
      case 'rejected':
        return rejectedPagination;
      default:
        return approvedPagination;
    }
  };

  const trucks = getCurrentTrucks();
  const pagination = getCurrentPagination();

  /**
   * Handle tab change
   */
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    params.delete('page');
    router.push(`/carrier/trucks?${params.toString()}`);
  };

  /**
   * Handle truck type filter change
   */
  const handleTruckTypeChange = (type: string) => {
    setTruckTypeFilter(type);
    const params = new URLSearchParams(searchParams.toString());
    if (type !== 'all') {
      params.set('truckType', type);
    } else {
      params.delete('truckType');
    }
    params.delete('page');
    router.push(`/carrier/trucks?${params.toString()}`);
  };

  /**
   * Handle status filter change
   */
  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    const params = new URLSearchParams(searchParams.toString());
    if (status !== 'all') {
      params.set('status', status);
    } else {
      params.delete('status');
    }
    params.delete('page');
    router.push(`/carrier/trucks?${params.toString()}`);
  };

  /**
   * Handle page change
   */
  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`/carrier/trucks?${params.toString()}`);
  };

  /**
   * Handle truck deletion
   */
  const handleDelete = async (truckId: string) => {
    setIsDeleting(true);
    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/trucks/${truckId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      });

      if (!response.ok) {
        const error = await response.json();

        if (response.status === 409) {
          toast.error(
            error.message || 'Cannot delete truck with active postings. Please cancel or complete all active postings first.'
          );
        } else if (response.status === 404) {
          toast.error('Truck not found');
        } else {
          toast.error(error.message || 'Failed to delete truck');
        }
        return;
      }

      // Remove truck from appropriate list
      if (activeTab === 'approved') {
        setApprovedTrucks(prev => prev.filter(t => t.id !== truckId));
      } else if (activeTab === 'pending') {
        setPendingTrucks(prev => prev.filter(t => t.id !== truckId));
      } else {
        setRejectedTrucks(prev => prev.filter(t => t.id !== truckId));
      }

      toast.success('Truck deleted successfully');
      setDeleteConfirmId(null);
      router.refresh();
    } catch (error) {
      console.error('Error deleting truck:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Tab counts
  const approvedCount = approvedPagination?.total || 0;
  const pendingCount = pendingPagination?.total || 0;
  const rejectedCount = rejectedPagination?.total || 0;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-1.5 inline-flex gap-1">
        <button
          onClick={() => handleTabChange('approved')}
          className={`${
            activeTab === 'approved'
              ? 'bg-gradient-to-r from-teal-600 to-teal-500 text-white shadow-md shadow-teal-500/25'
              : 'text-slate-600 hover:bg-slate-100'
          } px-5 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition-all`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Approved
          <span className={`${
            activeTab === 'approved' ? 'bg-white/20' : 'bg-slate-100'
          } px-2 py-0.5 rounded-full text-xs font-bold`}>
            {approvedCount}
          </span>
        </button>
        <button
          onClick={() => handleTabChange('pending')}
          className={`${
            activeTab === 'pending'
              ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-white shadow-md shadow-amber-500/25'
              : 'text-slate-600 hover:bg-slate-100'
          } px-5 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition-all`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Pending
          {pendingCount > 0 && (
            <span className={`${
              activeTab === 'pending' ? 'bg-white/20' : 'bg-amber-100 text-amber-700'
            } px-2 py-0.5 rounded-full text-xs font-bold ${activeTab !== 'pending' ? 'animate-pulse' : ''}`}>
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => handleTabChange('rejected')}
          className={`${
            activeTab === 'rejected'
              ? 'bg-gradient-to-r from-rose-500 to-rose-400 text-white shadow-md shadow-rose-500/25'
              : 'text-slate-600 hover:bg-slate-100'
          } px-5 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition-all`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Rejected
          {rejectedCount > 0 && (
            <span className={`${
              activeTab === 'rejected' ? 'bg-white/20' : 'bg-rose-100 text-rose-700'
            } px-2 py-0.5 rounded-full text-xs font-bold`}>
              {rejectedCount}
            </span>
          )}
        </button>
      </div>

      {/* Filters and Actions - Only show for approved tab */}
      {activeTab === 'approved' && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Truck Type Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Truck Type
                </label>
                <select
                  value={truckTypeFilter}
                  onChange={(e) => handleTruckTypeChange(e.target.value)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all bg-white text-sm"
                >
                  {TRUCK_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all bg-white text-sm"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Add Truck Button */}
            <Link
              href="/carrier/trucks/add"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-xl font-medium hover:from-teal-700 hover:to-teal-600 transition-all shadow-md shadow-teal-500/25"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Truck
            </Link>
          </div>
        </div>
      )}

      {/* Add Truck Button for pending/rejected tabs */}
      {activeTab !== 'approved' && (
        <div className="flex justify-end">
          <Link
            href="/carrier/trucks/add"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-xl font-medium hover:from-teal-700 hover:to-teal-600 transition-all shadow-md shadow-teal-500/25"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Truck
          </Link>
        </div>
      )}

      {/* Pending/Rejected Info Banner */}
      {activeTab === 'pending' && pendingCount > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-amber-800 font-semibold">Trucks awaiting admin approval</p>
              <p className="text-amber-700 text-sm mt-0.5">
                Once approved, trucks will appear in the Approved tab and can be posted for loads.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'rejected' && rejectedCount > 0 && (
        <div className="bg-gradient-to-r from-rose-50 to-red-50 border border-rose-200 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-rose-800 font-semibold">These trucks were rejected by admin</p>
              <p className="text-rose-700 text-sm mt-0.5">
                You can edit and resubmit rejected trucks for approval. Check the rejection reason below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Trucks List */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-teal-50/30 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>
            {activeTab === 'approved' && `Approved Trucks (${approvedCount})`}
            {activeTab === 'pending' && `Pending Approval (${pendingCount})`}
            {activeTab === 'rejected' && `Rejected Trucks (${rejectedCount})`}
          </h2>
        </div>

        {trucks.length > 0 ? (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      License Plate
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Capacity
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Location
                    </th>
                    {activeTab === 'approved' && (
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Status
                      </th>
                    )}
                    {activeTab === 'rejected' && (
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Rejection Reason
                      </th>
                    )}
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      GPS
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {trucks.map((truck) => (
                    <tr key={truck.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">
                          {truck.licensePlate}
                        </div>
                        <div className="text-xs text-slate-400">
                          Added {formatDate(truck.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-700">
                          {truck.truckType.replace(/_/g, ' ')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-700">
                          {truck.capacity.toLocaleString()} kg
                        </div>
                        {truck.volume && (
                          <div className="text-xs text-slate-400">
                            {truck.volume} m³
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-700">
                          {truck.currentCity || 'Not set'}
                        </div>
                        {truck.currentRegion && (
                          <div className="text-xs text-slate-400">
                            {truck.currentRegion}
                          </div>
                        )}
                      </td>
                      {activeTab === 'approved' && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${getStatusColor(
                              truck.status
                            )}`}
                          >
                            {truck.status}
                          </span>
                        </td>
                      )}
                      {activeTab === 'rejected' && (
                        <td className="px-6 py-4">
                          <div className="text-sm text-rose-600 max-w-xs">
                            {truck.rejectionReason || 'No reason provided'}
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {truck.gpsDevice ? (
                          <div className="text-sm">
                            <div className="text-emerald-600 font-medium flex items-center gap-1">
                              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                              Connected
                            </div>
                            <div className="text-xs text-slate-400">
                              {truck.gpsDevice.imei}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-slate-400">No GPS</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-3">
                          <Link
                            href={`/carrier/trucks/${truck.id}`}
                            className="text-teal-600 hover:text-teal-700 font-medium transition-colors"
                          >
                            View
                          </Link>
                          <Link
                            href={`/carrier/trucks/${truck.id}/edit`}
                            className="text-slate-600 hover:text-slate-700 font-medium transition-colors"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => setDeleteConfirmId(truck.id)}
                            className="text-rose-600 hover:text-rose-700 font-medium transition-colors"
                          >
                            Delete
                          </button>
                          {activeTab === 'rejected' && (
                            <Link
                              href={`/carrier/trucks/${truck.id}/edit?resubmit=true`}
                              className="text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                            >
                              Resubmit
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-200">
              {trucks.map((truck) => (
                <div key={truck.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-medium text-gray-900">
                        {truck.licensePlate}
                      </div>
                      <div className="text-sm text-gray-600">
                        {truck.truckType.replace(/_/g, ' ')}
                      </div>
                    </div>
                    {activeTab === 'approved' && (
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          truck.status
                        )}`}
                      >
                        {truck.status}
                      </span>
                    )}
                    {activeTab === 'pending' && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                    )}
                    {activeTab === 'rejected' && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        Rejected
                      </span>
                    )}
                  </div>

                  {activeTab === 'rejected' && truck.rejectionReason && (
                    <div className="bg-red-50 rounded p-2 mb-3 text-sm text-red-700">
                      <strong>Reason:</strong> {truck.rejectionReason}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <div className="text-gray-500">Capacity</div>
                      <div className="font-medium">
                        {truck.capacity.toLocaleString()} kg
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Location</div>
                      <div className="font-medium">
                        {truck.currentCity || 'Not set'}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/carrier/trucks/${truck.id}`}
                      className="flex-1 px-4 py-2 text-sm text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 text-center font-medium"
                    >
                      View
                    </Link>
                    <Link
                      href={`/carrier/trucks/${truck.id}/edit`}
                      className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 text-center font-medium"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => setDeleteConfirmId(truck.id)}
                      className="flex-1 px-4 py-2 text-sm text-red-600 border border-red-600 rounded-lg hover:bg-red-50 text-center font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Page {pagination.page} of {pagination.pages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Empty State */
          <div className="px-6 py-12 text-center">
            {activeTab === 'approved' && (
              <>
                <div className="text-6xl mb-4">🚛</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Approved Trucks Yet
                </h3>
                <p className="text-gray-600 mb-6">
                  {pendingCount > 0
                    ? `You have ${pendingCount} truck(s) awaiting admin approval.`
                    : 'Add your first truck to start finding loads and earning revenue.'}
                </p>
                <Link
                  href="/carrier/trucks/add"
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Add Your First Truck
                </Link>
              </>
            )}
            {activeTab === 'pending' && (
              <>
                <div className="text-6xl mb-4">✓</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Pending Trucks
                </h3>
                <p className="text-gray-600">
                  All your trucks have been reviewed.
                </p>
              </>
            )}
            {activeTab === 'rejected' && (
              <>
                <div className="text-6xl mb-4">✓</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Rejected Trucks
                </h3>
                <p className="text-gray-600">
                  None of your trucks have been rejected.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200/60">
            <div className="px-6 py-4 bg-gradient-to-r from-rose-500 to-rose-600">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Confirm Delete
              </h3>
            </div>
            <div className="p-6">
              <p className="text-slate-600 mb-6">
                Are you sure you want to delete this truck? This action cannot be undone.
                {' '}If this truck has active postings, you&apos;ll need to cancel them first.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirmId)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-rose-600 to-rose-500 text-white rounded-xl hover:from-rose-700 hover:to-rose-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-rose-500/25"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Truck'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
