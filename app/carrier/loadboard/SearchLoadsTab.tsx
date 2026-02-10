'use client';

/**
 * SEARCH LOADS Tab Component - DAT Power Style
 *
 * Carrier interface for searching available loads
 * Sprint 14 - DAT-Style UI Transformation
 * Updated: Sprint 19 - Responsive DataTable integration
 */

import React, { useState, useEffect, useMemo } from 'react';
import { StatusTabs, AgeIndicator, SavedSearches, EditSearchModal } from '@/components/loadboard-ui';
import DataTable from '@/components/loadboard-ui/DataTable';
import { TableColumn, RowAction, StatusTab, SavedSearch, SavedSearchCriteria } from '@/types/loadboard-ui';
import LoadRequestModal from './LoadRequestModal';
import { getCSRFToken } from '@/lib/csrfFetch';
import { calculateDistanceKm } from '@/lib/geo';

interface SearchLoadsTabProps {
  user: any;
}

type ResultsFilter = 'all' | 'PREFERRED' | 'BLOCKED';

/**
 * COLLAPSED TO SINGLE SOURCE OF TRUTH (2026-02-06)
 * Now delegates to lib/geo.ts:calculateDistanceKm with Math.round wrapper.
 * Preserves original INTEGER return behavior for backward compatibility.
 *
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers (rounded to integer)
 */
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  // Delegates to single source of truth, preserves integer rounding behavior
  return Math.round(calculateDistanceKm(lat1, lon1, lat2, lon2));
}

export default function SearchLoadsTab({ user }: SearchLoadsTabProps) {
  const [loads, setLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ResultsFilter>('all');
  const [ethiopianCities, setEthiopianCities] = useState<any[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [showSearchForm, setShowSearchForm] = useState(false);
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Saved searches state
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [activeSavedSearchId, setActiveSavedSearchId] = useState<string | null>(null);
  const [loadingSavedSearches, setLoadingSavedSearches] = useState(false);
  const [editingSearch, setEditingSearch] = useState<SavedSearch | null>(null);

  // Load request modal state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedLoad, setSelectedLoad] = useState<any | null>(null);
  const [pendingRequestLoadIds, setPendingRequestLoadIds] = useState<Set<string>>(new Set());

  // Search form state
  const [filterValues, setFilterValues] = useState<Record<string, any>>({
    truckType: '',
    truckTypeMode: 'ANY',
    origin: '',
    destination: '',
    availDate: '',
    dhOrigin: '',
    dhDestination: '',
    fullPartial: '',
    length: '',
    weight: '',
    searchBack: '',
  });

  /**
   * Fetch pending load requests to track button states
   */
  const fetchPendingLoadRequests = async () => {
    try {
      const response = await fetch('/api/load-requests?status=PENDING');
      if (response.ok) {
        const data = await response.json();
        const loadIds = new Set<string>(
          (data.loadRequests || []).map((req: any) => req.loadId)
        );
        setPendingRequestLoadIds(loadIds);
      }
    } catch (error) {
      console.error('Failed to fetch pending load requests:', error);
    }
  };

  /**
   * Fetch Ethiopian cities
   */
  const fetchEthiopianCities = async () => {
    setLoadingCities(true);
    try {
      const response = await fetch('/api/ethiopian-locations');
      const data = await response.json();
      setEthiopianCities(data.locations || []);
    } catch (error) {
      console.error('Failed to fetch Ethiopian cities:', error);
    } finally {
      setLoadingCities(false);
    }
  };

  useEffect(() => {
    fetchEthiopianCities();
    fetchSavedSearches();
    fetchPendingLoadRequests();
  }, []);

  /**
   * Fetch saved searches for LOADS
   */
  const fetchSavedSearches = async () => {
    setLoadingSavedSearches(true);
    try {
      const response = await fetch('/api/saved-searches?type=LOADS');
      const data = await response.json();
      setSavedSearches(data.searches || []);
    } catch (error) {
      console.error('Failed to fetch saved searches:', error);
    } finally {
      setLoadingSavedSearches(false);
    }
  };

  /**
   * Save current search criteria
   */
  const handleSaveSearch = async () => {
    const name = prompt('Enter a name for this search:');
    if (!name) return;

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(csrfToken && { 'X-CSRF-Token': csrfToken }) },
        body: JSON.stringify({
          name,
          type: 'LOADS',
          criteria: filterValues,
        }),
      });

      if (response.ok) {
        await fetchSavedSearches();
        alert('Search saved successfully!');
      } else {
        throw new Error('Failed to save search');
      }
    } catch (error) {
      console.error('Failed to save search:', error);
      alert('Failed to save search. Please try again.');
    }
  };

  /**
   * Select and apply a saved search
   */
  const handleSelectSavedSearch = (searchId: string) => {
    const search = savedSearches.find((s) => s.id === searchId);
    if (!search) return;

    // Apply saved criteria to filter values
    setFilterValues(search.criteria);
    setActiveSavedSearchId(searchId);

    // Automatically trigger search
    fetchLoads();
  };

  /**
   * Delete a saved search
   */
  const handleDeleteSavedSearch = async (searchId: string) => {
    if (!confirm('Are you sure you want to delete this saved search?')) return;

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/saved-searches/${searchId}`, {
        method: 'DELETE',
        headers: { ...(csrfToken && { 'X-CSRF-Token': csrfToken }) },
      });

      if (response.ok) {
        await fetchSavedSearches();
        if (activeSavedSearchId === searchId) {
          setActiveSavedSearchId(null);
        }
      } else {
        throw new Error('Failed to delete search');
      }
    } catch (error) {
      console.error('Failed to delete search:', error);
      alert('Failed to delete search. Please try again.');
    }
  };

  /**
   * Edit a saved search - open modal
   */
  const handleEditSavedSearch = (searchId: string) => {
    const search = savedSearches.find((s) => s.id === searchId);
    if (!search) return;
    setEditingSearch(search);
  };

  /**
   * Handle saving edited search from modal
   */
  const handleSaveEditedSearch = async (id: string, updates: { name?: string; criteria?: SavedSearchCriteria }) => {
    await updateSavedSearch(id, updates);
  };

  /**
   * Update saved search
   */
  const updateSavedSearch = async (searchId: string, updates: any) => {
    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/saved-searches/${searchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(csrfToken && { 'X-CSRF-Token': csrfToken }) },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        await fetchSavedSearches();
      } else {
        throw new Error('Failed to update search');
      }
    } catch (error) {
      console.error('Failed to update search:', error);
      alert('Failed to update search. Please try again.');
    }
  };

  /**
   * Handle filter change
   */
  const handleFilterChange = (key: string, value: any) => {
    setFilterValues({ ...filterValues, [key]: value });
  };

  /**
   * Handle filter reset
   */
  const handleFilterReset = () => {
    setFilterValues({
      truckType: '',
      truckTypeMode: 'ANY',
      origin: '',
      destination: '',
      availDate: '',
      dhOrigin: '',
      dhDestination: '',
      fullPartial: '',
      length: '',
      weight: '',
      searchBack: '',
    });
  };

  /**
   * Handle successful load request sent
   */
  const handleLoadRequestSent = (loadId: string) => {
    setPendingRequestLoadIds(prev => new Set([...prev, loadId]));
  };

  /**
   * Helper to get city coordinates by name
   */
  const getCityCoords = (cityName: string | null): { lat: number; lon: number } | null => {
    if (!cityName || ethiopianCities.length === 0) return null;
    const searchName = cityName.toLowerCase().trim();

    // Try exact match first
    let city = ethiopianCities.find((c: any) => c.name?.toLowerCase().trim() === searchName);

    // Fuzzy match for spelling variations
    if (!city) {
      city = ethiopianCities.find((c: any) => {
        const name = c.name?.toLowerCase().trim() || '';
        if (name.includes(searchName) || searchName.includes(name)) return true;
        // Handle double letters (Mekelle/Mekele, Jimma/Jima)
        const simplify = (s: string) => s.replace(/(.)\1+/g, '$1');
        return simplify(name) === simplify(searchName);
      });
    }

    if (city?.latitude && city?.longitude) {
      return { lat: Number(city.latitude), lon: Number(city.longitude) };
    }
    return null;
  };

  /**
   * Fetch loads based on filters and calculate DH-O/DH-D dynamically
   */
  const fetchLoads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('status', 'POSTED');

      if (filterValues.truckType) {
        params.append('truckType', filterValues.truckType);
      }
      // Don't filter by exact city match - we want to calculate distances
      if (filterValues.availDate) {
        params.append('pickupFrom', filterValues.availDate);
      }
      if (filterValues.fullPartial) {
        params.append('fullPartial', filterValues.fullPartial);
      }
      if (filterValues.length) {
        params.append('minLength', filterValues.length);
      }
      if (filterValues.weight) {
        params.append('minWeight', filterValues.weight);
      }

      const response = await fetch(`/api/loads?${params.toString()}`);
      const data = await response.json();
      // Deduplicate loads by ID to prevent duplicates
      let fetchedLoads = [...new Map((data.loads || []).map((l: any) => [l.id, l])).values()];

      // Get carrier's origin and destination coordinates
      const carrierOriginCoords = getCityCoords(filterValues.origin);
      const carrierDestCoords = getCityCoords(filterValues.destination);

      // Calculate DH-O and DH-D for each load
      const loadsWithDH = fetchedLoads.map((load: any) => {
        const pickupCoords = getCityCoords(load.pickupCity);
        const deliveryCoords = getCityCoords(load.deliveryCity);

        // Calculate DH-O: distance from carrier's origin to load's pickup
        let calculatedDhO: number | null = null;
        if (carrierOriginCoords && pickupCoords) {
          calculatedDhO = haversineDistance(
            carrierOriginCoords.lat, carrierOriginCoords.lon,
            pickupCoords.lat, pickupCoords.lon
          );
        }

        // Calculate DH-D: distance from load's delivery to carrier's destination
        let calculatedDhD: number | null = null;
        if (carrierDestCoords && deliveryCoords) {
          calculatedDhD = haversineDistance(
            deliveryCoords.lat, deliveryCoords.lon,
            carrierDestCoords.lat, carrierDestCoords.lon
          );
        }

        return {
          ...load,
          // Use calculated values, fall back to stored values if no carrier origin/dest entered
          dhToOriginKm: calculatedDhO !== null ? calculatedDhO : load.dhToOriginKm,
          dhAfterDeliveryKm: calculatedDhD !== null ? calculatedDhD : load.dhAfterDeliveryKm,
          // Store whether these are calculated (for UI indicator)
          dhCalculated: calculatedDhO !== null || calculatedDhD !== null,
        };
      });

      // Filter by DH limits if specified
      const dhOriginLimit = filterValues.dhOrigin ? parseInt(filterValues.dhOrigin) : null;
      const dhDestLimit = filterValues.dhDestination ? parseInt(filterValues.dhDestination) : null;

      let filteredLoads = loadsWithDH;

      if (dhOriginLimit !== null) {
        filteredLoads = filteredLoads.filter((load: any) => {
          // If no DH-O calculated (carrier didn't enter origin), skip filtering
          if (load.dhToOriginKm === null || load.dhToOriginKm === undefined) return true;
          return load.dhToOriginKm <= dhOriginLimit;
        });
      }

      if (dhDestLimit !== null) {
        filteredLoads = filteredLoads.filter((load: any) => {
          // If no DH-D calculated (carrier didn't enter destination), skip filtering
          if (load.dhAfterDeliveryKm === null || load.dhAfterDeliveryKm === undefined) return true;
          return load.dhAfterDeliveryKm <= dhDestLimit;
        });
      }

      // Sort by DH-O (smaller is better), then DH-D, then by date
      filteredLoads.sort((a: any, b: any) => {
        // Loads with calculated DH first
        const aHasDH = a.dhToOriginKm !== null && a.dhToOriginKm !== undefined;
        const bHasDH = b.dhToOriginKm !== null && b.dhToOriginKm !== undefined;

        if (aHasDH && !bHasDH) return -1;
        if (!aHasDH && bHasDH) return 1;

        // Sort by DH-O (smaller is better)
        if (aHasDH && bHasDH) {
          if (a.dhToOriginKm !== b.dhToOriginKm) {
            return a.dhToOriginKm - b.dhToOriginKm;
          }
        }

        // Then by DH-D (smaller is better)
        const aHasDhD = a.dhAfterDeliveryKm !== null && a.dhAfterDeliveryKm !== undefined;
        const bHasDhD = b.dhAfterDeliveryKm !== null && b.dhAfterDeliveryKm !== undefined;

        if (aHasDhD && bHasDhD && a.dhAfterDeliveryKm !== b.dhAfterDeliveryKm) {
          return a.dhAfterDeliveryKm - b.dhAfterDeliveryKm;
        }

        // Finally by creation date (newest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setLoads(filteredLoads);
    } catch (error) {
      console.error('Failed to fetch loads:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle header column click for sorting
   */
  const handleHeaderClick = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }

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
   * Truck types list with enum values and display labels
   */
  const truckTypes = [
    { value: 'AUTO_CARRIER', label: 'Auto Carrier', code: 'AC' },
    { value: 'B_TRAIN', label: 'B-Train', code: 'BT' },
    { value: 'CONESTOGA', label: 'Conestoga', code: 'CN' },
    { value: 'CONTAINER', label: 'Container', code: 'C' },
    { value: 'CONTAINER_INSULATED', label: 'Container Insulated', code: 'CI' },
    { value: 'CONTAINER_REFRIGERATED', label: 'Container Refrigerated', code: 'CR' },
    { value: 'CONVEYOR', label: 'Conveyor', code: 'CV' },
    { value: 'DOUBLE_DROP', label: 'Double Drop', code: 'DD' },
    { value: 'DROP_DECK_LANDOLL', label: 'Drop Deck Landoll', code: 'LA' },
    { value: 'DUMP_TRAILER', label: 'Dump Trailer', code: 'DT' },
    { value: 'DUMP_TRUCK', label: 'Dump Truck', code: 'DK' },
    { value: 'FLATBED', label: 'Flatbed', code: 'F' },
    { value: 'FLATBED_AIR_RIDE', label: 'Flatbed Air-Ride', code: 'FA' },
    { value: 'FLATBED_CONESTOGA', label: 'Flatbed Conestoga', code: 'FN' },
    { value: 'FLATBED_DOUBLE', label: 'Flatbed Double', code: 'F2' },
    { value: 'FLATBED_HAZMAT', label: 'Flatbed HazMat', code: 'FZ' },
    { value: 'FLATBED_HOTSHOT', label: 'Flatbed Hotshot', code: 'FH' },
    { value: 'FLATBED_MAXI', label: 'Flatbed Maxi', code: 'MX' },
    { value: 'DRY_VAN', label: 'Van', code: 'V' },
    { value: 'BOX_TRUCK', label: 'Box Truck', code: 'BX' },
    { value: 'REFRIGERATED', label: 'Reefer', code: 'R' },
    { value: 'TANKER', label: 'Tanker', code: 'T' },
    { value: 'LOWBOY', label: 'Lowboy', code: 'LB' },
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
   * Table columns configuration (memoized)
   */
  const columns: TableColumn[] = useMemo(() => [
    {
      key: 'age',
      label: 'Age',
      width: '80px',
      render: (_: any, row: any) => <AgeIndicator date={row.postedAt || row.createdAt} />,
    },
    {
      key: 'pickupDate',
      label: 'Pickup',
      sortable: true,
      render: (value: string) =>
        value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A',
    },
    {
      key: 'truckType',
      label: 'Truck',
      sortable: true,
      render: (value: string) => getTruckTypeLabel(value),
    },
    {
      key: 'fullPartial',
      label: 'F/P',
      width: '60px',
      align: 'center' as const,
      render: (value: string) => value === 'FULL' ? 'F' : 'P',
    },
    {
      key: 'dhToOriginKm',
      label: 'DH-O',
      width: '70px',
      sortable: true,
      align: 'right' as const,
      render: (value: number) => value ? `${value}km` : '—',
    },
    {
      key: 'pickupCity',
      label: 'Origin',
      sortable: true,
      render: (value: string) => (
        <span className="font-medium text-slate-800 dark:text-slate-100">{value || 'N/A'}</span>
      ),
    },
    {
      key: 'tripKm',
      label: 'Trip',
      width: '70px',
      align: 'right' as const,
      render: (value: number) => value ? `${value}km` : '—',
    },
    {
      key: 'deliveryCity',
      label: 'Destination',
      sortable: true,
      render: (value: string) => (
        <span className="font-medium text-slate-800 dark:text-slate-100">{value || 'N/A'}</span>
      ),
    },
    {
      key: 'dhAfterDeliveryKm',
      label: 'DH-D',
      width: '70px',
      sortable: true,
      align: 'right' as const,
      render: (value: number) => value ? `${value}km` : '—',
    },
    {
      key: 'shipper',
      label: 'Company',
      render: (_: any, row: any) => (
        <span className="font-medium text-teal-600 dark:text-teal-400 hover:underline cursor-pointer">
          {row.shipper?.name || 'Anonymous'}
        </span>
      ),
    },
    {
      key: 'weight',
      label: 'Weight',
      width: '90px',
      align: 'right' as const,
      sortable: true,
      render: (value: number) => value ? `${value.toLocaleString()}kg` : 'N/A',
    },
    {
      key: 'serviceFeeEtb',
      label: 'Service Fee',
      width: '110px',
      align: 'right' as const,
      sortable: true,
      render: (value: number, row: any) => (
        <span className="text-teal-600 dark:text-teal-400 font-medium">
          {value ? `${value.toLocaleString()} ETB` : row.tripKm ? `~${Math.round(row.tripKm * 15)} ETB` : '—'}
        </span>
      ),
    },
  ], []);

  /**
   * Table actions configuration (memoized)
   */
  const tableActions: RowAction[] = useMemo(() => [
    {
      key: 'request',
      label: 'Request',
      variant: 'primary',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      onClick: (row: any) => {
        setSelectedLoad(row);
        setShowRequestModal(true);
      },
      show: (row: any) => !pendingRequestLoadIds.has(row.id),
    },
    {
      key: 'pending',
      label: 'Pending',
      variant: 'secondary',
      disabled: true,  // Status indicator - request already sent
      onClick: () => {},  // No action needed - just shows status
      show: (row: any) => pendingRequestLoadIds.has(row.id),
    },
  ], [pendingRequestLoadIds]);

  /**
   * Results tabs configuration
   */
  const resultsTabs: StatusTab[] = [
    { key: 'all', label: 'ALL' },
    { key: 'PREFERRED', label: 'PREFERRED' },
    { key: 'BLOCKED', label: 'BLOCKED' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Search Loads</h2>
          <p className="text-sm text-slate-500">Find available loads matching your trucks</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowSearchForm(!showSearchForm)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all shadow-sm ${
              showSearchForm
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-gradient-to-r from-teal-600 to-teal-500 text-white hover:from-teal-700 hover:to-teal-600 shadow-md shadow-teal-500/25'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {showSearchForm ? 'Hide Search' : 'New Load Search'}
          </button>

          {showSearchForm && (
            <button
              onClick={handleSaveSearch}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              Save Search
            </button>
          )}
        </div>
      </div>

      {/* Saved Searches Panel */}
      {savedSearches.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-teal-50/30 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              Saved Searches ({savedSearches.length})
            </h3>
          </div>
          <div className="p-4">
            <SavedSearches
              searches={savedSearches}
              activeSearchId={activeSavedSearchId}
              onSelect={handleSelectSavedSearch}
              onDelete={handleDeleteSavedSearch}
              onEdit={handleEditSavedSearch}
              type="LOADS"
            />
          </div>
        </div>
      )}

      {/* Inline Search Form - Only show when toggled */}
      {showSearchForm && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          {/* Header Row */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs font-semibold text-white bg-gradient-to-r from-slate-800 to-slate-700">
            <div>Truck</div>
            <div>Origin</div>
            <div>Destination</div>
            <div>Avail</div>
            <div>DH-O</div>
            <div>DH-D</div>
            <div>F/P</div>
            <div>Length</div>
            <div>Weight</div>
            <div>Days Back</div>
            <div className="col-span-2"></div>
          </div>

          {/* Editable Search Row */}
          <div className="grid grid-cols-12 gap-2 px-4 py-4 text-xs items-center bg-gradient-to-r from-slate-50 to-teal-50/30">
            {/* Truck Type with ANY/ONLY */}
            <div className="flex flex-col gap-1">
              <div className="flex gap-1">
                <button
                  onClick={() => handleFilterChange('truckTypeMode', 'ANY')}
                  className={`flex-1 px-2 py-0.5 text-xs font-bold rounded-md transition-colors ${
                    filterValues.truckTypeMode === 'ANY'
                      ? 'bg-teal-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  ANY
                </button>
                <button
                  onClick={() => handleFilterChange('truckTypeMode', 'ONLY')}
                  className={`flex-1 px-2 py-0.5 text-xs font-bold rounded-md transition-colors ${
                    filterValues.truckTypeMode === 'ONLY'
                      ? 'bg-teal-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  ONLY
                </button>
              </div>
              <select
                value={filterValues.truckType || ''}
                onChange={(e) => handleFilterChange('truckType', e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              >
                <option value="">Select Type</option>
                {truckTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.code}
                  </option>
                ))}
              </select>
            </div>

            {/* Origin */}
            <div>
              <select
                value={filterValues.origin || ''}
                onChange={(e) => handleFilterChange('origin', e.target.value)}
                disabled={loadingCities}
                className="w-full px-2 py-1.5 text-xs border border-[#064d51]/20 rounded bg-white"
                style={{ minHeight: '32px' }}
              >
                <option value="">
                  {loadingCities ? 'Loading...' : 'Any Origin'}
                </option>
                {ethiopianCities.map((city) => (
                  <option key={city.id} value={city.name}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Destination */}
            <div>
              <select
                value={filterValues.destination || ''}
                onChange={(e) => handleFilterChange('destination', e.target.value)}
                disabled={loadingCities}
                className="w-full px-2 py-1.5 text-xs border border-[#064d51]/20 rounded bg-white"
                style={{ minHeight: '32px' }}
              >
                <option value="">
                  {loadingCities ? 'Loading...' : 'Anywhere'}
                </option>
                {ethiopianCities.map((city) => (
                  <option key={city.id} value={city.name}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Avail Date */}
            <div>
              <input
                type="date"
                value={filterValues.availDate || ''}
                onChange={(e) => handleFilterChange('availDate', e.target.value)}
                className="w-full px-2 py-1 text-xs bg-white border border-[#064d51]/20 rounded"
              />
            </div>

            {/* DH-O */}
            <div>
              <input
                type="number"
                value={filterValues.dhOrigin || ''}
                onChange={(e) => handleFilterChange('dhOrigin', e.target.value)}
                placeholder="km"
                className="w-full px-2 py-1 text-xs bg-white border border-[#064d51]/20 rounded"
              />
            </div>

            {/* DH-D */}
            <div>
              <input
                type="number"
                value={filterValues.dhDestination || ''}
                onChange={(e) => handleFilterChange('dhDestination', e.target.value)}
                placeholder="km"
                className="w-full px-2 py-1 text-xs bg-white border border-[#064d51]/20 rounded"
              />
            </div>

            {/* F/P */}
            <div>
              <select
                value={filterValues.fullPartial || ''}
                onChange={(e) => handleFilterChange('fullPartial', e.target.value)}
                className="w-full px-2 py-1 text-xs border border-[#064d51]/20 rounded bg-white"
              >
                <option value="">Both</option>
                <option value="FULL">Full</option>
                <option value="PARTIAL">Partial</option>
              </select>
            </div>

            {/* Length */}
            <div>
              <input
                type="number"
                value={filterValues.length || ''}
                onChange={(e) => handleFilterChange('length', e.target.value)}
                placeholder="m"
                className="w-full px-2 py-1 text-xs bg-white border border-[#064d51]/20 rounded"
              />
            </div>

            {/* Weight */}
            <div>
              <input
                type="number"
                value={filterValues.weight || ''}
                onChange={(e) => handleFilterChange('weight', e.target.value)}
                placeholder="kg"
                className="w-full px-2 py-1 text-xs bg-white border border-[#064d51]/20 rounded"
              />
            </div>

            {/* Search Back (days) */}
            <div>
              <input
                type="number"
                value={filterValues.searchBack || ''}
                onChange={(e) => handleFilterChange('searchBack', e.target.value)}
                placeholder="days"
                className="w-full px-2 py-1 text-xs bg-white border border-[#064d51]/20 rounded"
              />
            </div>

            {/* Action Buttons */}
            <div className="col-span-2 flex gap-2 justify-end">
              <button
                onClick={fetchLoads}
                className="px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white text-xs font-bold rounded-lg hover:from-teal-700 hover:to-teal-600 transition-all shadow-sm flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search
              </button>
              <button
                onClick={handleFilterReset}
                className="px-4 py-2 bg-white text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-100 transition-colors border border-slate-200"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results Section Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-teal-600 to-teal-500 rounded-t-2xl">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          {loads.length} {loads.length === 1 ? 'Load' : 'Loads'} Found
        </h3>
        <div className="flex gap-2">
          {resultsTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key as ResultsFilter)}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                activeFilter === tab.key
                  ? 'bg-white text-teal-700'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results Table - Responsive DataTable */}
      <DataTable
        columns={columns}
        data={loads}
        loading={loading}
        actions={tableActions}
        rowKey="id"
        responsiveCardView={true}
        cardTitleColumn="pickupCity"
        cardSubtitleColumn="deliveryCity"
        emptyMessage="No loads found. Try adjusting your search filters."
        className="rounded-t-none"
      />

      {/* Edit Search Modal */}
      <EditSearchModal
        search={editingSearch}
        isOpen={!!editingSearch}
        onClose={() => setEditingSearch(null)}
        onSave={handleSaveEditedSearch}
        cities={ethiopianCities.map((city) => ({ name: city.name, region: city.region }))}
        type="LOADS"
      />

      {/* Load Request Modal */}
      <LoadRequestModal
        isOpen={showRequestModal}
        onClose={() => {
          setShowRequestModal(false);
          setSelectedLoad(null);
        }}
        load={selectedLoad}
        onRequestSent={handleLoadRequestSent}
      />
    </div>
  );
}
