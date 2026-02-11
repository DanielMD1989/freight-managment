/**
 * Dispatcher Panel TypeScript Types
 *
 * Centralized type definitions for all dispatcher components
 * Created to fix H1-H6 type safety issues
 */

// ============================================
// Dashboard Types
// ============================================

export interface DashboardStats {
  postedLoads: number;
  assignedLoads: number;
  inTransitLoads: number;
  availableTrucks: number;
  deliveriesToday: number;
  onTimeRate: number;
  alertCount: number;
}

export interface PickupToday {
  id: string;
  pickupCity: string;
  deliveryCity: string;
  pickupDate: string;
  status: string;
  truckType: string;
}

export interface DashboardData {
  stats: DashboardStats;
  pickupsToday: PickupToday[];
}

export interface DashboardUser {
  userId: string;
  email: string;
  role: string;
  name?: string;
}

// ============================================
// Load Types
// ============================================

export interface DispatcherLoad {
  id: string;
  status: string;
  pickupCity: string;
  deliveryCity: string;
  pickupDate: string;
  deliveryDate: string;
  truckType: string;
  weight: number;
  rate: number | null;
  currency: string;
  cargoDescription?: string;
  shipper?: {
    id: string;
    name: string;
  };
  assignedTruck?: {
    id: string;
    licensePlate: string;
  };
}

// ============================================
// Truck Types
// ============================================

export interface DispatcherTruckPosting {
  id: string;
  status: string;
  availableFrom: string;
  availableTo: string;
  originCity?: { id: string; name: string };
  destinationCity?: { id: string; name: string };
  truck: {
    id: string;
    licensePlate: string;
    truckType: string;
    capacity: number;
    gpsStatus?: string;
    imei?: string;
    carrier?: {
      id: string;
      name: string;
    };
  };
  carrier?: {
    id: string;
    name: string;
  };
}

// ============================================
// Trip Types
// ============================================

export interface DispatcherTrip {
  id: string;
  status: string;
  pickupCity: string;
  deliveryCity: string;
  trackingEnabled: boolean;
  trackingUrl: string | null;
  currentLat: number | null;
  currentLng: number | null;
  lastLocationUpdate: string | null;
  createdAt: string;
  estimatedDistanceKm: number | null;
  load?: {
    id: string;
    pickupCity: string;
    deliveryCity: string;
    cargoDescription: string;
    weight: number;
    truckType: string;
    pickupDate: string;
    deliveryDate: string;
  };
  truck?: {
    id: string;
    licensePlate: string;
    truckType: string;
    contactName: string;
    contactPhone: string;
  };
  carrier?: {
    id: string;
    name: string;
    isVerified: boolean;
  };
  shipper?: {
    id: string;
    name: string;
  };
}

// ============================================
// Escalation Types
// ============================================

export interface DispatcherEscalation {
  id: string;
  escalationType: string;
  priority: string;
  status: string;
  title: string;
  description: string | null;
  notes: string | null;
  resolution: string | null;
  assignedTo: string | null;
  createdAt: string;
  resolvedAt: string | null;
  load: {
    id: string;
    status: string;
    pickupCity: string;
    deliveryCity: string;
    assignedTruck?: {
      licensePlate: string;
      carrier?: {
        name: string;
      };
    };
    shipper?: {
      name: string;
    };
  };
}

export interface EscalationStats {
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}

// ============================================
// Match Proposal Types
// ============================================

export interface MatchProposal {
  id: string;
  status: string;
  notes: string | null;
  proposedRate: number | null;
  expiresAt: string;
  createdAt: string;
  respondedAt: string | null;
  responseNotes: string | null;
  load: {
    pickupCity: string;
    deliveryCity: string;
    pickupDate: string;
    weight: number;
    truckType: string;
    status: string;
  };
  truck: {
    licensePlate: string;
    truckType: string;
    capacity: number;
  };
  carrier: {
    name: string;
  };
}

// ============================================
// Find Matches Modal Types
// ============================================

export interface MatchingTruck {
  id: string;
  matchScore: number;
  truck: {
    id: string;
    licensePlate: string;
    truckType: string;
    capacity: number;
  };
  carrier?: {
    id: string;
    name: string;
  };
  originCity?: {
    name: string;
  };
  currentCity?: string;
}

export interface MatchingLoad {
  load: {
    id: string;
    pickupCity: string;
    deliveryCity: string;
    weight: number;
    truckType: string;
    pickupDate: string;
    shipper?: {
      name: string;
    };
  };
  matchScore: number;
}

// ============================================
// Map Types
// ============================================

export interface MapTruck {
  id: string;
  plateNumber: string;
  truckType: string;
  capacity: number;
  status: string;
  gpsStatus?: 'ACTIVE' | 'OFFLINE' | 'NO_DEVICE';
  currentLocation?: {
    lat: number;
    lng: number;
    updatedAt?: string;
  };
  carrier: {
    name: string;
  };
  region?: string;
}

export interface MapLoad {
  id: string;
  referenceNumber: string;
  status: string;
  cargoType: string;
  weight: number;
  truckType?: string;
  pickupCity?: string;
  deliveryCity?: string;
  pickupLocation: {
    lat: number;
    lng: number;
    address: string;
  };
  deliveryLocation: {
    lat: number;
    lng: number;
    address: string;
  };
  shipper: {
    name: string;
  };
}

export interface MapTrip {
  id: string;
  loadId: string;
  status: string;
  truck: {
    id: string;
    plateNumber: string;
  };
  currentLocation?: {
    lat: number;
    lng: number;
  };
  pickupLocation: {
    lat: number;
    lng: number;
    address: string;
  };
  deliveryLocation: {
    lat: number;
    lng: number;
    address: string;
  };
}

export interface RoadDistance {
  distanceKm: number;
  durationMinutes: number;
  source: string;
}

// ============================================
// Pagination Types
// ============================================

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ============================================
// Constants
// ============================================

export const DISPATCHER_PAGE_SIZE = 50;
export const DISPATCHER_SEARCH_LIMIT = 20;
export const DISPATCHER_MAX_PICKUPS_TODAY = 10;

// ============================================
// Status Filter Types
// ============================================

export type LoadStatusFilter = 'ALL' | 'DRAFT' | 'POSTED' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
export type TruckStatusFilter = 'ALL' | 'ACTIVE' | 'EXPIRED' | 'MATCHED';
export type TripStatusFilter = 'ALL' | 'ASSIGNED' | 'PICKUP_PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';
export type EscalationStatusFilter = 'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
export type EscalationPriorityFilter = 'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type ProposalStatusFilter = 'all' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

// ============================================
// Error Handling Utility
// ============================================

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred';
}
