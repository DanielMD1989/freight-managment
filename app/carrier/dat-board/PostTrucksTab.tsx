'use client';

/**
 * POST TRUCKS Tab Component
 *
 * Main carrier interface for posting trucks and viewing matching loads
 * Sprint 14 - DAT-Style UI Transformation (Phase 4)
 */

import React, { useState, useEffect } from 'react';
import {
  DatStatusTabs,
  DatDataTable,
  DatActionButton,
  DatAgeIndicator,
} from '@/components/dat-ui';
import { DatColumn, DatStatusTab, DatRowAction } from '@/types/dat-ui';

interface PostTrucksTabProps {
  user: any;
}

type TruckStatus = 'all' | 'POSTED' | 'UNPOSTED' | 'EXPIRED' | 'KEPT';

export default function PostTrucksTab({ user }: PostTrucksTabProps) {
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<TruckStatus>('all');
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);
  const [matchingLoads, setMatchingLoads] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [showNewTruckModal, setShowNewTruckModal] = useState(false);

  /**
   * Fetch trucks
   */
  const fetchTrucks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeStatus !== 'all') {
        if (activeStatus === 'KEPT') {
          params.append('isKept', 'true');
        } else {
          params.append('status', activeStatus);
        }
      }

      const response = await fetch(`/api/truck-postings?${params.toString()}`);
      const data = await response.json();

      setTrucks(data.truckPostings || []);

      // Calculate status counts
      const counts: Record<string, number> = {
        all: data.pagination?.total || 0,
        POSTED: 0,
        UNPOSTED: 0,
        EXPIRED: 0,
        KEPT: 0,
      };

      // Fetch counts for each status
      const statusPromises = ['POSTED', 'UNPOSTED', 'EXPIRED'].map(async (status) => {
        const res = await fetch(`/api/truck-postings?status=${status}&limit=1`);
        const json = await res.json();
        counts[status] = json.pagination?.total || 0;
      });

      // Fetch KEPT count
      const keptRes = await fetch('/api/truck-postings?isKept=true&limit=1');
      const keptData = await keptRes.json();
      counts.KEPT = keptData.pagination?.total || 0;

      await Promise.all(statusPromises);
      setStatusCounts(counts);
    } catch (error) {
      console.error('Failed to fetch trucks:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch matching loads for a truck
   */
  const fetchMatchingLoads = async (truckId: string) => {
    setLoadingMatches(true);
    try {
      const response = await fetch(`/api/truck-postings/${truckId}/matching-loads?limit=50`);
      const data = await response.json();
      setMatchingLoads(data.loads || []);
    } catch (error) {
      console.error('Failed to fetch matching loads:', error);
    } finally {
      setLoadingMatches(false);
    }
  };

  useEffect(() => {
    fetchTrucks();
  }, [activeStatus]);

  /**
   * Handle truck row click - show matching loads
   */
  const handleTruckClick = (truck: any) => {
    if (selectedTruckId === truck.id) {
      // Deselect
      setSelectedTruckId(null);
      setMatchingLoads([]);
    } else {
      // Select and fetch matches
      setSelectedTruckId(truck.id);
      fetchMatchingLoads(truck.id);
    }
  };

  /**
   * Handle COPY action
   */
  const handleCopy = async (truck: any) => {
    try {
      const response = await fetch(`/api/truck-postings/${truck.id}/duplicate`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to duplicate truck');

      const newTruck = await response.json();
      alert(`Truck posting copied successfully! New Truck ID: ${newTruck.id}`);
      fetchTrucks();
    } catch (error) {
      console.error('Copy failed:', error);
      alert('Failed to copy truck posting');
    }
  };

  /**
   * Handle EDIT action
   */
  const handleEdit = (truck: any) => {
    alert(`Edit modal coming soon for truck ${truck.id}`);
  };

  /**
   * Handle DELETE action
   */
  const handleDelete = async (truck: any) => {
    if (!confirm(`Are you sure you want to delete this truck posting?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/truck-postings/${truck.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete truck');

      alert('Truck posting deleted successfully');
      fetchTrucks();
      if (selectedTruckId === truck.id) {
        setSelectedTruckId(null);
        setMatchingLoads([]);
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete truck posting');
    }
  };

  /**
   * Status tabs configuration
   */
  const statusTabs: DatStatusTab[] = [
    { key: 'all', label: 'ALL', count: statusCounts.all },
    { key: 'POSTED', label: 'POSTED', count: statusCounts.POSTED },
    { key: 'UNPOSTED', label: 'UNPOSTED', count: statusCounts.UNPOSTED },
    { key: 'EXPIRED', label: 'EXPIRED', count: statusCounts.EXPIRED },
    { key: 'KEPT', label: 'KEPT', count: statusCounts.KEPT },
  ];

  /**
   * Truck table columns
   */
  const truckColumns: DatColumn[] = [
    {
      key: 'age',
      label: 'Age',
      width: '80px',
      render: (_, row) => <DatAgeIndicator date={row.createdAt} />,
    },
    {
      key: 'status',
      label: 'Status',
      width: '100px',
      render: (value) => (
        <span className={`
          px-2 py-1 rounded text-xs font-medium
          ${value === 'POSTED' ? 'bg-green-100 text-green-800' : ''}
          ${value === 'UNPOSTED' ? 'bg-gray-100 text-gray-800' : ''}
          ${value === 'EXPIRED' ? 'bg-red-100 text-red-800' : ''}
        `}>
          {value}
        </span>
      ),
    },
    {
      key: 'currentCity',
      label: 'Current Location',
      sortable: true,
    },
    {
      key: 'destinationCity',
      label: 'Destination',
      sortable: true,
    },
    {
      key: 'availableDate',
      label: 'Available',
      width: '110px',
      render: (value) => value ? new Date(value).toLocaleDateString() : 'Now',
    },
    {
      key: 'truckType',
      label: 'Truck Type',
      width: '120px',
    },
    {
      key: 'fullPartial',
      label: 'F/P',
      width: '60px',
      align: 'center' as const,
    },
    {
      key: 'lengthM',
      label: 'Length',
      width: '80px',
      align: 'right' as const,
      render: (value) => value ? `${value}m` : 'N/A',
    },
    {
      key: 'maxWeight',
      label: 'Max Weight',
      width: '100px',
      align: 'right' as const,
      render: (value) => value ? `${value}kg` : 'N/A',
    },
    {
      key: 'matches',
      label: 'Matches',
      width: '90px',
      align: 'center' as const,
      render: (_, row) => (
        <span className="font-semibold text-blue-600">
          {row.matchCount || 0}
        </span>
      ),
    },
  ];

  /**
   * Matching loads table columns
   */
  const loadColumns: DatColumn[] = [
    {
      key: 'age',
      label: 'Age',
      width: '80px',
      render: (_, row) => <DatAgeIndicator date={row.createdAt} />,
    },
    {
      key: 'pickupCity',
      label: 'Origin',
      sortable: true,
    },
    {
      key: 'deliveryCity',
      label: 'Destination',
      sortable: true,
    },
    {
      key: 'pickupDate',
      label: 'Pickup',
      width: '110px',
      render: (value) => value ? new Date(value).toLocaleDateString() : 'N/A',
    },
    {
      key: 'weight',
      label: 'Weight',
      width: '90px',
      align: 'right' as const,
      render: (value) => value ? `${value}kg` : 'N/A',
    },
    {
      key: 'rate',
      label: 'Rate',
      width: '110px',
      align: 'right' as const,
      sortable: true,
      render: (value, row) => value ? `${row.currency} ${value.toLocaleString()}` : 'N/A',
    },
    {
      key: 'matchScore',
      label: 'Score',
      width: '80px',
      align: 'center' as const,
      render: (value) => (
        <span className={`
          px-2 py-1 rounded text-xs font-semibold
          ${value >= 80 ? 'bg-green-100 text-green-800' : ''}
          ${value >= 60 && value < 80 ? 'bg-yellow-100 text-yellow-800' : ''}
          ${value < 60 ? 'bg-gray-100 text-gray-800' : ''}
        `}>
          {value || 0}%
        </span>
      ),
    },
  ];

  /**
   * Truck row actions
   */
  const truckActions: DatRowAction[] = [
    {
      key: 'edit',
      label: 'EDIT',
      variant: 'primary',
      onClick: handleEdit,
    },
    {
      key: 'copy',
      label: 'COPY',
      variant: 'secondary',
      onClick: handleCopy,
    },
    {
      key: 'delete',
      label: 'DELETE',
      variant: 'destructive',
      onClick: handleDelete,
    },
  ];

  /**
   * Load row actions
   */
  const loadActions: DatRowAction[] = [
    {
      key: 'book',
      label: 'BOOK',
      variant: 'primary',
      onClick: (load) => alert(`Book load ${load.id}`),
    },
    {
      key: 'contact',
      label: 'CONTACT',
      variant: 'secondary',
      onClick: (load) => alert(`Contact shipper for load ${load.id}`),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header with NEW TRUCK POST button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">POST TRUCKS</h2>
        <DatActionButton
          variant="primary"
          onClick={() => setShowNewTruckModal(true)}
          icon="+"
        >
          NEW TRUCK POST
        </DatActionButton>
      </div>

      {/* Status Tabs */}
      <DatStatusTabs
        tabs={statusTabs}
        activeTab={activeStatus}
        onTabChange={(tab) => setActiveStatus(tab as TruckStatus)}
      />

      {/* Trucks Table */}
      <DatDataTable
        columns={truckColumns}
        data={trucks}
        actions={truckActions}
        loading={loading}
        emptyMessage="No truck postings found. Click NEW TRUCK POST to create one."
        rowKey="id"
        onRowClick={handleTruckClick}
      />

      {/* Matching Loads Panel */}
      {selectedTruckId && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-blue-900">
              📦 Matching Loads for Selected Truck
            </h3>
            <button
              onClick={() => {
                setSelectedTruckId(null);
                setMatchingLoads([]);
              }}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Close ×
            </button>
          </div>

          <DatDataTable
            columns={loadColumns}
            data={matchingLoads}
            actions={loadActions}
            loading={loadingMatches}
            emptyMessage="No matching loads found for this truck."
            rowKey="id"
          />
        </div>
      )}

      {/* TODO: TruckPostingModal */}
      {showNewTruckModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-bold mb-4">New Truck Post</h3>
            <p className="text-gray-600 mb-4">Truck posting modal coming soon...</p>
            <button
              onClick={() => setShowNewTruckModal(false)}
              className="px-4 py-2 bg-gray-600 text-white rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
