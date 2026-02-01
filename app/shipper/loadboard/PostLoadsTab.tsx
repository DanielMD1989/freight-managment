'use client';

/**
 * POST LOADS Tab Component
 *
 * Main shipper interface for posting loads and viewing matching trucks
 * Sprint 19 - Redesigned to match Carrier PostTrucksTab pattern
 *
 * Features:
 * - Status tabs (POSTED/UNPOSTED/EXPIRED) with counts
 * - Inline posting form
 * - Expand to see matching trucks with scores
 * - Request truck directly
 * - Edit/Duplicate inline
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  StatusTabs,
  AgeIndicator,
} from '@/components/loadboard-ui';
import { StatusTab } from '@/types/loadboard-ui';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';
import { useToast } from '@/components/Toast/ToastContext';
import { getCSRFToken } from '@/lib/csrfFetch';

interface PostLoadsTabProps {
  user: any;
  onSwitchToSearchTrucks?: (filters: any) => void;
}

type LoadStatus = 'POSTED' | 'UNPOSTED' | 'EXPIRED';
type MainTab = 'postings' | 'matching';

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

const getTruckTypeLabel = (enumValue: string | null | undefined): string => {
  if (!enumValue) return 'N/A';
  const found = truckTypes.find(t => t.value === enumValue);
  return found ? found.label : enumValue.replace('_', ' ');
};

export default function PostLoadsTab({ user, onSwitchToSearchTrucks }: PostLoadsTabProps) {
  const toast = useToast();
  const [loads, setLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<LoadStatus>('POSTED');
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('postings');
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [expandedLoadId, setExpandedLoadId] = useState<string | null>(null);
  const [matchingTrucks, setMatchingTrucks] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [editingLoadId, setEditingLoadId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [showNewLoadForm, setShowNewLoadForm] = useState(false);

  // Ethiopian cities
  const [ethiopianCities, setEthiopianCities] = useState<any[]>([]);

  // New load posting form state
  const [newLoadForm, setNewLoadForm] = useState({
    pickupCity: '',
    deliveryCity: '',
    pickupDate: '',
    deliveryDate: '',
    truckType: 'DRY_VAN',
    weight: '',
    lengthM: '',
    cargoDescription: '',
    specialRequirements: '',
    rate: '',
    contactPhone: '',
    pickupCoordinates: undefined as { lat: number; lng: number } | undefined,
    deliveryCoordinates: undefined as { lat: number; lng: number } | undefined,
  });

  // Truck request modal state
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [selectedTruckForRequest, setSelectedTruckForRequest] = useState<any>(null);
  const [selectedLoadForRequest, setSelectedLoadForRequest] = useState<string>('');
  const [requestNotes, setRequestNotes] = useState('');
  const [requestProposedRate, setRequestProposedRate] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Track which trucks have already been requested
  const [requestedTruckIds, setRequestedTruckIds] = useState<Set<string>>(new Set());

  /**
   * Fetch Ethiopian cities
   */
  const fetchEthiopianCities = async () => {
    try {
      const response = await fetch('/api/ethiopian-locations');
      const data = await response.json();
      setEthiopianCities(data.locations || []);
    } catch (error) {
      console.error('Failed to fetch Ethiopian cities:', error);
    }
  };

  /**
   * Fetch existing truck requests
   */
  const fetchExistingRequests = async () => {
    try {
      const response = await fetch('/api/truck-requests?status=PENDING');
      if (response.ok) {
        const data = await response.json();
        const requestedIds = new Set<string>(
          (data.truckRequests || []).map((req: any) => req.truckId)
        );
        setRequestedTruckIds(requestedIds);
      }
    } catch (error) {
      console.error('Failed to fetch existing truck requests:', error);
    }
  };

  useEffect(() => {
    fetchEthiopianCities();
    fetchExistingRequests();
  }, []);

  /**
   * Fetch loads
   */
  const fetchLoads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('myLoads', 'true');
      params.append('status', activeStatus);
      params.append('sortBy', 'postedAt');
      params.append('sortOrder', 'desc');

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
            } catch {
              return { ...load, matchCount: 0 };
            }
          }
          return { ...load, matchCount: 0 };
        })
      );

      setLoads(loadsWithMatchCounts);

      // Fetch counts for each status tab
      const counts: Record<string, number> = { POSTED: 0, UNPOSTED: 0, EXPIRED: 0 };
      const statusPromises = ['POSTED', 'UNPOSTED', 'EXPIRED'].map(async (status) => {
        const res = await fetch(`/api/loads?myLoads=true&status=${status}&limit=1`);
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

  /**
   * Fetch matching trucks for a load
   */
  const fetchMatchingTrucks = async (loadId: string) => {
    setLoadingMatches(true);
    try {
      const response = await fetch(`/api/loads/${loadId}/matching-trucks?minScore=0&limit=50`);
      const data = await response.json();
      return data.trucks || [];
    } catch (error) {
      console.error('Failed to fetch matching trucks:', error);
      return [];
    } finally {
      setLoadingMatches(false);
    }
  };

  useEffect(() => {
    fetchLoads();
  }, [activeStatus]);

  /**
   * Handle load row expand - show matching trucks
   */
  const handleLoadExpand = async (load: any) => {
    if (expandedLoadId === load.id) {
      setExpandedLoadId(null);
      setMatchingTrucks([]);
    } else {
      setExpandedLoadId(load.id);
      const trucks = await fetchMatchingTrucks(load.id);
      setMatchingTrucks(trucks);
    }
  };

  /**
   * Handle POST action - Change unposted load to posted
   */
  const handlePostLoad = async (load: any) => {
    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/loads/${load.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        body: JSON.stringify({ status: 'POSTED' }),
      });

      if (!response.ok) throw new Error('Failed to post load');

      toast.success('Load posted successfully!');
      setActiveStatus('POSTED');
    } catch (error: any) {
      toast.error(error.message || 'Failed to post load');
    }
  };

  /**
   * Handle UNPOST action
   */
  const handleUnpostLoad = async (load: any) => {
    if (!confirm('Remove this load from the marketplace?')) return;

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/loads/${load.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        body: JSON.stringify({ status: 'UNPOSTED' }),
      });

      if (!response.ok) throw new Error('Failed to unpost load');

      toast.success('Load removed from marketplace');
      fetchLoads();
    } catch (error: any) {
      toast.error(error.message || 'Failed to unpost load');
    }
  };

  /**
   * Handle DUPLICATE action
   */
  const handleDuplicateLoad = async (load: any) => {
    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/loads/${load.id}/duplicate`, {
        method: 'POST',
        headers: {
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
      });

      if (!response.ok) throw new Error('Failed to duplicate load');

      toast.success('Load duplicated! Edit and post when ready.');
      setActiveStatus('UNPOSTED');
    } catch (error: any) {
      toast.error(error.message || 'Failed to duplicate load');
    }
  };

  /**
   * Handle DELETE action
   */
  const handleDeleteLoad = async (load: any) => {
    if (!confirm('Are you sure you want to delete this load?')) return;

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/loads/${load.id}`, {
        method: 'DELETE',
        headers: {
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
      });

      if (!response.ok) throw new Error('Failed to delete load');

      toast.success('Load deleted successfully');
      fetchLoads();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete load');
    }
  };

  /**
   * Handle EDIT action
   */
  const handleStartEdit = (load: any) => {
    setEditingLoadId(load.id);
    setEditForm({
      pickupCity: load.pickupCity || '',
      deliveryCity: load.deliveryCity || '',
      pickupDate: load.pickupDate ? new Date(load.pickupDate).toISOString().split('T')[0] : '',
      deliveryDate: load.deliveryDate ? new Date(load.deliveryDate).toISOString().split('T')[0] : '',
      truckType: load.truckType || 'DRY_VAN',
      weight: load.weight || '',
      lengthM: load.lengthM || '',
      cargoDescription: load.cargoDescription || '',
      rate: load.rate || '',
      contactPhone: load.contactPhone || '',
    });
  };

  /**
   * Handle SAVE edit
   */
  const handleSaveEdit = async () => {
    if (!editingLoadId) return;

    const editingLoad = loads.find(l => l.id === editingLoadId);
    const wasUnposted = editingLoad?.status === 'UNPOSTED';

    try {
      const csrfToken = await getCSRFToken();

      // Look up city IDs
      const pickupCityObj = ethiopianCities.find(
        (c: any) => c.name.toLowerCase() === editForm.pickupCity.toLowerCase()
      );
      const deliveryCityObj = ethiopianCities.find(
        (c: any) => c.name.toLowerCase() === editForm.deliveryCity.toLowerCase()
      );

      const updatePayload: any = {
        pickupCity: editForm.pickupCity,
        deliveryCity: editForm.deliveryCity,
        pickupCityId: pickupCityObj?.id || null,
        deliveryCityId: deliveryCityObj?.id || null,
        pickupDate: editForm.pickupDate ? new Date(editForm.pickupDate).toISOString() : undefined,
        deliveryDate: editForm.deliveryDate ? new Date(editForm.deliveryDate).toISOString() : null,
        truckType: editForm.truckType,
        weight: editForm.weight ? parseFloat(editForm.weight) : null,
        lengthM: editForm.lengthM ? parseFloat(editForm.lengthM) : null,
        cargoDescription: editForm.cargoDescription || null,
        rate: editForm.rate ? parseFloat(editForm.rate) : null,
        contactPhone: editForm.contactPhone || null,
      };

      // If UNPOSTED, also post it
      if (wasUnposted) {
        updatePayload.status = 'POSTED';
      }

      const response = await fetch(`/api/loads/${editingLoadId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) throw new Error('Failed to update load');

      toast.success(wasUnposted ? 'Load updated and posted!' : 'Load updated successfully!');
      setEditingLoadId(null);
      setEditForm({});

      if (wasUnposted) {
        setActiveStatus('POSTED');
      } else {
        fetchLoads();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update load');
    }
  };

  const handleCancelEdit = () => {
    setEditingLoadId(null);
    setEditForm({});
  };

  /**
   * Handle new load form submission
   */
  const handleCreateLoad = async () => {
    if (!newLoadForm.pickupCity || !newLoadForm.deliveryCity || !newLoadForm.pickupDate || !newLoadForm.truckType) {
      toast.warning('Please fill in required fields: Origin, Destination, Pickup Date, and Truck Type');
      return;
    }

    try {
      const csrfToken = await getCSRFToken();

      // Look up city IDs
      const pickupCityObj = ethiopianCities.find(
        (c: any) => c.name.toLowerCase() === newLoadForm.pickupCity.toLowerCase()
      );
      const deliveryCityObj = ethiopianCities.find(
        (c: any) => c.name.toLowerCase() === newLoadForm.deliveryCity.toLowerCase()
      );

      const payload = {
        pickupCity: newLoadForm.pickupCity,
        deliveryCity: newLoadForm.deliveryCity,
        pickupCityId: pickupCityObj?.id || null,
        deliveryCityId: deliveryCityObj?.id || null,
        pickupDate: new Date(newLoadForm.pickupDate).toISOString(),
        deliveryDate: newLoadForm.deliveryDate ? new Date(newLoadForm.deliveryDate).toISOString() : null,
        truckType: newLoadForm.truckType,
        weight: newLoadForm.weight ? parseFloat(newLoadForm.weight) : null,
        lengthM: newLoadForm.lengthM ? parseFloat(newLoadForm.lengthM) : null,
        cargoDescription: newLoadForm.cargoDescription || null,
        specialRequirements: newLoadForm.specialRequirements || null,
        rate: newLoadForm.rate ? parseFloat(newLoadForm.rate) : null,
        contactPhone: newLoadForm.contactPhone || null,
        status: 'POSTED', // Post immediately
      };

      const response = await fetch('/api/loads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create load');
      }

      toast.success('Load posted successfully!');

      // Reset form
      setNewLoadForm({
        pickupCity: '',
        deliveryCity: '',
        pickupDate: '',
        deliveryDate: '',
        truckType: 'DRY_VAN',
        weight: '',
        lengthM: '',
        cargoDescription: '',
        specialRequirements: '',
        rate: '',
        contactPhone: '',
        pickupCoordinates: undefined,
        deliveryCoordinates: undefined,
      });

      setShowNewLoadForm(false);
      setActiveStatus('POSTED');
      fetchLoads();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create load');
    }
  };

  /**
   * Handle truck request
   */
  const handleOpenRequestModal = (truck: any, loadId: string) => {
    setSelectedTruckForRequest(truck);
    setSelectedLoadForRequest(loadId);
    setRequestNotes('');
    setRequestProposedRate('');
    setRequestModalOpen(true);
  };

  const handleSubmitTruckRequest = async () => {
    if (!selectedTruckForRequest || !selectedLoadForRequest) {
      toast.warning('Please select a truck');
      return;
    }

    setSubmittingRequest(true);
    try {
      const csrfToken = await getCSRFToken();

      const response = await fetch('/api/truck-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        body: JSON.stringify({
          truckId: selectedTruckForRequest.truck?.id || selectedTruckForRequest.id,
          loadId: selectedLoadForRequest,
          notes: requestNotes || undefined,
          proposedRate: requestProposedRate ? parseFloat(requestProposedRate) : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send truck request');
      }

      toast.success('Request sent to carrier! You will be notified when they respond.');
      setRequestedTruckIds(prev => new Set([...prev, selectedTruckForRequest.truck?.id || selectedTruckForRequest.id]));
      setRequestModalOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send truck request');
    } finally {
      setSubmittingRequest(false);
    }
  };

  /**
   * Status tabs configuration
   */
  const statusTabs: StatusTab[] = [
    { key: 'POSTED', label: 'Posted', count: statusCounts.POSTED },
    { key: 'UNPOSTED', label: 'Unposted', count: statusCounts.UNPOSTED },
    { key: 'EXPIRED', label: 'Expired', count: statusCounts.EXPIRED },
  ];

  /**
   * Helper: Get age style
   */
  const getAgeStyle = (date: string | Date | null): { bg: string; text: string; dot: string } => {
    if (!date) return { bg: 'bg-slate-100', text: 'text-slate-500', dot: '●' };
    const hours = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60);
    if (hours < 24) return { bg: 'bg-green-100', text: 'text-green-700', dot: '●' };
    if (hours < 72) return { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: '●' };
    return { bg: 'bg-slate-100', text: 'text-slate-500', dot: '●' };
  };

  const formatAge = (date: string | Date | null): string => {
    if (!date) return '-';
    const hours = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60);
    if (hours < 1) return '<1h';
    if (hours < 24) return `${Math.floor(hours)}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  /**
   * Helper: Get match score color
   */
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50';
    if (score >= 60) return 'text-teal-600 bg-teal-50';
    if (score >= 40) return 'text-amber-600 bg-amber-50';
    return 'text-slate-600 bg-slate-50';
  };

  return (
    <div className="space-y-4 pt-6">
      {/* Main Tab Navigation */}
      <div className="flex gap-1 bg-slate-200 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveMainTab('postings')}
          className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all ${
            activeMainTab === 'postings'
              ? 'bg-white text-teal-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>📦</span>
          My Loads
          <span className={`px-2 py-0.5 rounded-full text-sm ${
            activeMainTab === 'postings' ? 'bg-teal-100 text-teal-600' : 'bg-slate-300 text-slate-600'
          }`}>
            {loads.length}
          </span>
        </button>
        <button
          onClick={() => setActiveMainTab('matching')}
          className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all ${
            activeMainTab === 'matching'
              ? 'bg-white text-teal-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>🚚</span>
          Matching Trucks
          <span className={`px-2 py-0.5 rounded-full text-sm ${
            activeMainTab === 'matching' ? 'bg-teal-100 text-teal-600' : 'bg-slate-300 text-slate-600'
          }`}>
            {matchingTrucks.length}
          </span>
        </button>
      </div>

      {/* TAB 1: MY LOADS */}
      {activeMainTab === 'postings' && (
        <>
          {/* Header Row */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowNewLoadForm(!showNewLoadForm)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-600 to-teal-500 text-white text-sm font-bold rounded-xl hover:from-teal-700 hover:to-teal-600 transition-all shadow-md shadow-teal-500/25"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              POST NEW LOAD
            </button>

            <StatusTabs
              tabs={statusTabs}
              activeTab={activeStatus}
              onTabChange={(tab) => setActiveStatus(tab as LoadStatus)}
            />
          </div>

          {/* New Load Posting Form */}
          {showNewLoadForm && (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden mb-6">
              <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-50 to-teal-50/30 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-sm">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-800">Post New Load</h3>
                    <p className="text-xs text-slate-500">Find trucks for your shipment</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowNewLoadForm(false)}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6">
                {/* Row 1: Route & Dates */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Origin (Pickup) <span className="text-red-500">*</span>
                    </label>
                    <PlacesAutocomplete
                      value={newLoadForm.pickupCity}
                      onChange={(value, place) => {
                        setNewLoadForm({
                          ...newLoadForm,
                          pickupCity: value,
                          pickupCoordinates: place?.coordinates
                        });
                      }}
                      placeholder="Pickup city"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                      countryRestriction={['ET', 'DJ']}
                      types={['(cities)']}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Destination <span className="text-red-500">*</span>
                    </label>
                    <PlacesAutocomplete
                      value={newLoadForm.deliveryCity}
                      onChange={(value, place) => {
                        setNewLoadForm({
                          ...newLoadForm,
                          deliveryCity: value,
                          deliveryCoordinates: place?.coordinates
                        });
                      }}
                      placeholder="Delivery city"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                      countryRestriction={['ET', 'DJ']}
                      types={['(cities)']}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Pickup Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={newLoadForm.pickupDate}
                      onChange={(e) => setNewLoadForm({...newLoadForm, pickupDate: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Delivery Date
                    </label>
                    <input
                      type="date"
                      value={newLoadForm.deliveryDate}
                      onChange={(e) => setNewLoadForm({...newLoadForm, deliveryDate: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                      min={newLoadForm.pickupDate || new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>

                {/* Row 2: Load Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Truck Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newLoadForm.truckType}
                      onChange={(e) => setNewLoadForm({...newLoadForm, truckType: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                    >
                      {truckTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      value={newLoadForm.weight}
                      onChange={(e) => setNewLoadForm({...newLoadForm, weight: e.target.value})}
                      placeholder="e.g. 15000"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Length (m)</label>
                    <input
                      type="number"
                      value={newLoadForm.lengthM}
                      onChange={(e) => setNewLoadForm({...newLoadForm, lengthM: e.target.value})}
                      placeholder="e.g. 12"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Rate (ETB)</label>
                    <input
                      type="number"
                      value={newLoadForm.rate}
                      onChange={(e) => setNewLoadForm({...newLoadForm, rate: e.target.value})}
                      placeholder="Offered rate"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Contact Phone</label>
                    <input
                      type="tel"
                      value={newLoadForm.contactPhone}
                      onChange={(e) => setNewLoadForm({...newLoadForm, contactPhone: e.target.value})}
                      placeholder="+251-9xx-xxx-xxx"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                {/* Row 3: Description */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Cargo Description</label>
                    <input
                      type="text"
                      value={newLoadForm.cargoDescription}
                      onChange={(e) => setNewLoadForm({...newLoadForm, cargoDescription: e.target.value})}
                      placeholder="What are you shipping?"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Special Requirements</label>
                    <input
                      type="text"
                      value={newLoadForm.specialRequirements}
                      onChange={(e) => setNewLoadForm({...newLoadForm, specialRequirements: e.target.value})}
                      placeholder="Temperature control, fragile, etc."
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowNewLoadForm(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateLoad}
                    className="px-6 py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white text-sm font-bold rounded-lg hover:from-teal-700 hover:to-teal-600 transition-all shadow-sm"
                  >
                    POST LOAD
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Loads List */}
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
              <p className="mt-3 text-sm text-slate-500">Loading loads...</p>
            </div>
          ) : loads.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📦</span>
              </div>
              <h4 className="text-lg font-medium text-slate-800">No {activeStatus.toLowerCase()} loads</h4>
              <p className="text-sm text-slate-500 mt-1">
                {activeStatus === 'POSTED' ? 'Post a load to start finding trucks' : `No ${activeStatus.toLowerCase()} loads yet`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {loads.map((load) => (
                <div key={load.id} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                  {/* Load Row */}
                  <div
                    className={`p-4 cursor-pointer hover:bg-slate-50/50 transition-colors ${expandedLoadId === load.id ? 'bg-slate-50/50' : ''}`}
                    onClick={() => handleLoadExpand(load)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* Age Badge */}
                        <span className={`${getAgeStyle(load.postedAt || load.createdAt).bg} ${getAgeStyle(load.postedAt || load.createdAt).text} px-2 py-1 rounded text-xs font-medium`}>
                          {getAgeStyle(load.postedAt || load.createdAt).dot} {formatAge(load.postedAt || load.createdAt)}
                        </span>

                        {/* Route */}
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-700 rounded-lg flex items-center justify-center text-white text-lg">
                            📦
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">
                              {load.pickupCity || 'N/A'} → {load.deliveryCity || 'N/A'}
                            </div>
                            <div className="text-sm text-slate-500">
                              {getTruckTypeLabel(load.truckType)} • {load.weight ? `${(load.weight / 1000).toFixed(1)}T` : 'N/A'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Pickup Date */}
                        <div className="text-right">
                          <div className="text-xs text-slate-400">Pickup</div>
                          <div className="text-sm font-medium text-slate-700">
                            {load.pickupDate ? new Date(load.pickupDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
                          </div>
                        </div>

                        {/* Match Count Badge */}
                        {load.status === 'POSTED' && (
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            load.matchCount > 0
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {load.matchCount || 0} trucks
                          </span>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {activeStatus === 'UNPOSTED' && (
                            <button
                              onClick={() => handleStartEdit(load)}
                              className="px-3 py-1.5 text-xs font-medium text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                            >
                              Edit & Post
                            </button>
                          )}
                          {activeStatus === 'POSTED' && (
                            <>
                              <button
                                onClick={() => handleStartEdit(load)}
                                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleUnpostLoad(load)}
                                className="px-3 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              >
                                Unpost
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDuplicateLoad(load)}
                            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            Copy
                          </button>
                          <button
                            onClick={() => handleDeleteLoad(load)}
                            className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            Delete
                          </button>
                        </div>

                        {/* Expand Arrow */}
                        <svg
                          className={`w-5 h-5 text-slate-400 transition-transform ${expandedLoadId === load.id ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content - Matching Trucks */}
                  {expandedLoadId === load.id && (
                    <div className="border-t border-slate-100 bg-slate-50/30">
                      {editingLoadId === load.id ? (
                        /* Edit Form */
                        <div className="p-6">
                          <h4 className="text-sm font-semibold text-slate-700 mb-4">Edit Load</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Origin</label>
                              <PlacesAutocomplete
                                value={editForm.pickupCity}
                                onChange={(value) => setEditForm({...editForm, pickupCity: value})}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                                countryRestriction={['ET', 'DJ']}
                                types={['(cities)']}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Destination</label>
                              <PlacesAutocomplete
                                value={editForm.deliveryCity}
                                onChange={(value) => setEditForm({...editForm, deliveryCity: value})}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                                countryRestriction={['ET', 'DJ']}
                                types={['(cities)']}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Pickup Date</label>
                              <input
                                type="date"
                                value={editForm.pickupDate}
                                onChange={(e) => setEditForm({...editForm, pickupDate: e.target.value})}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Truck Type</label>
                              <select
                                value={editForm.truckType}
                                onChange={(e) => setEditForm({...editForm, truckType: e.target.value})}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                              >
                                {truckTypes.map(type => (
                                  <option key={type.value} value={type.value}>{type.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 mb-4">
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Weight (kg)</label>
                              <input
                                type="number"
                                value={editForm.weight}
                                onChange={(e) => setEditForm({...editForm, weight: e.target.value})}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Rate (ETB)</label>
                              <input
                                type="number"
                                value={editForm.rate}
                                onChange={(e) => setEditForm({...editForm, rate: e.target.value})}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Cargo</label>
                              <input
                                type="text"
                                value={editForm.cargoDescription}
                                onChange={(e) => setEditForm({...editForm, cargoDescription: e.target.value})}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-3">
                            <button onClick={handleCancelEdit} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
                              Cancel
                            </button>
                            <button
                              onClick={handleSaveEdit}
                              className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700"
                            >
                              {load.status === 'UNPOSTED' ? 'Save & Post' : 'Save Changes'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Matching Trucks List */
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-slate-700">
                              🚚 Matching Trucks ({matchingTrucks.length})
                            </h4>
                            {onSwitchToSearchTrucks && (
                              <button
                                onClick={() => onSwitchToSearchTrucks({ origin: load.pickupCity, destination: load.deliveryCity })}
                                className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                              >
                                Search All Trucks →
                              </button>
                            )}
                          </div>

                          {loadingMatches ? (
                            <div className="py-8 text-center">
                              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-teal-500"></div>
                              <p className="mt-2 text-sm text-slate-500">Finding trucks...</p>
                            </div>
                          ) : matchingTrucks.length === 0 ? (
                            <div className="py-8 text-center text-slate-500 text-sm">
                              No matching trucks found for this load
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {matchingTrucks.slice(0, 10).map((truck: any, idx: number) => {
                                const truckId = truck.truck?.id || truck.id;
                                const isRequested = requestedTruckIds.has(truckId);

                                return (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 hover:border-slate-200 transition-colors"
                                  >
                                    <div className="flex items-center gap-3">
                                      {/* Match Score */}
                                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getScoreColor(truck.matchScore || 0)}`}>
                                        {Math.round(truck.matchScore || 0)}%
                                      </span>

                                      {/* Truck Info */}
                                      <div>
                                        <div className="font-semibold text-slate-800">
                                          {truck.truck?.licensePlate || 'N/A'}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                          {getTruckTypeLabel(truck.truck?.truckType)} • {truck.truck?.capacity ? `${(truck.truck.capacity / 1000).toFixed(0)}T` : 'N/A'}
                                          {truck.carrier?.name && ` • ${truck.carrier.name}`}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                      {/* DH-O Distance */}
                                      {truck.dhOriginKm !== undefined && (
                                        <span className="text-xs text-slate-500">
                                          DH-O: {truck.dhOriginKm}km
                                        </span>
                                      )}

                                      {/* Location */}
                                      <span className="text-xs text-slate-400">
                                        📍 {truck.originCity?.name || truck.currentCity || 'N/A'}
                                      </span>

                                      {/* Request Button */}
                                      {isRequested ? (
                                        <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium">
                                          ✓ Requested
                                        </span>
                                      ) : (
                                        <button
                                          onClick={() => handleOpenRequestModal(truck, load.id)}
                                          className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 transition-colors"
                                        >
                                          Request Truck
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                              {matchingTrucks.length > 10 && (
                                <p className="text-center text-xs text-slate-400 py-2">
                                  +{matchingTrucks.length - 10} more trucks available
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB 2: MATCHING TRUCKS (All trucks for all posted loads) */}
      {activeMainTab === 'matching' && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🚚</span>
            </div>
            <h4 className="text-lg font-medium text-slate-800">Select a load to see matches</h4>
            <p className="text-sm text-slate-500 mt-1">
              Click on a posted load in "My Loads" tab to view matching trucks
            </p>
          </div>
        </div>
      )}

      {/* Truck Request Modal */}
      {requestModalOpen && selectedTruckForRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setRequestModalOpen(false)} />
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Request Truck</h3>

              <div className="mb-4 p-3 bg-slate-50 rounded-xl">
                <div className="font-semibold text-slate-800">
                  {selectedTruckForRequest.truck?.licensePlate || 'N/A'}
                </div>
                <div className="text-sm text-slate-500">
                  {getTruckTypeLabel(selectedTruckForRequest.truck?.truckType)} • {selectedTruckForRequest.carrier?.name || 'Unknown Carrier'}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Proposed Rate (ETB)
                  </label>
                  <input
                    type="number"
                    value={requestProposedRate}
                    onChange={(e) => setRequestProposedRate(e.target.value)}
                    placeholder="Your offer"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={requestNotes}
                    onChange={(e) => setRequestNotes(e.target.value)}
                    placeholder="Any special requirements or messages..."
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setRequestModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitTruckRequest}
                  disabled={submittingRequest}
                  className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {submittingRequest ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
