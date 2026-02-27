/**
 * Carrier Loadboard Types
 *
 * Type definitions for the carrier loadboard components
 * Sprint 19 - Type Safety Improvements
 */

// ============================================================================
// USER TYPES
// ============================================================================

export interface CarrierUser {
  userId: string;
  email: string;
  role: string;
  organizationId?: string | null;
  firstName?: string;
  lastName?: string;
  status?: string;
}

// ============================================================================
// LOCATION TYPES
// ============================================================================

export interface EthiopianCity {
  id: string;
  name: string;
  nameEthiopic?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
}

// ============================================================================
// LOAD TYPES
// ============================================================================

export interface Load {
  id: string;
  status: string;
  pickupCity: string;
  deliveryCity: string;
  pickupDate?: string;
  deliveryDate?: string;
  pickupAddress?: string;
  deliveryAddress?: string;
  truckType?: string;
  weight?: number;
  tripKm?: number;
  estimatedTripKm?: number;
  fullPartial?: "FULL" | "PARTIAL";
  bookMode?: "REQUEST" | "INSTANT";
  cargoDescription?: string;
  rate?: number;
  shipper?: {
    id: string;
    name: string;
    isVerified?: boolean;
  };
  originLat?: number;
  originLon?: number;
  destinationLat?: number;
  destinationLon?: number;
  postedAt?: string;
  createdAt?: string;
  // Computed fields
  dhToPickup?: number;
  dhToOriginKm?: number;
  dhAfterDeliveryKm?: number;
  withinDhLimits?: boolean;
  matchScore?: number;
  // Extended match fields - for when load is from match API
  load?: Load;
}

export interface LoadRequest {
  id: string;
  loadId: string;
  status: string;
  createdAt: string;
}

// ============================================================================
// TRUCK TYPES
// ============================================================================

export interface Truck {
  id: string;
  licensePlate: string;
  truckType: string;
  capacity?: number;
  volume?: number;
  lengthM?: number;
  isAvailable: boolean;
  currentCity?: string;
  currentRegion?: string;
  currentLocationLat?: number;
  currentLocationLon?: number;
  approvalStatus?: string;
  carrier?: {
    id: string;
    name: string;
    isVerified?: boolean;
  };
}

export interface TruckPosting {
  id: string;
  truckId: string;
  status: "ACTIVE" | "INACTIVE" | "EXPIRED" | "POSTED" | "UNPOSTED";
  originCity?: EthiopianCity;
  destinationCity?: EthiopianCity;
  originCityId?: string;
  destinationCityId?: string;
  origin?: string;
  destination?: string;
  availableFrom?: string;
  availableTo?: string;
  notes?: string;
  keepPosted?: boolean;
  truck: Truck;
  truckType?: string;
  fullPartial?: "FULL" | "PARTIAL";
  ownerName?: string;
  contactPhone?: string;
  availableLength?: number;
  availableWeight?: number;
  preferredDhToOriginKm?: number;
  preferredDhAfterDeliveryKm?: number;
  postedAt?: string;
  createdAt?: string;
  // Computed fields
  matchCount?: number;
  matchingLoads?: Load[];
}

export interface TruckWithPosting extends TruckPosting {
  posting?: TruckPosting;
  postings?: TruckPosting[];
  lengthM?: number;
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface LoadFilterValues {
  truckType: string;
  truckTypeMode: "ANY" | "EXACT" | "ONLY";
  origin: string;
  destination: string;
  availDate: string;
  dhOrigin: string;
  dhDestination: string;
  fullPartial: string;
  length: string;
  weight: string;
  searchBack: string;
  [key: string]: string | number | boolean | undefined;
}

export interface TruckFilterValues {
  truckType: string;
  origin: string;
  destination: string;
  availableFrom: string;
  availableTo: string;
  [key: string]: string | number | boolean | undefined;
}

// ============================================================================
// MATCH TYPES
// ============================================================================

export interface TruckMatch {
  truckPosting: {
    id: string;
    truck: {
      id: string;
      licensePlate: string;
      truckType: string;
      carrier: {
        name: string;
      };
      currentCity?: string;
    };
  };
  matchScore?: number;
  distance?: number;
}

export interface LoadMatch {
  load: Load;
  matchScore?: number;
  distance?: number;
  // Extended match data
  id?: string;
  dhToOriginKm?: number;
  dhAfterDeliveryKm?: number;
  withinDhLimits?: boolean;
  truckOrigin?: string;
  truckDestination?: string;
}

// ============================================================================
// PAGINATION TYPES
// ============================================================================

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore?: boolean;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface LoadsResponse {
  loads: Load[];
  total?: number;
  page?: number;
  pageSize?: number;
}

export interface TrucksResponse {
  trucks: Truck[];
  total?: number;
  page?: number;
  pageSize?: number;
}

export interface TruckPostingsResponse {
  postings: TruckPosting[];
  total?: number;
  page?: number;
  pageSize?: number;
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface NewTruckPostingForm {
  origin: string;
  destination: string;
  availableFrom: string;
  availableTo: string;
  notes: string;
  truckId?: string;
}

export interface TruckPostingUpdatePayload {
  originCityId?: string;
  destinationCityId?: string;
  availableFrom?: string;
  availableTo?: string;
  notes?: string;
  status?: string;
  keepPosted?: boolean;
  // Extended edit form fields
  origin?: string;
  destination?: string;
  owner?: string;
  truckType?: string;
  fullPartial?: string;
  lengthM?: string | number;
  weight?: string | number;
  contactPhone?: string;
  comments1?: string;
  comments2?: string;
  declaredDhO?: string | number;
  declaredDhD?: string | number;
  // API update payload fields
  availableLength?: number | null;
  availableWeight?: number | null;
  ownerName?: string | null;
  preferredDhToOriginKm?: number | null;
  preferredDhAfterDeliveryKm?: number | null;
}
