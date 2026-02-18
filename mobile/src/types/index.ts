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
  PaginationInfo,
  LoadsResponse,
  TrucksResponse,
  TripsResponse,
  TruckPostingsResponse,
  ApiError,
  LoadWithComputed,
  TripWithProgress,
} from "../../../types/domain";

/** Dashboard stats returned by /api/dashboard */
export interface DashboardStats {
  totalLoads: number;
  activeLoads: number;
  totalTrips: number;
  activeTrips: number;
  totalTrucks: number;
  availableTrucks: number;
  pendingRequests: number;
  completionRate: number;
  revenue: number;
  recentActivity: Array<{
    id: string;
    type: string;
    message: string;
    timestamp: string;
  }>;
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
