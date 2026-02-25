/**
 * Types re-export from shared domain types
 * Single source of truth: types/domain.ts at project root
 */
export type {
  UserRole,
  UserStatus,
  LoadStatus,
  TripStatus,
  TruckType,
  LoadType,
  BookMode,
  PostingStatus,
  RequestStatus,
  ServiceFeeStatus,
  VerificationStatus,
  GpsDeviceStatus,
  OrganizationType,
  NotificationType,
  DisputeType,
  DisputeStatus,
  User,
  Organization,
  Load,
  Truck,
  Trip,
  TruckPosting,
  TruckRequest,
  LoadRequest,
  Notification,
  GpsPosition,
  TripPod,
  Dispute,
  PaginationInfo,
  LoadsResponse,
  TrucksResponse,
  TripsResponse,
  TruckPostingsResponse,
  DisputesResponse,
  ApiError,
  LoadWithComputed,
  TripWithProgress,
} from "../../../types/domain";

/** Carrier dashboard from GET /api/carrier/dashboard */
export interface CarrierDashboardStats {
  totalTrucks: number;
  activeTrucks: number;
  activePostings: number;
  completedDeliveries: number;
  inTransitTrips: number;
  totalServiceFeesPaid: number;
  totalDistance: number;
  wallet: { balance: number; currency: string };
  recentPostings: number;
  pendingApprovals: number;
}

/** Shipper dashboard from GET /api/shipper/dashboard */
export interface ShipperDashboardStats {
  stats: {
    totalLoads: number;
    activeLoads: number;
    inTransitLoads: number;
    deliveredLoads: number;
    totalSpent: number;
    pendingPayments: number;
  };
  loadsByStatus: Array<{ status: string; count: number }>;
  wallet: { balance: number; currency: string };
}

/** Auth response from login/register */
export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
    status: string;
    organizationId: string | null;
  };
  sessionToken?: string;
  csrfToken?: string;
  requiresMfa?: boolean;
  mfaToken?: string;
}

/** Login request payload */
export interface LoginPayload {
  email: string;
  password: string;
}

/** MFA verification payload */
export interface MfaPayload {
  mfaToken: string;
  code: string;
}

/** Register request payload */
export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: "SHIPPER" | "CARRIER" | "DISPATCHER";
  companyName: string;
  carrierType?: string;
  associationId?: string;
}
