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
} from '@/components/dat-ui';
import { DatColumn, DatStatusTab, DatFilter, DatRowAction } from '@/types/dat-ui';
import TruckSearchModal from './TruckSearchModal';

interface SearchTrucksTabProps {
  user: any;
}

type ResultsFilter = 'all' | 'PREFERRED' | 'BLOCKED';

export default function SearchTrucksTab({ user }: SearchTrucksTabProps) {
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ResultsFilter>('all');
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [showNewSearchModal, setShowNewSearchModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);

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
      if (filterValues.minDhOrigin !== undefined) {
        params.append('minDhOriginKm', filterValues.minDhOrigin.toString());
      }
      if (filterValues.maxDhOrigin !== undefined) {
        params.append('maxDhOriginKm', filterValues.maxDhOrigin.toString());
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

  useEffect(() => {
    fetchTrucks();
    fetchSavedSearches();
  }, [activeFilter, filterValues]);

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
    { key: 'all', label: 'ALL', count: trucks.length },
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
      key: 'dhOrigin',
      label: 'DH-ORIGIN (km)',
      type: 'range-slider',
      min: 0,
      max: 500,
      step: 10,
      unit: 'km',
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
    {
      key: 'dhToOriginKm',
      label: 'DH-O',
      width: '80px',
      align: 'right' as const,
      render: (value) => value ? `${value}km` : 'N/A',
    },
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
      onClick: (row) => alert(`Book truck ${row.id}`),
    },
  ];

  return (
    <div className="flex gap-4">
      {/* Left Sidebar - Saved Searches */}
      <div className="w-80 flex-shrink-0">
        <div className="mb-4">
          <DatActionButton
            variant="secondary"
            size="md"
            onClick={() => setShowNewSearchModal(true)}
            icon="+"
            className="w-full"
          >
            NEW TRUCK SEARCH
          </DatActionButton>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Saved Searches</h3>
          <DatSavedSearches
            searches={savedSearches}
            activeSearchId={activeSearchId}
            onSelect={handleSelectSearch}
            onDelete={handleDeleteSearch}
            onEdit={handleEditSearch}
            type="TRUCKS"
          />
        </div>

        {/* Market Links */}
        <div className="mt-4 bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Market Intelligence</h3>
          <div className="space-y-2">
            <button className="w-full text-left text-sm text-blue-600 hover:text-blue-800 hover:underline">
              🗺️ Hot Market Map
            </button>
            <button className="w-full text-left text-sm text-blue-600 hover:text-blue-800 hover:underline">
              📊 LoadSkaters
            </button>
            <button className="w-full text-left text-sm text-blue-600 hover:text-blue-800 hover:underline">
              📈 Market Trends
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-4">
        <h2 className="text-xl font-bold text-gray-900">SEARCH TRUCKS</h2>

        {/* Results Tabs */}
        <DatStatusTabs
          tabs={resultsTabs}
          activeTab={activeFilter}
          onTabChange={(tab) => setActiveFilter(tab as ResultsFilter)}
        />

        {/* Data Table */}
        <DatDataTable
          columns={columns}
          data={trucks}
          actions={rowActions}
          loading={loading}
          emptyMessage="No trucks found matching your criteria. Try adjusting filters."
          rowKey="id"
        />

        {/* Exact Matches Section */}
        {trucks.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              {trucks.length} EXACT MATCHES
            </h3>
            <p className="text-xs text-blue-700">
              These trucks match your search criteria perfectly
            </p>
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

      {/* Truck Search Modal */}
      <TruckSearchModal
        isOpen={showNewSearchModal}
        onClose={() => setShowNewSearchModal(false)}
        onSuccess={(searchId) => {
          fetchSavedSearches();
          setActiveSearchId(searchId);
          const search = savedSearches.find((s) => s.id === searchId);
          if (search) {
            setFilterValues(search.criteria || {});
          }
        }}
      />
    </div>
  );
}
