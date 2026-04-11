import {
  getSession,
  getSessionAny,
  requireActiveUser,
  SessionPayload,
} from "@/lib/auth";
import {
  Permission,
  type Role,
  hasPermission as checkPermission,
  hasAnyPermission as checkAnyPermission,
  hasAllPermissions as checkAllPermissions,
} from "./permissions";

export { Permission } from "./permissions";
export type { Role } from "./permissions";
export {
  getAccessRoles,
  canView,
  canModify,
  isAdminRole,
  isSuperAdminRole,
  type SessionInfo,
  type AccessRoles,
} from "./accessHelpers";

export class UnauthorizedError extends Error {
  constructor(message: string = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = "Forbidden: Insufficient permissions") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function getCurrentUserRole(): Promise<Role | null> {
  // BUG #8 fix: support BOTH cookies (web) and Bearer tokens (mobile).
  // Previously this used cookie-only getSession() which silently
  // returned null for mobile clients, breaking hasRole/hasPermission
  // and any downstream auth check that flowed through this helper.
  const session = await getSessionAny();
  return session ? (session.role as Role) : null;
}

export async function hasRole(role: Role): Promise<boolean> {
  const currentRole = await getCurrentUserRole();
  return currentRole === role;
}

export async function hasAnyRole(roles: Role[]): Promise<boolean> {
  const currentRole = await getCurrentUserRole();
  return currentRole ? roles.includes(currentRole) : false;
}

export async function requireRole(
  allowedRoles: Role[]
): Promise<SessionPayload> {
  const session = await requireActiveUser();

  if (!allowedRoles.includes(session.role as Role)) {
    throw new ForbiddenError(
      `This action requires one of the following roles: ${allowedRoles.join(", ")}`
    );
  }

  return session;
}

export async function hasPermission(permission: Permission): Promise<boolean> {
  const role = await getCurrentUserRole();
  if (!role) return false;

  return checkPermission(role, permission);
}

export async function hasAnyPermission(
  permissions: Permission[]
): Promise<boolean> {
  const role = await getCurrentUserRole();
  if (!role) return false;

  return checkAnyPermission(role, permissions);
}

export async function hasAllPermissions(
  permissions: Permission[]
): Promise<boolean> {
  const role = await getCurrentUserRole();
  if (!role) return false;

  return checkAllPermissions(role, permissions);
}

export async function requirePermission(
  permission: Permission
): Promise<SessionPayload> {
  const session = await requireActiveUser();

  if (!checkPermission(session.role as Role, permission)) {
    throw new ForbiddenError(
      `This action requires the permission: ${permission}`
    );
  }

  return session;
}

export async function requireAnyPermission(
  permissions: Permission[]
): Promise<SessionPayload> {
  const session = await requireActiveUser();

  if (!checkAnyPermission(session.role as Role, permissions)) {
    throw new ForbiddenError(
      `This action requires one of the following permissions: ${permissions.join(", ")}`
    );
  }

  return session;
}

export async function requireAllPermissions(
  permissions: Permission[]
): Promise<SessionPayload> {
  const session = await requireActiveUser();

  if (!checkAllPermissions(session.role as Role, permissions)) {
    throw new ForbiddenError(
      `This action requires all of the following permissions: ${permissions.join(", ")}`
    );
  }

  return session;
}

// Helper to check if user is admin or super admin
export async function isAdmin(): Promise<boolean> {
  return await hasAnyRole(["ADMIN", "SUPER_ADMIN"]);
}

// Helper to check if user is ops (legacy - now checks for ADMIN or SUPER_ADMIN)
export async function isOps(): Promise<boolean> {
  return await hasAnyRole(["ADMIN", "SUPER_ADMIN"]);
}

// Helper to check if user is super admin
export async function isSuperAdmin(): Promise<boolean> {
  return await hasRole("SUPER_ADMIN");
}

// Helper to check if user can manage an organization
export async function canManageOrganization(
  organizationId: string
): Promise<boolean> {
  // BUG #8 fix: use getSessionAny() so mobile Bearer tokens are recognized.
  // The cookie-only getSession() returned null for mobile clients, which
  // made carrier+shipper unable to update their own organization on
  // mobile (PATCH /api/organizations/[id] returned 403 every time).
  const session = await getSessionAny();
  if (!session) return false;

  // Drivers never manage organizations — they are workers inside a carrier org,
  // not representatives of it.
  if (session.role === "DRIVER") return false;

  // Admin or Super Admin can manage any organization
  if (session.role === "ADMIN" || session.role === "SUPER_ADMIN") return true;

  // User can only manage their own organization
  return session.organizationId === organizationId;
}
