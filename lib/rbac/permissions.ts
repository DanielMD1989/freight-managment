// RBAC Permission System for Freight Management Platform

export enum Permission {
  // User Management
  VIEW_USERS = "view_users",
  MANAGE_USERS = "manage_users",
  ASSIGN_ROLES = "assign_roles",

  // Organization Management
  VIEW_ORGANIZATIONS = "view_organizations",
  MANAGE_ORGANIZATIONS = "manage_organizations",
  VERIFY_ORGANIZATIONS = "verify_organizations",
  VERIFY_DOCUMENTS = "verify_documents",

  // Load Management
  CREATE_LOAD = "create_load",
  VIEW_LOADS = "view_loads",
  MANAGE_OWN_LOADS = "manage_own_loads",
  MANAGE_ALL_LOADS = "manage_all_loads",
  ASSIGN_LOADS = "assign_loads",

  // Truck Management
  CREATE_TRUCK = "create_truck",
  VIEW_TRUCKS = "view_trucks",
  MANAGE_OWN_TRUCKS = "manage_own_trucks",
  MANAGE_ALL_TRUCKS = "manage_all_trucks",

  // GPS Management
  VIEW_GPS = "view_gps",
  MANAGE_GPS_DEVICES = "manage_gps_devices",
  VIEW_ALL_GPS = "view_all_gps",

  // Financial Management
  VIEW_WALLET = "view_wallet",
  DEPOSIT_FUNDS = "deposit_funds",
  WITHDRAW_FUNDS = "withdraw_funds",
  VIEW_ALL_ACCOUNTS = "view_all_accounts",
  APPROVE_WITHDRAWALS = "approve_withdrawals",
  MANAGE_ESCROW = "manage_escrow",

  // Dispatch
  ACCEPT_LOADS = "accept_loads",
  DISPATCH_LOADS = "dispatch_loads",

  // Disputes & Reports
  CREATE_DISPUTE = "create_dispute",
  MANAGE_DISPUTES = "manage_disputes",
  CREATE_REPORT = "create_report",
  MANAGE_REPORTS = "manage_reports",

  // Admin
  VIEW_DASHBOARD = "view_dashboard",
  MANAGE_SYSTEM_CONFIG = "manage_system_config",
}

export type Role =
  | "SHIPPER"
  | "CARRIER"
  | "LOGISTICS_AGENT"
  | "DRIVER"
  | "PLATFORM_OPS"
  | "ADMIN";

// Permission mappings for each role
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SHIPPER: [
    Permission.CREATE_LOAD,
    Permission.VIEW_LOADS,
    Permission.MANAGE_OWN_LOADS,
    Permission.VIEW_TRUCKS,
    Permission.VIEW_WALLET,
    Permission.DEPOSIT_FUNDS,
    Permission.WITHDRAW_FUNDS,
    Permission.CREATE_DISPUTE,
    Permission.CREATE_REPORT,
    Permission.VIEW_DASHBOARD,
  ],

  CARRIER: [
    Permission.CREATE_TRUCK,
    Permission.VIEW_TRUCKS,
    Permission.MANAGE_OWN_TRUCKS,
    Permission.VIEW_LOADS,
    Permission.ACCEPT_LOADS,
    Permission.VIEW_GPS,
    Permission.VIEW_WALLET,
    Permission.DEPOSIT_FUNDS,
    Permission.WITHDRAW_FUNDS,
    Permission.CREATE_DISPUTE,
    Permission.CREATE_REPORT,
    Permission.VIEW_DASHBOARD,
  ],

  LOGISTICS_AGENT: [
    Permission.CREATE_LOAD,
    Permission.VIEW_LOADS,
    Permission.MANAGE_OWN_LOADS,
    Permission.CREATE_TRUCK,
    Permission.VIEW_TRUCKS,
    Permission.MANAGE_OWN_TRUCKS,
    Permission.ACCEPT_LOADS,
    Permission.VIEW_GPS,
    Permission.VIEW_WALLET,
    Permission.DEPOSIT_FUNDS,
    Permission.WITHDRAW_FUNDS,
    Permission.CREATE_DISPUTE,
    Permission.CREATE_REPORT,
    Permission.VIEW_DASHBOARD,
  ],

  DRIVER: [
    Permission.VIEW_LOADS,
    Permission.VIEW_TRUCKS,
    Permission.VIEW_GPS,
    Permission.CREATE_REPORT,
    Permission.VIEW_DASHBOARD,
  ],

  PLATFORM_OPS: [
    Permission.VIEW_USERS,
    Permission.VIEW_ORGANIZATIONS,
    Permission.VERIFY_DOCUMENTS,
    Permission.VIEW_LOADS,
    Permission.MANAGE_ALL_LOADS,
    Permission.ASSIGN_LOADS,
    Permission.DISPATCH_LOADS,
    Permission.VIEW_TRUCKS,
    Permission.MANAGE_ALL_TRUCKS,
    Permission.VIEW_ALL_GPS,
    Permission.MANAGE_GPS_DEVICES,
    Permission.VIEW_ALL_ACCOUNTS,
    Permission.APPROVE_WITHDRAWALS,
    Permission.MANAGE_ESCROW,
    Permission.MANAGE_DISPUTES,
    Permission.MANAGE_REPORTS,
    Permission.VIEW_DASHBOARD,
  ],

  ADMIN: [
    // Admins have all permissions
    ...Object.values(Permission),
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
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
