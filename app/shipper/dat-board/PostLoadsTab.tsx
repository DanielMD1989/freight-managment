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
} from '@/components/dat-ui';
import { DatColumn, DatStatusTab, DatRowAction } from '@/types/dat-ui';
import { ETHIOPIAN_LOCATIONS } from '@/lib/constants/ethiopian-locations';
import PlacesAutocomplete, { PlaceResult } from '@/components/PlacesAutocomplete';
import { useToast } from '@/components/Toast/ToastContext';

interface PostLoadsTabProps {
  user: any;
  onSwitchToSearchTrucks?: (filters: any) => void;
}

/**
 * Get CSRF token for secure form submissions
 */
const getCSRFToken = async (): Promise<string | null> => {
  try {
    const response = await fetch('/api/csrf-token');
    if (!response.ok) {
      console.error('CSRF token request failed:', response.status);
      return null;
    }
    const data = await response.json();
    return data.csrfToken;
  } catch (error) {
    console.error('Failed to get CSRF token:', error);
    return null;
  }
};

type LoadStatus = 'POSTED' | 'UNPOSTED' | 'EXPIRED';

export default function PostLoadsTab({ user, onSwitchToSearchTrucks }: PostLoadsTabProps) {
  const toast = useToast();
  const [loads, setLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<LoadStatus>('POSTED');
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [editingLoad, setEditingLoad] = useState<any | null>(null);
  const [expandedLoadId, setExpandedLoadId] = useState<string | null>(null);
  const [showNewLoadModal, setShowNewLoadModal] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [submitting, setSubmitting] = useState(false);

  // New load form state
  const [newLoadForm, setNewLoadForm] = useState({
    pickupDate: '',
    pickupCity: '',
    deliveryCity: '',
    pickupDockHours: '',
    truckType: 'REFRIGERATED',
    fullPartial: 'FULL',
    lengthM: '',
    weight: '',
    shipperContactPhone: '',
    cargoDescription: '',
    specialInstructions: '',
    // Sprint 16: Base + Per-KM Pricing
    baseFareEtb: '',
    perKmEtb: '',
    tripKm: '',
    // Sprint 15: Google Places coordinates
    pickupCoordinates: undefined as { lat: number; lng: number } | undefined,
    deliveryCoordinates: undefined as { lat: number; lng: number } | undefined,
  });

  /**
   * Truck types list with enum values and display labels
   */
  const truckTypes = [
    { value: 'REFRIGERATED', label: 'Reefer' },
    { value: 'DRY_VAN', label: 'Van' },
    { value: 'FLATBED', label: 'Flatbed' },
    { value: 'CONTAINER', label: 'Container' },
    { value: 'TANKER', label: 'Tanker' },
    { value: 'BOX_TRUCK', label: 'Box Truck' },
    { value: 'LOWBOY', label: 'Lowboy' },
    { value: 'DUMP_TRUCK', label: 'Dump Truck' },
  ];

  /**
   * Get display label for truck type enum value
   */
  const getTruckTypeLabel = (enumValue: string | null | undefined): string => {
    if (!enumValue) return 'N/A';
    const found = truckTypes.find(t => t.value === enumValue);
    return found ? found.label : enumValue.replace('_', ' ');
  };

  /**
   * Fetch loads
   */
  const fetchLoads = async () => {
    setLoading(true);
    try {
      // Fetch loads for the active status tab (user's own loads only)
      const params = new URLSearchParams();
      params.append('status', activeStatus);
      params.append('myLoads', 'true'); // Only fetch user's own loads

      const response = await fetch(`/api/loads?${params.toString()}`);
      const data = await response.json();

      const loadsData = data.loads || [];

      // Fetch match counts for POSTED loads in parallel
      const loadsWithMatchCounts = await Promise.all(
        loadsData.map(async (load: any) => {
          if (load.status === 'POSTED') {
            try {
              const matchResponse = await fetch(`/api/loads/${load.id}/matching-trucks?limit=1`);
              const matchData = await matchResponse.json();
              return { ...load, matchCount: matchData.total || 0 };
            } catch (error) {
              console.error(`Failed to fetch matches for load ${load.id}:`, error);
              return { ...load, matchCount: 0 };
            }
          }
          return { ...load, matchCount: 0 };
        })
      );

      setLoads(loadsWithMatchCounts);

      // Fetch counts for each status tab
      const counts: Record<string, number> = {
        POSTED: 0,
        UNPOSTED: 0,
        EXPIRED: 0,
      };

      const statusPromises = ['POSTED', 'UNPOSTED', 'EXPIRED'].map(async (status) => {
        const res = await fetch(`/api/loads?status=${status}&myLoads=true&limit=1`);
        const json = await res.json();
        counts[status] = json.pagination?.total || 0;
      });

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
      toast.success('Load copied successfully!');
      fetchLoads();
    } catch (error) {
      console.error('Copy failed:', error);
      toast.error('Failed to copy load');
    }
  };

  /**
   * Handle EDIT action - Show inline edit form
   */
  const handleEdit = (load: any) => {
    setEditingLoad(load);
    setExpandedLoadId(load.id);
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

      toast.success('Load deleted successfully');
      fetchLoads();
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete load');
    }
  };

  /**
   * Handle POST action - Change unposted load to posted
   */
  const handlePostLoad = async (load: any) => {
    try {
      // Get CSRF token for secure submission
      const csrfToken = await getCSRFToken();
      if (!csrfToken) {
        toast.error('Failed to get security token. Please refresh and try again.');
        return;
      }

      const response = await fetch(`/api/loads/${load.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ status: 'POSTED' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to post load');
      }

      toast.success('Load posted successfully!');
      fetchLoads(); // Refresh the list
    } catch (error: any) {
      console.error('Post load error:', error);
      toast.error(error.message || 'Failed to post load');
    }
  };

  /**
   * Handle SEARCH TRUCKS action
   */
  const handleSearchTrucks = (load: any) => {
    // Build filters from the load data
    const filters = {
      origin: load.pickupCity || '',
      destination: load.deliveryCity || '',
      truckType: load.truckType || '',
      pickupDate: load.pickupDate || '',
      length: load.lengthM?.toString() || '',
      weight: load.weight?.toString() || '',
    };

    // Call the parent callback to switch to SEARCH TRUCKS tab with filters
    if (onSwitchToSearchTrucks) {
      onSwitchToSearchTrucks(filters);
    }
  };

  /**
   * Handle header column click for sorting
   */
  const handleHeaderClick = (field: string) => {
    if (sortField === field) {
      // Toggle sort order if same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortOrder('asc');
    }

    // Sort the loads array
    const sorted = [...loads].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setLoads(sorted);
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
      toast.error('Failed to update load');
    }
  };

  /**
   * Handle new load form submission
   */
  const handleSubmitNewLoad = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!newLoadForm.pickupCity || !newLoadForm.deliveryCity || !newLoadForm.pickupDate || !newLoadForm.truckType) {
      toast.warning('Please fill in all required fields: Origin, Destination, Pickup Date, and Truck Type');
      return;
    }

    // Sprint 16: Validate pricing fields
    if (!newLoadForm.baseFareEtb || !newLoadForm.perKmEtb || !newLoadForm.tripKm) {
      toast.warning('Please fill in all pricing fields: Base Fare, Per-KM Rate, and Trip Distance');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/loads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newLoadForm,
          lengthM: newLoadForm.lengthM ? parseFloat(newLoadForm.lengthM) : null,
          weight: newLoadForm.weight ? parseFloat(newLoadForm.weight) : null,
          // Sprint 16: Parse pricing fields
          baseFareEtb: parseFloat(newLoadForm.baseFareEtb),
          perKmEtb: parseFloat(newLoadForm.perKmEtb),
          tripKm: parseFloat(newLoadForm.tripKm),
          status: 'POSTED', // Default to POSTED
          deliveryDate: newLoadForm.pickupDate, // Use same date for now
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create load');
      }

      // Success! Clear form and refresh loads
      setNewLoadForm({
        pickupDate: '',
        pickupCity: '',
        deliveryCity: '',
        pickupDockHours: '',
        truckType: 'REFRIGERATED',
        fullPartial: 'FULL',
        lengthM: '',
        weight: '',
        shipperContactPhone: '',
        cargoDescription: '',
        specialInstructions: '',
        baseFareEtb: '',
        perKmEtb: '',
        tripKm: '',
        // Sprint 15: Google Places coordinates
        pickupCoordinates: undefined,
        deliveryCoordinates: undefined,
      });
      setShowNewLoadModal(false);
      toast.success('Load posted successfully!');
      fetchLoads(); // Refresh the list
    } catch (error: any) {
      console.error('Submit load error:', error);
      toast.error(error.message || 'Failed to post load');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Handle form input change
   */
  const handleFormChange = (field: string, value: any) => {
    setNewLoadForm({ ...newLoadForm, [field]: value });
  };

  /**
   * Handle edit form input change
   */
  const handleEditFormChange = (field: string, value: any) => {
    setEditingLoad({ ...editingLoad, [field]: value });
  };

  /**
   * Handle edit form submission
   */
  const handleSubmitEditLoad = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingLoad) return;

    // Validate required fields
    if (!editingLoad.pickupCity || !editingLoad.deliveryCity || !editingLoad.pickupDate || !editingLoad.truckType) {
      toast.warning('Please fill in all required fields: Origin, Destination, Pickup Date, and Truck Type');
      return;
    }

    setSubmitting(true);
    try {
      // Get CSRF token for secure submission
      const csrfToken = await getCSRFToken();
      if (!csrfToken) {
        toast.error('Failed to get security token. Please refresh and try again.');
        setSubmitting(false);
        return;
      }

      // Build update payload - auto-post unposted loads when saving
      const updatePayload: any = {
        pickupCity: editingLoad.pickupCity,
        deliveryCity: editingLoad.deliveryCity,
        pickupDate: editingLoad.pickupDate,
        pickupDockHours: editingLoad.pickupDockHours,
        truckType: editingLoad.truckType,
        fullPartial: editingLoad.fullPartial,
        lengthM: editingLoad.lengthM ? parseFloat(editingLoad.lengthM) : null,
        weight: editingLoad.weight ? parseFloat(editingLoad.weight) : null,
        shipperContactPhone: editingLoad.shipperContactPhone,
        cargoDescription: editingLoad.cargoDescription,
        specialInstructions: editingLoad.specialInstructions,
      };

      // If currently UNPOSTED, change to POSTED when saving
      if (editingLoad.status === 'UNPOSTED') {
        updatePayload.status = 'POSTED';
      }

      const response = await fetch(`/api/loads/${editingLoad.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update load');
      }

      // Success! Clear editing state and refresh loads
      const wasUnposted = editingLoad.status === 'UNPOSTED';
      setEditingLoad(null);
      setExpandedLoadId(null);
      toast.success(wasUnposted ? 'Load updated and posted successfully!' : 'Load updated successfully!');
      fetchLoads();
    } catch (error: any) {
      console.error('Update load error:', error);
      toast.error(error.message || 'Failed to update load');
    } finally {
      setSubmitting(false);
    }
  };


  /**
   * Status tabs configuration - POSTED, UNPOSTED, EXPIRED only
   */
  const statusTabs: DatStatusTab[] = [
    { key: 'POSTED', label: 'POSTED', count: statusCounts.POSTED },
    { key: 'UNPOSTED', label: 'UNPOSTED', count: statusCounts.UNPOSTED },
    { key: 'EXPIRED', label: 'EXPIRED', count: statusCounts.EXPIRED },
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
      width: '130px',
      align: 'right' as const,
      sortable: true,
      render: (value, row) => {
        // Sprint 16: Show detailed pricing if available
        if (row.baseFareEtb && row.perKmEtb) {
          return (
            <div className="text-right">
              <div className="font-bold" style={{ color: '#00BCD4' }}>
                {row.totalFareEtb?.toLocaleString() || value.toLocaleString()} ETB
              </div>
              <div className="text-xs text-[#064d51]/70">
                {row.baseFareEtb.toLocaleString()}+{row.perKmEtb.toLocaleString()}/km
              </div>
            </div>
          );
        }
        // Legacy: Show simple rate
        return value ? `${row.currency} ${value.toLocaleString()}` : 'N/A';
      },
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

  return (
    <div className="space-y-6 pt-10">
      {/* Header Row - NEW LOAD POST on left, Status Tabs on right */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowNewLoadModal(!showNewLoadModal)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-teal-500/30 transition-all font-semibold text-sm shadow-md shadow-teal-500/25"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          NEW LOAD POST
        </button>

        {/* Status Tabs - Right Side */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-1.5 inline-flex gap-1">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveStatus(tab.key as LoadStatus)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeStatus === tab.key
                  ? 'bg-gradient-to-r from-teal-600 to-teal-500 text-white shadow-md shadow-teal-500/25'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label} {tab.count !== undefined && <span className="ml-1 text-xs opacity-75">({tab.count})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Table Structure */}
      <div className="bg-white border border-slate-200/60 rounded-2xl overflow-visible relative shadow-sm">
        {/* Table Header - Teal Gradient */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-500 grid grid-cols-12 gap-2 px-4 py-3 rounded-t-2xl text-xs font-semibold text-white relative">
          <div className="flex items-center gap-1 relative">
            <button
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              className="flex items-center gap-1 hover:bg-white/20 px-1.5 py-1 rounded transition-colors"
            >
              <span>☐</span>
              <span>=</span>
            </button>

            {/* Actions Dropdown Menu */}
            {showActionsMenu && (
              <>
                {/* Invisible overlay to close menu when clicking outside */}
                <div
                  className="fixed inset-0"
                  style={{ zIndex: 9998 }}
                  onClick={() => setShowActionsMenu(false)}
                />

                {/* Dropdown Menu */}
                <div
                  className="absolute top-full left-0 mt-1 bg-white border border-slate-200/60 rounded-xl shadow-xl w-48"
                  style={{ zIndex: 9999 }}
                >
                  <button
                    onClick={() => {
                      // Handle refresh action
                      setShowActionsMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 text-sm text-slate-700 border-b border-slate-100 transition-colors rounded-t-xl"
                  >
                    <span>🔄</span> REFRESH
                  </button>
                  <button
                    onClick={() => {
                      // Handle rollover action
                      setShowActionsMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 text-sm text-slate-700 border-b border-slate-100 transition-colors"
                  >
                    <span>📋</span> ROLLOVER
                  </button>
                  <button
                    onClick={() => {
                      // Handle cancel rollover action
                      setShowActionsMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 text-sm text-slate-700 border-b border-slate-100 transition-colors"
                  >
                    CANCEL ROLLOVER
                  </button>
                  <button
                    onClick={() => {
                      // Handle delete action
                      setShowActionsMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-rose-50 flex items-center gap-2 text-sm text-rose-600 border-b border-slate-100 transition-colors"
                  >
                    <span>🗑️</span> DELETE
                  </button>
                  <button
                    onClick={() => {
                      // Handle unpost action
                      setShowActionsMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 text-sm text-slate-700 border-b border-slate-100 transition-colors"
                  >
                    UNPOST
                  </button>
                  <button
                    onClick={() => {
                      // Handle keep action
                      setShowActionsMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 text-sm text-slate-700 border-b border-slate-100 transition-colors"
                  >
                    <span>⭐</span> KEEP
                  </button>
                  <button
                    onClick={() => {
                      // Handle unkeep action
                      setShowActionsMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 text-sm text-slate-700 transition-colors rounded-b-xl"
                  >
                    UNKEEP
                  </button>
                </div>
              </>
            )}
          </div>
          <div
            className="cursor-pointer hover:bg-white/20 px-1.5 py-1 rounded transition-colors"
            onClick={() => handleHeaderClick('createdAt')}
          >
            Age {sortField === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
          </div>
          <div
            className="cursor-pointer hover:bg-white/20 px-1.5 py-1 rounded transition-colors"
            onClick={() => handleHeaderClick('status')}
          >
            Status {sortField === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
          </div>
          <div
            className="cursor-pointer hover:bg-white/20 px-1.5 py-1 rounded transition-colors"
            onClick={() => handleHeaderClick('pickupDate')}
          >
            Pickup {sortField === 'pickupDate' && (sortOrder === 'asc' ? '↑' : '↓')}
          </div>
          <div
            className="cursor-pointer hover:bg-white/20 px-1.5 py-1 rounded transition-colors"
            onClick={() => handleHeaderClick('pickupCity')}
          >
            Origin {sortField === 'pickupCity' && (sortOrder === 'asc' ? '↑' : '↓')}
          </div>
          <div
            className="cursor-pointer hover:bg-white/20 px-1.5 py-1 rounded transition-colors"
            onClick={() => handleHeaderClick('deliveryCity')}
          >
            Destination {sortField === 'deliveryCity' && (sortOrder === 'asc' ? '↑' : '↓')}
          </div>
          <div
            className="cursor-pointer hover:bg-white/20 px-1.5 py-1 rounded transition-colors"
            onClick={() => handleHeaderClick('pickupDockHours')}
          >
            Dock Hours {sortField === 'pickupDockHours' && (sortOrder === 'asc' ? '↑' : '↓')}
          </div>
          <div
            className="cursor-pointer hover:bg-white/20 px-1.5 py-1 rounded transition-colors"
            onClick={() => handleHeaderClick('truckType')}
          >
            Truck {sortField === 'truckType' && (sortOrder === 'asc' ? '↑' : '↓')}
          </div>
          <div
            className="cursor-pointer hover:bg-white/20 px-1.5 py-1 rounded transition-colors"
            onClick={() => handleHeaderClick('fullPartial')}
          >
            F/P {sortField === 'fullPartial' && (sortOrder === 'asc' ? '↑' : '↓')}
          </div>
          <div
            className="cursor-pointer hover:bg-white/20 px-1.5 py-1 rounded transition-colors"
            onClick={() => handleHeaderClick('lengthM')}
          >
            Length {sortField === 'lengthM' && (sortOrder === 'asc' ? '↑' : '↓')}
          </div>
          <div
            className="cursor-pointer hover:bg-white/20 px-1.5 py-1 rounded transition-colors"
            onClick={() => handleHeaderClick('weight')}
          >
            Weight {sortField === 'weight' && (sortOrder === 'asc' ? '↑' : '↓')}
          </div>
          <div
            className="cursor-pointer hover:bg-white/20 px-1.5 py-1 rounded transition-colors"
            onClick={() => handleHeaderClick('shipperContactPhone')}
          >
            Contact {sortField === 'shipperContactPhone' && (sortOrder === 'asc' ? '↑' : '↓')}
          </div>
        </div>

        {/* NEW POST FORM - Expands under header */}
        {showNewLoadModal && (
          <form onSubmit={handleSubmitNewLoad}>
          <div className="border-b border-slate-100 p-6 bg-gradient-to-r from-slate-50 to-teal-50/30">
            {/* Form Fields Row - Skip Age and Status columns */}
            <div className="grid grid-cols-12 gap-2 mb-4">
              <div className="flex items-center gap-1 pt-5">
                <input type="checkbox" className="w-4 h-4" />
                <span className="text-lg cursor-pointer" style={{ color: '#2B2727' }}>☆</span>
              </div>
              {/* Empty columns for Age and Status */}
              <div></div>
              <div></div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>Pickup *</label>
                <input
                  type="date"
                  value={newLoadForm.pickupDate}
                  onChange={(e) => handleFormChange('pickupDate', e.target.value)}
                  className="w-full px-2 py-1 text-xs !bg-white border border-[#064d51]/30 rounded"
                  style={{ color: '#2B2727' }}
                  required
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>Origin *</label>
                <PlacesAutocomplete
                  value={newLoadForm.pickupCity}
                  onChange={(value, place) => {
                    handleFormChange('pickupCity', value);
                    // Store coordinates if available for distance calculation
                    if (place?.coordinates) {
                      handleFormChange('pickupCoordinates', place.coordinates);
                    }
                  }}
                  placeholder="Search city..."
                  className="w-full px-2 py-1 text-xs !bg-white border border-[#064d51]/30 rounded"
                  countryRestriction={['ET', 'DJ']}
                  types={['(cities)']}
                  required
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>Destination *</label>
                <PlacesAutocomplete
                  value={newLoadForm.deliveryCity}
                  onChange={(value, place) => {
                    handleFormChange('deliveryCity', value);
                    // Store coordinates if available for distance calculation
                    if (place?.coordinates) {
                      handleFormChange('deliveryCoordinates', place.coordinates);
                    }
                  }}
                  placeholder="Search city..."
                  className="w-full px-2 py-1 text-xs !bg-white border border-[#064d51]/30 rounded"
                  countryRestriction={['ET', 'DJ']}
                  types={['(cities)']}
                  required
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>Dock Hours</label>
                <input
                  type="text"
                  value={newLoadForm.pickupDockHours}
                  onChange={(e) => handleFormChange('pickupDockHours', e.target.value)}
                  className="w-full px-2 py-1 text-xs !bg-white border border-[#064d51]/30 rounded"
                  style={{ color: '#2B2727' }}
                  placeholder="9am-5pm"
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>Truck *</label>
                <select
                  value={newLoadForm.truckType}
                  onChange={(e) => handleFormChange('truckType', e.target.value)}
                  className="w-full px-2 py-1 text-xs !bg-white border border-[#064d51]/30 rounded"
                  style={{ color: '#2B2727' }}
                  required
                >
                  <option value="REFRIGERATED">Reefer</option>
                  <option value="DRY_VAN">Van</option>
                  <option value="FLATBED">Flatbed</option>
                  <option value="CONTAINER">Container</option>
                  <option value="TANKER">Tanker</option>
                  <option value="BOX_TRUCK">Box Truck</option>
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>F/P</label>
                <select
                  value={newLoadForm.fullPartial}
                  onChange={(e) => handleFormChange('fullPartial', e.target.value)}
                  className="w-full px-2 py-1 text-xs !bg-white border border-[#064d51]/30 rounded"
                  style={{ color: '#2B2727' }}
                >
                  <option value="FULL">Full</option>
                  <option value="PARTIAL">Partial</option>
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>Length</label>
                <input
                  type="number"
                  value={newLoadForm.lengthM}
                  onChange={(e) => handleFormChange('lengthM', e.target.value)}
                  className="w-full px-2 py-1 text-xs !bg-white border border-[#064d51]/30 rounded"
                  style={{ color: '#2B2727' }}
                  placeholder="53"
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>Weight</label>
                <input
                  type="number"
                  value={newLoadForm.weight}
                  onChange={(e) => handleFormChange('weight', e.target.value)}
                  className="w-full px-2 py-1 text-xs !bg-white border border-[#064d51]/30 rounded"
                  style={{ color: '#2B2727' }}
                  placeholder="45000"
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>Contact</label>
                <input
                  type="tel"
                  value={newLoadForm.shipperContactPhone}
                  onChange={(e) => handleFormChange('shipperContactPhone', e.target.value)}
                  className="w-full px-2 py-1 text-xs !bg-white border border-[#064d51]/30 rounded"
                  style={{ color: '#2B2727' }}
                  placeholder="+251-9xx"
                />
              </div>
            </div>

            {/* Sprint 16: Pricing Row - Base + Per-KM Model */}
            <div className="grid grid-cols-12 gap-2 mb-4 mt-2">
              {/* Empty columns for alignment */}
              <div></div><div></div><div></div>

              <div>
                <label className="block text-xs mb-1 font-semibold" style={{ color: '#2B2727' }}>Base Fare (ETB) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={newLoadForm.baseFareEtb}
                  onChange={(e) => handleFormChange('baseFareEtb', e.target.value)}
                  className="w-full px-2 py-1 text-xs !bg-white border border-[#064d51]/30 rounded"
                  style={{ color: '#2B2727' }}
                  placeholder="500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs mb-1 font-semibold" style={{ color: '#2B2727' }}>Per-KM (ETB) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={newLoadForm.perKmEtb}
                  onChange={(e) => handleFormChange('perKmEtb', e.target.value)}
                  className="w-full px-2 py-1 text-xs !bg-white border border-[#064d51]/30 rounded"
                  style={{ color: '#2B2727' }}
                  placeholder="15.50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs mb-1 font-semibold" style={{ color: '#2B2727' }}>Trip KM *</label>
                <input
                  type="number"
                  step="0.01"
                  value={newLoadForm.tripKm}
                  onChange={(e) => handleFormChange('tripKm', e.target.value)}
                  className="w-full px-2 py-1 text-xs !bg-white border border-[#064d51]/30 rounded"
                  style={{ color: '#2B2727' }}
                  placeholder="250"
                  required
                />
              </div>

              <div className="col-span-3">
                <label className="block text-xs mb-1 font-semibold" style={{ color: '#00BCD4' }}>Total Fare (Calculated)</label>
                <div className="px-2 py-1 text-sm font-bold bg-cyan-50 border-2 border-cyan-400 rounded" style={{ color: '#00BCD4' }}>
                  ETB {newLoadForm.baseFareEtb && newLoadForm.perKmEtb && newLoadForm.tripKm
                    ? (parseFloat(newLoadForm.baseFareEtb) + (parseFloat(newLoadForm.perKmEtb) * parseFloat(newLoadForm.tripKm))).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})
                    : '0.00'}
                </div>
                {newLoadForm.baseFareEtb && newLoadForm.perKmEtb && newLoadForm.tripKm && (
                  <div className="text-xs text-[#064d51]/70 mt-1">
                    RPK: {(parseFloat(newLoadForm.baseFareEtb) + (parseFloat(newLoadForm.perKmEtb) * parseFloat(newLoadForm.tripKm)) / parseFloat(newLoadForm.tripKm)).toFixed(2)} ETB/km
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Section: Commodity, Comments, and Actions */}
            <div className="grid grid-cols-3 gap-4">
              {/* Commodity */}
              <div>
                <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>
                  Commodity <span className="text-[#064d51]/60">({newLoadForm.cargoDescription.length}/100 max char)</span>
                </label>
                <textarea
                  value={newLoadForm.cargoDescription}
                  onChange={(e) => handleFormChange('cargoDescription', e.target.value)}
                  className="w-full px-3 py-2 !bg-white border border-[#064d51]/30 rounded resize-none"
                  style={{ color: '#2B2727' }}
                  rows={3}
                  maxLength={100}
                  placeholder="e.g. Steel Coils, Electronics..."
                />
              </div>

              {/* Comments */}
              <div>
                <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>
                  Comments <span className="text-[#064d51]/60">({newLoadForm.specialInstructions.length}/70 max char)</span>
                </label>
                <textarea
                  value={newLoadForm.specialInstructions}
                  onChange={(e) => handleFormChange('specialInstructions', e.target.value)}
                  className="w-full px-3 py-2 !bg-white border border-[#064d51]/30 rounded resize-none"
                  style={{ color: '#2B2727' }}
                  rows={3}
                  maxLength={70}
                  placeholder="Additional notes..."
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col justify-end">
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-6 py-2.5 bg-gradient-to-r from-teal-600 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-teal-500/30 transition-all disabled:from-slate-400 disabled:to-slate-400 disabled:shadow-none disabled:cursor-not-allowed shadow-md shadow-teal-500/25"
                  >
                    {submitting ? 'POSTING...' : '+ POST'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewLoadModal(false)}
                    className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors font-bold border border-slate-200"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          </div>
          </form>
        )}

        {/* Load Rows */}
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500">Loading loads...</p>
          </div>
        ) : loads.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-slate-700 font-medium mb-1">No loads found</h3>
            <p className="text-slate-500 text-sm">Click NEW LOAD POST to create your first load</p>
          </div>
        ) : (
          loads.map((load) => (
            <div key={load.id}>
              {/* Load Row - Clickable */}
              <div
                className={`grid grid-cols-12 gap-2 px-4 py-3 border-b cursor-default text-xs transition-colors ${
                  expandedLoadId === load.id
                    ? 'bg-teal-50 border-l-4 border-l-teal-500 border-b-teal-200'
                    : 'border-slate-100 hover:bg-slate-50 text-slate-700'
                }`}
                onClick={() => {
                  if (expandedLoadId === load.id) {
                    setExpandedLoadId(null);
                    setEditingLoad(null); // Reset editing state when collapsing
                  } else {
                    setExpandedLoadId(load.id);
                    setEditingLoad(null); // Ensure editing is closed when expanding a new row
                  }
                }}
              >
                <div className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span
                    className="text-lg cursor-pointer hover:text-yellow-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleKept(load);
                    }}
                  >
                    {load.isKept ? '★' : '☆'}
                  </span>
                </div>
                <div><DatAgeIndicator date={load.createdAt} /></div>
                <div>
                  <span className={`
                    px-2.5 py-1 rounded-full text-xs font-medium
                    ${load.status === 'POSTED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : ''}
                    ${load.status === 'UNPOSTED' ? 'bg-slate-50 text-slate-600 border border-slate-200' : ''}
                    ${load.status === 'EXPIRED' ? 'bg-rose-50 text-rose-700 border border-rose-200' : ''}
                  `}>
                    {load.status}
                  </span>
                </div>
                <div>{load.pickupDate ? new Date(load.pickupDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) : 'N/A'}</div>
                <div className="truncate">{load.pickupCity || 'N/A'}</div>
                <div className="truncate">{load.deliveryCity || 'N/A'}</div>
                <div>{load.pickupDockHours || 'N/A'}</div>
                <div>{getTruckTypeLabel(load.truckType)}</div>
                <div>{load.fullPartial || 'N/A'}</div>
                <div>{load.lengthM ? `${load.lengthM}ft` : 'N/A'}</div>
                <div>{load.weight ? `${load.weight.toLocaleString()}` : 'N/A'}</div>
                <div>{load.shipperContactPhone || 'N/A'}</div>
              </div>

              {/* Expanded Section - Shows details or edit form */}
              {expandedLoadId === load.id && editingLoad?.id === load.id && (
                /* INLINE EDIT FORM - Professional Layout */
                <form onSubmit={handleSubmitEditLoad}>
                  <div className="border-l-4 border-l-teal-500 bg-teal-50 p-6 border-t border-teal-200">
                    {/* Header with load info */}
                    <div className="flex items-center justify-between border-b border-teal-200 pb-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                          <span className="text-xl">📦</span>
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-[#064d51]">
                            Edit Load Posting
                          </h3>
                          <p className="text-xs text-[#064d51]/60">
                            {load.pickupCity} → {load.deliveryCity} • {getTruckTypeLabel(load.truckType)} • {load.weight ? `${load.weight.toLocaleString()} kg` : 'N/A'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLoad(null);
                          setExpandedLoadId(null);
                        }}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white/50 rounded-full transition-colors"
                      >
                        <span className="text-lg">✕</span>
                      </button>
                    </div>

                    {/* Form Grid - Professional Layout */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-4">
                      {/* Pickup Date */}
                      <div>
                        <label className="block text-xs font-medium text-[#064d51]/80 mb-1">
                          Pickup Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={editingLoad.pickupDate ? new Date(editingLoad.pickupDate).toISOString().split('T')[0] : ''}
                          onChange={(e) => handleEditFormChange('pickupDate', e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white text-[#064d51] border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                          required
                        />
                      </div>

                      {/* Origin */}
                      <div>
                        <label className="block text-xs font-medium text-[#064d51]/80 mb-1">
                          Origin <span className="text-red-500">*</span>
                        </label>
                        <PlacesAutocomplete
                          value={editingLoad.pickupCity || ''}
                          onChange={(value, place) => {
                            handleEditFormChange('pickupCity', value);
                            if (place?.coordinates) {
                              handleEditFormChange('pickupCoordinates', place.coordinates);
                            }
                          }}
                          placeholder="Search city..."
                          className="w-full px-3 py-2 text-sm bg-white border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-teal-500"
                          countryRestriction={['ET', 'DJ']}
                          types={['(cities)']}
                          required
                        />
                      </div>

                      {/* Destination */}
                      <div>
                        <label className="block text-xs font-medium text-[#064d51]/80 mb-1">
                          Destination <span className="text-red-500">*</span>
                        </label>
                        <PlacesAutocomplete
                          value={editingLoad.deliveryCity || ''}
                          onChange={(value, place) => {
                            handleEditFormChange('deliveryCity', value);
                            if (place?.coordinates) {
                              handleEditFormChange('deliveryCoordinates', place.coordinates);
                            }
                          }}
                          placeholder="Search city..."
                          className="w-full px-3 py-2 text-sm bg-white border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-teal-500"
                          countryRestriction={['ET', 'DJ']}
                          types={['(cities)']}
                          required
                        />
                      </div>

                      {/* Dock Hours */}
                      <div>
                        <label className="block text-xs font-medium text-[#064d51]/80 mb-1">
                          Dock Hours
                        </label>
                        <input
                          type="text"
                          value={editingLoad.pickupDockHours || ''}
                          onChange={(e) => handleEditFormChange('pickupDockHours', e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white text-[#064d51] border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                          placeholder="9am-5pm"
                        />
                      </div>

                      {/* Truck Type */}
                      <div>
                        <label className="block text-xs font-medium text-[#064d51]/80 mb-1">
                          Truck Type <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={editingLoad.truckType || 'REFRIGERATED'}
                          onChange={(e) => handleEditFormChange('truckType', e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white text-[#064d51] border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                          required
                        >
                          <option value="REFRIGERATED">Reefer</option>
                          <option value="DRY_VAN">Van</option>
                          <option value="FLATBED">Flatbed</option>
                          <option value="CONTAINER">Container</option>
                          <option value="TANKER">Tanker</option>
                          <option value="BOX_TRUCK">Box Truck</option>
                        </select>
                      </div>

                      {/* Full/Partial */}
                      <div>
                        <label className="block text-xs font-medium text-[#064d51]/80 mb-1">
                          Load Type
                        </label>
                        <select
                          value={editingLoad.fullPartial || 'FULL'}
                          onChange={(e) => handleEditFormChange('fullPartial', e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white text-[#064d51] border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        >
                          <option value="FULL">Full</option>
                          <option value="PARTIAL">Partial</option>
                        </select>
                      </div>

                      {/* Length */}
                      <div>
                        <label className="block text-xs font-medium text-[#064d51]/80 mb-1">
                          Length (m)
                        </label>
                        <input
                          type="number"
                          value={editingLoad.lengthM || ''}
                          onChange={(e) => handleEditFormChange('lengthM', e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white text-[#064d51] border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                          placeholder="12"
                        />
                      </div>

                      {/* Weight */}
                      <div>
                        <label className="block text-xs font-medium text-[#064d51]/80 mb-1">
                          Weight (kg)
                        </label>
                        <input
                          type="number"
                          value={editingLoad.weight || ''}
                          onChange={(e) => handleEditFormChange('weight', e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white text-[#064d51] border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                          placeholder="25000"
                        />
                      </div>
                    </div>

                    {/* Second Row: Contact, Commodity, Comments */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      {/* Contact */}
                      <div>
                        <label className="block text-xs font-medium text-[#064d51]/80 mb-1">
                          Contact Phone
                        </label>
                        <input
                          type="tel"
                          value={editingLoad.shipperContactPhone || ''}
                          onChange={(e) => handleEditFormChange('shipperContactPhone', e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white text-[#064d51] border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                          placeholder="+251-9xx-xxx-xxx"
                        />
                      </div>

                      {/* Commodity */}
                      <div>
                        <label className="block text-xs font-medium text-[#064d51]/80 mb-1">
                          Commodity <span className="text-[#064d51]/50">({(editingLoad.cargoDescription || '').length}/100)</span>
                        </label>
                        <input
                          type="text"
                          value={editingLoad.cargoDescription || ''}
                          onChange={(e) => handleEditFormChange('cargoDescription', e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white text-[#064d51] border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                          maxLength={100}
                          placeholder="e.g. Steel Coils, Electronics..."
                        />
                      </div>

                      {/* Comments */}
                      <div>
                        <label className="block text-xs font-medium text-[#064d51]/80 mb-1">
                          Comments <span className="text-[#064d51]/50">({(editingLoad.specialInstructions || '').length}/70)</span>
                        </label>
                        <input
                          type="text"
                          value={editingLoad.specialInstructions || ''}
                          onChange={(e) => handleEditFormChange('specialInstructions', e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white text-[#064d51] border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                          maxLength={70}
                          placeholder="Additional notes..."
                        />
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-end gap-2">
                        <button
                          type="submit"
                          disabled={submitting}
                          className="flex-1 px-6 py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white font-semibold rounded-lg hover:from-teal-700 hover:to-teal-600 transition-all disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed shadow-md cursor-pointer"
                        >
                          {submitting ? 'SAVING...' : 'SAVE CHANGES'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLoad(null);
                            setExpandedLoadId(null);
                          }}
                          className="px-4 py-2 bg-white text-slate-600 rounded-lg hover:bg-slate-100 transition-colors font-semibold border border-slate-200 cursor-pointer"
                        >
                          CANCEL
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              )}

              {/* Expanded Details - Shows when clicked but not editing */}
              {expandedLoadId === load.id && (!editingLoad || editingLoad.id !== load.id) && (
                <div className="border-l-4 border-l-teal-500 bg-teal-50 p-6 border-t border-teal-200">
                  {/* Row with Commodity, Comments, Search, and Action Buttons */}
                  <div className="flex items-start gap-6 text-sm mb-6">
                    <div className="flex-1">
                      <div className="font-medium mb-1 text-slate-700">Commodity</div>
                      <div className="text-slate-600">{load.cargoDescription || 'N/A'}</div>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium mb-1 text-slate-700">Comments</div>
                      <div className="text-slate-600">{load.specialInstructions || 'N/A'}</div>
                    </div>
                    {/* Search and Action Buttons */}
                    <div className="flex items-center gap-2">
                      {/* POST button - only for unposted loads */}
                      {load.status === 'UNPOSTED' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePostLoad(load);
                          }}
                          className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-xs font-semibold rounded-lg hover:from-emerald-700 hover:to-emerald-600 transition-all shadow-md shadow-emerald-500/25 cursor-pointer flex items-center gap-1"
                          title="Post this load to make it visible to carriers"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          POST
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSearchTrucks(load);
                        }}
                        className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200 flex items-center gap-1 cursor-pointer"
                        title="Search for matching trucks"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        SEARCH
                        <span className="bg-indigo-600 text-white px-1.5 py-0.5 rounded-full text-xs font-bold">
                          {load.matchCount || 0}
                        </span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(load);
                        }}
                        className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors border border-slate-200 cursor-pointer"
                      >
                        COPY
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(load);
                        }}
                        className="px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 transition-all cursor-pointer"
                      >
                        EDIT
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(load);
                        }}
                        className="px-3 py-1.5 bg-rose-500 text-white text-xs font-semibold rounded-lg hover:bg-rose-600 transition-all cursor-pointer"
                      >
                        DELETE
                      </button>
                    </div>
                  </div>

                  {/* Sprint 16: Pricing Breakdown */}
                  {load.baseFareEtb && load.perKmEtb && load.tripKm && (
                    <div className="mb-4 p-3 bg-[#064d51]/5 border-2 border-[#1e9c99] rounded-lg">
                      <div className="font-semibold mb-2 text-sm" style={{ color: '#1e9c99' }}>
                        💰 PRICING BREAKDOWN
                      </div>
                      <div className="grid grid-cols-4 gap-3 text-xs">
                        <div>
                          <div className="text-[#064d51]/70 mb-1">Base Fare</div>
                          <div className="font-bold" style={{ color: '#2B2727' }}>
                            {load.baseFareEtb?.toLocaleString()} ETB
                          </div>
                        </div>
                        <div>
                          <div className="text-[#064d51]/70 mb-1">Per-KM Rate</div>
                          <div className="font-bold" style={{ color: '#2B2727' }}>
                            {load.perKmEtb?.toLocaleString()} ETB/km
                          </div>
                        </div>
                        <div>
                          <div className="text-[#064d51]/70 mb-1">Trip Distance</div>
                          <div className="font-bold" style={{ color: '#2B2727' }}>
                            {load.tripKm?.toLocaleString()} km
                          </div>
                        </div>
                        <div>
                          <div className="text-[#064d51]/70 mb-1">Total Fare</div>
                          <div className="font-bold text-lg" style={{ color: '#1e9c99' }}>
                            {load.totalFareEtb?.toLocaleString() || load.rate?.toLocaleString()} ETB
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-[#1e9c99]/30 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-[#064d51]/70">Revenue Per KM (RPK):</span>
                          <span className="font-semibold ml-2" style={{ color: '#2B2727' }}>
                            {((load.totalFareEtb || load.rate) / load.tripKm).toFixed(2)} ETB/km
                          </span>
                        </div>
                        <div>
                          <span className="text-[#064d51]/70">Revenue Per Mile (RPM):</span>
                          <span className="font-semibold ml-2" style={{ color: '#2B2727' }}>
                            {(((load.totalFareEtb || load.rate) / load.tripKm) * 0.621371).toFixed(2)} ETB/mi
                          </span>
                        </div>
                      </div>
                      {load.dhToOriginKm && load.dhAfterDeliveryKm && (
                        <div className="mt-2 pt-2 border-t border-[#1e9c99]/30 text-xs">
                          <div className="text-[#064d51]/70 mb-1">Including Deadhead:</div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <span className="text-[#064d51]/70">DH Origin:</span>
                              <span className="font-semibold ml-2" style={{ color: '#2B2727' }}>
                                {load.dhToOriginKm?.toLocaleString()} km
                              </span>
                            </div>
                            <div>
                              <span className="text-[#064d51]/70">DH Destination:</span>
                              <span className="font-semibold ml-2" style={{ color: '#2B2727' }}>
                                {load.dhAfterDeliveryKm?.toLocaleString()} km
                              </span>
                            </div>
                            <div>
                              <span className="text-[#064d51]/70">True RPK:</span>
                              <span className="font-semibold ml-2" style={{ color: '#2B2727' }}>
                                {((load.totalFareEtb || load.rate) / (parseFloat(load.tripKm) + parseFloat(load.dhToOriginKm || 0) + parseFloat(load.dhAfterDeliveryKm || 0))).toFixed(2)} ETB/km
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sprint 16: GPS Tracking Section */}
                  {load.trackingEnabled && load.trackingUrl && (
                    <div className="mb-4 p-3 bg-green-50 border-2 border-green-400 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold text-sm text-green-700 flex items-center gap-2">
                          <span>📍</span> GPS LIVE TRACKING ACTIVE
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-xs text-green-700">Live</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                        <div>
                          <div className="text-[#064d51]/70 mb-1">Tracking URL</div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              value={`${window.location.origin}${load.trackingUrl}`}
                              className="flex-1 px-2 py-1 text-xs bg-white border border-gray-300 rounded font-mono"
                              onClick={(e) => e.currentTarget.select()}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(`${window.location.origin}${load.trackingUrl}`);
                                toast.success('Tracking URL copied to clipboard!');
                              }}
                              className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                              title="Copy tracking URL"
                            >
                              📋 Copy
                            </button>
                          </div>
                        </div>
                        <div>
                          <div className="text-[#064d51]/70 mb-1">Started</div>
                          <div className="font-semibold text-gray-800">
                            {load.trackingStartedAt ? new Date(load.trackingStartedAt).toLocaleString() : 'N/A'}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={load.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded hover:bg-green-700 transition-colors text-center"
                        >
                          🗺️ VIEW LIVE TRACKING
                        </a>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(`${window.location.origin}${load.trackingUrl}`);
                            toast.success('Tracking URL copied! Share it with your customer.');
                          }}
                          className="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded hover:bg-green-600 transition-colors"
                        >
                          SHARE
                        </button>
                      </div>
                    </div>
                  )}

                  {/* GPS Tracking Not Available */}
                  {load.status === 'ASSIGNED' && !load.trackingEnabled && (
                    <div className="mb-4 p-3 bg-yellow-50 border-2 border-yellow-400 rounded">
                      <div className="font-semibold text-sm text-yellow-700 mb-1">
                        ⚠️ GPS Tracking Not Available
                      </div>
                      <p className="text-xs text-yellow-800">
                        This load is assigned but GPS tracking is not enabled. The assigned truck may not have a GPS device registered.
                      </p>
                    </div>
                  )}

                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
