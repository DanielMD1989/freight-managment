/**
 * Shipper Panel TypeScript Types
 *
 * Centralized type definitions for shipper panel components
 * Created to fix LOW severity 'any' type issues
 */

// =============================================================================
// Load Types
// =============================================================================

export interface Load {
  id: string;
  referenceNumber?: string;
  status: LoadStatus;
  pickupCity: string | null;
  pickupCityId?: string | null;
  deliveryCity: string | null;
  deliveryCityId?: string | null;
  pickupDate: string;
  deliveryDate: string | null;
  pickupAddress?: string | null;
  deliveryAddress?: string | null;
  pickupDockHours?: string | null;
  deliveryDockHours?: string | null;
  truckType: string;
  weight: number;
  lengthM?: number | null;
  fullPartial?: 'FULL' | 'PARTIAL';
  cargoDescription?: string | null;
  specialInstructions?: string | null;
  rate?: number | null;
  offeredRate?: number | null;
  tripKm?: number | null;
  currency?: string;
  shipperId: string;
  shipperContactPhone?: string | null;
  shipperContactName?: string | null;
  postedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  assignedTruckId?: string | null;
  assignedTruck?: AssignedTruck | null;
  shipper?: Organization | null;
}

export type LoadStatus =
  | 'DRAFT'
  | 'UNPOSTED'
  | 'POSTED'
  | 'SEARCHING'
  | 'OFFERED'
  | 'ASSIGNED'
  | 'PICKUP_PENDING'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'EXCEPTION';

export interface AssignedTruck {
  id: string;
  licensePlate: string;
  truckType: string;
  capacity?: number;
  carrier?: {
    id: string;
    name: string;
    isVerified?: boolean;
  };
}

// =============================================================================
// Truck Types
// =============================================================================

export interface Truck {
  id: string;
  licensePlate: string;
  truckType: string;
  capacity: number;
  lengthM?: number | null;
  isAvailable: boolean;
  carrierId: string;
  approvalStatus?: string;
  carrier?: Organization;
}

export interface TruckPosting {
  id: string;
  truckId: string;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  originCityId?: string | null;
  destinationCityId?: string | null;
  currentCity?: string | null;
  destinationCity?: string | null;
  availableFrom: string;
  availableTo?: string | null;
  preferredRate?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  truck: Truck;
  originCity?: City | null;
  destinationCityObj?: City | null;
}

// =============================================================================
// Organization Types
// =============================================================================

export interface Organization {
  id: string;
  name: string;
  type: 'SHIPPER' | 'CARRIER' | 'BOTH';
  isVerified?: boolean;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

// =============================================================================
// City/Location Types
// =============================================================================

export interface City {
  id: string;
  name: string;
  region?: string | null;
  country?: string;
  lat?: number | null;
  lng?: number | null;
}

// =============================================================================
// Match/Proposal Types
// =============================================================================

// TruckMatch can come in different formats depending on API endpoint
export interface TruckMatch {
  id?: string;
  // Direct truck reference (from some endpoints)
  truck?: Truck & { carrier?: Organization };
  carrier?: Organization;
  // Nested in truckPosting (from other endpoints)
  truckPosting?: {
    id: string;
    truck: Truck & { carrier: Organization };
    currentCity: string;
    destinationCity: string | null;
    availableFrom: string;
    availableUntil: string | null;
    preferredRate: number | null;
  };
  matchScore: number;
  matchReasons?: string[];
  distanceMetrics?: {
    tripKm: number;
    dhOriginKm: number;
    dhDestKm: number;
  };
  isExactMatch?: boolean;
  // Additional fields from matching-trucks API
  score?: number;
  posting?: TruckPosting;
  // Direct distance/location fields (flattened from various API responses)
  dhOriginKm?: number;
  dhDestKm?: number;
  currentCity?: string | null;
  originCity?: City | null;
  destinationCity?: City | null;
}

export interface MatchProposal {
  id: string;
  loadId: string;
  truckId: string;
  carrierId: string;
  proposedById: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
  notes?: string | null;
  proposedRate?: number | null;
  expiresAt: string;
  createdAt: string;
  respondedAt?: string | null;
  load?: Load;
  truck?: Truck;
  carrier?: Organization;
  proposedBy?: User;
}

// =============================================================================
// Request Types
// =============================================================================

export interface LoadRequest {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
  notes: string | null;
  proposedRate: number | null;
  expiresAt: string;
  createdAt: string;
  respondedAt: string | null;
  load: Load;
  truck: {
    id: string;
    plateNumber: string;
    truckType: string;
    capacity: number;
  };
  carrier: Organization & { phone?: string };
  requestedBy: User | null;
}

export interface TruckRequest {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
  notes: string | null;
  offeredRate: number | null;
  expiresAt: string;
  createdAt: string;
  respondedAt: string | null;
  load: Load;
  truck: Truck & { carrier: Organization };
  requestedBy: User | null;
}

// =============================================================================
// Trip Types
// =============================================================================

export interface Trip {
  id: string;
  loadId: string;
  status: TripStatus;
  truckId?: string | null;
  carrierId?: string | null;
  shipperId?: string | null;
  trackingEnabled?: boolean;
  trackingUrl?: string | null;
  tripProgressPercent?: number | null;
  remainingDistanceKm?: number | null;
  estimatedTripKm?: number | null;
  assignedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  podUrl?: string | null;
  podSubmitted?: boolean;
  podVerified?: boolean;
  shipperConfirmed?: boolean;
  shipperConfirmedAt?: string | null;
  receiverName?: string | null;
  receiverPhone?: string | null;
  deliveryNotes?: string | null;
  cancelReason?: string | null;
  createdAt: string;
  updatedAt: string;
  load?: Load;
  truck?: Truck;
  carrier?: Organization;
  shipper?: Organization;
}

export type TripStatus =
  | 'ASSIGNED'
  | 'PICKUP_PENDING'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';

// =============================================================================
// User Types
// =============================================================================

export interface User {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string;
  phone?: string | null;
  role: UserRole;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  organizationId?: string | null;
}

export type UserRole =
  | 'SHIPPER'
  | 'CARRIER'
  | 'DISPATCHER'
  | 'ADMIN'
  | 'SUPER_ADMIN';

// =============================================================================
// Wallet Types
// =============================================================================

export interface WalletTransaction {
  id: string;
  type: 'CREDIT' | 'DEBIT' | 'REFUND' | 'FEE' | 'SETTLEMENT';
  amount: number;
  balance: number;
  description: string;
  referenceId?: string | null;
  referenceType?: string | null;
  createdAt: string;
}

export interface Wallet {
  id: string;
  balance: number;
  currency: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Document Types
// =============================================================================

export interface Document {
  id: string;
  loadId?: string | null;
  tripId?: string | null;
  documentType: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number | null;
  mimeType?: string | null;
  uploadedById: string;
  createdAt: string;
}

export interface TripPod {
  id: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  notes: string | null;
  uploadedAt: string;
}

// =============================================================================
// Escalation Types
// =============================================================================

export interface Escalation {
  id: string;
  loadId: string;
  escalationType: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  description: string;
  assignedTo?: string | null;
  resolvedAt?: string | null;
  resolution?: string | null;
  createdAt: string;
  updatedAt: string;
  load?: Load;
}

// =============================================================================
// Dashboard Types
// =============================================================================

export interface ShipperDashboardStats {
  loadsPosted: number;
  activeTrips: number;
  completedTrips: number;
  pendingRequests: number;
  totalSpent: number;
  walletBalance: number;
}

export interface LoadStatusCounts {
  POSTED: number;
  UNPOSTED: number;
  EXPIRED: number;
  ASSIGNED: number;
  IN_TRANSIT: number;
  DELIVERED: number;
  COMPLETED: number;
}

// =============================================================================
// Search Types
// =============================================================================

export interface SavedSearch {
  id: string;
  name: string;
  type: 'LOADS' | 'TRUCKS';
  criteria: Record<string, unknown>;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchFilters {
  origin?: string;
  destination?: string;
  truckType?: string;
  minWeight?: number;
  maxWeight?: number;
  minLength?: number;
  maxLength?: number;
  availableFrom?: string;
  availableTo?: string;
  verifiedOnly?: boolean;
}

// =============================================================================
// Pagination Types
// =============================================================================

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface ApiError {
  error: string;
  message?: string;
  details?: Record<string, unknown>;
}

export interface ApiSuccess<T> {
  data?: T;
  message?: string;
}

// =============================================================================
// Form Data Types
// =============================================================================

export interface LoadFormData {
  pickupDate: string;
  pickupCity: string;
  deliveryCity: string;
  pickupDockHours?: string;
  truckType: string;
  fullPartial: 'FULL' | 'PARTIAL';
  lengthM?: string;
  weight: string;
  shipperContactPhone?: string;
  cargoDescription: string;
  specialInstructions?: string;
}

export interface TruckSearchFormData {
  name: string;
  origin?: string;
  destination?: string;
  truckType?: string;
  ageHours?: number;
  dhOriginMin?: number;
  dhOriginMax?: number;
  dhDestMin?: number;
  dhDestMax?: number;
  minLength?: number;
  maxLength?: number;
  minWeight?: number;
  maxWeight?: number;
  fullPartial?: string;
  availableFrom?: string;
  availableTo?: string;
  showVerifiedOnly?: boolean;
}
