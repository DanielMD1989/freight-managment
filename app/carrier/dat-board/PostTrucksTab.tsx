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
import { useToast } from '@/components/Toast/ToastContext';

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

type TruckStatus = 'POSTED' | 'UNPOSTED' | 'EXPIRED';
type LoadTab = 'all' | 'preferred' | 'blocked';

export default function PostTrucksTab({ user }: PostTrucksTabProps) {
  const toast = useToast();
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<TruckStatus>('POSTED');
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
      // Fetch trucks for the active status tab
      const params = new URLSearchParams();
      params.append('includeMatchCount', 'true');
      params.append('organizationId', user.organizationId); // Only show user's truck postings

      // Map status - POSTED maps to ACTIVE in the API
      const apiStatus = activeStatus === 'POSTED' ? 'ACTIVE' : activeStatus;
      params.append('status', apiStatus);

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

      // Sort by most recently posted first (smallest age at top)
      const sortedTrucks = trucksWithMatchCounts.sort((a: any, b: any) => {
        const dateA = new Date(a.postedAt || a.createdAt || 0).getTime();
        const dateB = new Date(b.postedAt || b.createdAt || 0).getTime();
        return dateB - dateA; // Newest first
      });

      setTrucks(sortedTrucks);

      // Fetch counts for each status tab
      const counts: Record<string, number> = {
        POSTED: 0,
        UNPOSTED: 0,
        EXPIRED: 0,
      };

      const statusPromises = [
        { key: 'POSTED', apiStatus: 'ACTIVE' },
        { key: 'UNPOSTED', apiStatus: 'UNPOSTED' },
        { key: 'EXPIRED', apiStatus: 'EXPIRED' },
      ].map(async ({ key, apiStatus }) => {
        const res = await fetch(`/api/truck-postings?organizationId=${user.organizationId}&status=${apiStatus}&limit=1`);
        const json = await res.json();
        counts[key] = json.pagination?.total || 0;
      });

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

      // Sort by most recent first, then by origin alphabetically
      const sortedLoads = uniqueLoads.sort((a, b) => {
        const loadA = a.load || a;
        const loadB = b.load || b;

        // First: by most recent (newest first)
        const dateA = new Date(loadA.createdAt || 0).getTime();
        const dateB = new Date(loadB.createdAt || 0).getTime();
        if (dateA !== dateB) return dateB - dateA;

        // Second: by pickup city (origin) alphabetically
        const cityA = (loadA.pickupCity || '').toLowerCase();
        const cityB = (loadB.pickupCity || '').toLowerCase();
        return cityA.localeCompare(cityB);
      });

      setMatchingLoads(sortedLoads);
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
   * Handle POST action - Change unposted truck to posted/active
   */
  const handlePostTruckPosting = async (truck: any) => {
    try {
      // Get CSRF token for secure submission
      const csrfToken = await getCSRFToken();
      if (!csrfToken) {
        toast.error('Failed to get security token. Please refresh and try again.');
        return;
      }

      const response = await fetch(`/api/truck-postings/${truck.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          status: 'ACTIVE',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to post truck');
      }

      toast.success('Truck posted successfully!');
      fetchTrucks(); // Refresh the list
    } catch (error: any) {
      console.error('Post truck error:', error);
      toast.error(error.message || 'Failed to post truck');
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
      toast.success('Truck posting copied successfully!');
      fetchTrucks();
    } catch (error) {
      console.error('Copy failed:', error);
      toast.error('Failed to copy truck posting');
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

      toast.success('Truck posting deleted successfully');
      fetchTrucks();
      if (selectedTruckId === truck.id) {
        setSelectedTruckId(null);
        setMatchingLoads([]);
      }
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete truck posting');
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
      toast.warning('Please select a truck from your fleet');
      return;
    }
    if (!newTruckForm.origin || !newTruckForm.availableFrom || !newTruckForm.contactPhone) {
      toast.warning('Please fill in all required fields: Origin, Available Date, and Contact Phone');
      return;
    }

    try {
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
        toast.warning('Origin city not found in Ethiopian locations. Please select a valid city.');
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

      toast.success('Truck posting created successfully!');

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
      toast.error(error.message || 'Failed to create truck posting');
    }
  };

  /**
   * Status tabs configuration - POSTED, UNPOSTED, EXPIRED only
   */
  const statusTabs: DatStatusTab[] = [
    { key: 'POSTED', label: 'POSTED', count: statusCounts.POSTED },
    { key: 'UNPOSTED', label: 'UNPOSTED', count: statusCounts.UNPOSTED },
    { key: 'EXPIRED', label: 'EXPIRED', count: statusCounts.EXPIRED },
  ];

  /**
   * Handle toggle keep/star
   */
  const handleToggleKeep = async (truck: any) => {
    // TODO: Implement keep/star toggle
    toast.info('Keep/Star functionality coming soon');
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
      toast.warning('Please select a truck for this load request');
      return;
    }

    setSubmittingRequest(true);
    try {
      // Get CSRF token
      const csrfToken = await getCSRFToken();
      if (!csrfToken) {
        toast.error('Failed to get security token. Please refresh and try again.');
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

      toast.success('Load request sent to shipper! You will be notified when they respond.');
      setRequestModalOpen(false);
      setSelectedLoadForRequest(null);
      setSelectedTruckForRequest('');
      setRequestNotes('');
      setRequestProposedRate('');
    } catch (error: any) {
      console.error('Load request error:', error);
      toast.error(error.message || 'Failed to submit load request');
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
      key: 'age',
      label: 'Age',
      width: '50px',
      render: (_, row) => <DatAgeIndicator date={row.postedAt || row.createdAt} />,
    },
    {
      key: 'status',
      label: 'Status',
      width: '70px',
      render: (value) => (
        <span className={`
          px-1.5 py-0.5 rounded text-xs font-semibold
          ${value === 'ACTIVE' ? 'bg-emerald-500 text-white' : ''}
          ${value === 'POSTED' ? 'bg-emerald-500 text-white' : ''}
          ${value === 'UNPOSTED' ? 'bg-[#064d51]/10 text-[#064d51]' : ''}
          ${value === 'EXPIRED' ? 'bg-rose-500 text-white' : ''}
        `}>
          {value === 'ACTIVE' ? 'POSTED' : value}
        </span>
      ),
    },
    {
      key: 'availableFrom',
      label: 'Avail',
      width: '75px',
      render: (value, row) => {
        const from = value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Now';
        return from;
      },
    },
    {
      key: 'ownerName',
      label: 'Owner',
      width: '80px',
      render: (value) => <span className="truncate">{value || '-'}</span>,
    },
    {
      key: 'currentCity',
      label: 'Origin',
      width: '90px',
      render: (value, row) => {
        if (typeof value === 'object' && value?.name) return value.name;
        if (row.originCity?.name) return row.originCity.name;
        return value || 'N/A';
      },
    },
    {
      key: 'destinationCity',
      label: 'Dest',
      width: '90px',
      render: (value, row) => {
        if (typeof value === 'object' && value?.name) return value.name;
        if (row.destinationCity?.name) return row.destinationCity.name;
        return value || 'Any';
      },
    },
    {
      key: 'preferredDhToOriginKm',
      label: 'DH-O',
      width: '50px',
      align: 'right' as const,
      render: (value) => value ? `${value}` : '-',
    },
    {
      key: 'preferredDhAfterDeliveryKm',
      label: 'DH-D',
      width: '50px',
      align: 'right' as const,
      render: (value) => value ? `${value}` : '-',
    },
    {
      key: 'truckType',
      label: 'Type',
      width: '70px',
      render: (value) => value?.replace('_', ' ') || 'N/A',
    },
    {
      key: 'truck',
      label: 'GPS',
      width: '50px',
      align: 'center' as const,
      render: (_, row) => {
        const truck = row.truck;
        if (!truck || !truck.imei) {
          return <span className="text-gray-400 text-xs">-</span>;
        }
        const statusDots: Record<string, string> = {
          ACTIVE: '🟢',
          SIGNAL_LOST: '🟡',
          INACTIVE: '🔴',
          MAINTENANCE: '⚪',
        };
        const status = truck.gpsStatus || 'INACTIVE';
        return <span className="text-sm">{statusDots[status] || '⚫'}</span>;
      },
    },
    {
      key: 'availableLength',
      label: 'Len',
      width: '45px',
      align: 'right' as const,
      render: (value) => value ? `${value}m` : '-',
    },
    {
      key: 'availableWeight',
      label: 'Wt',
      width: '55px',
      align: 'right' as const,
      render: (value) => value ? `${value}` : '-',
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '180px',
      align: 'center' as const,
      render: (_, row) => {
        const isExpanded = expandedTruckId === row.id;
        const isEditing = editingTruckId === row.id;

        // Only show action buttons when row is expanded and not in editing mode
        if (!isExpanded || isEditing) {
          return null;
        }

        return (
          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {/* POST button - only for unposted trucks */}
            {row.status === 'UNPOSTED' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePostTruckPosting(row);
                }}
                className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-xs font-semibold rounded-lg hover:from-emerald-700 hover:to-emerald-600 transition-all shadow-md shadow-emerald-500/25 cursor-pointer flex items-center gap-1"
                title="Post this truck to make it visible to shippers"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                POST
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(row);
              }}
              className="px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 transition-all cursor-pointer"
            >
              EDIT
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopy(row);
              }}
              className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-all border border-slate-200 cursor-pointer"
            >
              COPY
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(row);
              }}
              className="px-3 py-1.5 bg-rose-500 text-white text-xs font-semibold rounded-lg hover:bg-rose-600 transition-all cursor-pointer"
            >
              DELETE
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
      render: (_, row) => <DatAgeIndicator date={row.postedAt || row.createdAt} />,
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
          <span className={`font-medium ${withinLimits ? 'text-green-600' : 'text-[#064d51]/60'}`}>
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
          <span className={`font-medium ${withinLimits ? 'text-green-600' : 'text-[#064d51]/60'}`}>
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
        <span className="text-[#1e9c99] hover:underline cursor-pointer">
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
          className="px-3 py-1.5 bg-[#064d51] text-white text-xs font-bold rounded-lg hover:bg-[#053d40] transition-colors whitespace-nowrap"
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

    // Find the truck being edited to check its status
    const editingTruck = trucks.find(t => t.id === editingTruckId);
    const wasUnposted = editingTruck?.status === 'UNPOSTED';

    // Build notes from comments, handling undefined values
    const comment1 = editForm.comments1 || '';
    const comment2 = editForm.comments2 || '';
    const notes = [comment1, comment2].filter(Boolean).join('\n').trim() || null;

    try {
      // Get CSRF token for secure submission
      const csrfToken = await getCSRFToken();
      if (!csrfToken) {
        toast.error('Failed to get security token. Please refresh and try again.');
        return;
      }

      // Build update payload
      const updatePayload: any = {
        availableFrom: editForm.availableFrom || undefined,
        availableTo: editForm.availableTo || null,
        originCityId: editForm.origin || undefined,
        destinationCityId: editForm.destination || null,
        fullPartial: editForm.fullPartial || undefined,
        availableLength: editForm.lengthM ? parseFloat(editForm.lengthM) : null,
        availableWeight: editForm.weight ? parseFloat(editForm.weight) : null,
        ownerName: editForm.owner || null,
        contactPhone: editForm.contactPhone || undefined,
        notes,
        // Declared DH limits
        preferredDhToOriginKm: editForm.declaredDhO ? parseFloat(editForm.declaredDhO) : null,
        preferredDhAfterDeliveryKm: editForm.declaredDhD ? parseFloat(editForm.declaredDhD) : null,
      };

      // If currently UNPOSTED, change to ACTIVE when saving
      if (wasUnposted) {
        updatePayload.status = 'ACTIVE';
      }

      const response = await fetch(`/api/truck-postings/${editingTruckId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) throw new Error('Failed to update truck posting');

      toast.success(wasUnposted ? 'Truck updated and posted successfully!' : 'Truck posting updated successfully!');
      setEditingTruckId(null);
      setEditForm({});
      fetchTrucks();
    } catch (error: any) {
      console.error('Update failed:', error);
      toast.error(error.message || 'Failed to update truck posting');
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
      } else {
        // No truck selected: sort by recency first, then by location
        // First: by most recent posted (newest first)
        const dateA = new Date(a.load?.postedAt || a.load?.createdAt || 0).getTime();
        const dateB = new Date(b.load?.postedAt || b.load?.createdAt || 0).getTime();
        if (dateA !== dateB) return dateB - dateA;

        // Second: by pickup city (alphabetically for easier scanning)
        const cityA = (a.load?.pickupCity || '').toLowerCase();
        const cityB = (b.load?.pickupCity || '').toLowerCase();
        if (cityA !== cityB) return cityA.localeCompare(cityB);

        // Third: by delivery city
        const destA = (a.load?.deliveryCity || '').toLowerCase();
        const destB = (b.load?.deliveryCity || '').toLowerCase();
        return destA.localeCompare(destB);
      }

      // Fallback: sort by most recent posted first
      const dateA = new Date(a.load?.postedAt || a.load?.createdAt || 0).getTime();
      const dateB = new Date(b.load?.postedAt || b.load?.createdAt || 0).getTime();
      return dateB - dateA;
    })
    .map(match => match.load); // Return just the load object for the table

  return (
    <div className="space-y-4 pt-10">
      {/* Header Row - NEW TRUCK POST on left, Status Tabs on right */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowNewTruckForm(!showNewTruckForm)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-600 to-teal-500 text-white text-sm font-bold rounded-xl hover:from-teal-700 hover:to-teal-600 transition-all shadow-md shadow-teal-500/25"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          NEW TRUCK POST
        </button>

        {/* Status Filter Tabs - Right Side */}
        <DatStatusTabs
          tabs={statusTabs}
          activeTab={activeStatus}
          onTabChange={(tab) => setActiveStatus(tab as TruckStatus)}
        />
      </div>

      {/* New Truck Posting Form - Clean Organized Layout */}
      {showNewTruckForm && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden mb-6">
          <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-50 to-teal-50/30 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-sm">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-800">Create New Truck Posting</h3>
                <p className="text-xs text-slate-500">List your truck for available loads</p>
              </div>
            </div>
            <button
              onClick={() => setShowNewTruckForm(false)}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-6">

          {/* Step 1: Select Truck */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Step 1: Select Truck from Your Fleet <span className="text-red-500">*</span>
            </label>
            {loadingApprovedTrucks ? (
              <div className="text-[#064d51]/60 dark:text-gray-400 py-4">Loading your trucks...</div>
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
                  className="w-full max-w-md px-4 py-3 text-sm bg-white dark:bg-slate-800 text-[#064d51] dark:text-gray-100 border border-[#064d51]/20 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-[#1e9c99]"
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
                    <label className="block text-xs font-medium text-[#064d51]/80 dark:text-gray-300 mb-1">
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
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-[#064d51] dark:text-gray-100 border border-[#064d51]/20 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-[#1e9c99]"
                      countryRestriction={['ET', 'DJ']}
                      types={['(cities)']}
                    />
                  </div>

                  {/* Destination */}
                  <div>
                    <label className="block text-xs font-medium text-[#064d51]/80 dark:text-gray-300 mb-1">
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
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-[#064d51] dark:text-gray-100 border border-[#064d51]/20 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-[#1e9c99]"
                      countryRestriction={['ET', 'DJ']}
                      types={['(cities)']}
                    />
                  </div>

                  {/* Available From */}
                  <div>
                    <label className="block text-xs font-medium text-[#064d51]/80 dark:text-gray-300 mb-1">
                      Available From <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={newTruckForm.availableFrom}
                      onChange={(e) => setNewTruckForm({...newTruckForm, availableFrom: e.target.value})}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-[#064d51] dark:text-gray-100 border border-[#064d51]/20 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-[#1e9c99]"
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  {/* Available To */}
                  <div>
                    <label className="block text-xs font-medium text-[#064d51]/80 dark:text-gray-300 mb-1">
                      Available Until
                    </label>
                    <input
                      type="date"
                      value={newTruckForm.availableTo}
                      onChange={(e) => setNewTruckForm({...newTruckForm, availableTo: e.target.value})}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-[#064d51] dark:text-gray-100 border border-[#064d51]/20 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-[#1e9c99]"
                      min={newTruckForm.availableFrom || new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>

                {/* Row 2: Load Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-4">
                  {/* DH-O (Declared Deadhead to Origin Limit) */}
                  <div>
                    <label className="block text-xs font-medium text-[#064d51]/80 dark:text-gray-300 mb-1">
                      DH-O Limit (km)
                    </label>
                    <input
                      type="number"
                      value={newTruckForm.declaredDhO}
                      onChange={(e) => setNewTruckForm({...newTruckForm, declaredDhO: e.target.value})}
                      placeholder="e.g. 100"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-[#064d51] dark:text-gray-100 border border-[#064d51]/20 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-[#1e9c99]"
                      min="0"
                    />
                    <p className="text-xs text-[#064d51]/60 mt-1">Max distance to pickup</p>
                  </div>

                  {/* DH-D (Declared Deadhead after Delivery Limit) */}
                  <div>
                    <label className="block text-xs font-medium text-[#064d51]/80 dark:text-gray-300 mb-1">
                      DH-D Limit (km)
                    </label>
                    <input
                      type="number"
                      value={newTruckForm.declaredDhD}
                      onChange={(e) => setNewTruckForm({...newTruckForm, declaredDhD: e.target.value})}
                      placeholder="e.g. 100"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-[#064d51] dark:text-gray-100 border border-[#064d51]/20 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-[#1e9c99]"
                      min="0"
                    />
                    <p className="text-xs text-[#064d51]/60 mt-1">Max distance after delivery</p>
                  </div>

                  {/* F/P */}
                  <div>
                    <label className="block text-xs font-medium text-[#064d51]/80 dark:text-gray-300 mb-1">
                      Full/Partial
                    </label>
                    <select
                      value={newTruckForm.fullPartial}
                      onChange={(e) => setNewTruckForm({...newTruckForm, fullPartial: e.target.value})}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-[#064d51] dark:text-gray-100 border border-[#064d51]/20 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-[#1e9c99]"
                    >
                      <option value="FULL">Full Load</option>
                      <option value="PARTIAL">Partial</option>
                    </select>
                  </div>

                  {/* Length */}
                  <div>
                    <label className="block text-xs font-medium text-[#064d51]/80 dark:text-gray-300 mb-1">
                      Length (m)
                    </label>
                    <input
                      type="number"
                      value={newTruckForm.lengthM}
                      onChange={(e) => setNewTruckForm({...newTruckForm, lengthM: e.target.value})}
                      placeholder="Available length"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-[#064d51] dark:text-gray-100 border border-[#064d51]/20 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-[#1e9c99]"
                    />
                  </div>

                  {/* Weight */}
                  <div>
                    <label className="block text-xs font-medium text-[#064d51]/80 dark:text-gray-300 mb-1">
                      Weight (kg)
                    </label>
                    <input
                      type="number"
                      value={newTruckForm.weight}
                      onChange={(e) => setNewTruckForm({...newTruckForm, weight: e.target.value})}
                      placeholder="Max capacity"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-[#064d51] dark:text-gray-100 border border-[#064d51]/20 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-[#1e9c99]"
                    />
                  </div>

                  {/* Contact Phone */}
                  <div>
                    <label className="block text-xs font-medium text-[#064d51]/80 dark:text-gray-300 mb-1">
                      Contact Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={newTruckForm.contactPhone}
                      onChange={(e) => setNewTruckForm({...newTruckForm, contactPhone: e.target.value})}
                      placeholder="+251-9xx-xxx-xxx"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-[#064d51] dark:text-gray-100 border border-[#064d51]/20 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-[#1e9c99]"
                    />
                  </div>
                </div>

                {/* Row 3: Comments */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#064d51]/80 dark:text-gray-300 mb-1">
                      Comments <span className="text-gray-400">({newTruckForm.comments1.length}/70)</span>
                    </label>
                    <input
                      type="text"
                      value={newTruckForm.comments1}
                      onChange={(e) => setNewTruckForm({...newTruckForm, comments1: e.target.value.slice(0, 70)})}
                      placeholder="Additional notes for shippers..."
                      maxLength={70}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-[#064d51] dark:text-gray-100 border border-[#064d51]/20 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-[#1e9c99]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#064d51]/80 dark:text-gray-300 mb-1">
                      Additional Comments <span className="text-gray-400">({newTruckForm.comments2.length}/70)</span>
                    </label>
                    <input
                      type="text"
                      value={newTruckForm.comments2}
                      onChange={(e) => setNewTruckForm({...newTruckForm, comments2: e.target.value.slice(0, 70)})}
                      placeholder="Special equipment, requirements..."
                      maxLength={70}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-[#064d51] dark:text-gray-100 border border-[#064d51]/20 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-[#1e9c99]"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowNewTruckForm(false)}
                  className="px-6 py-2 border border-[#064d51]/30 text-[#064d51] rounded-lg hover:bg-[#064d51]/5 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePostTruck}
                  disabled={!newTruckForm.truckId || !newTruckForm.origin || !newTruckForm.availableFrom || !newTruckForm.contactPhone}
                  className="px-6 py-2 bg-[#064d51] text-white rounded-lg hover:bg-[#053d40] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Post Truck
                </button>
              </div>
            </>
          )}
          </div>
        </div>
      )}

      {/* Truck Posts Table */}
      <div className="bg-white rounded-2xl overflow-hidden border border-slate-200/60 shadow-sm">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-800 to-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>
            {trucks.length} Posted Trucks
          </h3>
          <span className="text-xs text-slate-300">Click a truck to see matching loads</span>
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
              setEditingTruckId(null); // Reset editing state when collapsing
              setEditForm({}); // Clear edit form data
              fetchAllMatchingLoads(); // Show all loads when deselected
            } else {
              setExpandedTruckId(truck.id);
              setEditingTruckId(null); // Ensure editing is closed when expanding a new row
              setEditForm({}); // Clear any previous edit form data
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
              <div id={`posting-${truck.id}`} className="p-4">
                {/* Edit Mode - Professional Form Layout */}
                <div className="space-y-4">
                    {/* Header with truck info */}
                    <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-xl">🚛</span>
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-[#064d51]">
                            Edit Truck Posting
                          </h3>
                          <p className="text-xs text-[#064d51]/60">
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
                        <label className="block text-xs font-medium text-[#064d51]/80 mb-1">
                          Origin <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={editForm.origin || ''}
                          onChange={(e) => setEditForm({...editForm, origin: e.target.value})}
                          className="w-full px-3 py-2 text-sm bg-white text-[#064d51] border border-[#064d51]/20 rounded-md focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                        >
                          <option value="">Select city</option>
                          {ethiopianCities.map((city: any) => (
                            <option key={city.id} value={city.id}>{city.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Destination */}
                      <div>
                        <label className="block text-xs font-medium text-[#064d51]/80 mb-1">
                          Destination
                        </label>
                        <select
                          value={editForm.destination || ''}
                          onChange={(e) => setEditForm({...editForm, destination: e.target.value})}
                          className="w-full px-3 py-2 text-sm bg-white text-[#064d51] border border-[#064d51]/20 rounded-md focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                        >
                          <option value="">Anywhere</option>
                          {ethiopianCities.map((city: any) => (
                            <option key={city.id} value={city.id}>{city.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Available From */}
                      <div>
                        <label className="block text-xs font-medium text-[#064d51]/80 mb-1">
                          From <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={editForm.availableFrom || ''}
                          onChange={(e) => setEditForm({...editForm, availableFrom: e.target.value})}
                          className="w-full px-3 py-2 text-sm bg-white text-[#064d51] border border-[#064d51]/20 rounded-md focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                        />
                      </div>

                      {/* Available To */}
                      <div>
                        <label className="block text-xs font-medium text-[#064d51]/80 mb-1">
                          Until
                        </label>
                        <input
                          type="date"
                          value={editForm.availableTo || ''}
                          onChange={(e) => setEditForm({...editForm, availableTo: e.target.value})}
                          className="w-full px-3 py-2 text-sm bg-white text-[#064d51] border border-[#064d51]/20 rounded-md focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                        />
                      </div>

                      {/* Full/Partial */}
                      <div>
                        <label className="block text-xs font-medium text-[#064d51]/80 mb-1">
                          Load Type
                        </label>
                        <select
                          value={editForm.fullPartial || 'FULL'}
                          onChange={(e) => setEditForm({...editForm, fullPartial: e.target.value})}
                          className="w-full px-3 py-2 text-sm bg-white text-[#064d51] border border-[#064d51]/20 rounded-md focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                        >
                          <option value="FULL">Full</option>
                          <option value="PARTIAL">Partial</option>
                        </select>
                      </div>

                      {/* DH-O Limit */}
                      <div>
                        <label className="block text-xs font-medium text-[#064d51]/80 mb-1">
                          DH-O (km)
                        </label>
                        <input
                          type="number"
                          value={editForm.declaredDhO || ''}
                          onChange={(e) => setEditForm({...editForm, declaredDhO: e.target.value})}
                          placeholder="100"
                          className="w-full px-3 py-2 text-sm bg-white text-[#064d51] border border-[#064d51]/20 rounded-md focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                          min="0"
                        />
                      </div>

                      {/* DH-D Limit */}
                      <div>
                        <label className="block text-xs font-medium text-[#064d51]/80 mb-1">
                          DH-D (km)
                        </label>
                        <input
                          type="number"
                          value={editForm.declaredDhD || ''}
                          onChange={(e) => setEditForm({...editForm, declaredDhD: e.target.value})}
                          placeholder="100"
                          className="w-full px-3 py-2 text-sm bg-white text-[#064d51] border border-[#064d51]/20 rounded-md focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                          min="0"
                        />
                      </div>

                      {/* Length */}
                      <div>
                        <label className="block text-xs font-medium text-[#064d51]/80 mb-1">
                          Length (m)
                        </label>
                        <input
                          type="number"
                          value={editForm.lengthM || ''}
                          onChange={(e) => setEditForm({...editForm, lengthM: e.target.value})}
                          placeholder="12"
                          className="w-full px-3 py-2 text-sm bg-white text-[#064d51] border border-[#064d51]/20 rounded-md focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                        />
                      </div>

                      {/* Weight */}
                      <div>
                        <label className="block text-xs font-medium text-[#064d51]/80 mb-1">
                          Weight (kg)
                        </label>
                        <input
                          type="number"
                          value={editForm.weight || ''}
                          onChange={(e) => setEditForm({...editForm, weight: e.target.value})}
                          placeholder="25000"
                          className="w-full px-3 py-2 text-sm bg-white text-[#064d51] border border-[#064d51]/20 rounded-md focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                        />
                      </div>

                      {/* Contact Phone */}
                      <div>
                        <label className="block text-xs font-medium text-[#064d51]/80 mb-1">
                          Phone <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          value={editForm.contactPhone || ''}
                          onChange={(e) => setEditForm({...editForm, contactPhone: e.target.value})}
                          placeholder="+251 9XX"
                          className="w-full px-3 py-2 text-sm bg-white text-[#064d51] border border-[#064d51]/20 rounded-md focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                        />
                      </div>
                    </div>

                    {/* Comments and Actions Row */}
                    <div className="flex items-end gap-4">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-[#064d51]/80 mb-1">
                          Comments <span className="text-gray-400">({editForm.comments1?.length || 0}/70)</span>
                        </label>
                        <input
                          type="text"
                          value={editForm.comments1 || ''}
                          onChange={(e) => setEditForm({...editForm, comments1: e.target.value.slice(0, 70)})}
                          placeholder="Additional notes..."
                          className="w-full px-3 py-2 text-sm bg-white text-[#064d51] border border-[#064d51]/20 rounded-md focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                          maxLength={70}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-[#064d51]/80 mb-1">
                          Additional <span className="text-gray-400">({editForm.comments2?.length || 0}/70)</span>
                        </label>
                        <input
                          type="text"
                          value={editForm.comments2 || ''}
                          onChange={(e) => setEditForm({...editForm, comments2: e.target.value.slice(0, 70)})}
                          placeholder="Special requirements..."
                          className="w-full px-3 py-2 text-sm bg-white text-[#064d51] border border-[#064d51]/20 rounded-md focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                          maxLength={70}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelEdit();
                          }}
                          className="px-4 py-2 text-sm font-medium text-[#064d51]/80 bg-white border border-[#064d51]/20 rounded-md hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveEdit();
                          }}
                          className="px-5 py-2 text-sm font-semibold text-white bg-[#1e9c99] rounded-md hover:bg-[#064d51] transition-colors"
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
      <div className="bg-white rounded-2xl overflow-hidden mt-6 border border-slate-200/60 shadow-sm">
        {/* Header with Total Count and Tabs */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-teal-600 to-teal-500">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              {filteredMatchingLoads.length} Matching Loads
              {selectedTruckId && (
                <span className="ml-2 font-normal text-sm text-teal-100">
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
                className="text-xs text-white/80 hover:text-white underline"
              >
                Show all loads
              </button>
            )}
          </div>

          {/* Tabs on the right */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveLoadTab('all')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                activeLoadTab === 'all'
                  ? 'bg-white text-teal-700'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              ALL
            </button>
            <button
              onClick={() => setActiveLoadTab('preferred')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                activeLoadTab === 'preferred'
                  ? 'bg-white text-teal-700'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              PREFERRED
            </button>
            <button
              onClick={() => setActiveLoadTab('blocked')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                activeLoadTab === 'blocked'
                  ? 'bg-white text-teal-700'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              BLOCKED
            </button>
          </div>
        </div>

        {/* Matching Loads Table */}
        <div className="p-0">
          <DatDataTable
            columns={loadColumns}
            data={filteredMatchingLoads}
            loading={loadingMatches}
            emptyMessage="No matching loads found. Post a truck to see matching loads."
            rowKey="id"
          />
        </div>
      </div>

      {/* Sprint 18: Load Request Modal */}
      {requestModalOpen && selectedLoadForRequest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200/60">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-800 to-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Request Load
              </h3>
              <button
                onClick={() => setRequestModalOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">

            {/* Load Summary */}
            <div className="bg-gradient-to-br from-slate-50 to-teal-50/30 rounded-xl p-4 mb-4 border border-slate-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-1">Route</div>
                  <div className="font-semibold text-slate-800">
                    {selectedLoadForRequest.pickupCity} → {selectedLoadForRequest.deliveryCity}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-1">Shipper</div>
                  <div className="font-semibold text-slate-800">
                    {selectedLoadForRequest.shipper?.name || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-1">Truck Type</div>
                  <div className="font-semibold text-slate-800">
                    {selectedLoadForRequest.truckType?.replace('_', ' ') || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-1">Rate</div>
                  <div className="font-semibold text-teal-600">
                    {selectedLoadForRequest.rate ? `${selectedLoadForRequest.rate} ETB` : 'Negotiable'}
                  </div>
                </div>
              </div>
            </div>

            {/* Truck Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Truck *
              </label>
              <select
                value={selectedTruckForRequest}
                onChange={(e) => setSelectedTruckForRequest(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
              >
                <option value="">Select a truck...</option>
                {getApprovedPostedTrucks().map((posting) => (
                  <option key={posting.truck?.id} value={posting.truck?.id}>
                    {posting.truck?.licensePlate} - {posting.truck?.truckType?.replace('_', ' ')} ({posting.originCity?.name || 'N/A'})
                  </option>
                ))}
              </select>
              {getApprovedPostedTrucks().length === 0 && (
                <p className="text-xs text-rose-500 mt-1">
                  No approved trucks with active postings. Please post a truck first.
                </p>
              )}
            </div>

            {/* Proposed Rate (Optional) */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Proposed Rate (ETB) <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="number"
                value={requestProposedRate}
                onChange={(e) => setRequestProposedRate(e.target.value)}
                placeholder="Leave blank to accept posted rate"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
              />
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Message to Shipper <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <textarea
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
                placeholder="Add any notes or special requirements..."
                rows={3}
                maxLength={500}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all resize-none"
              />
              <p className="text-xs text-slate-400 mt-1">{requestNotes.length}/500</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setRequestModalOpen(false);
                  setSelectedLoadForRequest(null);
                }}
                disabled={submittingRequest}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitLoadRequest}
                disabled={submittingRequest || !selectedTruckForRequest}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-xl hover:from-teal-700 hover:to-teal-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-teal-500/25"
              >
                {submittingRequest ? 'Sending...' : 'Send Request'}
              </button>
            </div>

            <p className="text-xs text-slate-400 mt-4 text-center">
              The shipper will review your request and can approve or reject it.
            </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
