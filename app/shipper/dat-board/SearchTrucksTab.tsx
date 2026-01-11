'use client';

/**
 * SEARCH TRUCKS Tab Component
 *
 * Advanced truck search with saved searches and filtering
 * Sprint 14 - DAT-Style UI Transformation (Phase 3)
 */

import React, { useState, useEffect } from 'react';
import {
  DatStatusTabs,
  DatDataTable,
  DatActionButton,
  DatAgeIndicator,
  DatSavedSearches,
  DatFilterPanel,
  DatCompanyLink,
  DatCompanyModal,
  DatEditSearchModal,
} from '@/components/dat-ui';
import { DatColumn, DatStatusTab, DatFilter, DatRowAction, SavedSearch, SavedSearchCriteria } from '@/types/dat-ui';
import TruckBookingModal from './TruckBookingModal';

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
      const response = await fetch(`/api/saved-searches/${searchId}`, {
        method: 'DELETE',
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
      const response = await fetch(`/api/saved-searches/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
   * Results tabs configuration
   */
  const resultsTabs: DatStatusTab[] = [
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

  const filters: DatFilter[] = [
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
      key: 'availableDate',
      label: 'Avail',
      width: '110px',
      render: (value) => value ? new Date(value).toLocaleDateString() : 'Now',
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
    // DH-O column hidden from shipper (carrier-only metric)
    {
      key: 'currentCity',
      label: 'Origin',
      sortable: true,
    },
    {
      key: 'tripKm',
      label: 'Trip',
      width: '90px',
      align: 'right' as const,
      render: (value) => value ? `${value}km` : 'N/A',
    },
    {
      key: 'destinationCity',
      label: 'Destination',
      sortable: true,
    },
    // DH-D column hidden from shipper (carrier-only metric)
    {
      key: 'company',
      label: 'Company',
      render: (_, row) => (
        <DatCompanyLink
          companyId={row.carrierId}
          companyName={row.carrier?.name || 'Unknown'}
          isMasked={!row.carrier?.allowNameDisplay}
          onClick={handleCompanyClick}
        />
      ),
    },
    {
      key: 'contact',
      label: 'Contact',
      width: '120px',
      render: (_, row) => row.carrierContactPhone || 'N/A',
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
      label: 'Weight',
      width: '90px',
      align: 'right' as const,
      render: (value) => value ? `${value}kg` : 'N/A',
    },
  ];

  /**
   * Row actions configuration
   */
  const rowActions: DatRowAction[] = [
    {
      key: 'contact',
      label: 'CONTACT',
      variant: 'primary',
      onClick: (row) => alert(`Contact carrier: ${row.carrier?.name}`),
    },
    {
      key: 'book',
      label: 'BOOK',
      variant: 'secondary',
      onClick: (row) => {
        setSelectedTruckPosting(row);
        setShowBookingModal(true);
      },
    },
  ];

  return (
    <div className="flex gap-4">
      {/* Main Content - Left Side */}
      <div className="flex-1 space-y-4">
        {/* NEW TRUCK SEARCH Button */}
        <button
          onClick={() => setShowSearchForm(!showSearchForm)}
          className="px-6 py-3 bg-[#064d51] text-white font-bold text-sm rounded-lg hover:bg-[#053d40] transition-colors shadow-md flex items-center gap-2"
        >
          <span className="text-lg">🚛</span>
          {showSearchForm ? 'HIDE SEARCH' : 'NEW TRUCK SEARCH'}
        </button>

        {/* Inline Search Form - Only show when toggled */}
        {showSearchForm && (
        <div className="bg-white border border-[#064d51]/20 rounded-xl shadow-sm overflow-hidden">
          {/* Header Row - DH-O and DH-D hidden from shipper */}
          <div className="grid grid-cols-10 gap-2 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#064d51] to-[#1e9c99]">
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
          <div className="grid grid-cols-10 gap-2 px-4 py-3 text-xs items-center bg-[#f0fdfa]">
            {/* Truck Type */}
            <div className="flex items-center gap-1">
              <select
                value={filterValues.truckType || ''}
                onChange={(e) => handleFilterChange('truckType', e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white"
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
                className="w-full px-2 py-1.5 text-xs border-2 border-gray-400 rounded bg-white cursor-pointer hover:border-blue-500 focus:border-blue-600 focus:ring-2 focus:ring-blue-200 transition-colors"
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
                className="w-full px-2 py-1.5 text-xs border-2 border-gray-400 rounded bg-white cursor-pointer hover:border-blue-500 focus:border-blue-600 focus:ring-2 focus:ring-blue-200 transition-colors"
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
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
              />
            </div>

            {/* F/P */}
            <div>
              <select
                value={filterValues.fullPartial || ''}
                onChange={(e) => handleFilterChange('fullPartial', e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white"
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
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
              />
            </div>

            {/* Weight */}
            <div>
              <input
                type="number"
                value={filterValues.maxWeight || ''}
                onChange={(e) => handleFilterChange('maxWeight', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="kg"
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
              />
            </div>

            {/* Search Back (Age) */}
            <div>
              <input
                type="number"
                value={filterValues.ageHours || ''}
                onChange={(e) => handleFilterChange('ageHours', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="hrs"
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
              />
            </div>

            {/* Action Buttons */}
            <div className="col-span-2 flex gap-2 justify-end">
              <button
                onClick={fetchTrucks}
                className="px-4 py-1.5 bg-[#064d51] text-white text-xs font-bold rounded-lg hover:bg-[#053d40] transition-colors"
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
            <h3 className="text-lg font-bold text-[#064d51]">
              {trucks.length} TOTAL RESULTS
            </h3>
            <DatStatusTabs
              tabs={resultsTabs}
              activeTab={activeFilter}
              onTabChange={(key) => setActiveFilter(key as ResultsFilter)}
            />
          </div>
        </div>

        {/* Results Section */}
        <div>
          <h4 className="text-sm font-bold text-gray-700 mb-2 uppercase">
            {trucks.length} {trucks.length === 1 ? 'MATCH' : 'MATCHES'}
          </h4>

          {/* Results Table - DH-O and DH-D hidden from shipper */}
          <div className="bg-white border border-[#064d51]/20 rounded-xl overflow-visible shadow-sm">
            {/* Table Header */}
            <div className="bg-gradient-to-r from-[#064d51] to-[#1e9c99] grid grid-cols-11 gap-2 px-4 py-3 rounded-t-xl text-xs font-semibold text-white">
              <div
                className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded"
                onClick={() => handleHeaderClick('createdAt')}
              >
                Age {sortField === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
              </div>
              <div
                className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded"
                onClick={() => handleHeaderClick('availableDate')}
              >
                Avail {sortField === 'availableDate' && (sortOrder === 'asc' ? '↑' : '↓')}
              </div>
              <div
                className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded"
                onClick={() => handleHeaderClick('truckType')}
              >
                Truck {sortField === 'truckType' && (sortOrder === 'asc' ? '↑' : '↓')}
              </div>
              <div
                className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded"
                onClick={() => handleHeaderClick('fullPartial')}
              >
                F/P {sortField === 'fullPartial' && (sortOrder === 'asc' ? '↑' : '↓')}
              </div>
              <div
                className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded"
                onClick={() => handleHeaderClick('currentCity')}
              >
                Origin {sortField === 'currentCity' && (sortOrder === 'asc' ? '↑' : '↓')}
              </div>
              <div
                className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded"
                onClick={() => handleHeaderClick('tripKm')}
              >
                Trip {sortField === 'tripKm' && (sortOrder === 'asc' ? '↑' : '↓')}
              </div>
              <div
                className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded"
                onClick={() => handleHeaderClick('destinationCity')}
              >
                Destination {sortField === 'destinationCity' && (sortOrder === 'asc' ? '↑' : '↓')}
              </div>
              <div
                className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded"
              >
                Company
              </div>
              <div
                className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded"
              >
                Contact
              </div>
              <div
                className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded"
                onClick={() => handleHeaderClick('lengthM')}
              >
                Length {sortField === 'lengthM' && (sortOrder === 'asc' ? '↑' : '↓')}
              </div>
              <div
                className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded"
                onClick={() => handleHeaderClick('maxWeight')}
              >
                Weight {sortField === 'maxWeight' && (sortOrder === 'asc' ? '↑' : '↓')}
              </div>
            </div>

            {/* Truck Rows */}
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading trucks...</div>
            ) : trucks.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No trucks found. Try adjusting your filters.</div>
            ) : (
              trucks.map((truck) => (
                <div
                  key={truck.id}
                  className="grid grid-cols-11 gap-2 px-4 py-3 border-b border-[#064d51]/10 hover:bg-[#064d51]/5 cursor-default text-xs transition-colors"
                  style={{ color: '#2B2727' }}
                >
                  <div>{truck.age || '00:07'}</div>
                  <div>{truck.availableDate ? new Date(truck.availableDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) : 'Now'}</div>
                  <div>{truck.truckType || 'V'}</div>
                  <div>{truck.fullPartial || 'F'}</div>
                  <div className="truncate">{truck.currentCity || 'Tacoma, WA'}</div>
                  <div>—</div>
                  <div className="truncate">{truck.destinationCity || 'Anywhere'}</div>
                  <div className="truncate text-[#1e9c99] hover:underline cursor-pointer font-medium">
                    {truck.carrier?.name || 'Land Lines Inc'}
                  </div>
                  <div>{truck.contactPhone || '(630) 410-8194'}</div>
                  <div>{truck.lengthM ? `${truck.lengthM}ft` : '53 ft'}</div>
                  <div>{truck.maxWeight ? `${truck.maxWeight.toLocaleString()}` : '50,000 lbs'}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar - Filters */}
      <div className="w-56 flex-shrink-0">
        <DatFilterPanel
          title="REFINE YOUR SEARCH:"
          filters={filters}
          values={filterValues}
          onChange={handleFilterChange}
          onReset={handleFilterReset}
        />
      </div>

      {/* Company Modal */}
      {selectedCompany && (
        <DatCompanyModal
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
      />

      {/* Edit Search Modal */}
      <DatEditSearchModal
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
