'use client';

/**
 * SEARCH LOADS Tab Component - DAT Power Style
 *
 * Carrier interface for searching available loads
 * Sprint 14 - DAT-Style UI Transformation
 */

import React, { useState, useEffect } from 'react';
import { DatStatusTabs, DatAgeIndicator, DatSavedSearches } from '@/components/dat-ui';
import { DatStatusTab } from '@/types/dat-ui';

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
   * Edit a saved search (placeholder)
   */
  const handleEditSavedSearch = (searchId: string) => {
    const search = savedSearches.find((s) => s.id === searchId);
    if (!search) return;

    const newName = prompt('Enter new name for this search:', search.name);
    if (!newName || newName === search.name) return;

    updateSavedSearch(searchId, { name: newName });
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
   * Truck types list
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
    { value: 'FLATBED', label: 'Flatbed', code: 'F' },
    { value: 'FLATBED_AIR_RIDE', label: 'Flatbed Air-Ride', code: 'FA' },
    { value: 'FLATBED_CONESTOGA', label: 'Flatbed Conestoga', code: 'FN' },
    { value: 'FLATBED_DOUBLE', label: 'Flatbed Double', code: 'F2' },
    { value: 'FLATBED_HAZMAT', label: 'Flatbed HazMat', code: 'FZ' },
    { value: 'FLATBED_HOTSHOT', label: 'Flatbed Hotshot', code: 'FH' },
    { value: 'FLATBED_MAXI', label: 'Flatbed Maxi', code: 'MX' },
    { value: 'DRY_VAN', label: 'Van', code: 'V' },
    { value: 'REFRIGERATED', label: 'Reefer', code: 'R' },
    { value: 'TANKER', label: 'Tanker', code: 'T' },
  ];

  /**
   * Results tabs configuration
   */
  const resultsTabs: DatStatusTab[] = [
    { key: 'all', label: 'ALL' },
    { key: 'PREFERRED', label: 'PREFERRED' },
    { key: 'BLOCKED', label: 'BLOCKED' },
  ];

  return (
    <div className="space-y-4">
      {/* Saved Searches Panel */}
      {savedSearches.length > 0 && (
        <div className="bg-white border border-[#064d51]/20 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[#064d51] uppercase">
              Saved Searches ({savedSearches.length})
            </h3>
          </div>
          <DatSavedSearches
            searches={savedSearches}
            activeSearchId={activeSavedSearchId}
            onSelect={handleSelectSavedSearch}
            onDelete={handleDeleteSavedSearch}
            onEdit={handleEditSavedSearch}
            type="LOADS"
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => setShowSearchForm(!showSearchForm)}
          className="px-6 py-3 bg-[#064d51] text-white font-bold text-sm rounded-lg hover:bg-[#053d40] transition-colors shadow-md flex items-center gap-2"
        >
          <span className="text-lg">🔍</span>
          {showSearchForm ? 'HIDE SEARCH' : 'NEW LOAD SEARCH'}
        </button>

        {showSearchForm && (
          <button
            onClick={handleSaveSearch}
            className="px-6 py-3 bg-[#1e9c99] text-white font-bold text-sm rounded-lg hover:bg-[#178f8c] transition-colors shadow-md flex items-center gap-2"
          >
            <span className="text-lg">💾</span>
            SAVE SEARCH
          </button>
        )}
      </div>

      {/* Inline Search Form - Only show when toggled */}
      {showSearchForm && (
        <div className="bg-white border border-[#064d51]/20 rounded-xl shadow-sm overflow-hidden">
          {/* Header Row */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#064d51] to-[#1e9c99]">
            <div>Truck</div>
            <div>Origin</div>
            <div>Destination</div>
            <div>Avail</div>
            <div>DH-O</div>
            <div>DH-D</div>
            <div>F/P</div>
            <div>Length</div>
            <div>Weight</div>
            <div>Search Back</div>
            <div className="col-span-2"></div>
          </div>

          {/* Editable Search Row */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs items-center bg-[#f0fdfa]">
            {/* Truck Type with ANY/ONLY */}
            <div className="flex flex-col gap-1">
              <div className="flex gap-1">
                <button
                  onClick={() => handleFilterChange('truckTypeMode', 'ANY')}
                  className={`flex-1 px-2 py-0.5 text-xs font-bold rounded ${
                    filterValues.truckTypeMode === 'ANY'
                      ? 'bg-[#064d51] text-white'
                      : 'bg-white text-[#064d51] hover:bg-[#064d51]/10 border border-[#064d51]/20'
                  }`}
                >
                  ANY
                </button>
                <button
                  onClick={() => handleFilterChange('truckTypeMode', 'ONLY')}
                  className={`flex-1 px-2 py-0.5 text-xs font-bold rounded ${
                    filterValues.truckTypeMode === 'ONLY'
                      ? 'bg-[#064d51] text-white'
                      : 'bg-white text-[#064d51] hover:bg-[#064d51]/10 border border-[#064d51]/20'
                  }`}
                >
                  ONLY
                </button>
              </div>
              <select
                value={filterValues.truckType || ''}
                onChange={(e) => handleFilterChange('truckType', e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white"
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
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
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
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
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
                className="w-full px-2 py-1 text-xs bg-white border border-gray-300 rounded"
              />
            </div>

            {/* DH-O */}
            <div>
              <input
                type="number"
                value={filterValues.dhOrigin || ''}
                onChange={(e) => handleFilterChange('dhOrigin', e.target.value)}
                placeholder="km"
                className="w-full px-2 py-1 text-xs bg-white border border-gray-300 rounded"
              />
            </div>

            {/* DH-D */}
            <div>
              <input
                type="number"
                value={filterValues.dhDestination || ''}
                onChange={(e) => handleFilterChange('dhDestination', e.target.value)}
                placeholder="km"
                className="w-full px-2 py-1 text-xs bg-white border border-gray-300 rounded"
              />
            </div>

            {/* F/P */}
            <div>
              <select
                value={filterValues.fullPartial || ''}
                onChange={(e) => handleFilterChange('fullPartial', e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white"
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
                className="w-full px-2 py-1 text-xs bg-white border border-gray-300 rounded"
              />
            </div>

            {/* Weight */}
            <div>
              <input
                type="number"
                value={filterValues.weight || ''}
                onChange={(e) => handleFilterChange('weight', e.target.value)}
                placeholder="kg"
                className="w-full px-2 py-1 text-xs bg-white border border-gray-300 rounded"
              />
            </div>

            {/* Search Back (days) */}
            <div>
              <input
                type="number"
                value={filterValues.searchBack || ''}
                onChange={(e) => handleFilterChange('searchBack', e.target.value)}
                placeholder="days"
                className="w-full px-2 py-1 text-xs bg-white border border-gray-300 rounded"
              />
            </div>

            {/* Action Buttons */}
            <div className="col-span-2 flex gap-2 justify-end">
              <button
                onClick={fetchLoads}
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
            {loads.length} TOTAL RESULTS
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
          {loads.length} {loads.length === 1 ? 'MATCH' : 'MATCHES'}
        </h4>

        {/* Results Table - Matches SearchTrucksTab styling */}
        <div className="bg-white border border-[#064d51]/20 rounded-xl overflow-visible shadow-sm">
          {/* Table Header */}
          <div className="bg-gradient-to-r from-[#064d51] to-[#1e9c99] grid grid-cols-13 gap-2 px-4 py-3 rounded-t-xl text-xs font-semibold text-white">
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
            <div className="p-8 text-center text-gray-500">Loading loads...</div>
          ) : loads.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No loads found. Try adjusting your filters.</div>
          ) : (
            loads.map((load) => (
              <div
                key={load.id}
                className="grid grid-cols-13 gap-2 px-4 py-3 border-b border-[#064d51]/10 hover:bg-[#064d51]/5 cursor-pointer text-xs transition-colors"
                style={{ color: '#2B2727' }}
              >
                <div><DatAgeIndicator date={load.createdAt} /></div>
                <div>{load.pickupDate ? new Date(load.pickupDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) : 'N/A'}</div>
                <div>{load.truckType || 'N/A'}</div>
                <div>{load.fullPartial === 'FULL' ? 'F' : 'P'}</div>
                <div>{load.dhToOriginKm || '—'}</div>
                <div className="truncate">{load.pickupCity || 'N/A'}</div>
                <div>{load.tripKm || '—'}</div>
                <div className="truncate">{load.deliveryCity || 'N/A'}</div>
                <div>{load.dhAfterDeliveryKm || '—'}</div>
                <div className="truncate font-medium text-[#1e9c99] hover:underline cursor-pointer">
                  {load.shipper?.name || 'Anonymous'}
                </div>
                <div>{load.shipperContactPhone || 'N/A'}</div>
                <div>{load.lengthM ? `${load.lengthM}m` : 'N/A'}</div>
                <div>{load.weight ? `${load.weight.toLocaleString()}kg` : 'N/A'}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
