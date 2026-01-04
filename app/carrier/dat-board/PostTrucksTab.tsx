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

  // User's approved trucks (from My Trucks)
  const [approvedTrucks, setApprovedTrucks] = useState<any[]>([]);
  const [loadingApprovedTrucks, setLoadingApprovedTrucks] = useState(false);

  // New truck posting form state
  const [newTruckForm, setNewTruckForm] = useState({
    truckId: '',
    availableFrom: '',
    availableTo: '',
    origin: '',
    destination: '',
    dhOrigin: '', // Deadhead to origin (km)
    fullPartial: 'FULL',
    lengthM: '',
    weight: '',
    contactPhone: '',
    comments1: '',
    comments2: '',
    // Sprint 15: Google Places coordinates
    originCoordinates: undefined as { lat: number; lng: number } | undefined,
    destinationCoordinates: undefined as { lat: number; lng: number } | undefined,
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

  // Sprint 18: Load request modal state
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [selectedLoadForRequest, setSelectedLoadForRequest] = useState<any>(null);
  const [selectedTruckForRequest, setSelectedTruckForRequest] = useState<string>('');
  const [requestNotes, setRequestNotes] = useState('');
  const [requestProposedRate, setRequestProposedRate] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

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

  /**
   * Fetch user's approved trucks from My Trucks
   */
  const fetchApprovedTrucks = async () => {
    setLoadingApprovedTrucks(true);
    try {
      const response = await fetch('/api/trucks?myTrucks=true&approvalStatus=APPROVED');
      const data = await response.json();
      setApprovedTrucks(data.trucks || []);
    } catch (error) {
      console.error('Failed to fetch approved trucks:', error);
    } finally {
      setLoadingApprovedTrucks(false);
    }
  };

  useEffect(() => {
    fetchEthiopianCities();
    fetchApprovedTrucks();
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
   * Handle truck selection - pre-fill form with truck data
   */
  const handleTruckSelection = (truckId: string) => {
    setNewTruckForm(prev => ({ ...prev, truckId }));

    const selectedTruck = approvedTrucks.find(t => t.id === truckId);
    if (selectedTruck) {
      // Pre-fill some fields from the truck data
      setNewTruckForm(prev => ({
        ...prev,
        truckId,
        origin: selectedTruck.currentCity || '',
        lengthM: selectedTruck.volume ? String(selectedTruck.volume) : '',
        weight: selectedTruck.capacity ? String(selectedTruck.capacity) : '',
      }));
    }
  };

  /**
   * Handle new truck form submission
   */
  const handlePostTruck = async () => {
    // Validate required fields
    if (!newTruckForm.truckId) {
      alert('Please select a truck from your fleet');
      return;
    }
    if (!newTruckForm.origin || !newTruckForm.availableFrom || !newTruckForm.contactPhone) {
      alert('Please fill in all required fields: Origin, Available Date, and Contact Phone');
      return;
    }

    try {
      const selectedTruck = approvedTrucks.find(t => t.id === newTruckForm.truckId);

      const response = await fetch('/api/truck-postings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'temp-token',
        },
        body: JSON.stringify({
          truckId: newTruckForm.truckId,
          originCityId: newTruckForm.origin,
          destinationCityId: newTruckForm.destination || null,
          availableFrom: newTruckForm.availableFrom,
          availableTo: newTruckForm.availableTo || null,
          fullPartial: newTruckForm.fullPartial,
          availableLength: newTruckForm.lengthM ? parseFloat(newTruckForm.lengthM) : null,
          availableWeight: newTruckForm.weight ? parseFloat(newTruckForm.weight) : null,
          ownerName: selectedTruck?.carrier?.name || null,
          contactName: user.firstName + ' ' + user.lastName,
          contactPhone: newTruckForm.contactPhone,
          notes: (newTruckForm.comments1 + '\n' + newTruckForm.comments2).trim() || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create truck posting');
      }

      alert('Truck posting created successfully!');

      // Reset form
      setNewTruckForm({
        truckId: '',
        availableFrom: '',
        availableTo: '',
        origin: '',
        destination: '',
        dhOrigin: '',
        fullPartial: 'FULL',
        lengthM: '',
        weight: '',
        contactPhone: '',
        comments1: '',
        comments2: '',
        originCoordinates: undefined,
        destinationCoordinates: undefined,
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
   * Sprint 18: Handle opening the load request modal
   */
  const handleOpenRequestModal = (load: any) => {
    setSelectedLoadForRequest(load);
    // Pre-select first posted truck
    const postedTrucks = trucks.filter(t =>
      (t.status === 'POSTED' || t.status === 'ACTIVE') && t.truck?.approvalStatus === 'APPROVED'
    );
    if (postedTrucks.length > 0) {
      setSelectedTruckForRequest(postedTrucks[0].truck?.id || '');
    }
    setRequestNotes('');
    setRequestProposedRate('');
    setRequestModalOpen(true);
  };

  /**
   * Sprint 18: Submit load request to shipper
   */
  const handleSubmitLoadRequest = async () => {
    if (!selectedLoadForRequest || !selectedTruckForRequest) {
      alert('Please select a truck for this load request');
      return;
    }

    setSubmittingRequest(true);
    try {
      const response = await fetch('/api/load-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'temp-token',
        },
        body: JSON.stringify({
          loadId: selectedLoadForRequest.id,
          truckId: selectedTruckForRequest,
          notes: requestNotes || undefined,
          proposedRate: requestProposedRate ? parseFloat(requestProposedRate) : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit load request');
      }

      alert('Load request sent to shipper! You will be notified when they respond.');
      setRequestModalOpen(false);
      setSelectedLoadForRequest(null);
      setSelectedTruckForRequest('');
      setRequestNotes('');
      setRequestProposedRate('');
    } catch (error: any) {
      console.error('Load request error:', error);
      alert(error.message || 'Failed to submit load request');
    } finally {
      setSubmittingRequest(false);
    }
  };

  /**
   * Get posted trucks that are approved for requests
   */
  const getApprovedPostedTrucks = () => {
    return trucks.filter(t =>
      (t.status === 'POSTED' || t.status === 'ACTIVE') &&
      t.truck?.approvalStatus === 'APPROVED'
    );
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
    // Sprint 18: Request Load button column
    {
      key: 'actions',
      label: 'Action',
      width: '120px',
      align: 'center' as const,
      render: (_, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleOpenRequestModal(row);
          }}
          className="px-3 py-1.5 bg-lime-500 text-white text-xs font-bold rounded hover:bg-lime-600 transition-colors whitespace-nowrap"
        >
          REQUEST LOAD
        </button>
      ),
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

      {/* New Truck Posting Form - Clean Organized Layout */}
      {showNewTruckForm && (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6 mb-4">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Create New Truck Posting
            </h3>
            <button
              onClick={() => setShowNewTruckForm(false)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>

          {/* Step 1: Select Truck */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Step 1: Select Truck from Your Fleet <span className="text-red-500">*</span>
            </label>
            {loadingApprovedTrucks ? (
              <div className="text-gray-500 dark:text-gray-400 py-4">Loading your trucks...</div>
            ) : approvedTrucks.length === 0 ? (
              <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-yellow-800 dark:text-yellow-300 text-sm">
                  No approved trucks found. Please add and get a truck approved in <a href="/carrier/trucks" className="underline font-medium">My Trucks</a> first.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {approvedTrucks.map((truck) => (
                  <button
                    key={truck.id}
                    onClick={() => handleTruckSelection(truck.id)}
                    className={`
                      p-4 border-2 rounded-lg text-left transition-all
                      ${newTruckForm.truckId === truck.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                        : 'border-gray-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-500'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🚛</span>
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {truck.licensePlate}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {truck.truckType?.replace('_', ' ')} • {truck.capacity} kg
                        </div>
                        {truck.currentCity && (
                          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            📍 {truck.currentCity}
                          </div>
                        )}
                      </div>
                    </div>
                    {newTruckForm.truckId === truck.id && (
                      <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
                        ✓ Selected
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Step 2: Posting Details - Only show when truck is selected */}
          {newTruckForm.truckId && (
            <>
              <div className="border-t border-gray-200 dark:border-slate-700 pt-6 mb-6">
                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
                  Step 2: Posting Details
                </label>

                {/* Row 1: Location & Availability */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  {/* Origin */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Origin (Available At) <span className="text-red-500">*</span>
                    </label>
                    <PlacesAutocomplete
                      value={newTruckForm.origin}
                      onChange={(value, place) => {
                        setNewTruckForm({
                          ...newTruckForm,
                          origin: value,
                          originCoordinates: place?.coordinates
                        });
                      }}
                      placeholder="Where is truck available?"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                      countryRestriction={['ET', 'DJ']}
                      types={['(cities)']}
                    />
                  </div>

                  {/* Destination */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Destination (Preferred)
                    </label>
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
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                      countryRestriction={['ET', 'DJ']}
                      types={['(cities)']}
                    />
                  </div>

                  {/* Available From */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Available From <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={newTruckForm.availableFrom}
                      onChange={(e) => setNewTruckForm({...newTruckForm, availableFrom: e.target.value})}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  {/* Available To */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Available Until
                    </label>
                    <input
                      type="date"
                      value={newTruckForm.availableTo}
                      onChange={(e) => setNewTruckForm({...newTruckForm, availableTo: e.target.value})}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                      min={newTruckForm.availableFrom || new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>

                {/* Row 2: Load Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-4">
                  {/* DH-O (Deadhead to Origin) */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      DH-O (km)
                    </label>
                    <input
                      type="number"
                      value={newTruckForm.dhOrigin}
                      onChange={(e) => setNewTruckForm({...newTruckForm, dhOrigin: e.target.value})}
                      placeholder="Max deadhead"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* F/P */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Full/Partial
                    </label>
                    <select
                      value={newTruckForm.fullPartial}
                      onChange={(e) => setNewTruckForm({...newTruckForm, fullPartial: e.target.value})}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="FULL">Full Load</option>
                      <option value="PARTIAL">Partial</option>
                    </select>
                  </div>

                  {/* Length */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Length (m)
                    </label>
                    <input
                      type="number"
                      value={newTruckForm.lengthM}
                      onChange={(e) => setNewTruckForm({...newTruckForm, lengthM: e.target.value})}
                      placeholder="Available length"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Weight */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Weight (kg)
                    </label>
                    <input
                      type="number"
                      value={newTruckForm.weight}
                      onChange={(e) => setNewTruckForm({...newTruckForm, weight: e.target.value})}
                      placeholder="Max capacity"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Contact Phone */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Contact Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={newTruckForm.contactPhone}
                      onChange={(e) => setNewTruckForm({...newTruckForm, contactPhone: e.target.value})}
                      placeholder="+251-9xx-xxx-xxx"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Row 3: Comments */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Comments <span className="text-gray-400">({newTruckForm.comments1.length}/70)</span>
                    </label>
                    <input
                      type="text"
                      value={newTruckForm.comments1}
                      onChange={(e) => setNewTruckForm({...newTruckForm, comments1: e.target.value.slice(0, 70)})}
                      placeholder="Additional notes for shippers..."
                      maxLength={70}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Additional Comments <span className="text-gray-400">({newTruckForm.comments2.length}/70)</span>
                    </label>
                    <input
                      type="text"
                      value={newTruckForm.comments2}
                      onChange={(e) => setNewTruckForm({...newTruckForm, comments2: e.target.value.slice(0, 70)})}
                      placeholder="Special equipment, requirements..."
                      maxLength={70}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowNewTruckForm(false)}
                  className="px-6 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePostTruck}
                  disabled={!newTruckForm.truckId || !newTruckForm.origin || !newTruckForm.availableFrom || !newTruckForm.contactPhone}
                  className="px-6 py-2 bg-lime-500 text-white rounded-lg hover:bg-lime-600 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Post Truck
                </button>
              </div>
            </>
          )}
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

      {/* Sprint 18: Load Request Modal */}
      {requestModalOpen && selectedLoadForRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Request Load
            </h3>

            {/* Load Summary */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-gray-500">Route</div>
                  <div className="font-medium">
                    {selectedLoadForRequest.pickupCity} → {selectedLoadForRequest.deliveryCity}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Shipper</div>
                  <div className="font-medium">
                    {selectedLoadForRequest.shipper?.name || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Truck Type</div>
                  <div className="font-medium">
                    {selectedLoadForRequest.truckType?.replace('_', ' ') || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Rate</div>
                  <div className="font-medium">
                    {selectedLoadForRequest.rate ? `${selectedLoadForRequest.rate} ETB` : 'Negotiable'}
                  </div>
                </div>
              </div>
            </div>

            {/* Truck Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Truck *
              </label>
              <select
                value={selectedTruckForRequest}
                onChange={(e) => setSelectedTruckForRequest(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-transparent"
              >
                <option value="">Select a truck...</option>
                {getApprovedPostedTrucks().map((posting) => (
                  <option key={posting.truck?.id} value={posting.truck?.id}>
                    {posting.truck?.licensePlate} - {posting.truck?.truckType?.replace('_', ' ')} ({posting.originCity?.name || 'N/A'})
                  </option>
                ))}
              </select>
              {getApprovedPostedTrucks().length === 0 && (
                <p className="text-xs text-red-500 mt-1">
                  No approved trucks with active postings. Please post a truck first.
                </p>
              )}
            </div>

            {/* Proposed Rate (Optional) */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Proposed Rate (ETB) <span className="text-gray-400">(Optional)</span>
              </label>
              <input
                type="number"
                value={requestProposedRate}
                onChange={(e) => setRequestProposedRate(e.target.value)}
                placeholder="Leave blank to accept posted rate"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-transparent"
              />
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message to Shipper <span className="text-gray-400">(Optional)</span>
              </label>
              <textarea
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
                placeholder="Add any notes or special requirements..."
                rows={3}
                maxLength={500}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-transparent resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">{requestNotes.length}/500</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setRequestModalOpen(false);
                  setSelectedLoadForRequest(null);
                }}
                disabled={submittingRequest}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitLoadRequest}
                disabled={submittingRequest || !selectedTruckForRequest}
                className="flex-1 px-4 py-2 bg-lime-500 text-white rounded-lg hover:bg-lime-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingRequest ? 'Sending...' : 'Send Request'}
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-4 text-center">
              The shipper will review your request and can approve or reject it.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
