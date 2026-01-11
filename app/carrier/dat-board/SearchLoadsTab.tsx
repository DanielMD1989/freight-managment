'use client';

/**
 * SEARCH LOADS Tab Component - DAT Power Style
 *
 * Carrier interface for searching available loads
 * Sprint 14 - DAT-Style UI Transformation
 */

import React, { useState, useEffect } from 'react';
import { DatStatusTabs, DatAgeIndicator, DatSavedSearches, DatEditSearchModal } from '@/components/dat-ui';
import { DatStatusTab, SavedSearch, SavedSearchCriteria } from '@/types/dat-ui';

interface SearchLoadsTabProps {
  user: any;
}

type ResultsFilter = 'all' | 'PREFERRED' | 'BLOCKED';

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
      const response = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const response = await fetch(`/api/saved-searches/${searchId}`, {
        method: 'DELETE',
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
      const response = await fetch(`/api/saved-searches/${searchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
   * Fetch loads based on filters
   */
  const fetchLoads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('status', 'POSTED');

      if (filterValues.truckType) {
        params.append('truckType', filterValues.truckType);
      }
      if (filterValues.origin) {
        params.append('pickupCity', filterValues.origin);
      }
      if (filterValues.destination) {
        params.append('deliveryCity', filterValues.destination);
      }
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
      setLoads(data.loads || []);
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
   * Results tabs configuration
   */
  const resultsTabs: DatStatusTab[] = [
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
            <DatSavedSearches
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

      {/* Results Section */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-teal-600 to-teal-500">
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

        {/* Results Table */}
        <div className="overflow-x-auto">
          {/* Table Header */}
          <div className="bg-gradient-to-r from-slate-100 to-slate-50 grid grid-cols-13 gap-2 px-4 py-3 text-xs font-semibold text-slate-600 border-b border-slate-200">
            <div
              className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded"
              onClick={() => handleHeaderClick('createdAt')}
            >
              Age {sortField === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
            </div>
            <div
              className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded"
              onClick={() => handleHeaderClick('pickupDate')}
            >
              Pickup {sortField === 'pickupDate' && (sortOrder === 'asc' ? '↑' : '↓')}
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
              onClick={() => handleHeaderClick('dhToOriginKm')}
            >
              DH-O {sortField === 'dhToOriginKm' && (sortOrder === 'asc' ? '↑' : '↓')}
            </div>
            <div
              className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded"
              onClick={() => handleHeaderClick('pickupCity')}
            >
              Origin {sortField === 'pickupCity' && (sortOrder === 'asc' ? '↑' : '↓')}
            </div>
            <div
              className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded"
              onClick={() => handleHeaderClick('tripKm')}
            >
              Trip {sortField === 'tripKm' && (sortOrder === 'asc' ? '↑' : '↓')}
            </div>
            <div
              className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded"
              onClick={() => handleHeaderClick('deliveryCity')}
            >
              Destination {sortField === 'deliveryCity' && (sortOrder === 'asc' ? '↑' : '↓')}
            </div>
            <div
              className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded"
              onClick={() => handleHeaderClick('dhAfterDeliveryKm')}
            >
              DH-D {sortField === 'dhAfterDeliveryKm' && (sortOrder === 'asc' ? '↑' : '↓')}
            </div>
            <div className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded">
              Company
            </div>
            <div className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded">
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
              onClick={() => handleHeaderClick('weight')}
            >
              Weight {sortField === 'weight' && (sortOrder === 'asc' ? '↑' : '↓')}
            </div>
          </div>

          {/* Load Rows */}
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-sm text-slate-500">Loading loads...</p>
            </div>
          ) : loads.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-slate-800 mb-1">No loads found</h3>
              <p className="text-sm text-slate-500">Try adjusting your search filters</p>
            </div>
          ) : (
            loads.map((load) => (
              <div
                key={load.id}
                className="grid grid-cols-13 gap-2 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 cursor-default text-xs transition-colors group"
              >
                <div><DatAgeIndicator date={load.createdAt} /></div>
                <div className="text-slate-700">{load.pickupDate ? new Date(load.pickupDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) : 'N/A'}</div>
                <div className="text-slate-700">{getTruckTypeLabel(load.truckType)}</div>
                <div className="text-slate-700">{load.fullPartial === 'FULL' ? 'F' : 'P'}</div>
                <div className="text-slate-500">{load.dhToOriginKm || '—'}</div>
                <div className="truncate font-medium text-slate-800">{load.pickupCity || 'N/A'}</div>
                <div className="text-slate-500">{load.tripKm || '—'}</div>
                <div className="truncate font-medium text-slate-800">{load.deliveryCity || 'N/A'}</div>
                <div className="text-slate-500">{load.dhAfterDeliveryKm || '—'}</div>
                <div className="truncate font-medium text-teal-600 hover:text-teal-700 hover:underline cursor-pointer">
                  {load.shipper?.name || 'Anonymous'}
                </div>
                <div className="text-slate-600">{load.shipperContactPhone || 'N/A'}</div>
                <div className="text-slate-600">{load.lengthM ? `${load.lengthM}m` : 'N/A'}</div>
                <div className="text-slate-600">{load.weight ? `${load.weight.toLocaleString()}kg` : 'N/A'}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit Search Modal */}
      <DatEditSearchModal
        search={editingSearch}
        isOpen={!!editingSearch}
        onClose={() => setEditingSearch(null)}
        onSave={handleSaveEditedSearch}
        cities={ethiopianCities.map((city) => ({ name: city.name, region: city.region }))}
        type="LOADS"
      />
    </div>
  );
}
