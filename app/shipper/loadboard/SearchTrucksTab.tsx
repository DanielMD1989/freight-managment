'use client';

/**
 * SEARCH TRUCKS Tab Component
 *
 * Advanced truck search with saved searches and filtering
 * Sprint 14 - DAT-Style UI Transformation (Phase 3)
 * Updated: Sprint 19 - Responsive DataTable integration
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  StatusTabs,
  AgeIndicator,
  CompanyLink,
  CompanyModal,
  EditSearchModal,
} from '@/components/loadboard-ui';
import DataTable from '@/components/loadboard-ui/DataTable';
import { TableColumn, StatusTab, RowAction, SavedSearch, SavedSearchCriteria, CompanyInfo } from '@/types/loadboard-ui';
import TruckBookingModal from './TruckBookingModal';
import { getCSRFToken } from '@/lib/csrfFetch';
import type { Organization, Truck } from '@/lib/types/shipper';

// Session user shape (from auth)
interface SessionUser {
  userId: string;
  email?: string;
  role: string;
  status?: string;
  organizationId?: string;
}

// L22 FIX: Properly typed filter values
interface FilterValues {
  ageHours?: number;
  origin?: string;
  destination?: string;
  truckType?: string;
  minWeight?: number;
  maxWeight?: number;
  minLength?: number;
  maxLength?: number;
  verifiedOnly?: boolean;
  showVerifiedOnly?: boolean;
  fullPartial?: string;
  availableFrom?: string;
  [key: string]: string | number | boolean | undefined; // Allow dynamic keys
}

// L23 FIX: Extended truck posting with carrier info
// Note: Uses local interface instead of extending TruckPosting for type compatibility
interface TruckPostingWithCarrier {
  id: string;
  truckId: string;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  originCityId?: string | null;
  destinationCityId?: string | null;
  currentCity?: string | null;
  availableFrom: string;
  availableTo?: string | null;
  preferredRate?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  originCity?: { name: string; id?: string } | null;
  destinationCityObj?: { name: string; id?: string } | null;
  truck: Truck & { carrier?: Organization; carrierId: string };
  carrier?: Organization & { contactPhone?: string; contactEmail?: string };
  // Additional fields that may come from API
  contactName?: string;
  contactPhone?: string;
}

interface SearchTrucksTabProps {
  user: SessionUser;
  initialFilters?: FilterValues;
}

type ResultsFilter = 'all' | 'PREFERRED' | 'BLOCKED';

export default function SearchTrucksTab({ user, initialFilters }: SearchTrucksTabProps) {
  // L24 FIX: Properly typed state variables
  const [trucks, setTrucks] = useState<TruckPostingWithCarrier[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ResultsFilter>('all');
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<FilterValues>(initialFilters || {});
  const [selectedCompany, setSelectedCompany] = useState<CompanyInfo | null>(null);
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showSearchForm, setShowSearchForm] = useState(true); // Show search form by default
  const [ethiopianCities, setEthiopianCities] = useState<Array<{ name: string; id?: string; region?: string }>>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedTruckPosting, setSelectedTruckPosting] = useState<TruckPostingWithCarrier | null>(null);
  const [editingSearch, setEditingSearch] = useState<SavedSearch | null>(null);
  const [pendingRequestTruckIds, setPendingRequestTruckIds] = useState<Set<string>>(new Set());
  const [fetchError, setFetchError] = useState<string | null>(null);

  /**
   * Fetch trucks based on filters
   * Uses current filter values from state ref to avoid stale closure issues
   * L25 FIX: Properly typed filter override
   */
  const fetchTrucks = async (overrideFilters?: FilterValues) => {
    setLoading(true);
    setFetchError(null);
    try {
      // Use override filters if provided, otherwise use current state
      const currentFilters = overrideFilters || filterValues;
      const params = new URLSearchParams();

      // Apply filters
      if (currentFilters.ageHours) {
        params.append('ageHours', currentFilters.ageHours.toString());
      }

      // Note: DH-Origin and DH-Destination are carrier-only metrics, hidden from shipper view

      if (currentFilters.origin && currentFilters.origin.trim() !== '') {
        params.append('origin', currentFilters.origin);
      }
      if (currentFilters.destination && currentFilters.destination.trim() !== '' && currentFilters.destination.toLowerCase() !== 'anywhere') {
        params.append('destination', currentFilters.destination);
      }
      if (currentFilters.truckType) {
        params.append('truckType', currentFilters.truckType);
      }
      if (currentFilters.fullPartial) {
        params.append('fullPartial', currentFilters.fullPartial);
      }
      if (currentFilters.minLength) {
        params.append('minLength', currentFilters.minLength.toString());
      }
      if (currentFilters.maxWeight) {
        params.append('maxWeight', currentFilters.maxWeight.toString());
      }
      if (currentFilters.availableFrom) {
        params.append('availableFrom', currentFilters.availableFrom);
      }
      if (currentFilters.showVerifiedOnly) {
        params.append('companyVerified', 'true');
      }

      // Apply company preference filter
      if (activeFilter === 'PREFERRED') {
        params.append('isPreferred', 'true');
      } else if (activeFilter === 'BLOCKED') {
        params.append('isBlocked', 'true');
      }

      const url = `/api/truck-postings?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch trucks');
      const data = await response.json();
      setTrucks(data.truckPostings || []);
    } catch (error) {
      console.error('Failed to fetch trucks:', error);
      setFetchError('Failed to load trucks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch saved searches
   */
  const fetchSavedSearches = async () => {
    try {
      const response = await fetch('/api/saved-searches?type=TRUCKS');
      // H31 FIX: Check response.ok before parsing
      if (!response.ok) {
        console.error('Failed to fetch saved searches:', response.status);
        return;
      }
      const data = await response.json();
      setSavedSearches(data.searches || []);
    } catch (error) {
      console.error('Failed to fetch saved searches:', error);
    }
  };

  /**
   * Fetch pending truck requests to track button states
   * L29 FIX: Properly typed request mapping
   */
  const fetchPendingTruckRequests = async () => {
    try {
      const response = await fetch('/api/truck-requests?status=PENDING');
      if (response.ok) {
        const data = await response.json();
        const truckIds = new Set<string>(
          (data.requests || []).map((req: { truckId: string }) => req.truckId)
        );
        setPendingRequestTruckIds(truckIds);
      }
    } catch (error) {
      console.error('Failed to fetch pending truck requests:', error);
    }
  };

  /**
   * Fetch Ethiopian cities for dropdowns
   */
  const fetchEthiopianCities = async () => {
    setLoadingCities(true);
    try {
      const response = await fetch('/api/ethiopian-locations');
      // H32 FIX: Check response.ok before parsing
      if (!response.ok) {
        console.error('Failed to fetch Ethiopian cities:', response.status);
        return;
      }
      const data = await response.json();
      setEthiopianCities(data.locations || []);
    } catch (error) {
      console.error('Failed to fetch Ethiopian cities:', error);
    } finally {
      setLoadingCities(false);
    }
  };

  // Mount effect - load helper data and initial trucks
  useEffect(() => {
    fetchSavedSearches();
    fetchEthiopianCities();
    fetchPendingTruckRequests();

    // Initial fetch with initialFilters or empty
    const filters = initialFilters && Object.keys(initialFilters).length > 0 ? initialFilters : {};
    fetchTrucks(filters);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Handle saved search selection
   * L31 FIX: Transform SavedSearchCriteria to FilterValues
   */
  const handleSelectSearch = (searchId: string) => {
    const search = savedSearches.find((s) => s.id === searchId);
    if (search) {
      setActiveSearchId(searchId);
      // Transform criteria - truckType may be array in criteria but string in filters
      const criteria = search.criteria || {};
      const transformed: FilterValues = {
        ...criteria,
        truckType: Array.isArray(criteria.truckType) ? criteria.truckType[0] : criteria.truckType,
      };
      setFilterValues(transformed);
    }
  };

  /**
   * Handle saved search deletion
   */
  const handleDeleteSearch = async (searchId: string) => {
    if (!confirm('Delete this saved search?')) return;

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/saved-searches/${searchId}`, {
        method: 'DELETE',
        headers: {
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
      });

      if (!response.ok) throw new Error('Failed to delete search');

      fetchSavedSearches();
      if (activeSearchId === searchId) {
        setActiveSearchId(null);
        setFilterValues({});
      }
    } catch (error) {
      console.error('Delete search error:', error);
      alert('Failed to delete saved search');
    }
  };

  /**
   * Handle saved search edit - open modal
   */
  const handleEditSearch = (searchId: string) => {
    const search = savedSearches.find((s) => s.id === searchId);
    if (!search) return;
    setEditingSearch(search);
  };

  /**
   * Handle saving edited search from modal
   */
  const handleSaveEditedSearch = async (id: string, updates: { name?: string; criteria?: SavedSearchCriteria }) => {
    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/saved-searches/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update search');

      fetchSavedSearches();
    } catch (error) {
      console.error('Update search error:', error);
      throw error;
    }
  };

  /**
   * Handle filter change
   */
  // Use ref to always have latest filter values (avoids stale closure)
  const filterValuesRef = React.useRef(filterValues);
  filterValuesRef.current = filterValues;

  // L26 FIX: Properly typed filter change handler
  const handleFilterChange = (key: string, value: string | number | boolean | undefined) => {
    const newFilters = { ...filterValues, [key]: value };
    setFilterValues(newFilters);
    setActiveSearchId(null);
  };

  /**
   * Handle search button click - uses ref to get latest filter values
   */
  const handleSearchClick = () => {
    fetchTrucks(filterValuesRef.current);
  };

  /**
   * Handle filter reset
   */
  const handleFilterReset = () => {
    setFilterValues({});
    setActiveSearchId(null);
    fetchTrucks({});
  };

  /**
   * Handle successful truck request sent
   */
  const handleTruckRequestSent = (truckId: string) => {
    setPendingRequestTruckIds(prev => new Set([...prev, truckId]));
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

    // L32 FIX: Sort the trucks array with proper type handling
    const sorted = [...trucks].sort((a, b) => {
      // Use type assertion for dynamic property access (via unknown to satisfy TS)
      const aVal = (a as unknown as Record<string, unknown>)[field];
      const bVal = (b as unknown as Record<string, unknown>)[field];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setTrucks(sorted);
  };

  /**
   * Handle company link click
   * L30 FIX: Transform to CompanyInfo type
   */
  const handleCompanyClick = async (companyId: string) => {
    try {
      const response = await fetch(`/api/organizations/${companyId}`);
      const data = await response.json();
      // Transform to CompanyInfo format expected by CompanyModal
      setSelectedCompany({
        id: data.id,
        name: data.name,
        isVerified: data.isVerified ?? false,
        isMasked: false,
        allowNameDisplay: true,
      });
    } catch (error) {
      console.error('Failed to fetch company:', error);
    }
  };

  /**
   * Truck types list with enum values and display labels
   */
  const truckTypes = [
    { value: 'AUTO_CARRIER', label: 'Auto Carrier', code: 'AC' },
    { value: 'CONTAINER', label: 'Container', code: 'C' },
    { value: 'DUMP_TRUCK', label: 'Dump Truck', code: 'DK' },
    { value: 'FLATBED', label: 'Flatbed', code: 'F' },
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
    if (!enumValue) return 'V';
    const found = truckTypes.find(t => t.value === enumValue);
    return found ? found.label : enumValue.replace('_', ' ');
  };

  /**
   * Results tabs configuration
   */
  const resultsTabs: StatusTab[] = [
    { key: 'all', label: 'ALL' },
    { key: 'PREFERRED', label: 'PREFERRED' },
    { key: 'BLOCKED', label: 'BLOCKED' },
  ];

  /**
   * Table columns configuration (memoized)
   */
  const columns: TableColumn[] = useMemo(() => [
    // L27 FIX: Properly typed column render functions
    {
      key: 'age',
      label: 'Age',
      width: '80px',
      render: (_: unknown, row: TruckPostingWithCarrier) => <AgeIndicator date={row.createdAt} />,
    },
    {
      key: 'availableDate',
      label: 'Avail',
      width: '110px',
      sortable: true,
      render: (value: string) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Now',
    },
    {
      key: 'truckType',
      label: 'Truck',
      width: '100px',
      sortable: true,
      render: (value: string) => getTruckTypeLabel(value),
    },
    {
      key: 'fullPartial',
      label: 'F/P',
      width: '60px',
      align: 'center' as const,
    },
    {
      key: 'currentCity',
      label: 'Origin',
      sortable: true,
      render: (value: string, row: TruckPostingWithCarrier) => (
        <span className="font-medium text-slate-800 dark:text-slate-100">
          {value || row.originCity?.name || 'N/A'}
        </span>
      ),
    },
    {
      key: 'destinationCity',
      label: 'Destination',
      sortable: true,
      render: (_: unknown, row: TruckPostingWithCarrier) => (
        <span className="font-medium text-slate-800 dark:text-slate-100">
          {row.destinationCityObj?.name || 'Anywhere'}
        </span>
      ),
    },
    {
      key: 'company',
      label: 'Company',
      render: (_: unknown, row: TruckPostingWithCarrier) => (
        <CompanyLink
          companyId={row.truck?.carrierId || ''}
          companyName={row.carrier?.name || 'Unknown'}
          isMasked={false}
          onClick={handleCompanyClick}
        />
      ),
    },
    {
      key: 'lengthM',
      label: 'Length',
      width: '80px',
      align: 'right' as const,
      sortable: true,
      render: (value: number) => value ? `${value}m` : 'N/A',
    },
    {
      key: 'maxWeight',
      label: 'Weight',
      width: '90px',
      align: 'right' as const,
      sortable: true,
      render: (value: number) => value ? `${value.toLocaleString()}kg` : 'N/A',
    },
    {
      key: 'serviceFee',
      label: 'Service Fee',
      width: '140px',
      render: () => (
        <span className="text-xs text-slate-500 dark:text-slate-400 italic">
          Calculated on booking
        </span>
      ),
    },
  ], []);

  /**
   * Table actions configuration (memoized)
   * L28 FIX: Properly typed row actions
   */
  const tableActions: RowAction[] = useMemo(() => [
    {
      key: 'book',
      label: 'Book',
      variant: 'primary',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      onClick: (row: TruckPostingWithCarrier) => {
        setSelectedTruckPosting(row);
        setShowBookingModal(true);
      },
      show: (row: TruckPostingWithCarrier) => !pendingRequestTruckIds.has(row.truck?.id || row.truckId),
    },
    {
      key: 'pending',
      label: 'Pending',
      variant: 'secondary',
      onClick: () => {},
      show: (row: TruckPostingWithCarrier) => pendingRequestTruckIds.has(row.truck?.id || row.truckId),
    },
  ], [pendingRequestTruckIds]);

  return (
    <div className="space-y-6">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h2
              className="text-xl font-semibold"
              style={{ color: 'var(--foreground)' }}
            >
              Find Available Trucks
            </h2>
            <p
              className="text-sm mt-1"
              style={{ color: 'var(--foreground-muted)' }}
            >
              Search for trucks that match your shipping needs
            </p>
          </div>
          <button
            onClick={() => setShowSearchForm(!showSearchForm)}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            style={{
              background: showSearchForm ? 'var(--bg-tinted)' : 'var(--primary-500)',
              color: showSearchForm ? 'var(--foreground)' : 'white',
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showSearchForm ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
            </svg>
            {showSearchForm ? 'Collapse Search' : 'Expand Search'}
          </button>
        </div>

        {/* Search Form Card */}
        {showSearchForm && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          {/* Header Row */}
          <div
            className="grid grid-cols-10 gap-2 px-4 py-3 text-xs font-semibold"
            style={{ background: 'var(--primary-500)', color: 'white' }}
          >
            <div>Truck Type</div>
            <div>Origin</div>
            <div>Destination</div>
            <div>Available</div>
            <div>F/P</div>
            <div>Length</div>
            <div>Weight</div>
            <div>Age (hrs)</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {/* Search Row */}
          <div
            className="grid grid-cols-10 gap-2 px-4 py-4 text-xs items-center"
            style={{ background: 'var(--bg-tinted)' }}
          >
            {/* Truck Type */}
            <div>
              <select
                value={filterValues.truckType || ''}
                onChange={(e) => handleFilterChange('truckType', e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2"
                style={{
                  background: 'var(--card)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              >
                <option value="">Any Type</option>
                <option value="DRY_VAN">Van</option>
                <option value="FLATBED">Flatbed</option>
                <option value="REFRIGERATED">Reefer</option>
                <option value="CONTAINER">Container</option>
                <option value="TANKER">Tanker</option>
              </select>
            </div>

            {/* Origin */}
            <div>
              <select
                value={filterValues.origin || ''}
                onChange={(e) => handleFilterChange('origin', e.target.value)}
                disabled={loadingCities}
                className="w-full px-3 py-2 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2"
                style={{
                  background: 'var(--card)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
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
                onChange={(e) => handleFilterChange('destination', e.target.value || undefined)}
                disabled={loadingCities}
                className="w-full px-3 py-2 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2"
                style={{
                  background: 'var(--card)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
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
                value={filterValues.availableFrom || ''}
                onChange={(e) => handleFilterChange('availableFrom', e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2"
                style={{
                  background: 'var(--card)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
            </div>

            {/* F/P */}
            <div>
              <select
                value={filterValues.fullPartial || ''}
                onChange={(e) => handleFilterChange('fullPartial', e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2"
                style={{
                  background: 'var(--card)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              >
                <option value="">Any</option>
                <option value="FULL">Full</option>
                <option value="PARTIAL">Partial</option>
              </select>
            </div>

            {/* Length */}
            <div>
              <input
                type="number"
                value={filterValues.minLength || ''}
                onChange={(e) => handleFilterChange('minLength', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="Min (m)"
                className="w-full px-3 py-2 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2"
                style={{
                  background: 'var(--card)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
            </div>

            {/* Weight */}
            <div>
              <input
                type="number"
                value={filterValues.maxWeight || ''}
                onChange={(e) => handleFilterChange('maxWeight', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="Max (kg)"
                className="w-full px-3 py-2 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2"
                style={{
                  background: 'var(--card)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
            </div>

            {/* Search Back (Age) */}
            <div>
              <input
                type="number"
                value={filterValues.ageHours || ''}
                onChange={(e) => handleFilterChange('ageHours', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="Hours"
                className="w-full px-3 py-2 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2"
                style={{
                  background: 'var(--card)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
            </div>

            {/* Action Buttons */}
            <div className="col-span-2 flex gap-2 justify-end">
              <button
                onClick={handleSearchClick}
                className="px-5 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                style={{ background: 'var(--primary-500)', color: 'white' }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search
              </button>
              <button
                onClick={handleFilterReset}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                style={{
                  background: 'var(--bg-tinted)',
                  color: 'var(--foreground-muted)',
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
        )}

        {/* Error Banner */}
        {fetchError && (
          <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700">
            <span>{fetchError}</span>
            <button
              onClick={() => fetchTrucks(filterValuesRef.current)}
              className="ml-3 px-3 py-1 text-xs font-medium bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Results Section */}
        <div
          className="rounded-xl border overflow-hidden"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          {/* Results Header */}
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div>
              <h3
                className="text-base font-semibold"
                style={{ color: 'var(--foreground)' }}
              >
                {trucks.length} Trucks Found
              </h3>
              <p
                className="text-sm mt-0.5"
                style={{ color: 'var(--foreground-muted)' }}
              >
                {loading ? 'Searching...' : 'Available trucks matching your criteria'}
              </p>
            </div>
            <StatusTabs
              tabs={resultsTabs}
              activeTab={activeFilter}
              onTabChange={(key) => setActiveFilter(key as ResultsFilter)}
            />
          </div>

          {/* Results Table */}
          <DataTable
            columns={columns}
            data={trucks}
            loading={loading}
            actions={tableActions}
            rowKey="id"
            responsiveCardView={true}
            cardTitleColumn="currentCity"
            cardSubtitleColumn="destinationCity"
            emptyMessage="No trucks found matching your search criteria. Try adjusting your filters."
          />
        </div>

      {/* Company Modal */}
      {selectedCompany && (
        <CompanyModal
          isOpen={!!selectedCompany}
          onClose={() => setSelectedCompany(null)}
          company={selectedCompany}
        />
      )}

      {/* Truck Booking Modal */}
      <TruckBookingModal
        isOpen={showBookingModal}
        onClose={() => {
          setShowBookingModal(false);
          setSelectedTruckPosting(null);
        }}
        truckPosting={selectedTruckPosting}
        onRequestSent={handleTruckRequestSent}
      />

      {/* Edit Search Modal */}
      <EditSearchModal
        search={editingSearch}
        isOpen={!!editingSearch}
        onClose={() => setEditingSearch(null)}
        onSave={handleSaveEditedSearch}
        cities={ethiopianCities.map((city) => ({ name: city.name, region: city.region }))}
        type="TRUCKS"
      />
    </div>
  );
}
