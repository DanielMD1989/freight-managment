'use client';

/**
 * POST LOADS Tab Component
 *
 * Main shipper interface for managing posted loads with DAT-style features
 * Sprint 14 - DAT-Style UI Transformation
 */

import React, { useState, useEffect } from 'react';
import {
  DatStatusTabs,
  DatDataTable,
  DatActionButton,
  DatAgeIndicator,
  DatReferencePricing,
  DatInlineEdit,
} from '@/components/dat-ui';
import { DatColumn, DatStatusTab, DatRowAction } from '@/types/dat-ui';
import LoadPostingModal from './LoadPostingModal';

interface PostLoadsTabProps {
  user: any;
}

type LoadStatus = 'all' | 'POSTED' | 'UNPOSTED' | 'EXPIRED' | 'KEPT' | 'GROUP';

export default function PostLoadsTab({ user }: PostLoadsTabProps) {
  const [loads, setLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<LoadStatus>('all');
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [editingLoadId, setEditingLoadId] = useState<string | null>(null);
  const [showNewLoadModal, setShowNewLoadModal] = useState(false);

  /**
   * Fetch loads
   */
  const fetchLoads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeStatus !== 'all') {
        if (activeStatus === 'KEPT') {
          params.append('isKept', 'true');
        } else if (activeStatus === 'GROUP') {
          params.append('hasGroupId', 'true');
        } else {
          params.append('status', activeStatus);
        }
      }

      const response = await fetch(`/api/loads?${params.toString()}`);
      const data = await response.json();

      setLoads(data.loads || []);

      // Calculate status counts
      const counts: Record<string, number> = {
        all: data.pagination?.total || 0,
        POSTED: 0,
        UNPOSTED: 0,
        EXPIRED: 0,
        KEPT: 0,
        GROUP: 0,
      };

      // Fetch counts for each status
      const statusPromises = ['POSTED', 'UNPOSTED', 'EXPIRED'].map(async (status) => {
        const res = await fetch(`/api/loads?status=${status}&limit=1`);
        const json = await res.json();
        counts[status] = json.pagination?.total || 0;
      });

      // Fetch KEPT count
      const keptRes = await fetch('/api/loads?isKept=true&limit=1');
      const keptData = await keptRes.json();
      counts.KEPT = keptData.pagination?.total || 0;

      // Fetch GROUP count
      const groupRes = await fetch('/api/loads?hasGroupId=true&limit=1');
      const groupData = await groupRes.json();
      counts.GROUP = groupData.pagination?.total || 0;

      await Promise.all(statusPromises);
      setStatusCounts(counts);
    } catch (error) {
      console.error('Failed to fetch loads:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoads();
  }, [activeStatus]);

  /**
   * Handle COPY action
   */
  const handleCopy = async (load: any) => {
    try {
      const response = await fetch(`/api/loads/${load.id}/duplicate`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to duplicate load');

      const newLoad = await response.json();
      alert(`Load copied successfully! New Load ID: ${newLoad.id}`);
      fetchLoads();
    } catch (error) {
      console.error('Copy failed:', error);
      alert('Failed to copy load');
    }
  };

  /**
   * Handle EDIT action
   */
  const handleEdit = (load: any) => {
    setEditingLoadId(load.id);
  };

  /**
   * Handle DELETE action
   */
  const handleDelete = async (load: any) => {
    if (!confirm(`Are you sure you want to delete this load from ${load.pickupCity} to ${load.deliveryCity}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/loads/${load.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete load');

      alert('Load deleted successfully');
      fetchLoads();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete load');
    }
  };

  /**
   * Handle SEARCH TRUCKS action
   */
  const handleSearchTrucks = (load: any) => {
    // Navigate to SEARCH TRUCKS tab with filters
    alert(`Search for trucks matching this load (${load.pickupCity} → ${load.deliveryCity})`);
    // TODO: Implement navigation to SEARCH TRUCKS tab with pre-filled filters
  };

  /**
   * Handle KEPT toggle
   */
  const handleToggleKept = async (load: any) => {
    try {
      const response = await fetch(`/api/loads/${load.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isKept: !load.isKept }),
      });

      if (!response.ok) throw new Error('Failed to update load');

      fetchLoads();
    } catch (error) {
      console.error('Toggle KEPT failed:', error);
      alert('Failed to update load');
    }
  };

  /**
   * Handle inline edit save
   */
  const handleInlineEditSave = async (formData: any) => {
    if (!editingLoadId) return;

    try {
      const response = await fetch(`/api/loads/${editingLoadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to update load');

      alert('Load updated successfully');
      setEditingLoadId(null);
      fetchLoads();
    } catch (error) {
      console.error('Update failed:', error);
      alert('Failed to update load');
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
    { key: 'GROUP', label: 'GROUP', count: statusCounts.GROUP },
  ];

  /**
   * Table columns configuration
   */
  const columns: DatColumn[] = [
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
      key: 'pickupDate',
      label: 'Pickup',
      width: '110px',
      render: (value) => value ? new Date(value).toLocaleDateString() : 'N/A',
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
      key: 'pickupDockHours',
      label: 'Dock Hours',
      width: '120px',
      render: (value) => value || 'N/A',
    },
    {
      key: 'truckType',
      label: 'Truck',
      width: '100px',
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
      key: 'weight',
      label: 'Weight',
      width: '90px',
      align: 'right' as const,
      render: (value) => value ? `${value}kg` : 'N/A',
    },
    {
      key: 'rate',
      label: 'Offer Rate',
      width: '110px',
      align: 'right' as const,
      sortable: true,
      render: (value, row) => value ? `${row.currency} ${value.toLocaleString()}` : 'N/A',
    },
  ];

  /**
   * Row actions configuration
   */
  const rowActions: DatRowAction[] = [
    {
      key: 'copy',
      label: 'COPY',
      variant: 'secondary',
      onClick: handleCopy,
    },
    {
      key: 'edit',
      label: 'EDIT',
      variant: 'primary',
      onClick: handleEdit,
    },
    {
      key: 'delete',
      label: 'DELETE',
      variant: 'destructive',
      onClick: handleDelete,
    },
    {
      key: 'search',
      label: 'TRUCKS',
      variant: 'search',
      onClick: handleSearchTrucks,
      render: (row) => `${row.matchCount || 0} TRUCKS`,
    },
  ];

  /**
   * Render expanded row content
   */
  const renderExpandedRow = (load: any) => {
    if (editingLoadId === load.id) {
      // Show inline editing form
      return (
        <DatInlineEdit
          data={load}
          fields={[
            { key: 'cargoDescription', label: 'Commodity', type: 'text', maxLength: 100 },
            { key: 'specialInstructions', label: 'Comments 1', type: 'textarea', maxLength: 500 },
            { key: 'safetyNotes', label: 'Comments 2', type: 'textarea', maxLength: 500 },
            { key: 'bookMode', label: 'Contact Method', type: 'select', options: [
              { value: 'DIRECT', label: 'Direct' },
              { value: 'CALLBACK', label: 'Callback' },
              { value: 'PLATFORM', label: 'Platform' },
            ]},
          ]}
          onSave={handleInlineEditSave}
          onCancel={() => setEditingLoadId(null)}
        />
      );
    }

    // Show expanded details
    return (
      <div className="grid grid-cols-2 gap-4 text-white">
        <div>
          <div className="text-xs text-gray-400 mb-1">Contact Method</div>
          <div className="text-sm">{load.bookMode || 'N/A'}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-1">Ref ID</div>
          <div className="text-sm">{load.id.slice(0, 12)}...</div>
        </div>
        <div className="col-span-2">
          <div className="text-xs text-gray-400 mb-1">Commodity</div>
          <div className="text-sm">{load.cargoDescription || 'N/A'}</div>
        </div>
        <div className="col-span-2">
          <div className="text-xs text-gray-400 mb-1">Comments 1</div>
          <div className="text-sm">{load.specialInstructions || 'N/A'}</div>
        </div>
        <div className="col-span-2">
          <div className="text-xs text-gray-400 mb-1">Comments 2</div>
          <div className="text-sm">{load.safetyNotes || 'N/A'}</div>
        </div>
        <div className="col-span-2">
          <DatReferencePricing
            trihaulRate={load.referencePricing?.trihaulRate}
            brokerSpotRate={load.referencePricing?.brokerSpotRate}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with NEW LOAD POST button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">POST LOADS</h2>
        <DatActionButton
          variant="primary"
          onClick={() => setShowNewLoadModal(true)}
          icon="+"
        >
          NEW LOAD POST
        </DatActionButton>
      </div>

      {/* Status Tabs */}
      <DatStatusTabs
        tabs={statusTabs}
        activeTab={activeStatus}
        onTabChange={(tab) => setActiveStatus(tab as LoadStatus)}
      />

      {/* Data Table */}
      <DatDataTable
        columns={columns}
        data={loads}
        expandable={true}
        renderExpandedRow={renderExpandedRow}
        actions={rowActions}
        loading={loading}
        emptyMessage="No loads found. Click NEW LOAD POST to create one."
        rowKey="id"
      />

      {/* Load Posting Modal */}
      <LoadPostingModal
        isOpen={showNewLoadModal}
        onClose={() => setShowNewLoadModal(false)}
        onSuccess={fetchLoads}
        user={user}
      />
    </div>
  );
}
