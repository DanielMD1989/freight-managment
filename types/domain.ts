/**
 * Domain Types - Single Source of Truth
 *
 * These types mirror the Prisma schema and should be used across:
 * - Web app components
 * - API responses
 * - Mobile app (generate Dart from these)
 *
 * IMPORTANT: Keep in sync with prisma/schema.prisma
 * Last synced: 2026-01-22
 */

// =============================================================================
// ENUMS - Must match Prisma schema exactly
// =============================================================================

export type UserRole =
  | "SHIPPER"
  | "CARRIER"
  | "DISPATCHER"
  | "ADMIN"
  | "SUPER_ADMIN";

export type UserStatus =
  | "REGISTERED"
  | "PENDING_VERIFICATION"
  | "ACTIVE"
  | "SUSPENDED"
  | "REJECTED";

export type LoadStatus =
  | "DRAFT"
  | "POSTED"
  | "SEARCHING"
  | "OFFERED"
  | "ASSIGNED"
  | "PICKUP_PENDING"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "COMPLETED"
  | "EXCEPTION"
  | "CANCELLED"
  | "EXPIRED"
  | "UNPOSTED";

export type TripStatus =
  | "ASSIGNED"
  | "PICKUP_PENDING"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED";

export type TruckType =
  | "FLATBED"
  | "REFRIGERATED"
  | "TANKER"
  | "CONTAINER"
  | "DRY_VAN"
  | "LOWBOY"
  | "DUMP_TRUCK"
  | "BOX_TRUCK";

export type LoadType = "FULL" | "PARTIAL";

export type BookMode = "REQUEST" | "INSTANT";

export type PostingStatus = "ACTIVE" | "EXPIRED" | "CANCELLED" | "MATCHED";

export type RequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED";

export type ServiceFeeStatus =
  | "PENDING"
  | "RESERVED"
  | "DEDUCTED"
  | "REFUNDED"
  | "WAIVED";

export type VerificationStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED";

export type GpsDeviceStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SIGNAL_LOST"
  | "MAINTENANCE";

export type OrganizationType =
  | "SHIPPER"
  | "CARRIER_COMPANY"
  | "CARRIER_INDIVIDUAL"
  | "CARRIER_ASSOCIATION"
  | "FLEET_OWNER"
  | "LOGISTICS_AGENT";

export type DisputeType =
  | "PAYMENT_ISSUE"
  | "DAMAGE"
  | "LATE_DELIVERY"
  | "QUALITY_ISSUE"
  | "OTHER";

export type DisputeStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "CLOSED";

export type NotificationType =
  | "LOAD_ASSIGNED"
  | "LOAD_STATUS_CHANGE"
  | "TRUCK_REQUEST"
  | "TRUCK_REQUEST_APPROVED"
  | "TRUCK_REQUEST_REJECTED"
  | "LOAD_REQUEST"
  | "LOAD_REQUEST_APPROVED"
  | "LOAD_REQUEST_REJECTED"
  | "GPS_OFFLINE"
  | "GPS_ONLINE"
  | "POD_SUBMITTED"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_PENDING"
  | "USER_SUSPENDED"
  | "RATING_RECEIVED"
  | "EXCEPTION_REPORTED"
  | "GEOFENCE_ALERT"
  | "NEW_LOAD_MATCHING"
  | "MARKETING"
  | "SYSTEM";

// =============================================================================
// CORE DOMAIN MODELS
// =============================================================================

/**
 * User - Platform user account
 */
export interface User {
  id: string;
  email: string;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role: UserRole;
  status: UserStatus;
  organizationId?: string | null;
  organization?: Organization | null;
  isActive: boolean;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Organization - Company/carrier/shipper entity
 */
export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  description?: string | null;
  contactEmail: string;
  contactPhone: string;
  address?: string | null;
  city?: string | null;
  isVerified: boolean;
  verifiedAt?: Date | null;
  licenseNumber?: string | null;
  taxId?: string | null;
  // Trust metrics
  completionRate?: number | null;
  cancellationRate?: number | null;
  disputeRate?: number | null;
  totalLoadsCompleted: number;
  totalLoadsCancelled: number;
  totalDisputes: number;
  // Bypass detection
  isFlagged: boolean;
  flaggedAt?: Date | null;
  flagReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Load - Freight load posting
 */
export interface Load {
  id: string;
  status: LoadStatus;
  postedAt?: Date | null;

  // Location & Schedule
  pickupCity?: string | null;
  pickupCityId?: string | null;
  pickupAddress?: string | null;
  pickupDockHours?: string | null;
  pickupDate: Date;
  appointmentRequired: boolean;
  deliveryCity?: string | null;
  deliveryCityId?: string | null;
  deliveryAddress?: string | null;
  deliveryDockHours?: string | null;
  deliveryDate: Date;

  // Coordinates
  originLat?: number | null;
  originLon?: number | null;
  destinationLat?: number | null;
  destinationLon?: number | null;

  // Load Details
  truckType: TruckType;
  weight: number;
  volume?: number | null;
  cargoDescription: string;
  fullPartial: LoadType;
  isFragile: boolean;
  requiresRefrigeration: boolean;
  lengthM?: number | null;
  casesCount?: number | null;

  // Distance
  tripKm?: number | null;
  estimatedTripKm?: number | null;
  dhToOriginKm?: number | null;
  dhAfterDeliveryKm?: number | null;
  actualTripKm?: number | null;

  // Pricing
  currency: string;
  bookMode: BookMode;

  // Service Fees
  serviceFeeEtb?: number | null;
  shipperServiceFee?: number | null;
  shipperFeeStatus: ServiceFeeStatus;
  carrierServiceFee?: number | null;
  carrierFeeStatus: ServiceFeeStatus;
  corridorId?: string | null;

  // Settlement
  settlementStatus?: string | null;
  settledAt?: Date | null;

  // Privacy & Safety
  isAnonymous: boolean;
  shipperContactName?: string | null;
  shipperContactPhone?: string | null;
  safetyNotes?: string | null;
  specialInstructions?: string | null;

  // POD
  podUrl?: string | null;
  podSubmitted: boolean;
  podSubmittedAt?: Date | null;
  podVerified: boolean;
  podVerifiedAt?: Date | null;

  // Tracking
  trackingUrl?: string | null;
  trackingEnabled: boolean;
  trackingStartedAt?: Date | null;

  // Trip Progress
  tripProgressPercent: number;
  remainingDistanceKm?: number | null;

  // Assignment
  shipperId: string;
  shipper?: Organization | null;
  createdById?: string | null;
  assignedTruckId?: string | null;
  assignedTruck?: Truck | null;
  assignedAt?: Date | null;

  // Timestamps
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Truck - Carrier's truck/vehicle
 */
export interface Truck {
  id: string;
  truckType: TruckType;
  licensePlate: string;
  capacity: number;
  volume?: number | null;
  isAvailable: boolean;

  // Location
  currentCity?: string | null;
  currentRegion?: string | null;
  currentLocationLat?: number | null;
  currentLocationLon?: number | null;
  locationUpdatedAt?: Date | null;
  lengthM?: number | null;

  // Contact
  ownerName?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;

  // GPS Device
  imei?: string | null;
  gpsProvider?: string | null;
  gpsStatus?: GpsDeviceStatus | null;
  gpsLastSeenAt?: Date | null;
  gpsVerifiedAt?: Date | null;

  // P1-003-B FIX: GPS Tracking Fields (mobile-web parity)
  lastLatitude?: number | null;
  lastLongitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  gpsUpdatedAt?: Date | null;

  // Approval
  approvalStatus: VerificationStatus;
  approvedAt?: Date | null;
  approvedById?: string | null;
  rejectionReason?: string | null;

  // Relations
  carrierId: string;
  carrier?: Organization | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Trip - Active trip tracking
 */
export interface Trip {
  id: string;
  status: TripStatus;

  // Relations
  loadId: string;
  load?: Load | null;
  truckId: string;
  truck?: Truck | null;
  carrierId: string;
  carrier?: Organization | null;
  shipperId: string;
  shipper?: Organization | null;

  // Current Location
  currentLat?: number | null;
  currentLng?: number | null;
  currentLocationUpdatedAt?: Date | null;

  // Pickup Location
  pickupLat?: number | null;
  pickupLng?: number | null;
  pickupAddress?: string | null;
  pickupCity?: string | null;

  // Delivery Location
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  deliveryAddress?: string | null;
  deliveryCity?: string | null;

  // Timing
  startedAt?: Date | null;
  pickedUpAt?: Date | null;
  deliveredAt?: Date | null;
  completedAt?: Date | null;

  // Receiver Info
  receiverName?: string | null;
  receiverPhone?: string | null;
  deliveryNotes?: string | null;

  // Shipper Confirmation
  shipperConfirmed: boolean;
  shipperConfirmedAt?: Date | null;
  shipperConfirmedBy?: string | null;

  // Cancellation
  cancelledAt?: Date | null;
  cancelledBy?: string | null;
  cancelReason?: string | null;

  // Distance
  estimatedDistanceKm?: number | null;
  actualDistanceKm?: number | null;
  estimatedDurationMin?: number | null;

  // Tracking
  trackingUrl?: string | null;
  trackingEnabled: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * TruckPosting - Truck availability posting
 */
export interface TruckPosting {
  id: string;
  status: PostingStatus;

  // Truck
  truckId: string;
  truck?: Truck | null;

  // Location
  originCityId: string;
  originCityName?: string | null;
  destinationCityId?: string | null;
  destinationCityName?: string | null;

  // Availability
  availableFrom: Date;
  availableTo?: Date | null;
  fullPartial: LoadType;
  availableLength?: number | null;
  availableWeight?: number | null;

  // Contact
  contactName: string;
  contactPhone: string;
  ownerName?: string | null;
  notes?: string | null;

  // Relations
  carrierId: string;
  carrier?: Organization | null;
  createdById: string;

  // Timestamps
  postedAt: Date;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * TruckRequest - Shipper request for truck
 */
export interface TruckRequest {
  id: string;
  status: RequestStatus;

  // Relations
  loadId: string;
  load?: Load | null;
  truckId: string;
  truck?: Truck | null;
  shipperId: string;
  shipper?: Organization | null;
  requestedById: string;
  carrierId: string;
  carrier?: Organization | null;

  // Request Details
  notes?: string | null;
  offeredRate?: number | null;

  // Response
  respondedAt?: Date | null;
  responseNotes?: string | null;
  respondedById?: string | null;

  // Timestamps
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * LoadRequest - Carrier request for load
 */
export interface LoadRequest {
  id: string;
  status: RequestStatus;

  // Relations
  loadId: string;
  load?: Load | null;
  truckId: string;
  truck?: Truck | null;
  carrierId: string;
  carrier?: Organization | null;
  requestedById: string;
  shipperId: string;
  shipper?: Organization | null;

  // Request Details
  notes?: string | null;
  proposedRate?: number | null;

  // Response
  respondedAt?: Date | null;
  responseNotes?: string | null;
  respondedById?: string | null;

  // Timestamps
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Notification - User notification
 */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

/**
 * GpsPosition - GPS tracking position
 */
export interface GpsPosition {
  id: string;
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
  altitude?: number | null;
  accuracy?: number | null;
  timestamp: Date;
}

/**
 * TripPod - Proof of Delivery document
 */
export interface TripPod {
  id: string;
  tripId: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  mimeType: string;
  notes?: string | null;
  uploadedAt: Date;
  uploadedBy: string;
}

/**
 * Dispute - Load dispute between shipper and carrier
 */
export interface Dispute {
  id: string;
  type: DisputeType;
  status: DisputeStatus;
  description: string;
  evidenceUrls?: string[] | null;
  resolution?: string | null;
  resolvedAt?: Date | null;
  loadId: string;
  load?: Load | null;
  createdById: string;
  createdBy?: User | null;
  disputedOrgId: string;
  disputedOrg?: Organization | null;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface LoadsResponse {
  loads: Load[];
  pagination: PaginationInfo;
}

export interface TrucksResponse {
  trucks: Truck[];
  pagination: PaginationInfo;
}

export interface TripsResponse {
  trips: Trip[];
  pagination: PaginationInfo;
}

export interface TruckPostingsResponse {
  postings: TruckPosting[];
  pagination: PaginationInfo;
}

export interface DisputesResponse {
  disputes: Dispute[];
  pagination: PaginationInfo;
}

export interface ApiError {
  error: string;
  details?: unknown;
  statusCode?: number;
}

// =============================================================================
// COMPUTED FIELDS (calculated by backend, included in responses)
// =============================================================================

export interface LoadWithComputed extends Load {
  ageMinutes?: number;
  rpmEtbPerKm?: number | null;
  trpmEtbPerKm?: number | null;
}

export interface TripWithProgress extends Trip {
  progressPercent?: number;
  remainingKm?: number | null;
  eta?: Date | null;
}
