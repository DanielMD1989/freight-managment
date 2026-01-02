'use client';

/**
 * POST TRUCKS Tab Component
 *
 * Main carrier interface for posting trucks and viewing matching loads
 * Sprint 14 - DAT-Style UI Transformation (Phase 4)
 * Updated to match DAT Power UI design
 */

import React, { useState, useEffect } from 'react';
import {
  DatStatusTabs,
  DatDataTable,
  DatActionButton,
  DatAgeIndicator,
} from '@/components/dat-ui';
import { DatColumn, DatStatusTab, DatRowAction } from '@/types/dat-ui';
import PlacesAutocomplete, { PlaceResult } from '@/components/PlacesAutocomplete';

interface PostTrucksTabProps {
  user: any;
}

type TruckStatus = 'all' | 'mine' | 'group' | 'POSTED' | 'UNPOSTED' | 'EXPIRED' | 'KEPT';
type LoadTab = 'all' | 'preferred' | 'blocked';

export default function PostTrucksTab({ user }: PostTrucksTabProps) {
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<TruckStatus>('all');
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);
  const [expandedTruckId, setExpandedTruckId] = useState<string | null>(null);
  const [matchingLoads, setMatchingLoads] = useState<any[]>([]);
  const [editingTruckId, setEditingTruckId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [showNewTruckForm, setShowNewTruckForm] = useState(false);
  const [activeLoadTab, setActiveLoadTab] = useState<LoadTab>('all');

  // New truck form state
  const [newTruckForm, setNewTruckForm] = useState({
    availableFrom: '',
    availableTo: '',
    owner: '',
    origin: '',
    destination: '',
    truckType: 'DRY_VAN',
    fullPartial: 'FULL',
    lengthM: '',
    weight: '',
    contactPhone: '',
    comments1: '',
    comments2: '',
    // Sprint 16: GPS fields
    imei: '',
    gpsProvider: '',
  });

  // Ethiopian cities
  const [ethiopianCities, setEthiopianCities] = useState<any[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);

  // Matching loads filters
  const [loadFilters, setLoadFilters] = useState({
    dhOrigin: '',
    dhDestination: '',
    fullPartial: '',
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
  }, []);

  /**
   * Fetch trucks
   */
  const fetchTrucks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('includeMatchCount', 'true');

      if (activeStatus === 'mine') {
        params.append('organizationId', user.organizationId);
      } else if (activeStatus === 'group') {
        // TODO: Implement group filtering
        params.append('groupId', 'placeholder');
      } else if (activeStatus === 'KEPT') {
        params.append('isKept', 'true');
      } else if (activeStatus !== 'all') {
        params.append('status', activeStatus);
      }

      const response = await fetch(`/api/truck-postings?${params.toString()}`);
      const data = await response.json();

      const trucksData = data.truckPostings || [];

      // Fetch match counts for POSTED/ACTIVE trucks in parallel
      const trucksWithMatchCounts = await Promise.all(
        trucksData.map(async (truck: any) => {
          if (truck.status === 'POSTED' || truck.status === 'ACTIVE') {
            try {
              const matchResponse = await fetch(`/api/truck-postings/${truck.id}/matching-loads?limit=1`);
              const matchData = await matchResponse.json();
              return { ...truck, matchCount: matchData.totalMatches || 0 };
            } catch (error) {
              console.error(`Failed to fetch matches for truck ${truck.id}:`, error);
              return { ...truck, matchCount: 0 };
            }
          }
          return { ...truck, matchCount: 0 };
        })
      );

      setTrucks(trucksWithMatchCounts);

      // Calculate status counts
      const counts: Record<string, number> = {
        all: data.pagination?.total || 0,
        mine: 0,
        group: 0,
        POSTED: 0,
        UNPOSTED: 0,
        EXPIRED: 0,
        KEPT: 0,
      };

      // Fetch counts for each status
      const statusPromises = ['POSTED', 'UNPOSTED', 'EXPIRED'].map(async (status) => {
        const res = await fetch(`/api/truck-postings?status=${status}&limit=1`);
        const json = await res.json();
        counts[status] = json.pagination?.total || 0;
      });

      // Fetch MINE count
      const mineRes = await fetch(`/api/truck-postings?organizationId=${user.organizationId}&limit=1`);
      const mineData = await mineRes.json();
      counts.mine = mineData.pagination?.total || 0;

      // Fetch KEPT count
      const keptRes = await fetch('/api/truck-postings?isKept=true&limit=1');
      const keptData = await keptRes.json();
      counts.KEPT = keptData.pagination?.total || 0;

      await Promise.all(statusPromises);
      setStatusCounts(counts);
    } catch (error) {
      console.error('Failed to fetch trucks:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch matching loads for a truck
   */
  const fetchMatchingLoads = async (truckId: string) => {
    setLoadingMatches(true);
    try {
      const response = await fetch(`/api/truck-postings/${truckId}/matching-loads?limit=50`);
      const data = await response.json();
      return data.matches || [];
    } catch (error) {
      console.error('Failed to fetch matching loads:', error);
      return [];
    } finally {
      setLoadingMatches(false);
    }
  };

  /**
   * Fetch all matching loads for all posted trucks
   */
  const fetchAllMatchingLoads = async () => {
    setLoadingMatches(true);
    try {
      // Get all posted trucks
      const postedTrucks = trucks.filter(t => t.status === 'POSTED' || t.status === 'ACTIVE');

      if (postedTrucks.length === 0) {
        setMatchingLoads([]);
        setLoadingMatches(false);
        return;
      }

      // Fetch matching loads for each truck
      const allLoadsPromises = postedTrucks.map(truck =>
        fetch(`/api/truck-postings/${truck.id}/matching-loads?limit=100`)
          .then(res => res.json())
          .then(data => data.matches || [])
          .catch(err => {
            console.error(`Failed to fetch loads for truck ${truck.id}:`, err);
            return [];
          })
      );

      const loadsArrays = await Promise.all(allLoadsPromises);

      // Flatten and deduplicate loads by id
      const allLoads = loadsArrays.flat();
      const uniqueLoads = Array.from(
        new Map(allLoads.map(load => [load.load?.id || load.id, load])).values()
      );

      setMatchingLoads(uniqueLoads);
    } catch (error) {
      console.error('Failed to fetch all matching loads:', error);
      setMatchingLoads([]);
    } finally {
      setLoadingMatches(false);
    }
  };

  useEffect(() => {
    fetchTrucks();
  }, [activeStatus]);

  useEffect(() => {
    // Fetch matching loads when trucks are loaded
    if (trucks.length > 0) {
      fetchAllMatchingLoads();
    }
  }, [trucks]);

  /**
   * Handle truck row click - show matching loads
   */
  const handleTruckClick = (truck: any) => {
    if (selectedTruckId === truck.id) {
      setSelectedTruckId(null);
      setMatchingLoads([]);
    } else {
      setSelectedTruckId(truck.id);
      fetchMatchingLoads(truck.id);
    }
  };

  /**
   * Handle COPY action
   */
  const handleCopy = async (truck: any) => {
    try {
      const response = await fetch(`/api/truck-postings/${truck.id}/duplicate`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to duplicate truck');

      const newTruck = await response.json();
      alert(`Truck posting copied successfully!`);
      fetchTrucks();
    } catch (error) {
      console.error('Copy failed:', error);
      alert('Failed to copy truck posting');
    }
  };

  /**
   * Handle DELETE action
   */
  const handleDelete = async (truck: any) => {
    if (!confirm(`Are you sure you want to delete this truck posting?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/truck-postings/${truck.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete truck');

      alert('Truck posting deleted successfully');
      fetchTrucks();
      if (selectedTruckId === truck.id) {
        setSelectedTruckId(null);
        setMatchingLoads([]);
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete truck posting');
    }
  };

  /**
   * Handle new truck form submission
   */
  const handlePostTruck = async () => {
    // Validate required fields
    if (!newTruckForm.origin || !newTruckForm.availableFrom || !newTruckForm.contactPhone) {
      alert('Please fill in all required fields: Origin, Available Date, and Contact Phone');
      return;
    }

    try {
      // Find first truck from user's organization
      const trucksResponse = await fetch(`/api/trucks?organizationId=${user.organizationId}&limit=1`);
      const trucksData = await trucksResponse.json();
      const userTruck = trucksData.trucks?.[0];

      if (!userTruck) {
        alert('No truck found for your organization. Please add a truck first.');
        return;
      }

      const response = await fetch('/api/truck-postings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'temp-token',
        },
        body: JSON.stringify({
          truckId: userTruck.id,
          originCityId: newTruckForm.origin,
          destinationCityId: newTruckForm.destination || null,
          availableFrom: newTruckForm.availableFrom,
          availableTo: newTruckForm.availableTo || null,
          fullPartial: newTruckForm.fullPartial,
          availableLength: newTruckForm.lengthM ? parseFloat(newTruckForm.lengthM) : null,
          availableWeight: newTruckForm.weight ? parseFloat(newTruckForm.weight) : null,
          ownerName: newTruckForm.owner || null,
          contactName: user.firstName + ' ' + user.lastName,
          contactPhone: newTruckForm.contactPhone,
          notes: (newTruckForm.comments1 + '\n' + newTruckForm.comments2).trim() || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create truck posting');
      }

      const newTruck = await response.json();
      alert('Truck posting created successfully!');

      // Reset form
      setNewTruckForm({
        availableFrom: '',
        availableTo: '',
        owner: '',
        origin: '',
        destination: '',
        truckType: 'DRY_VAN',
        fullPartial: 'FULL',
        lengthM: '',
        weight: '',
        contactPhone: '',
        comments1: '',
        comments2: '',
        // Sprint 16: GPS fields
        imei: '',
        gpsProvider: '',
      });

      setShowNewTruckForm(false);

      // Refresh trucks (matching loads will be fetched automatically via useEffect)
      await fetchTrucks();
    } catch (error: any) {
      console.error('Create truck posting error:', error);
      alert(error.message || 'Failed to create truck posting');
    }
  };

  /**
   * Status tabs configuration
   */
  const statusTabs: DatStatusTab[] = [
    { key: 'group', label: 'GROUP', count: statusCounts.group },
    { key: 'mine', label: 'MINE', count: statusCounts.mine },
    { key: 'all', label: 'ALL', count: statusCounts.all },
    { key: 'POSTED', label: 'POSTED', count: statusCounts.POSTED },
    { key: 'UNPOSTED', label: 'UNPOSTED', count: statusCounts.UNPOSTED },
    { key: 'EXPIRED', label: 'EXPIRED', count: statusCounts.EXPIRED },
    { key: 'KEPT', label: 'KEPT', count: statusCounts.KEPT },
  ];

  /**
   * Handle toggle keep/star
   */
  const handleToggleKeep = async (truck: any) => {
    // TODO: Implement keep/star toggle
    alert('Keep/Star functionality coming soon');
  };

  /**
   * Truck table columns
   */
  const truckColumns: DatColumn[] = [
    {
      key: 'isKept',
      label: 'Keep',
      width: '60px',
      align: 'center' as const,
      render: (value, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleToggleKeep(row);
          }}
          className="text-xl hover:scale-110 transition-transform"
        >
          {value ? '★' : '☆'}
        </button>
      ),
    },
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
          ${value === 'ACTIVE' ? 'bg-green-100 text-green-800' : ''}
          ${value === 'POSTED' ? 'bg-green-100 text-green-800' : ''}
          ${value === 'UNPOSTED' ? 'bg-gray-100 text-gray-800' : ''}
          ${value === 'EXPIRED' ? 'bg-red-100 text-red-800' : ''}
        `}>
          {value}
        </span>
      ),
    },
    {
      key: 'availableFrom',
      label: 'Avail',
      width: '120px',
      render: (value, row) => {
        const from = value ? new Date(value).toLocaleDateString() : 'Now';
        const to = row.availableTo ? new Date(row.availableTo).toLocaleDateString() : '';
        return to ? `${from}-${to}` : from;
      },
    },
    {
      key: 'ownerName',
      label: 'Owner',
      width: '120px',
      render: (value) => value || 'N/A',
    },
    {
      key: 'currentCity',
      label: 'Origin',
      sortable: true,
      render: (value, row) => {
        // Handle if value is an object with name property
        if (typeof value === 'object' && value?.name) {
          return value.name;
        }
        // Handle if originCity object exists
        if (row.originCity?.name) {
          return row.originCity.name;
        }
        return value || 'N/A';
      },
    },
    {
      key: 'destinationCity',
      label: 'Destination',
      sortable: true,
      render: (value, row) => {
        // Handle if value is an object with name property
        if (typeof value === 'object' && value?.name) {
          return value.name;
        }
        // Handle if destinationCity object exists
        if (row.destinationCity?.name) {
          return row.destinationCity.name;
        }
        return value || 'Anywhere';
      },
    },
    {
      key: 'truckType',
      label: 'Truck',
      width: '100px',
      render: (value) => value?.replace('_', ' ') || 'N/A',
    },
    // Sprint 16: GPS Status Column
    {
      key: 'truck',
      label: 'GPS',
      width: '80px',
      align: 'center' as const,
      render: (_, row) => {
        const truck = row.truck;
        if (!truck || !truck.imei) {
          return <span className="text-gray-400 text-xs">-</span>;
        }

        const statusColors = {
          ACTIVE: 'bg-green-100 text-green-700 border-green-300',
          SIGNAL_LOST: 'bg-yellow-100 text-yellow-700 border-yellow-300',
          INACTIVE: 'bg-red-100 text-red-700 border-red-300',
          MAINTENANCE: 'bg-gray-100 text-gray-700 border-gray-300',
        };

        const statusDots = {
          ACTIVE: '🟢',
          SIGNAL_LOST: '🟡',
          INACTIVE: '🔴',
          MAINTENANCE: '⚪',
        };

        const status = truck.gpsStatus || 'INACTIVE';
        const validStatus = status as keyof typeof statusColors;

        return (
          <span className={`
            px-2 py-1 rounded text-xs font-semibold border
            ${statusColors[validStatus] || statusColors.INACTIVE}
          `}>
            {statusDots[validStatus] || '⚫'} GPS
          </span>
        );
      },
    },
    {
      key: 'fullPartial',
      label: 'F/P',
      width: '60px',
      align: 'center' as const,
      render: (value) => value === 'FULL' ? 'Full' : 'Partial',
    },
    {
      key: 'availableLength',
      label: 'Length',
      width: '80px',
      align: 'right' as const,
      render: (value) => value ? `${value}m` : 'N/A',
    },
    {
      key: 'availableWeight',
      label: 'Weight',
      width: '100px',
      align: 'right' as const,
      render: (value) => value ? `${value}kg` : 'N/A',
    },
    {
      key: 'matchCount',
      label: 'Loads',
      width: '100px',
      align: 'center' as const,
      render: (value, row) => {
        if (row.status !== 'POSTED' && row.status !== 'ACTIVE') {
          return <span className="text-gray-400">-</span>;
        }
        const count = value || 0;
        return (
          <span className={`
            px-2 py-1 rounded text-xs font-semibold
            ${count > 0 ? 'bg-lime-100 text-lime-800' : 'bg-gray-100 text-gray-600'}
          `}>
            {count} LOADS
          </span>
        );
      },
    },
  ];

  /**
   * Matching loads table columns
   */
  const loadColumns: DatColumn[] = [
    {
      key: 'age',
      label: 'Age',
      width: '60px',
      render: (_, row) => <DatAgeIndicator date={row.createdAt} />,
    },
    {
      key: 'pickupDate',
      label: 'Pickup',
      width: '90px',
      render: (value) => value ? new Date(value).toLocaleDateString() : 'N/A',
    },
    {
      key: 'truckType',
      label: 'Truck',
      width: '80px',
      render: (value) => value?.replace('_', ' ') || 'N/A',
    },
    {
      key: 'fullPartial',
      label: 'F/P',
      width: '40px',
      align: 'center' as const,
      render: (value) => value === 'FULL' ? 'F' : 'P',
    },
    {
      key: 'dhToOriginKm',
      label: 'DH-O',
      width: '60px',
      align: 'right' as const,
      render: (value) => value ? `${value}` : '-',
    },
    {
      key: 'pickupCity',
      label: 'Origin',
      width: '100px',
    },
    {
      key: 'tripKm',
      label: 'Trip',
      width: '60px',
      align: 'right' as const,
      render: (value) => value ? `${value}` : '-',
    },
    {
      key: 'deliveryCity',
      label: 'Destination',
      width: '100px',
    },
    {
      key: 'dhAfterDeliveryKm',
      label: 'DH-D',
      width: '60px',
      align: 'right' as const,
      render: (value) => value ? `${value}` : '-',
    },
    {
      key: 'shipper',
      label: 'Company',
      width: '140px',
      render: (_, row) => (
        <span className="text-blue-600 hover:underline cursor-pointer">
          {row.shipper?.name || 'N/A'}
        </span>
      ),
    },
    {
      key: 'shipperContactPhone',
      label: 'Contact',
      width: '110px',
      render: (value) => value || 'N/A',
    },
    {
      key: 'lengthM',
      label: 'Length',
      width: '60px',
      align: 'right' as const,
      render: (value) => value ? `${value}` : '-',
    },
    {
      key: 'weight',
      label: 'Weight',
      width: '70px',
      align: 'right' as const,
      render: (value) => value ? `${value} lbs` : '-',
    },
  ];

  /**
   * Handle EDIT action
   */
  const handleEdit = async (truck: any) => {
    // Parse notes to extract comments
    const notesLines = truck.notes?.split('\n') || [];

    // Format dates for date input (YYYY-MM-DD)
    const formatDate = (date: any) => {
      if (!date) return '';
      try {
        const d = new Date(date);
        return d.toISOString().split('T')[0];
      } catch {
        return '';
      }
    };

    setEditingTruckId(truck.id);
    setEditForm({
      availableFrom: formatDate(truck.availableFrom),
      availableTo: formatDate(truck.availableTo),
      owner: truck.ownerName || '',
      origin: truck.originCityId || '',
      destination: truck.destinationCityId || '',
      truckType: truck.truck?.truckType || 'DRY_VAN',
      fullPartial: truck.fullPartial || 'FULL',
      lengthM: truck.availableLength || '',
      weight: truck.availableWeight || '',
      contactPhone: truck.contactPhone || '',
      comments1: notesLines[0] || '',
      comments2: notesLines[1] || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingTruckId) return;

    try {
      const response = await fetch(`/api/truck-postings/${editingTruckId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          availableFrom: editForm.availableFrom,
          availableTo: editForm.availableTo || null,
          originCityId: editForm.origin,
          destinationCityId: editForm.destination || null,
          fullPartial: editForm.fullPartial,
          availableLength: editForm.lengthM ? parseFloat(editForm.lengthM) : null,
          availableWeight: editForm.weight ? parseFloat(editForm.weight) : null,
          ownerName: editForm.owner || null,
          contactPhone: editForm.contactPhone,
          notes: (editForm.comments1 + '\n' + editForm.comments2).trim() || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to update truck posting');

      alert('Truck posting updated successfully!');
      setEditingTruckId(null);
      setEditForm({});
      fetchTrucks();
    } catch (error: any) {
      console.error('Update failed:', error);
      alert(error.message || 'Failed to update truck posting');
    }
  };

  const handleCancelEdit = () => {
    setEditingTruckId(null);
    setEditForm({});
  };

  /**
   * Truck row actions
   */
  /**
   * Filter matching loads based on active tab and filters
   */
  const filteredMatchingLoads = matchingLoads
    .map(match => {
      // Extract load from match object (API returns { load: {...}, matchScore: X })
      const load = match.load || match;
      return { ...match, load };
    })
    .filter(({ load }) => {
      if (!load) return false;

      // Tab filtering
      if (activeLoadTab === 'preferred') {
        // TODO: Implement preferred company logic
        return false;
      }
      if (activeLoadTab === 'blocked') {
        // TODO: Implement blocked company logic
        return false;
      }

      // Filter by DH-O, DH-D, F/P
      if (loadFilters.dhOrigin && load.dhToOriginKm > parseInt(loadFilters.dhOrigin)) {
        return false;
      }
      if (loadFilters.dhDestination && load.dhAfterDeliveryKm > parseInt(loadFilters.dhDestination)) {
        return false;
      }
      if (loadFilters.fullPartial && load.fullPartial !== loadFilters.fullPartial) {
        return false;
      }

      return true;
    })
    .map(match => match.load); // Return just the load object for the table

  return (
    <div className="space-y-4">
      {/* Header with NEW TRUCK POST button */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowNewTruckForm(!showNewTruckForm)}
          className="flex items-center gap-2 px-4 py-2 bg-lime-500 text-white text-sm font-bold rounded hover:bg-lime-600 transition-colors"
        >
          NEW TRUCK POST
        </button>
      </div>

      {/* Inline New Truck Form */}
      {showNewTruckForm && (
        <div className="border-b border-gray-400 p-4" style={{ backgroundColor: '#F3F2F2' }}>
          {/* Main Form Row */}
          <div className="grid grid-cols-12 gap-2 mb-4 items-end">
            {/* Alert Checkbox */}
            <div className="flex items-center gap-1 pt-5">
              <input type="checkbox" className="w-4 h-4" />
              <span className="text-lg cursor-pointer" style={{ color: '#2B2727' }}>☆</span>
            </div>

            {/* Empty columns for Age and Status */}
            <div></div>
            <div></div>

            {/* Avail From */}
            <div>
              <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>Avail From *</label>
              <input
                type="date"
                value={newTruckForm.availableFrom}
                onChange={(e) => setNewTruckForm({...newTruckForm, availableFrom: e.target.value})}
                className="w-full px-2 py-1 text-xs !bg-white border border-gray-400 rounded"
                style={{ color: '#2B2727' }}
                required
              />
            </div>

            {/* Owner */}
            <div>
              <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>Owner</label>
              <input
                type="text"
                value={newTruckForm.owner}
                onChange={(e) => setNewTruckForm({...newTruckForm, owner: e.target.value})}
                className="w-full px-2 py-1 text-xs !bg-white border border-gray-400 rounded"
                style={{ color: '#2B2727' }}
                placeholder="Owner"
              />
            </div>

            {/* Origin */}
            <div>
              <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>Origin *</label>
              <PlacesAutocomplete
                value={newTruckForm.origin}
                onChange={(value, place) => {
                  setNewTruckForm({
                    ...newTruckForm,
                    origin: value,
                    originCoordinates: place?.coordinates
                  });
                }}
                placeholder="Search city..."
                className="w-full px-2 py-1 text-xs !bg-white border border-gray-400 rounded"
                countryRestriction={['ET', 'DJ']}
                types={['(cities)']}
                required
              />
            </div>

            {/* Destination */}
            <div>
              <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>Destination</label>
              <PlacesAutocomplete
                value={newTruckForm.destination}
                onChange={(value, place) => {
                  setNewTruckForm({
                    ...newTruckForm,
                    destination: value,
                    destinationCoordinates: place?.coordinates
                  });
                }}
                placeholder="Anywhere"
                className="w-full px-2 py-1 text-xs !bg-white border border-gray-400 rounded"
                countryRestriction={['ET', 'DJ']}
                types={['(cities)']}
              />
            </div>

            {/* Truck Type */}
            <div>
              <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>Truck *</label>
              <select
                value={newTruckForm.truckType}
                onChange={(e) => setNewTruckForm({...newTruckForm, truckType: e.target.value})}
                className="w-full px-2 py-1 text-xs !bg-white border border-gray-400 rounded"
                style={{ color: '#2B2727' }}
              >
                <option value="DRY_VAN">Van</option>
                <option value="FLATBED">Flatbed</option>
                <option value="REFRIGERATED">Reefer</option>
                <option value="TANKER">Tanker</option>
              </select>
            </div>

            {/* F/P */}
            <div>
              <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>F/P</label>
              <select
                value={newTruckForm.fullPartial}
                onChange={(e) => setNewTruckForm({...newTruckForm, fullPartial: e.target.value})}
                className="w-full px-2 py-1 text-xs !bg-white border border-gray-400 rounded"
                style={{ color: '#2B2727' }}
              >
                <option value="FULL">Full</option>
                <option value="PARTIAL">Partial</option>
              </select>
            </div>

            {/* Length */}
            <div>
              <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>Length</label>
              <input
                type="number"
                value={newTruckForm.lengthM}
                onChange={(e) => setNewTruckForm({...newTruckForm, lengthM: e.target.value})}
                className="w-full px-2 py-1 text-xs !bg-white border border-gray-400 rounded"
                style={{ color: '#2B2727' }}
                placeholder="52"
              />
            </div>

            {/* Weight */}
            <div>
              <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>Weight</label>
              <input
                type="number"
                value={newTruckForm.weight}
                onChange={(e) => setNewTruckForm({...newTruckForm, weight: e.target.value})}
                className="w-full px-2 py-1 text-xs !bg-white border border-gray-400 rounded"
                style={{ color: '#2B2727' }}
                placeholder="48000"
              />
            </div>
          </div>

          {/* Comments and Actions Row */}
          <div className="grid grid-cols-3 gap-4">
            {/* Comments 1 */}
            <div>
              <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>
                Comments 1 <span className="text-gray-500">({newTruckForm.comments1.length}/70 max)</span>
              </label>
              <textarea
                value={newTruckForm.comments1}
                onChange={(e) => setNewTruckForm({...newTruckForm, comments1: e.target.value.slice(0, 70)})}
                className="w-full px-3 py-2 !bg-white border border-gray-400 rounded resize-none"
                style={{ color: '#2B2727' }}
                rows={3}
                maxLength={70}
              />
            </div>

            {/* Comments 2 */}
            <div>
              <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>
                Comments 2 <span className="text-gray-500">({newTruckForm.comments2.length}/70 max)</span>
              </label>
              <textarea
                value={newTruckForm.comments2}
                onChange={(e) => setNewTruckForm({...newTruckForm, comments2: e.target.value.slice(0, 70)})}
                className="w-full px-3 py-2 !bg-white border border-gray-400 rounded resize-none"
                style={{ color: '#2B2727' }}
                rows={3}
                maxLength={70}
              />
            </div>

            {/* Contact and GPS */}
            <div className="space-y-2">
              <div>
                <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>Contact Phone *</label>
                <input
                  type="tel"
                  value={newTruckForm.contactPhone}
                  onChange={(e) => setNewTruckForm({...newTruckForm, contactPhone: e.target.value})}
                  className="w-full px-3 py-2 text-xs !bg-white border border-gray-400 rounded"
                  style={{ color: '#2B2727' }}
                  placeholder="+251-9xx-xxx-xxx"
                  required
                />
              </div>

              {/* Sprint 16: GPS IMEI */}
              <div>
                <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>
                  GPS IMEI <span className="text-gray-500">(Optional - 15 digits)</span>
                </label>
                <input
                  type="text"
                  value={newTruckForm.imei}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 15);
                    setNewTruckForm({...newTruckForm, imei: value});
                  }}
                  className="w-full px-3 py-2 text-xs !bg-white border border-gray-400 rounded"
                  style={{ color: '#2B2727' }}
                  placeholder="359000000000000"
                  maxLength={15}
                />
                {newTruckForm.imei && newTruckForm.imei.length === 15 && (
                  <div className="mt-1 text-xs text-green-600 flex items-center gap-1">
                    <span>✓</span> GPS-equipped badge will be displayed
                  </div>
                )}
                {newTruckForm.imei && newTruckForm.imei.length > 0 && newTruckForm.imei.length !== 15 && (
                  <div className="mt-1 text-xs text-amber-600">
                    ⚠ IMEI must be exactly 15 digits
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handlePostTruck}
                  className="flex-1 px-6 py-2 bg-cyan-400 text-white font-medium rounded hover:bg-cyan-500 transition-colors"
                >
                  + POST
                </button>
                <button
                  onClick={() => setShowNewTruckForm(false)}
                  className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 transition-colors font-bold"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Filter Tabs */}
      <DatStatusTabs
        tabs={statusTabs}
        activeTab={activeStatus}
        onTabChange={(tab) => setActiveStatus(tab as TruckStatus)}
      />

      {/* Truck Posts Table */}
      <div className="bg-white rounded-lg overflow-hidden mb-4">
        <DatDataTable
          columns={truckColumns}
          data={trucks}
          loading={loading}
          emptyMessage="No truck postings found. Click NEW TRUCK POST to create one."
          rowKey="id"
          expandable={true}
          onRowClick={(truck) => {
            if (expandedTruckId === truck.id) {
              setExpandedTruckId(null);
            } else {
              setExpandedTruckId(truck.id);
            }
          }}
          renderExpandedRow={(truck) => {
            const notesLines = truck.notes?.split('\n') || [];
            const comments1 = notesLines[0] || '';
            const comments2 = notesLines[1] || '';
            const isEditing = editingTruckId === truck.id;

            return (
              <div className="p-4 border border-gray-400" style={{ backgroundColor: '#F3F2F2' }}>
                {isEditing ? (
                  /* Edit Mode - Full Form */
                  <div className="space-y-3">
                    {/* Main Form Row - Grid matching table columns */}
                    <div className="grid grid-cols-12 gap-2 items-end">
                      {/* Empty columns for checkbox and star */}
                      <div></div>
                      {/* Empty columns for Age and Status */}
                      <div></div>
                      <div></div>

                      {/* Avail From */}
                      <div>
                        <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>Avail From *</label>
                        <input
                          type="date"
                          value={editForm.availableFrom || ''}
                          onChange={(e) => setEditForm({...editForm, availableFrom: e.target.value})}
                          className="w-full px-2 py-1 text-xs !bg-white border border-gray-400 rounded"
                          style={{ color: '#2B2727' }}
                          required
                        />
                      </div>

                      {/* Owner */}
                      <div>
                        <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>Owner</label>
                        <input
                          type="text"
                          value={editForm.owner || ''}
                          onChange={(e) => setEditForm({...editForm, owner: e.target.value})}
                          className="w-full px-2 py-1 text-xs !bg-white border border-gray-400 rounded"
                          style={{ color: '#2B2727' }}
                          placeholder="Owner"
                        />
                      </div>

                      {/* Origin */}
                      <div>
                        <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>Origin *</label>
                        <PlacesAutocomplete
                          value={editForm.origin || ''}
                          onChange={(value, place) => {
                            setEditForm({
                              ...editForm,
                              origin: value,
                              originCoordinates: place?.coordinates
                            });
                          }}
                          placeholder="Search city..."
                          className="w-full px-2 py-1 text-xs !bg-white border border-gray-400 rounded"
                          countryRestriction={['ET', 'DJ']}
                          types={['(cities)']}
                          required
                        />
                      </div>

                      {/* Destination */}
                      <div>
                        <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>Destination</label>
                        <PlacesAutocomplete
                          value={editForm.destination || ''}
                          onChange={(value, place) => {
                            setEditForm({
                              ...editForm,
                              destination: value,
                              destinationCoordinates: place?.coordinates
                            });
                          }}
                          placeholder="Anywhere"
                          className="w-full px-2 py-1 text-xs !bg-white border border-gray-400 rounded"
                          countryRestriction={['ET', 'DJ']}
                          types={['(cities)']}
                        />
                      </div>

                      {/* Truck Type */}
                      <div>
                        <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>Truck *</label>
                        <select
                          value={editForm.truckType || 'DRY_VAN'}
                          onChange={(e) => setEditForm({...editForm, truckType: e.target.value})}
                          className="w-full px-2 py-1 text-xs !bg-white border border-gray-400 rounded"
                          style={{ color: '#2B2727' }}
                        >
                          <option value="DRY_VAN">Van</option>
                          <option value="FLATBED">Flatbed</option>
                          <option value="REFRIGERATED">Reefer</option>
                          <option value="TANKER">Tanker</option>
                        </select>
                      </div>

                      {/* F/P */}
                      <div>
                        <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>F/P</label>
                        <select
                          value={editForm.fullPartial || 'FULL'}
                          onChange={(e) => setEditForm({...editForm, fullPartial: e.target.value})}
                          className="w-full px-2 py-1 text-xs !bg-white border border-gray-400 rounded"
                          style={{ color: '#2B2727' }}
                        >
                          <option value="FULL">Full</option>
                          <option value="PARTIAL">Partial</option>
                        </select>
                      </div>

                      {/* Length */}
                      <div>
                        <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>Length</label>
                        <input
                          type="number"
                          value={editForm.lengthM || ''}
                          onChange={(e) => setEditForm({...editForm, lengthM: e.target.value})}
                          className="w-full px-2 py-1 text-xs !bg-white border border-gray-400 rounded"
                          style={{ color: '#2B2727' }}
                          placeholder="52"
                        />
                      </div>

                      {/* Weight */}
                      <div>
                        <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>Weight</label>
                        <input
                          type="number"
                          value={editForm.weight || ''}
                          onChange={(e) => setEditForm({...editForm, weight: e.target.value})}
                          className="w-full px-2 py-1 text-xs !bg-white border border-gray-400 rounded"
                          style={{ color: '#2B2727' }}
                          placeholder="48000"
                        />
                      </div>
                    </div>

                    {/* Bottom Section: Comments and Actions */}
                    <div className="grid grid-cols-3 gap-4">
                      {/* Comments 1 */}
                      <div>
                        <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>
                          Comments 1 <span className="text-gray-500">({editForm.comments1?.length || 0}/70 max)</span>
                        </label>
                        <textarea
                          value={editForm.comments1 || ''}
                          onChange={(e) => setEditForm({...editForm, comments1: e.target.value.slice(0, 70)})}
                          className="w-full px-3 py-2 !bg-white border border-gray-400 rounded resize-none"
                          style={{ color: '#2B2727' }}
                          rows={3}
                          maxLength={70}
                        />
                      </div>

                      {/* Comments 2 */}
                      <div>
                        <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>
                          Comments 2 <span className="text-gray-500">({editForm.comments2?.length || 0}/70 max)</span>
                        </label>
                        <textarea
                          value={editForm.comments2 || ''}
                          onChange={(e) => setEditForm({...editForm, comments2: e.target.value.slice(0, 70)})}
                          className="w-full px-3 py-2 !bg-white border border-gray-400 rounded resize-none"
                          style={{ color: '#2B2727' }}
                          rows={3}
                          maxLength={70}
                        />
                      </div>

                      {/* Contact and Actions */}
                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs mb-1" style={{ color: '#2B2727' }}>Contact Phone *</label>
                          <input
                            type="tel"
                            value={editForm.contactPhone || ''}
                            onChange={(e) => setEditForm({...editForm, contactPhone: e.target.value})}
                            className="w-full px-3 py-2 text-xs !bg-white border border-gray-400 rounded"
                            style={{ color: '#2B2727' }}
                            placeholder="+251-9xx-xxx-xxx"
                            required
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveEdit();
                            }}
                            className="flex-1 px-6 py-2 bg-cyan-400 text-white font-medium rounded hover:bg-cyan-500 transition-colors"
                          >
                            SAVE
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelEdit();
                            }}
                            className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 transition-colors font-bold"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* View Mode - Match Load Post Style */
                  <div>
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                      {/* Comments 1 */}
                      <div>
                        <div className="font-medium mb-1" style={{ color: '#2B2727' }}>
                          Comments 1
                        </div>
                        <div style={{ color: '#2B2727' }}>
                          {comments1 || 'N/A'}
                        </div>
                      </div>

                      {/* Comments 2 */}
                      <div>
                        <div className="font-medium mb-1" style={{ color: '#2B2727' }}>
                          Comments 2
                        </div>
                        <div style={{ color: '#2B2727' }}>
                          {comments2 || 'N/A'}
                        </div>
                      </div>
                    </div>

                    {/* Sprint 16: GPS Tracking Section */}
                    {truck.truck?.assignedLoads?.[0]?.trackingEnabled && truck.truck?.assignedLoads?.[0]?.trackingUrl && (
                      <div className="mb-4 p-3 bg-green-50 border-2 border-green-400 rounded">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold text-sm text-green-700 flex items-center gap-2">
                            <span>📍</span> TRUCK CURRENTLY ON GPS-TRACKED LOAD
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-xs text-green-700">Live</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                          <div>
                            <div className="text-gray-600 mb-1">Load Route</div>
                            <div className="font-semibold text-gray-800">
                              {truck.truck.assignedLoads[0].pickupCity} → {truck.truck.assignedLoads[0].deliveryCity}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600 mb-1">Tracking Started</div>
                            <div className="font-semibold text-gray-800">
                              {truck.truck.assignedLoads[0].trackingStartedAt
                                ? new Date(truck.truck.assignedLoads[0].trackingStartedAt).toLocaleString()
                                : 'N/A'}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <a
                            href={truck.truck.assignedLoads[0].trackingUrl}
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
                              navigator.clipboard.writeText(
                                `${window.location.origin}${truck.truck.assignedLoads[0].trackingUrl}`
                              );
                              alert('Tracking URL copied! Share it with your customer.');
                            }}
                            className="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded hover:bg-green-600 transition-colors"
                          >
                            SHARE
                          </button>
                        </div>
                      </div>
                    )}

                    {/* GPS Device Status - Show if GPS enabled but not currently tracking */}
                    {truck.truck?.imei && truck.truck?.gpsVerifiedAt && !truck.truck?.assignedLoads?.[0]?.trackingEnabled && (
                      <div className="mb-4 p-3 bg-blue-50 border-2 border-blue-400 rounded">
                        <div className="font-semibold text-sm text-blue-700 mb-2 flex items-center gap-2">
                          <span>📡</span> GPS DEVICE ACTIVE
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div>
                            <div className="text-gray-600 mb-1">IMEI</div>
                            <div className="font-semibold text-gray-800 font-mono">
                              {truck.truck.imei}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600 mb-1">Provider</div>
                            <div className="font-semibold text-gray-800">
                              {truck.truck.gpsProvider || 'N/A'}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600 mb-1">Status</div>
                            <div className={`font-semibold ${
                              truck.truck.gpsStatus === 'ACTIVE' ? 'text-green-600' :
                              truck.truck.gpsStatus === 'SIGNAL_LOST' ? 'text-yellow-600' :
                              'text-gray-600'
                            }`}>
                              {truck.truck.gpsStatus === 'ACTIVE' ? '🟢 Active' :
                               truck.truck.gpsStatus === 'SIGNAL_LOST' ? '🟡 Signal Lost' :
                               truck.truck.gpsStatus === 'INACTIVE' ? '⚫ Inactive' :
                               'Unknown'}
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-blue-800 mt-2">
                          ℹ️ This truck is ready for GPS tracking when assigned to a load.
                        </p>
                      </div>
                    )}

                    {/* GPS Not Available */}
                    {!truck.truck?.imei && (
                      <div className="mb-4 p-3 bg-yellow-50 border-2 border-yellow-400 rounded">
                        <div className="font-semibold text-sm text-yellow-700 mb-1">
                          ⚠️ GPS Not Registered
                        </div>
                        <p className="text-xs text-yellow-800">
                          This truck does not have a GPS device registered. Register a GPS device to enable live tracking for future loads.
                        </p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 justify-end items-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(truck);
                        }}
                        className="px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-400 transition-colors"
                      >
                        COPY
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(truck);
                        }}
                        className="px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-400 transition-colors"
                      >
                        EDIT
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(truck);
                        }}
                        className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded hover:bg-red-600 transition-colors"
                      >
                        DELETE
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          }}
        />
      </div>

      {/* Matching Loads Section */}
      <div className="bg-white rounded-lg p-4">
        {/* Header with Filters and Tabs */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-bold text-gray-700 uppercase">
              {filteredMatchingLoads.length} TOTAL RESULTS
            </h3>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                <label className="text-gray-600">DH-O:</label>
                <input
                  type="number"
                  value={loadFilters.dhOrigin}
                  onChange={(e) => setLoadFilters({...loadFilters, dhOrigin: e.target.value})}
                  className="w-16 px-1 py-1 border rounded"
                  placeholder="150"
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-gray-600">DH-D:</label>
                <input
                  type="number"
                  value={loadFilters.dhDestination}
                  onChange={(e) => setLoadFilters({...loadFilters, dhDestination: e.target.value})}
                  className="w-16 px-1 py-1 border rounded"
                  placeholder="0"
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-gray-600">F/P:</label>
                <select
                  value={loadFilters.fullPartial}
                  onChange={(e) => setLoadFilters({...loadFilters, fullPartial: e.target.value})}
                  className="px-2 py-1 border rounded text-xs"
                >
                  <option value="">Both</option>
                  <option value="FULL">Full</option>
                  <option value="PARTIAL">Partial</option>
                </select>
              </div>
              <div className="flex items-center gap-1">
                <label className="text-gray-600">Each</label>
              </div>
            </div>
          </div>

          {/* Tabs on the right */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveLoadTab('all')}
              className={`px-4 py-1.5 text-xs font-bold rounded transition-colors ${
                activeLoadTab === 'all'
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              ALL
            </button>
            <button
              onClick={() => setActiveLoadTab('preferred')}
              className={`px-4 py-1.5 text-xs font-bold rounded transition-colors ${
                activeLoadTab === 'preferred'
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              PREFERRED
            </button>
            <button
              onClick={() => setActiveLoadTab('blocked')}
              className={`px-4 py-1.5 text-xs font-bold rounded transition-colors ${
                activeLoadTab === 'blocked'
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              BLOCKED
            </button>
          </div>
        </div>

        {/* Matching Loads Table */}
        <DatDataTable
          columns={loadColumns}
          data={filteredMatchingLoads}
          loading={loadingMatches}
          emptyMessage="No matching loads found. Post a truck to see matching loads."
          rowKey="id"
        />
      </div>
    </div>
  );
}
