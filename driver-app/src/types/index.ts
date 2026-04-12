export type {
  UserRole,
  UserStatus,
  TripStatus,
  Trip,
  TripPod,
  Notification,
  PaginationInfo,
  TripsResponse,
  ApiError,
} from "../../../types/domain";

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
  phoneLastFour?: string;
  expiresIn?: number;
}

export interface LoginPayload {
  email: string;
  password: string;
}
export interface MfaPayload {
  mfaToken: string;
  code: string;
}

// Not used by driver app but needed by authService.register() signature
export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: "SHIPPER" | "CARRIER" | "DISPATCHER";
  companyName?: string;
  carrierType?: string;
  associationId?: string;
  organizationId?: string;
  taxId?: string;
}

export interface AcceptInvitePayload {
  inviteCode: string;
  phone: string;
  password: string;
  cdlNumber?: string;
  cdlExpiry?: string;
  medicalCertExp?: string;
}

export interface AcceptInviteResponse {
  success: boolean;
  message: string;
  driverId: string;
  loginEmail: string;
}

export interface DriverProfile {
  id: string;
  cdlNumber: string | null;
  cdlState: string | null;
  cdlExpiry: string | null;
  medicalCertExp: string | null;
  endorsements: unknown;
  isAvailable: boolean;
}
