'use client';

/**
 * SEARCH LOADS Tab Component
 *
 * Advanced load search with rate analysis and company details
 * Sprint 14 - DAT-Style UI Transformation (Phase 5)
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
  DatRateAnalysis,
} from '@/components/dat-ui';
import { DatColumn, DatStatusTab, DatFilter, DatRowAction } from '@/types/dat-ui';

interface SearchLoadsTabProps {
  user: any;
}

type ResultsFilter = 'all' | 'PREFERRED' | 'BLOCKED';

export default function SearchLoadsTab({ user }: SearchLoadsTabProps) {
  const [loads, setLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ResultsFilter>('all');
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [selectedLoads, setSelectedLoads] = useState<string[]>([]);
  const [showNewSearchModal, setShowNewSearchModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [showRateAnalysis, setShowRateAnalysis] = useState(true);

  /**
   * Fetch loads based on filters
   */
  const fetchLoads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      // Apply filters
      if (filterValues.ageHours) {
        params.append('ageHours', filterValues.ageHours.toString());
      }
      if (filterValues.origin) {
        params.append('origin', filterValues.origin);
      }
      if (filterValues.destination) {
        params.append('destination', filterValues.destination);
      }
      if (filterValues.truckType) {
        params.append('truckType', filterValues.truckType);
      }
      if (filterValues.fullPartial) {
        params.append('fullPartial', filterValues.fullPartial);
      }
      if (filterValues.minWeight) {
        params.append('minWeight', filterValues.minWeight.toString());
      }
      if (filterValues.maxWeight) {
        params.append('maxWeight', filterValues.maxWeight.toString());
      }
      if (filterValues.minLength) {
        params.append('minLength', filterValues.minLength.toString());
      }
      if (filterValues.pickupFrom) {
        params.append('pickupFrom', filterValues.pickupFrom);
      }
      if (filterValues.showVerifiedOnly) {
        params.append('companyVerified', 'true');
      }
      if (filterValues.minRate) {
        params.append('minRate', filterValues.minRate.toString());
      }

      // Apply company preference filter
      if (activeFilter === 'PREFERRED') {
        params.append('isPreferred', 'true');
      } else if (activeFilter === 'BLOCKED') {
        params.append('isBlocked', 'true');
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
   * Fetch saved searches
   */
  const fetchSavedSearches = async () => {
    try {
      const response = await fetch('/api/saved-searches?type=LOADS');
      const data = await response.json();
      setSavedSearches(data.searches || []);
    } catch (error) {
      console.error('Failed to fetch saved searches:', error);
    }
  };

  useEffect(() => {
    fetchLoads();
    fetchSavedSearches();
  }, [activeFilter, filterValues]);

  /**
   * Calculate rate analysis for active search
   */
  const getRateAnalysis = () => {
    if (loads.length === 0) return null;

    // Calculate average rate per mile
    const ratesPerMile = loads
      .filter((l) => l.rate && l.tripKm)
      .map((l) => l.rate / l.tripKm);

    if (ratesPerMile.length === 0) return null;

    const avgRatePerMile = ratesPerMile.reduce((a, b) => a + b, 0) / ratesPerMile.length;

    // Calculate average rate per trip
    const avgRatePerTrip = loads
      .filter((l) => l.rate)
      .reduce((sum, l) => sum + l.rate, 0) / loads.filter((l) => l.rate).length;

    // Calculate average trip distance
    const avgTripKm = loads
      .filter((l) => l.tripKm)
      .reduce((sum, l) => sum + l.tripKm, 0) / loads.filter((l) => l.tripKm).length;

    // Calculate average speed (rough estimate)
    const avgSpeed = 65; // mph estimate

    // Calculate average age
    const avgAgeHours = loads.length > 0
      ? loads.reduce((sum, l) => {
          const ageMs = Date.now() - new Date(l.createdAt).getTime();
          return sum + (ageMs / (1000 * 60 * 60));
        }, 0) / loads.length
      : 0;

    return {
      ratePerMile: avgRatePerMile,
      ratePerTrip: avgRatePerTrip,
      totalMiles: avgTripKm,
      averageSpeed: avgSpeed,
      ageHours: avgAgeHours,
    };
  };

  const rateAnalysis = getRateAnalysis();

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
   * Handle saved search edit
   */
  const handleEditSearch = (searchId: string) => {
    alert(`Edit search modal coming soon for search ${searchId}`);
  };

  /**
   * Handle filter change
   */
  const handleFilterChange = (key: string, value: any) => {
    setFilterValues({ ...filterValues, [key]: value });
    setActiveSearchId(null);
  };

  /**
   * Handle filter reset
   */
  const handleFilterReset = () => {
    setFilterValues({});
    setActiveSearchId(null);
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
   * Handle load copy
   */
  const handleCopyLoad = (load: any) => {
    alert(`Copy load details: ${load.pickupCity} → ${load.deliveryCity}`);
  };

  /**
   * Results tabs configuration
   */
  const resultsTabs: DatStatusTab[] = [
    { key: 'all', label: 'ALL', count: loads.length },
    { key: 'PREFERRED', label: 'PREFERRED' },
    { key: 'BLOCKED', label: 'BLOCKED' },
  ];

  /**
   * Filter configuration
   */
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
    {
      key: 'origin',
      label: 'ORIGIN',
      type: 'text',
      placeholder: 'City name...',
    },
    {
      key: 'destination',
      label: 'DESTINATION',
      type: 'text',
      placeholder: 'City name...',
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
      key: 'weightRange',
      label: 'WEIGHT RANGE (kg)',
      type: 'range-slider',
      min: 0,
      max: 50000,
      step: 1000,
      unit: 'kg',
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
      key: 'minRate',
      label: 'MIN RATE (ETB)',
      type: 'slider',
      min: 0,
      max: 100000,
      step: 1000,
      unit: 'ETB',
    },
    {
      key: 'pickupFrom',
      label: 'PICKUP FROM',
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
      key: 'loadNumber',
      label: 'Load#',
      width: '100px',
      render: (_, row) => row.id.slice(0, 8).toUpperCase(),
    },
    {
      key: 'pickupDate',
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
      key: 'dhToOriginKm',
      label: 'DH-O',
      width: '80px',
      align: 'right' as const,
      render: (value) => value ? `${value}km` : 'N/A',
    },
    {
      key: 'pickupCity',
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
      key: 'deliveryCity',
      label: 'Destination',
      sortable: true,
    },
    {
      key: 'dhAfterDeliveryKm',
      label: 'DH-D',
      width: '80px',
      align: 'right' as const,
      render: (value) => value ? `${value}km` : 'N/A',
    },
    {
      key: 'company',
      label: 'Company',
      render: (_, row) => (
        <DatCompanyLink
          companyId={row.shipperId}
          companyName={row.shipper?.name || 'Unknown'}
          isMasked={!row.shipper?.allowNameDisplay}
          onClick={handleCompanyClick}
        />
      ),
    },
    {
      key: 'contact',
      label: 'Contact',
      width: '120px',
      render: (_, row) => row.shipperContactPhone || 'N/A',
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
      label: 'Rate',
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
      key: 'info',
      label: 'ℹ️',
      variant: 'primary',
      onClick: (load) => alert(`Info: ${load.pickupCity} → ${load.deliveryCity}`),
    },
    {
      key: 'rate',
      label: '💲',
      variant: 'secondary',
      onClick: (load) => alert(`Rate details for load ${load.id}`),
    },
    {
      key: 'book',
      label: '✓',
      variant: 'primary',
      onClick: (load) => alert(`Book load ${load.id}`),
    },
    {
      key: 'copy',
      label: 'COPY',
      variant: 'secondary',
      onClick: handleCopyLoad,
    },
  ];

  return (
    <div className="flex gap-4">
      {/* Left Sidebar - Rate Analysis & Saved Searches */}
      <div className="w-80 flex-shrink-0 space-y-4">
        {/* Rate Analysis Panel */}
        {rateAnalysis && showRateAnalysis && (
          <DatRateAnalysis
            rateType="SHIPPER-TO-CARRIER SPOT"
            ratePerMile={rateAnalysis.ratePerMile}
            ratePerTrip={rateAnalysis.ratePerTrip}
            totalMiles={rateAnalysis.totalMiles}
            averageSpeed={rateAnalysis.averageSpeed}
            ageHours={rateAnalysis.ageHours}
            onRateBias={() => alert('Rate bias analysis coming soon')}
            onEdit={() => setShowRateAnalysis(false)}
            onDelete={() => setShowRateAnalysis(false)}
          />
        )}

        {/* New Search Button */}
        <DatActionButton
          variant="secondary"
          size="md"
          onClick={() => setShowNewSearchModal(true)}
          icon="+"
          className="w-full"
        >
          NEW LOAD SEARCH
        </DatActionButton>

        {/* Saved Searches */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Saved Searches</h3>
          <DatSavedSearches
            searches={savedSearches}
            activeSearchId={activeSearchId}
            onSelect={handleSelectSearch}
            onDelete={handleDeleteSearch}
            onEdit={handleEditSearch}
            type="LOADS"
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-4">
        <h2 className="text-xl font-bold text-gray-900">SEARCH LOADS</h2>

        {/* Results Tabs */}
        <DatStatusTabs
          tabs={resultsTabs}
          activeTab={activeFilter}
          onTabChange={(tab) => setActiveFilter(tab as ResultsFilter)}
        />

        {/* Data Table with Checkboxes */}
        <DatDataTable
          columns={columns}
          data={loads}
          selectable={true}
          selectedRows={selectedLoads}
          onSelectionChange={setSelectedLoads}
          actions={rowActions}
          loading={loading}
          emptyMessage="No loads found matching your criteria. Try adjusting filters."
          rowKey="id"
        />

        {/* Selected Loads Info */}
        {selectedLoads.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-green-900 mb-2">
              {selectedLoads.length} LOADS SELECTED
            </h3>
            <div className="flex gap-2">
              <DatActionButton
                variant="primary"
                size="md"
                onClick={() => alert(`Book ${selectedLoads.length} loads`)}
              >
                BOOK SELECTED
              </DatActionButton>
              <button
                onClick={() => setSelectedLoads([])}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar - Filters */}
      <div className="w-80 flex-shrink-0">
        <DatFilterPanel
          title="Filters"
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

      {/* TODO: LoadSearchModal */}
      {showNewSearchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-bold mb-4">New Load Search</h3>
            <p className="text-gray-600 mb-4">Load search modal coming soon...</p>
            <button
              onClick={() => setShowNewSearchModal(false)}
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
