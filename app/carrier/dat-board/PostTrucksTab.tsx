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

/**
 * Get CSRF token for secure form submissions
 */
const getCSRFToken = async (): Promise<string | null> => {
  try {
    const response = await fetch('/api/csrf-token');
    if (!response.ok) {
      console.error('CSRF token request failed:', response.status);
      return null;
    }
    const data = await response.json();
    return data.csrfToken;
  } catch (error) {
    console.error('Failed to get CSRF token:', error);
    return null;
  }
};

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
    declaredDhO: '', // Declared DH-O limit (km) - carrier sets max distance to pickup
    declaredDhD: '', // Declared DH-D limit (km) - carrier sets max distance after delivery
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

  // Note: DH-O, DH-D, F/P filters removed - these are already specified when posting the truck
  // The system auto-calculates distances based on truck location

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
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in kilometers
   */
  const haversineDistance = (
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c); // Return rounded km
  };

  /**
   * Calculate actual distance between two cities using coordinates
   * Looks up city coordinates from ethiopianCities array
   */
  const calculateDeadhead = (city1: string | null | undefined, city2: string | null | undefined): number => {
    if (!city1 || !city2) return 0;

    const c1 = city1.toLowerCase().trim();
    const c2 = city2.toLowerCase().trim();

    // Same city = 0 distance
    if (c1 === c2) return 0;

    // Look up coordinates for both cities
    const city1Data = ethiopianCities.find(
      (city: any) => city.name?.toLowerCase().trim() === c1
    );
    const city2Data = ethiopianCities.find(
      (city: any) => city.name?.toLowerCase().trim() === c2
    );

    // If both cities have coordinates, calculate actual distance
    if (city1Data?.latitude && city1Data?.longitude &&
        city2Data?.latitude && city2Data?.longitude) {
      return haversineDistance(
        Number(city1Data.latitude),
        Number(city1Data.longitude),
        Number(city2Data.latitude),
        Number(city2Data.longitude)
      );
    }

    // Fallback: if coordinates not available, estimate based on name matching
    if (c1.includes(c2) || c2.includes(c1)) return 50; // Nearby/similar names
    return 0; // Return 0 if we can't calculate (no coordinates)
  };

  /**
   * Fetch all matching loads for all posted trucks
   * Shows recent loads with DH-O and DH-D set to 0 (will be calculated when truck is selected)
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
          .then(data => {
            // Add truck info to each load for DH calculation
            return (data.matches || []).map((match: any) => ({
              ...match,
              truckOrigin: truck.originCity?.name || truck.origin,
              truckDestination: truck.destinationCity?.name || truck.destination,
            }));
          })
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
   * Calculate distance using coordinates directly (more reliable than name lookup)
   */
  const calculateDistanceWithCoords = (
    originLat: number | null | undefined,
    originLon: number | null | undefined,
    destLat: number | null | undefined,
    destLon: number | null | undefined
  ): number => {
    if (!originLat || !originLon || !destLat || !destLon) return 0;
    return haversineDistance(
      Number(originLat), Number(originLon),
      Number(destLat), Number(destLon)
    );
  };

  /**
   * Get coordinates for a city name from ethiopianCities
   * Uses fuzzy matching to handle name variations (e.g., "Mekele" vs "Mekelle", "Jima" vs "Jimma")
   */
  const getCityCoords = (cityName: string | null | undefined): { lat: number; lon: number } | null => {
    if (!cityName || ethiopianCities.length === 0) return null;

    const searchName = cityName.toLowerCase().trim();

    // Try exact match first
    let city = ethiopianCities.find(
      (c: any) => c.name?.toLowerCase().trim() === searchName
    );

    // If no exact match, try fuzzy match (contains or similar spelling)
    if (!city) {
      city = ethiopianCities.find((c: any) => {
        const cityNameLower = c.name?.toLowerCase().trim() || '';
        // Check if one contains the other
        if (cityNameLower.includes(searchName) || searchName.includes(cityNameLower)) {
          return true;
        }
        // Check for common spelling variations (remove double letters)
        const simplify = (s: string) => s.replace(/(.)\1+/g, '$1'); // e.g., "Mekelle" -> "Mekele"
        if (simplify(cityNameLower) === simplify(searchName)) {
          return true;
        }
        return false;
      });
    }

    if (city?.latitude && city?.longitude) {
      return { lat: Number(city.latitude), lon: Number(city.longitude) };
    }
    return null;
  };

  /**
   * Handle truck row click - show matching loads for this specific truck
   * The API now calculates DH-O and DH-D distances and returns them sorted
   */
  const handleTruckClick = async (truck: any) => {
    if (selectedTruckId === truck.id) {
      // Deselect - show all loads again
      setSelectedTruckId(null);
      fetchAllMatchingLoads();
    } else {
      // Select this truck - show only its matching loads
      setSelectedTruckId(truck.id);
      setLoadingMatches(true);
      try {
        // API returns loads with calculated dhToOriginKm, dhAfterDeliveryKm, and withinDhLimits
        const loads = await fetchMatchingLoads(truck.id);
        setMatchingLoads(loads);
      } finally {
        setLoadingMatches(false);
      }
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
   * Check if a truck already has an active posting
   */
  const getActivePostingForTruck = (truckId: string) => {
    return trucks.find(
      posting => posting.truckId === truckId &&
      (posting.status === 'ACTIVE' || posting.status === 'POSTED')
    );
  };

  /**
   * Handle truck selection - pre-fill form with truck data
   * Only unposted trucks appear in the dropdown
   */
  const handleTruckSelection = (truckId: string) => {
    if (!truckId) {
      setNewTruckForm(prev => ({ ...prev, truckId: '' }));
      return;
    }

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
      // TODO: Fix CSRF token implementation - cookie not being set correctly
      // For now, CSRF is disabled on server side, so we skip the token
      const csrfToken = await getCSRFToken();

      const selectedTruck = approvedTrucks.find(t => t.id === newTruckForm.truckId);

      // Look up EthiopianLocation IDs from city names
      const originCity = ethiopianCities.find(
        (c: any) => c.name.toLowerCase() === newTruckForm.origin.toLowerCase()
      );
      const destinationCity = newTruckForm.destination
        ? ethiopianCities.find(
            (c: any) => c.name.toLowerCase() === newTruckForm.destination.toLowerCase()
          )
        : null;

      if (!originCity) {
        alert('Origin city not found in Ethiopian locations. Please select a valid city.');
        return;
      }

      // Convert date to ISO datetime format
      const availableFromISO = new Date(newTruckForm.availableFrom + 'T00:00:00').toISOString();
      const availableToISO = newTruckForm.availableTo
        ? new Date(newTruckForm.availableTo + 'T23:59:59').toISOString()
        : null;

      // Build the payload with all fields including declared DH limits
      const payload = {
        truckId: newTruckForm.truckId,
        originCityId: originCity.id,
        destinationCityId: destinationCity?.id || null,
        availableFrom: availableFromISO,
        availableTo: availableToISO,
        fullPartial: newTruckForm.fullPartial,
        availableLength: newTruckForm.lengthM ? parseFloat(newTruckForm.lengthM) : null,
        availableWeight: newTruckForm.weight ? parseFloat(newTruckForm.weight) : null,
        ownerName: selectedTruck?.carrier?.name || null,
        contactName: user.firstName + ' ' + user.lastName,
        contactPhone: newTruckForm.contactPhone,
        notes: (newTruckForm.comments1 + '\n' + newTruckForm.comments2).trim() || null,
        // Declared DH limits (carrier specifies max distances they're willing to accept)
        preferredDhToOriginKm: newTruckForm.declaredDhO ? parseFloat(newTruckForm.declaredDhO) : null,
        preferredDhAfterDeliveryKm: newTruckForm.declaredDhD ? parseFloat(newTruckForm.declaredDhD) : null,
      };

      const response = await fetch('/api/truck-postings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Show validation details if available
        let errorMessage = errorData.error || 'Failed to create truck posting';
        if (errorData.details) {
          errorMessage += '\n\nDetails: ' + JSON.stringify(errorData.details, null, 2);
        }
        throw new Error(errorMessage);
      }

      alert('Truck posting created successfully!');

      // Reset form
      setNewTruckForm({
        truckId: '',
        availableFrom: '',
        availableTo: '',
        origin: '',
        destination: '',
        declaredDhO: '',
        declaredDhD: '',
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
      // Get CSRF token
      const csrfToken = await getCSRFToken();
      if (!csrfToken) {
        alert('Failed to get security token. Please refresh and try again.');
        setSubmittingRequest(false);
        return;
      }

      const response = await fetch('/api/load-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
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
      key: 'preferredDhToOriginKm',
      label: 'DH-O',
      width: '65px',
      align: 'right' as const,
      render: (value) => value ? `${value} km` : '-',
    },
    {
      key: 'preferredDhAfterDeliveryKm',
      label: 'DH-D',
      width: '65px',
      align: 'right' as const,
      render: (value) => value ? `${value} km` : '-',
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
      width: '80px',
      align: 'center' as const,
      render: (value, row) => (
        <span className={`
          px-2 py-1 rounded text-xs font-bold
          ${value > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}
        `}>
          {value || 0}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '280px',
      align: 'center' as const,
      render: (_, row) => {
        const isExpanded = expandedTruckId === row.id;
        const isEditing = editingTruckId === row.id;

        if (!isExpanded || isEditing) {
          return null;
        }

        return (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(row);
              }}
              className="px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 transition-all"
            >
              ✏️ Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopy(row);
              }}
              className="px-4 py-1.5 bg-slate-600 text-white text-xs font-semibold rounded hover:bg-slate-700 transition-all"
            >
              📋 Copy
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(row);
              }}
              className="px-4 py-1.5 bg-red-600 text-white text-xs font-semibold rounded hover:bg-red-700 transition-all"
            >
              🗑️ Delete
            </button>
          </div>
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
      width: '70px',
      align: 'right' as const,
      render: (value, row) => {
        if (!value && value !== 0) return '-';
        // Show green if within declared limits, gray otherwise
        const withinLimits = row.withinDhLimits;
        return (
          <span className={`font-medium ${withinLimits ? 'text-green-600' : 'text-gray-500'}`}>
            {value} km
          </span>
        );
      },
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
      width: '70px',
      align: 'right' as const,
      render: (value, row) => {
        if (!value && value !== 0) return '-';
        // Show green if within declared limits, gray otherwise
        const withinLimits = row.withinDhLimits;
        return (
          <span className={`font-medium ${withinLimits ? 'text-green-600' : 'text-gray-500'}`}>
            {value} km
          </span>
        );
      },
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

    // Ensure the row stays expanded when editing
    setExpandedTruckId(truck.id);
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
      // Declared DH limits
      declaredDhO: truck.preferredDhToOriginKm || '',
      declaredDhD: truck.preferredDhAfterDeliveryKm || '',
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
          // Declared DH limits
          preferredDhToOriginKm: editForm.declaredDhO ? parseFloat(editForm.declaredDhO) : null,
          preferredDhAfterDeliveryKm: editForm.declaredDhD ? parseFloat(editForm.declaredDhD) : null,
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
   * Get selected truck's origin for filtering
   */
  const selectedTruck = selectedTruckId ? trucks.find(t => t.id === selectedTruckId) : null;
  const selectedTruckOrigin = selectedTruck?.originCity?.name || selectedTruck?.origin || '';

  /**
   * Filter matching loads based on active tab and truck origin
   * Sorts by: loads within DH limits first, then DH-O, DH-D, then by recent (createdAt)
   */
  const filteredMatchingLoads = matchingLoads
    .map(match => {
      // Extract load from match object (API returns { load: {...}, matchScore: X })
      const load = match.load || match;
      return {
        ...match,
        load: {
          ...load,
          // Preserve DH values and limits flag from match if available
          dhToOriginKm: match.dhToOriginKm ?? load.dhToOriginKm ?? 0,
          dhAfterDeliveryKm: match.dhAfterDeliveryKm ?? load.dhAfterDeliveryKm ?? 0,
          withinDhLimits: match.withinDhLimits ?? load.withinDhLimits ?? true,
        }
      };
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

      // Filter by truck origin - only show loads where pickup is near truck's origin
      if (selectedTruckId && selectedTruckOrigin && load.pickupCity) {
        const truckOriginLower = selectedTruckOrigin.toLowerCase().trim();
        const loadOriginLower = load.pickupCity.toLowerCase().trim();

        // Check if origins match or are related
        const originsMatch =
          truckOriginLower === loadOriginLower ||
          truckOriginLower.includes(loadOriginLower) ||
          loadOriginLower.includes(truckOriginLower);

        // Also allow loads with low DH-O (within reasonable distance) or within declared limits
        const dhOk = (load.dhToOriginKm || 0) <= 200 || load.withinDhLimits;

        if (!originsMatch && !dhOk) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      // If a truck is selected, sort by within-limits first, then DH-O
      if (selectedTruckId) {
        // First priority: loads within declared DH limits come first
        const aWithin = a.load?.withinDhLimits ?? true;
        const bWithin = b.load?.withinDhLimits ?? true;
        if (aWithin !== bWithin) {
          return aWithin ? -1 : 1;
        }

        // Second: by DH-O (lower is better)
        const dhA = a.load?.dhToOriginKm || 0;
        const dhB = b.load?.dhToOriginKm || 0;
        if (dhA !== dhB) return dhA - dhB;

        // Third: by DH-D (lower is better)
        const dhDA = a.load?.dhAfterDeliveryKm || 0;
        const dhDB = b.load?.dhAfterDeliveryKm || 0;
        if (dhDA !== dhDB) return dhDA - dhDB;
      }

      // Sort by most recent first
      const dateA = new Date(a.load?.createdAt || 0).getTime();
      const dateB = new Date(b.load?.createdAt || 0).getTime();
      return dateB - dateA;
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
            ) : (() => {
              // Filter to only show unposted trucks
              const unpostedTrucks = approvedTrucks.filter(truck => !getActivePostingForTruck(truck.id));

              if (approvedTrucks.length === 0) {
                return (
                  <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <p className="text-yellow-800 dark:text-yellow-300 text-sm">
                      No approved trucks found. Please add and get a truck approved in <a href="/carrier/trucks" className="underline font-medium">My Trucks</a> first.
                    </p>
                  </div>
                );
              }

              if (unpostedTrucks.length === 0) {
                return (
                  <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-blue-800 dark:text-blue-300 text-sm">
                      All your trucks are already posted. To edit an existing posting, click on it in the list below.
                    </p>
                  </div>
                );
              }

              return (
                <select
                  value={newTruckForm.truckId}
                  onChange={(e) => handleTruckSelection(e.target.value)}
                  className="w-full max-w-md px-4 py-3 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select a truck to post --</option>
                  {unpostedTrucks.map((truck) => (
                    <option key={truck.id} value={truck.id}>
                      {truck.licensePlate} - {truck.truckType?.replace('_', ' ')} • {truck.capacity} kg
                      {truck.currentCity ? ` (📍 ${truck.currentCity})` : ''}
                    </option>
                  ))}
                </select>
              );
            })()}
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
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-4">
                  {/* DH-O (Declared Deadhead to Origin Limit) */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      DH-O Limit (km)
                    </label>
                    <input
                      type="number"
                      value={newTruckForm.declaredDhO}
                      onChange={(e) => setNewTruckForm({...newTruckForm, declaredDhO: e.target.value})}
                      placeholder="e.g. 100"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                      min="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">Max distance to pickup</p>
                  </div>

                  {/* DH-D (Declared Deadhead after Delivery Limit) */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      DH-D Limit (km)
                    </label>
                    <input
                      type="number"
                      value={newTruckForm.declaredDhD}
                      onChange={(e) => setNewTruckForm({...newTruckForm, declaredDhD: e.target.value})}
                      placeholder="e.g. 100"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                      min="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">Max distance after delivery</p>
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
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800">
            {trucks.length} POSTED TRUCKS
          </h3>
        </div>
        <DatDataTable
          columns={truckColumns}
          data={trucks}
          loading={loading}
          emptyMessage="No truck postings found. Click NEW TRUCK POST to create one."
          rowKey="id"
          expandable={true}
          onRowClick={(truck) => {
            // Toggle expanded state
            if (expandedTruckId === truck.id) {
              setExpandedTruckId(null);
              setSelectedTruckId(null);
              fetchAllMatchingLoads(); // Show all loads when deselected
            } else {
              setExpandedTruckId(truck.id);
              handleTruckClick(truck); // Fetch loads for this specific truck
            }
          }}
          renderExpandedRow={(truck) => {
            const notesLines = truck.notes?.split('\n') || [];
            const comments1 = notesLines[0] || '';
            const comments2 = notesLines[1] || '';
            const isEditing = editingTruckId === truck.id;

            // Only show expanded content when editing - action buttons are now in the row itself
            if (!isEditing) {
              return null;
            }

            return (
              <div id={`posting-${truck.id}`} className="p-4 bg-white border-t-2 border-blue-500 shadow-md rounded-b-lg">
                {/* Edit Mode - Professional Form Layout */}
                <div className="space-y-4">
                    {/* Header with truck info */}
                    <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-xl">🚛</span>
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-gray-900">
                            Edit Truck Posting
                          </h3>
                          <p className="text-xs text-gray-500">
                            {truck.truck?.licensePlate} • {(truck.truck?.truckType || 'N/A').replace('_', ' ')} • {truck.truck?.capacity ? `${truck.truck.capacity} kg` : 'N/A'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelEdit();
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                      >
                        <span className="text-lg">✕</span>
                      </button>
                    </div>

                    {/* Form Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3">
                      {/* Origin */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Origin <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={editForm.origin || ''}
                          onChange={(e) => setEditForm({...editForm, origin: e.target.value})}
                          className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select city</option>
                          {ethiopianCities.map((city: any) => (
                            <option key={city.id} value={city.id}>{city.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Destination */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Destination
                        </label>
                        <select
                          value={editForm.destination || ''}
                          onChange={(e) => setEditForm({...editForm, destination: e.target.value})}
                          className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Anywhere</option>
                          {ethiopianCities.map((city: any) => (
                            <option key={city.id} value={city.id}>{city.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Available From */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          From <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={editForm.availableFrom || ''}
                          onChange={(e) => setEditForm({...editForm, availableFrom: e.target.value})}
                          className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      {/* Available To */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Until
                        </label>
                        <input
                          type="date"
                          value={editForm.availableTo || ''}
                          onChange={(e) => setEditForm({...editForm, availableTo: e.target.value})}
                          className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      {/* Full/Partial */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Load Type
                        </label>
                        <select
                          value={editForm.fullPartial || 'FULL'}
                          onChange={(e) => setEditForm({...editForm, fullPartial: e.target.value})}
                          className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="FULL">Full</option>
                          <option value="PARTIAL">Partial</option>
                        </select>
                      </div>

                      {/* DH-O Limit */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          DH-O (km)
                        </label>
                        <input
                          type="number"
                          value={editForm.declaredDhO || ''}
                          onChange={(e) => setEditForm({...editForm, declaredDhO: e.target.value})}
                          placeholder="100"
                          className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          min="0"
                        />
                      </div>

                      {/* DH-D Limit */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          DH-D (km)
                        </label>
                        <input
                          type="number"
                          value={editForm.declaredDhD || ''}
                          onChange={(e) => setEditForm({...editForm, declaredDhD: e.target.value})}
                          placeholder="100"
                          className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          min="0"
                        />
                      </div>

                      {/* Length */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Length (m)
                        </label>
                        <input
                          type="number"
                          value={editForm.lengthM || ''}
                          onChange={(e) => setEditForm({...editForm, lengthM: e.target.value})}
                          placeholder="12"
                          className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      {/* Weight */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Weight (kg)
                        </label>
                        <input
                          type="number"
                          value={editForm.weight || ''}
                          onChange={(e) => setEditForm({...editForm, weight: e.target.value})}
                          placeholder="25000"
                          className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      {/* Contact Phone */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Phone <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          value={editForm.contactPhone || ''}
                          onChange={(e) => setEditForm({...editForm, contactPhone: e.target.value})}
                          placeholder="+251 9XX"
                          className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Comments and Actions Row */}
                    <div className="flex items-end gap-4">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Comments <span className="text-gray-400">({editForm.comments1?.length || 0}/70)</span>
                        </label>
                        <input
                          type="text"
                          value={editForm.comments1 || ''}
                          onChange={(e) => setEditForm({...editForm, comments1: e.target.value.slice(0, 70)})}
                          placeholder="Additional notes..."
                          className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          maxLength={70}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Additional <span className="text-gray-400">({editForm.comments2?.length || 0}/70)</span>
                        </label>
                        <input
                          type="text"
                          value={editForm.comments2 || ''}
                          onChange={(e) => setEditForm({...editForm, comments2: e.target.value.slice(0, 70)})}
                          placeholder="Special requirements..."
                          className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          maxLength={70}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelEdit();
                          }}
                          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveEdit();
                          }}
                          className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
              </div>
            );
          }}
        />
      </div>

      {/* Matching Loads Section */}
      <div className="bg-white rounded-lg p-4 mt-32">
        {/* Header with Total Count and Tabs */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold text-lime-600">
              {filteredMatchingLoads.length} MATCHING LOADS
              {selectedTruckId && (
                <span className="ml-2 text-blue-600 font-normal text-sm">
                  (for selected truck)
                </span>
              )}
            </h3>
            {selectedTruckId && (
              <button
                onClick={() => {
                  setSelectedTruckId(null);
                  setExpandedTruckId(null);
                  fetchAllMatchingLoads();
                }}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Show all loads
              </button>
            )}
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
