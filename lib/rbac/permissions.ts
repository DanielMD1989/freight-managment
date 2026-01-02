// RBAC Permission System for Freight Management Platform
// Sprint 1: Role Consolidation - 5 Roles Only

export enum Permission {
  // User Management
  VIEW_USERS = "view_users",
  MANAGE_USERS = "manage_users",
  ASSIGN_ROLES = "assign_roles", // SuperAdmin only

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
  MANAGE_ESCROW = "manage_escrow", // Admin

  // Commission & Penalties
  CONFIGURE_COMMISSION = "configure_commission", // Admin
  CONFIGURE_PENALTIES = "configure_penalties", // Admin
  VIEW_COMMISSION_REPORTS = "view_commission_reports", // Admin, SuperAdmin

  // Dispatch Operations
  DISPATCH_LOADS = "dispatch_loads", // Dispatcher
  VIEW_UNASSIGNED_LOADS = "view_unassigned_loads", // Dispatcher
  VIEW_REJECTED_LOADS = "view_rejected_loads", // Dispatcher
  ESCALATE_TO_ADMIN = "escalate_to_admin", // Dispatcher

  // Exception Management
  VIEW_EXCEPTIONS = "view_exceptions", // Dispatcher, Admin, SuperAdmin
  MANAGE_EXCEPTIONS = "manage_exceptions", // Admin
  RESOLVE_EXCEPTIONS = "resolve_exceptions", // Admin
  OVERRIDE_EXCEPTIONS = "override_exceptions", // SuperAdmin

  // Automation Rules
  CONFIGURE_AUTOMATION_RULES = "configure_automation_rules", // Admin
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
   * - Post loads
   * - Track load status
   * - View live map tracking
   * - View proof of delivery
   * - View shipment history
   * - Optionally select trucks on web (shipper-led matching)
   */
  SHIPPER: [
    // Load management
    Permission.CREATE_LOAD,
    Permission.POST_LOADS,
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

    // Wallet
    Permission.VIEW_WALLET,
    Permission.DEPOSIT_FUNDS,
    Permission.WITHDRAW_FUNDS,

    // Disputes
    Permission.CREATE_DISPUTE,
    Permission.CREATE_REPORT,

    // Dashboard
    Permission.VIEW_DASHBOARD,
  ],

  /**
   * CARRIER
   * - Register and upload documents
   * - Search and filter loads
   * - Accept loads
   * - Execute trips
   * - Update trip status
   * - Upload proof of delivery
   * - View wallet (read-only)
   * - Mobile location tracking enabled during active trips
   */
  CARRIER: [
    // Truck management
    Permission.CREATE_TRUCK,
    Permission.POST_TRUCKS,
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

    // Wallet (read-only)
    Permission.VIEW_WALLET,
    Permission.DEPOSIT_FUNDS,
    Permission.WITHDRAW_FUNDS,

    // Disputes
    Permission.CREATE_DISPUTE,
    Permission.CREATE_REPORT,

    // Dashboard
    Permission.VIEW_DASHBOARD,
  ],

  /**
   * DISPATCHER
   * - Manage daily dispatching
   * - Assign and unassign loads
   * - Monitor unassigned and rejected loads
   * - Handle operational issues
   * - Escalate to Admin when required
   */
  DISPATCHER: [
    // Load management
    Permission.VIEW_ALL_LOADS,
    Permission.MANAGE_ALL_LOADS,
    Permission.ASSIGN_LOADS,
    Permission.UNASSIGN_LOADS,
    Permission.DISPATCH_LOADS,

    // Queue monitoring
    Permission.VIEW_UNASSIGNED_LOADS,
    Permission.VIEW_REJECTED_LOADS,

    // Truck visibility
    Permission.VIEW_ALL_TRUCKS,
    Permission.MANAGE_ALL_TRUCKS,

    // Exception handling
    Permission.VIEW_EXCEPTIONS,
    Permission.ESCALATE_TO_ADMIN,

    // GPS monitoring
    Permission.VIEW_ALL_GPS,

    // Dashboard
    Permission.VIEW_DASHBOARD,
  ],

  /**
   * ADMIN
   * - Verify and approve registration documents
   * - Manage wallet top-ups and adjustments
   * - Configure commission and penalties
   * - Configure automation rules and thresholds
   * - Resolve escalations and exceptions
   * - View analytics
   */
  ADMIN: [
    // User management
    Permission.VIEW_USERS,
    Permission.VIEW_ORGANIZATIONS,

    // Document verification
    Permission.VERIFY_DOCUMENTS,
    Permission.VERIFY_ORGANIZATIONS,

    // Load & truck visibility
    Permission.VIEW_ALL_LOADS,
    Permission.MANAGE_ALL_LOADS,
    Permission.VIEW_ALL_TRUCKS,
    Permission.MANAGE_ALL_TRUCKS,

    // Wallet management
    Permission.MANAGE_WALLET,
    Permission.VIEW_ALL_ACCOUNTS,
    Permission.APPROVE_WITHDRAWALS,
    Permission.MANAGE_ESCROW,

    // Commission & penalties
    Permission.CONFIGURE_COMMISSION,
    Permission.CONFIGURE_PENALTIES,
    Permission.VIEW_COMMISSION_REPORTS,

    // Automation rules
    Permission.CONFIGURE_AUTOMATION_RULES,
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

    // Dashboard
    Permission.VIEW_DASHBOARD,
  ],

  /**
   * SUPER_ADMIN
   * - Assign and revoke roles
   * - Platform-wide configuration
   * - Full analytics access
   * - Audit log access
   * - Global override authority
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
