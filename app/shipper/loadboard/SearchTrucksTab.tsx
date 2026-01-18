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
  ActionButton,
  AgeIndicator,
  SavedSearches,
  FilterPanel,
  CompanyLink,
  CompanyModal,
  EditSearchModal,
} from '@/components/loadboard-ui';
import DataTable from '@/components/loadboard-ui/DataTable';
import { TableColumn, StatusTab, Filter, RowAction, SavedSearch, SavedSearchCriteria } from '@/types/loadboard-ui';
import TruckBookingModal from './TruckBookingModal';
import { getCSRFToken } from '@/lib/csrfFetch';

interface SearchTrucksTabProps {
  user: any;
  initialFilters?: any;
}

type ResultsFilter = 'all' | 'PREFERRED' | 'BLOCKED';

export default function SearchTrucksTab({ user, initialFilters }: SearchTrucksTabProps) {
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ResultsFilter>('all');
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, any>>(initialFilters || {});
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showSearchForm, setShowSearchForm] = useState(false);
  const [ethiopianCities, setEthiopianCities] = useState<any[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedTruckPosting, setSelectedTruckPosting] = useState<any>(null);
  const [editingSearch, setEditingSearch] = useState<SavedSearch | null>(null);
  const [pendingRequestTruckIds, setPendingRequestTruckIds] = useState<Set<string>>(new Set());

  /**
   * Fetch trucks based on filters
   */
  const fetchTrucks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      // Apply filters
      if (filterValues.ageHours) {
        params.append('ageHours', filterValues.ageHours.toString());
      }

      // Note: DH-Origin and DH-Destination are carrier-only metrics, hidden from shipper view

      if (filterValues.origin && filterValues.origin.trim() !== '') {
        params.append('origin', filterValues.origin);
      }
      if (filterValues.destination && filterValues.destination.trim() !== '' && filterValues.destination.toLowerCase() !== 'anywhere') {
        params.append('destination', filterValues.destination);
      }
      if (filterValues.truckType) {
        params.append('truckType', filterValues.truckType);
      }
      if (filterValues.fullPartial) {
        params.append('fullPartial', filterValues.fullPartial);
      }
      if (filterValues.minLength) {
        params.append('minLength', filterValues.minLength.toString());
      }
      if (filterValues.maxWeight) {
        params.append('maxWeight', filterValues.maxWeight.toString());
      }
      if (filterValues.availableFrom) {
        params.append('availableFrom', filterValues.availableFrom);
      }
      if (filterValues.showVerifiedOnly) {
        params.append('companyVerified', 'true');
      }

      // Apply company preference filter
      if (activeFilter === 'PREFERRED') {
        params.append('isPreferred', 'true');
      } else if (activeFilter === 'BLOCKED') {
        params.append('isBlocked', 'true');
      }

      const response = await fetch(`/api/truck-postings?${params.toString()}`);
      const data = await response.json();

      setTrucks(data.truckPostings || []);
    } catch (error) {
      console.error('Failed to fetch trucks:', error);
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
      const data = await response.json();
      setSavedSearches(data.searches || []);
    } catch (error) {
      console.error('Failed to fetch saved searches:', error);
    }
  };

  /**
   * Fetch pending truck requests to track button states
   */
  const fetchPendingTruckRequests = async () => {
    try {
      const response = await fetch('/api/truck-requests?status=PENDING');
      if (response.ok) {
        const data = await response.json();
        const truckIds = new Set<string>(
          (data.requests || []).map((req: any) => req.truckId)
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
      const data = await response.json();
      setEthiopianCities(data.locations || []);
      console.log('Loaded cities:', data.locations?.length || 0);
    } catch (error) {
      console.error('Failed to fetch Ethiopian cities:', error);
    } finally {
      setLoadingCities(false);
    }
  };

  // Update filters when initialFilters prop changes
  useEffect(() => {
    if (initialFilters) {
      setFilterValues(initialFilters);
    }
  }, [initialFilters]);

  useEffect(() => {
    fetchTrucks();
  }, [activeFilter, filterValues]);

  useEffect(() => {
    fetchSavedSearches();
    fetchEthiopianCities();
    fetchPendingTruckRequests();
  }, []);

  /**
   * Handle saved search selection
   */
  const handleSelectSearch = (searchId: string) => {
    const search = savedSearches.find((s) => s.id === searchId);
    if (search) {
      setActiveSearchId(searchId);
      setFilterValues(search.criteria || {});
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
  const handleFilterChange = (key: string, value: any) => {
    setFilterValues({ ...filterValues, [key]: value });
    setActiveSearchId(null); // Clear active search when filters change
  };

  /**
   * Handle filter reset
   */
  const handleFilterReset = () => {
    setFilterValues({});
    setActiveSearchId(null);
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

    // Sort the trucks array
    const sorted = [...trucks].sort((a, b) => {
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

    setTrucks(sorted);
  };

  /**
   * Handle company link click
   */
  const handleCompanyClick = async (companyId: string) => {
    try {
      const response = await fetch(`/api/organizations/${companyId}`);
      const data = await response.json();
      setSelectedCompany(data);
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
   * Filter configuration
   */
  const cityOptions = ethiopianCities.map(city => ({
    value: city.name,
    label: city.name,
  }));

  const filters: Filter[] = [
    {
      key: 'ageHours',
      label: 'AGE (hours)',
      type: 'slider',
      min: 0,
      max: 168,
      step: 1,
      unit: 'h',
    },
    // Note: DH-O and DH-D filters hidden from shipper (carrier-only metrics)
    {
      key: 'origin',
      label: 'ORIGIN',
      type: 'select',
      options: cityOptions,
    },
    {
      key: 'destination',
      label: 'DESTINATION',
      type: 'select',
      options: cityOptions,
    },
    {
      key: 'truckType',
      label: 'TRUCK TYPE',
      type: 'select',
      options: [
        { value: 'DRY_VAN', label: 'Dry Van' },
        { value: 'FLATBED', label: 'Flatbed' },
        { value: 'REFRIGERATED', label: 'Refrigerated' },
        { value: 'TANKER', label: 'Tanker' },
        { value: 'CONTAINER', label: 'Container' },
      ],
    },
    {
      key: 'fullPartial',
      label: 'LOAD TYPE',
      type: 'select',
      options: [
        { value: 'FULL', label: 'Full Load' },
        { value: 'PARTIAL', label: 'Partial Load' },
      ],
    },
    {
      key: 'minLength',
      label: 'MIN LENGTH (m)',
      type: 'slider',
      min: 0,
      max: 20,
      step: 0.5,
      unit: 'm',
    },
    {
      key: 'maxWeight',
      label: 'MAX WEIGHT (kg)',
      type: 'slider',
      min: 0,
      max: 50000,
      step: 1000,
      unit: 'kg',
    },
    {
      key: 'availableFrom',
      label: 'AVAILABLE FROM',
      type: 'date-picker',
      minDate: new Date(),
    },
    {
      key: 'showVerifiedOnly',
      label: 'VERIFIED COMPANIES ONLY',
      type: 'toggle',
    },
  ];

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
      render: (value: string, row: any) => (
        <span className="font-medium text-slate-800 dark:text-slate-100">
          {value || row.originCity?.name || 'N/A'}
        </span>
      ),
    },
    {
      key: 'destinationCity',
      label: 'Destination',
      sortable: true,
      render: (_: any, row: any) => (
        <span className="font-medium text-slate-800 dark:text-slate-100">
          {row.destinationCity?.name || 'Anywhere'}
        </span>
      ),
    },
    {
      key: 'company',
      label: 'Company',
      render: (_: any, row: any) => (
        <CompanyLink
          companyId={row.carrierId}
          companyName={row.carrier?.name || 'Unknown'}
          isMasked={!row.carrier?.allowNameDisplay}
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
  ], []);

  /**
   * Table actions configuration (memoized)
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
      onClick: (row: any) => {
        setSelectedTruckPosting(row);
        setShowBookingModal(true);
      },
      show: (row: any) => !pendingRequestTruckIds.has(row.truck?.id || row.truckId),
    },
    {
      key: 'pending',
      label: 'Pending',
      variant: 'secondary',
      onClick: () => {},
      show: (row: any) => pendingRequestTruckIds.has(row.truck?.id || row.truckId),
    },
  ], [pendingRequestTruckIds]);

  return (
    <div className="flex gap-4">
      {/* Main Content - Left Side */}
      <div className="flex-1 space-y-4">
        {/* NEW TRUCK SEARCH Button */}
        <button
          onClick={() => setShowSearchForm(!showSearchForm)}
          className="px-6 py-3 bg-teal-700 dark:bg-teal-600 text-white font-bold text-sm rounded-lg hover:bg-teal-800 dark:hover:bg-teal-700 transition-colors shadow-md flex items-center gap-2"
        >
          <span className="text-lg">🚛</span>
          {showSearchForm ? 'HIDE SEARCH' : 'NEW TRUCK SEARCH'}
        </button>

        {/* Inline Search Form - Only show when toggled */}
        {showSearchForm && (
        <div className="bg-white dark:bg-slate-800 border border-teal-200 dark:border-teal-800 rounded-xl shadow-sm overflow-hidden">
          {/* Header Row - DH-O and DH-D hidden from shipper */}
          <div className="grid grid-cols-10 gap-2 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-teal-700 to-teal-600 dark:from-teal-800 dark:to-teal-700">
            <div>Truck</div>
            <div>Origin</div>
            <div>Destination</div>
            <div>Avail</div>
            <div>F/P</div>
            <div>Length</div>
            <div>Weight</div>
            <div>Search Back</div>
            <div className="col-span-2"></div>
          </div>

          {/* Editable Search Row - DH-O and DH-D hidden from shipper */}
          <div className="grid grid-cols-10 gap-2 px-4 py-3 text-xs items-center bg-teal-50 dark:bg-slate-700/50">
            {/* Truck Type */}
            <div className="flex items-center gap-1">
              <select
                value={filterValues.truckType || ''}
                onChange={(e) => handleFilterChange('truckType', e.target.value)}
                className="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="">ANY</option>
                <option value="DRY_VAN">Van</option>
                <option value="FLATBED">Flatbed</option>
                <option value="REFRIGERATED">Reefer</option>
                <option value="CONTAINER">Container</option>
              </select>
            </div>

            {/* Origin */}
            <div>
              <select
                value={filterValues.origin || ''}
                onChange={(e) => handleFilterChange('origin', e.target.value)}
                disabled={loadingCities}
                className="w-full px-2 py-1.5 text-xs border-2 border-slate-400 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-slate-200 cursor-pointer hover:border-teal-500 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-800 transition-colors"
                style={{ minHeight: '32px' }}
              >
                <option value="">
                  {loadingCities ? 'Loading cities...' : 'Any Origin'}
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
                className="w-full px-2 py-1.5 text-xs border-2 border-slate-400 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-slate-200 cursor-pointer hover:border-teal-500 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-800 transition-colors"
                style={{ minHeight: '32px' }}
              >
                <option value="">
                  {loadingCities ? 'Loading cities...' : 'Anywhere'}
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
                className="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-slate-200"
              />
            </div>

            {/* F/P */}
            <div>
              <select
                value={filterValues.fullPartial || ''}
                onChange={(e) => handleFilterChange('fullPartial', e.target.value)}
                className="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-slate-200"
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
                placeholder="m"
                className="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-slate-200"
              />
            </div>

            {/* Weight */}
            <div>
              <input
                type="number"
                value={filterValues.maxWeight || ''}
                onChange={(e) => handleFilterChange('maxWeight', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="kg"
                className="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-slate-200"
              />
            </div>

            {/* Search Back (Age) */}
            <div>
              <input
                type="number"
                value={filterValues.ageHours || ''}
                onChange={(e) => handleFilterChange('ageHours', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="hrs"
                className="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-slate-200"
              />
            </div>

            {/* Action Buttons */}
            <div className="col-span-2 flex gap-2 justify-end">
              <button
                onClick={fetchTrucks}
                className="px-4 py-1.5 bg-teal-700 dark:bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-800 dark:hover:bg-teal-700 transition-colors"
              >
                🔍 SEARCH
              </button>
              <button
                onClick={handleFilterReset}
                className="px-4 py-1.5 bg-rose-500 text-white text-xs font-bold rounded-lg hover:bg-rose-600 transition-colors"
              >
                🗑️ CLEAR
              </button>
            </div>
          </div>
        </div>
        )}

        {/* Results Summary */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-teal-700 dark:text-teal-400">
              {trucks.length} TOTAL RESULTS
            </h3>
            <StatusTabs
              tabs={resultsTabs}
              activeTab={activeFilter}
              onTabChange={(key) => setActiveFilter(key as ResultsFilter)}
            />
          </div>
        </div>

        {/* Results Section - Responsive DataTable */}
        <DataTable
          columns={columns}
          data={trucks}
          loading={loading}
          actions={tableActions}
          rowKey="id"
          responsiveCardView={true}
          cardTitleColumn="currentCity"
          cardSubtitleColumn="destinationCity"
          emptyMessage="No trucks found. Try adjusting your filters."
        />
      </div>

      {/* Right Sidebar - Filters */}
      <div className="w-56 flex-shrink-0">
        <FilterPanel
          title="REFINE YOUR SEARCH:"
          filters={filters}
          values={filterValues}
          onChange={handleFilterChange}
          onReset={handleFilterReset}
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
