// RBAC Permission System for Freight Management Platform
// Sprint 1: Role Consolidation - 5 Roles Only
// Phase 2 Update: Foundation Rules Enforcement - Dispatcher Coordination Only

export enum Permission {
  // User Management - Granular Permissions
  VIEW_USERS = "view_users", // View non-admin users (Admin)
  VIEW_ALL_USERS = "view_all_users", // View all users including admins (SuperAdmin)
  MANAGE_USERS = "manage_users", // Legacy - general user management
  ASSIGN_ROLES = "assign_roles", // SuperAdmin only

  // User Creation (role-specific)
  CREATE_ADMIN = "create_admin", // SuperAdmin only
  CREATE_OPERATIONAL_USERS = "create_operational_users", // Create Carrier/Shipper/Dispatcher (Admin, SuperAdmin)

  // User Status Management
  ACTIVATE_DEACTIVATE_USERS = "activate_deactivate_users", // Admin (non-admin), SuperAdmin (any)

  // User Data Management
  CHANGE_USER_PHONE = "change_user_phone", // Admin, SuperAdmin (users cannot change own)

  // User Deletion (role-specific)
  DELETE_ADMIN = "delete_admin", // SuperAdmin only
  DELETE_NON_ADMIN_USERS = "delete_non_admin_users", // Admin, SuperAdmin

  // Organization Management
  VIEW_ORGANIZATIONS = "view_organizations",
  MANAGE_ORGANIZATIONS = "manage_organizations",
  VERIFY_ORGANIZATIONS = "verify_organizations", // Admin

  // Document Management
  UPLOAD_DOCUMENTS = "upload_documents", // Shipper, Carrier during registration
  VIEW_DOCUMENTS = "view_documents",
  VERIFY_DOCUMENTS = "verify_documents", // Admin

  // Load Management
  CREATE_LOAD = "create_load", // Shipper
  POST_LOADS = "post_loads", // Shipper
  VIEW_LOADS = "view_loads", // Carrier, Dispatcher, Admin, SuperAdmin
  VIEW_ALL_LOADS = "view_all_loads", // Dispatcher, Admin, SuperAdmin
  EDIT_LOADS = "edit_loads", // Shipper (own loads)
  DELETE_LOADS = "delete_loads", // Shipper (own loads)
  MANAGE_OWN_LOADS = "manage_own_loads", // Shipper
  MANAGE_ALL_LOADS = "manage_all_loads", // Dispatcher, Admin, SuperAdmin
  ASSIGN_LOADS = "assign_loads", // Dispatcher
  UNASSIGN_LOADS = "unassign_loads", // Dispatcher
  TRACK_LOAD_STATUS = "track_load_status", // Shipper, Admin, SuperAdmin

  // Truck Management
  CREATE_TRUCK = "create_truck", // Carrier
  POST_TRUCKS = "post_trucks", // Carrier
  VIEW_TRUCKS = "view_trucks", // Shipper (for shipper-led matching), Dispatcher, Admin
  VIEW_ALL_TRUCKS = "view_all_trucks", // Dispatcher, Admin, SuperAdmin
  EDIT_TRUCKS = "edit_trucks", // Carrier (own trucks)
  DELETE_TRUCKS = "delete_trucks", // Carrier (own trucks)
  MANAGE_OWN_TRUCKS = "manage_own_trucks", // Carrier
  MANAGE_ALL_TRUCKS = "manage_all_trucks", // Dispatcher, Admin, SuperAdmin

  // Trip Execution (Carrier)
  ACCEPT_LOADS = "accept_loads", // Carrier
  UPDATE_TRIP_STATUS = "update_trip_status", // Carrier
  UPLOAD_POD = "upload_pod", // Carrier (Proof of Delivery)
  VIEW_POD = "view_pod", // Shipper, Admin, SuperAdmin

  // GPS Management
  VIEW_GPS = "view_gps", // Carrier (own), Admin, SuperAdmin
  MANAGE_GPS_DEVICES = "manage_gps_devices", // Admin
  VIEW_ALL_GPS = "view_all_gps", // Admin, SuperAdmin
  VIEW_LIVE_TRACKING = "view_live_tracking", // Shipper (own loads), Admin

  // Financial Management
  VIEW_WALLET = "view_wallet", // Shipper, Carrier (read-only for Carrier)
  MANAGE_WALLET = "manage_wallet", // Admin (top-ups, adjustments)
  DEPOSIT_FUNDS = "deposit_funds", // Shipper, Carrier
  WITHDRAW_FUNDS = "withdraw_funds", // Shipper, Carrier
  VIEW_ALL_ACCOUNTS = "view_all_accounts", // Admin, SuperAdmin
  APPROVE_WITHDRAWALS = "approve_withdrawals", // Admin
  MANAGE_SETTLEMENTS = "manage_settlements", // Admin

  // Service Fees & Penalties
  CONFIGURE_SERVICE_FEES = "configure_service_fees", // Admin
  CONFIGURE_PENALTIES = "configure_penalties", // Admin
  VIEW_SERVICE_FEE_REPORTS = "view_service_fee_reports", // Admin, SuperAdmin

  // Dispatch Operations
  DISPATCH_LOADS = "dispatch_loads", // Dispatcher
  VIEW_UNASSIGNED_LOADS = "view_unassigned_loads", // Dispatcher
  VIEW_REJECTED_LOADS = "view_rejected_loads", // Dispatcher
  ESCALATE_TO_ADMIN = "escalate_to_admin", // Dispatcher
  PROPOSE_MATCH = "propose_match", // Dispatcher - propose load-truck match (Phase 2: no direct assignment)

  // Exception Management
  VIEW_EXCEPTIONS = "view_exceptions", // Dispatcher, Admin, SuperAdmin
  MANAGE_EXCEPTIONS = "manage_exceptions", // Admin
  RESOLVE_EXCEPTIONS = "resolve_exceptions", // Admin
  OVERRIDE_EXCEPTIONS = "override_exceptions", // SuperAdmin

  // Automation Rules (Sprint 7)
  CONFIGURE_AUTOMATION_RULES = "configure_automation_rules", // Admin
  MANAGE_RULES = "manage_rules", // Admin - Create, update, delete automation rules
  VIEW_RULES = "view_rules", // Admin, Dispatcher - View automation rules
  CONFIGURE_THRESHOLDS = "configure_thresholds", // Admin
  VIEW_AUTOMATION_LOGS = "view_automation_logs", // Admin, SuperAdmin

  // Disputes & Reports
  CREATE_DISPUTE = "create_dispute", // Shipper, Carrier
  MANAGE_DISPUTES = "manage_disputes", // Admin
  CREATE_REPORT = "create_report", // Shipper, Carrier
  MANAGE_REPORTS = "manage_reports", // Admin

  // Analytics
  VIEW_ANALYTICS = "view_analytics", // Admin (limited), SuperAdmin (full)
  VIEW_FULL_ANALYTICS = "view_full_analytics", // SuperAdmin only
  VIEW_AUDIT_LOGS = "view_audit_logs", // SuperAdmin only

  // Platform Configuration
  MANAGE_SYSTEM_CONFIG = "manage_system_config", // SuperAdmin only
  GLOBAL_OVERRIDE = "global_override", // SuperAdmin only

  // Dashboard
  VIEW_DASHBOARD = "view_dashboard", // All roles
}

export type Role =
  | "SHIPPER"
  | "CARRIER"
  | "DISPATCHER"
  | "ADMIN"
  | "SUPER_ADMIN";

/**
 * Permission mappings based on frozen role definitions
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  /**
   * SHIPPER
   * Can Do:
   * - Manage own profile
   * - Create loads
   * - View assigned trucks
   * - Track trips
   * - View proof of delivery
   *
   * Cannot Do:
   * - Create/manage users
   * - Modify trucks
   * - Execute trips
   */
  SHIPPER: [
    // Load management
    Permission.CREATE_LOAD,
    Permission.POST_LOADS,
    Permission.VIEW_LOADS,
    Permission.EDIT_LOADS,
    Permission.DELETE_LOADS,
    Permission.MANAGE_OWN_LOADS,
    Permission.TRACK_LOAD_STATUS,

    // Truck search (shipper-led matching)
    Permission.VIEW_TRUCKS,

    // Tracking & POD
    Permission.VIEW_LIVE_TRACKING,
    Permission.VIEW_POD,

    // Documents
    Permission.UPLOAD_DOCUMENTS,
    Permission.VIEW_DOCUMENTS,

    // Wallet (view only)
    Permission.VIEW_WALLET,

    // Disputes
    Permission.CREATE_DISPUTE,
    Permission.CREATE_REPORT,

    // Dashboard
    Permission.VIEW_DASHBOARD,
  ],

  /**
   * CARRIER
   * Can Do:
   * - Manage own profile
   * - Manage own trucks
   * - Post trucks
   * - Search loads
   * - Accept/execute loads
   * - Update trip status
   * - Upload proof of delivery
   * - View wallet (read-only)
   *
   * Cannot Do:
   * - Create/manage users
   * - Activate/deactivate users
   * - Change phone number of others
   * - Delete users
   */
  CARRIER: [
    // Truck management
    Permission.CREATE_TRUCK,
    Permission.POST_TRUCKS,
    Permission.VIEW_TRUCKS,
    Permission.EDIT_TRUCKS,
    Permission.DELETE_TRUCKS,
    Permission.MANAGE_OWN_TRUCKS,

    // Load search & acceptance
    Permission.VIEW_LOADS,
    Permission.ACCEPT_LOADS,

    // Trip execution
    Permission.UPDATE_TRIP_STATUS,
    Permission.UPLOAD_POD,

    // GPS
    Permission.VIEW_GPS,

    // Documents
    Permission.UPLOAD_DOCUMENTS,
    Permission.VIEW_DOCUMENTS,

    // Wallet (view only)
    Permission.VIEW_WALLET,

    // Disputes
    Permission.CREATE_DISPUTE,
    Permission.CREATE_REPORT,

    // Dashboard
    Permission.VIEW_DASHBOARD,
  ],

  /**
   * DISPATCHER
   * Can Do:
   * - View trucks (availability only)
   * - View loads
   * - Propose matches (carrier must approve)
   * - Monitor trips
   * - Escalate to Admin
   *
   * Cannot Do:
   * - Create/manage users
   * - Modify trucks
   * - Execute trips
   * - Upload POD
   * - Change user data
   * - Assign loads directly (carrier authority only)
   */
  DISPATCHER: [
    // Load visibility (read-only coordination)
    Permission.VIEW_ALL_LOADS,
    Permission.VIEW_LOADS,
    Permission.DISPATCH_LOADS,

    // Match proposal (NOT assignment - carrier must approve)
    Permission.PROPOSE_MATCH,

    // Queue monitoring
    Permission.VIEW_UNASSIGNED_LOADS,
    Permission.VIEW_REJECTED_LOADS,

    // Truck visibility (posted trucks only for availability)
    Permission.VIEW_ALL_TRUCKS,
    Permission.VIEW_TRUCKS,

    // Exception handling
    Permission.VIEW_EXCEPTIONS,
    Permission.ESCALATE_TO_ADMIN,

    // Automation rules (view only)
    Permission.VIEW_RULES,

    // GPS monitoring (for coordination)
    Permission.VIEW_ALL_GPS,

    // Wallet (view only)
    Permission.VIEW_WALLET,

    // Dashboard
    Permission.VIEW_DASHBOARD,
  ],

  /**
   * ADMIN
   * User Management (non-admin only):
   * - Create Carrier, Shipper, Dispatcher
   * - Activate/Deactivate Carrier, Shipper, Dispatcher
   * - Change phone for Carrier, Shipper, Dispatcher
   * - Delete Carrier, Shipper, Dispatcher
   * - View all non-admin users
   *
   * Cannot Do:
   * - Create Super Admin or Admin
   * - Modify Super Admin
   * - Delete Admin users
   * - Execute trips
   *
   * Platform:
   * - Verify documents and organizations
   * - Manage wallet top-ups and adjustments
   * - Configure service fees and penalties
   * - Resolve escalations and exceptions
   */
  ADMIN: [
    // User management (non-admin users only)
    Permission.VIEW_USERS, // View Carrier, Shipper, Dispatcher
    Permission.CREATE_OPERATIONAL_USERS, // Create Carrier, Shipper, Dispatcher
    Permission.ACTIVATE_DEACTIVATE_USERS, // Activate/Deactivate non-admin users
    Permission.CHANGE_USER_PHONE, // Change phone for non-admin users
    Permission.DELETE_NON_ADMIN_USERS, // Delete Carrier, Shipper, Dispatcher
    // Cannot: CREATE_ADMIN, DELETE_ADMIN, VIEW_ALL_USERS, ASSIGN_ROLES

    // Organization management
    Permission.VIEW_ORGANIZATIONS,
    Permission.MANAGE_ORGANIZATIONS,

    // Document verification
    Permission.VERIFY_DOCUMENTS,
    Permission.VERIFY_ORGANIZATIONS,

    // Load & truck visibility
    Permission.VIEW_LOADS,
    Permission.VIEW_ALL_LOADS,
    Permission.MANAGE_ALL_LOADS,
    Permission.VIEW_TRUCKS,
    Permission.VIEW_ALL_TRUCKS,
    Permission.MANAGE_ALL_TRUCKS,

    // Wallet management
    Permission.MANAGE_WALLET,
    Permission.VIEW_ALL_ACCOUNTS,
    Permission.APPROVE_WITHDRAWALS,
    Permission.MANAGE_SETTLEMENTS,

    // Service fees & penalties
    Permission.CONFIGURE_SERVICE_FEES,
    Permission.CONFIGURE_PENALTIES,
    Permission.VIEW_SERVICE_FEE_REPORTS,

    // Automation rules
    Permission.CONFIGURE_AUTOMATION_RULES,
    Permission.MANAGE_RULES,
    Permission.VIEW_RULES,
    Permission.CONFIGURE_THRESHOLDS,
    Permission.VIEW_AUTOMATION_LOGS,

    // Exception resolution
    Permission.VIEW_EXCEPTIONS,
    Permission.MANAGE_EXCEPTIONS,
    Permission.RESOLVE_EXCEPTIONS,

    // Disputes
    Permission.MANAGE_DISPUTES,
    Permission.MANAGE_REPORTS,

    // GPS
    Permission.VIEW_ALL_GPS,
    Permission.MANAGE_GPS_DEVICES,

    // Tracking
    Permission.VIEW_LIVE_TRACKING,
    Permission.VIEW_POD,

    // Analytics (limited)
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_AUDIT_LOGS,

    // System config
    Permission.MANAGE_SYSTEM_CONFIG,

    // Dashboard
    Permission.VIEW_DASHBOARD,
  ],

  /**
   * SUPER_ADMIN (Highest Authority)
   * User Management:
   * - Create Admin users (CREATE_ADMIN)
   * - Activate/Deactivate ANY user
   * - Change phone number for ANY user
   * - Delete ANY user including Admin (DELETE_ADMIN)
   * - View ALL users (VIEW_ALL_USERS)
   * - Assign and revoke roles (ASSIGN_ROLES)
   *
   * Platform:
   * - Platform-wide configuration
   * - Full analytics access
   * - Audit log access
   * - Global override authority
   *
   * Cannot: Execute trips, act as carrier/shipper/dispatcher
   */
  SUPER_ADMIN: [
    // ALL permissions
    ...Object.values(Permission),
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false; // Handle invalid roles
  return permissions.includes(permission);
}

export function hasAnyPermission(
  role: Role,
  permissions: Permission[]
): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function hasAllPermissions(
  role: Role,
  permissions: Permission[]
): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}

export function getRolePermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role];
}
