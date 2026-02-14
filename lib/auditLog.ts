/**
 * Audit Logging System
 *
 * Sprint 9 - Story 9.9: Audit Logging & Monitoring
 *
 * Provides comprehensive audit logging for security events and debugging.
 *
 * Features:
 * - Structured logging with consistent format
 * - Database storage for queryability
 * - User and IP tracking
 * - Event categorization
 * - Metadata support
 * - Console logging for development
 *
 * Security Events Logged:
 * - Authentication attempts (success/failure)
 * - Authorization failures
 * - File uploads
 * - Document verifications
 * - Rate limit violations
 * - Account changes
 * - Admin actions
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";

/**
 * Audit event types
 */
export enum AuditEventType {
  // Authentication
  AUTH_LOGIN_SUCCESS = "AUTH_LOGIN_SUCCESS",
  AUTH_LOGIN_FAILURE = "AUTH_LOGIN_FAILURE",
  AUTH_LOGOUT = "AUTH_LOGOUT",
  AUTH_SESSION_EXPIRED = "AUTH_SESSION_EXPIRED",
  AUTH_TOKEN_REFRESH = "AUTH_TOKEN_REFRESH",

  // Authorization
  AUTHZ_ACCESS_DENIED = "AUTHZ_ACCESS_DENIED",
  AUTHZ_PERMISSION_CHECK = "AUTHZ_PERMISSION_CHECK",

  // File Operations
  FILE_UPLOAD = "FILE_UPLOAD",
  FILE_DOWNLOAD = "FILE_DOWNLOAD",
  FILE_DELETE = "FILE_DELETE",

  // Document Operations
  DOCUMENT_CREATED = "DOCUMENT_CREATED",
  DOCUMENT_VERIFIED = "DOCUMENT_VERIFIED",
  DOCUMENT_REJECTED = "DOCUMENT_REJECTED",
  DOCUMENT_DELETED = "DOCUMENT_DELETED",

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  RATE_LIMIT_WARNING = "RATE_LIMIT_WARNING",

  // Account Operations
  ACCOUNT_CREATED = "ACCOUNT_CREATED",
  ACCOUNT_UPDATED = "ACCOUNT_UPDATED",
  ACCOUNT_DELETED = "ACCOUNT_DELETED",
  PASSWORD_CHANGED = "PASSWORD_CHANGED",
  EMAIL_CHANGED = "EMAIL_CHANGED",

  // Admin Actions
  ADMIN_ACTION = "ADMIN_ACTION",
  USER_ROLE_CHANGED = "USER_ROLE_CHANGED",
  ORG_VERIFIED = "ORG_VERIFIED",

  // Truck & Load Operations
  TRUCK_POSTED = "TRUCK_POSTED",
  TRUCK_UPDATED = "TRUCK_UPDATED",
  TRUCK_DELETED = "TRUCK_DELETED",
  LOAD_POSTED = "LOAD_POSTED",
  LOAD_UPDATED = "LOAD_UPDATED",
  LOAD_DELETED = "LOAD_DELETED",

  // Phase 2: Foundation Rule Events
  MATCH_PROPOSAL_CREATED = "MATCH_PROPOSAL_CREATED",
  MATCH_PROPOSAL_APPROVED = "MATCH_PROPOSAL_APPROVED",
  MATCH_PROPOSAL_REJECTED = "MATCH_PROPOSAL_REJECTED",
  TRUCK_REQUEST_CREATED = "TRUCK_REQUEST_CREATED",
  TRUCK_REQUEST_APPROVED = "TRUCK_REQUEST_APPROVED",
  TRUCK_REQUEST_REJECTED = "TRUCK_REQUEST_REJECTED",
  AUTHORITY_VIOLATION = "AUTHORITY_VIOLATION", // Attempts to bypass carrier authority
  VISIBILITY_VIOLATION = "VISIBILITY_VIOLATION", // Attempts to access restricted resources

  // System Events
  SYSTEM_ERROR = "SYSTEM_ERROR",
  CSRF_VIOLATION = "CSRF_VIOLATION",
}

/**
 * Audit log severity levels
 */
export enum AuditSeverity {
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
  CRITICAL = "CRITICAL",
}

/**
 * Audit log entry structure
 */
export interface AuditLogEntry {
  eventType: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  organizationId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  resourceId?: string;
  action?: string;
  result: "SUCCESS" | "FAILURE";
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Get IP address from request
 *
 * @param request NextRequest
 * @returns IP address
 */
function getIpAddress(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Get user agent from request
 *
 * @param request NextRequest
 * @returns User agent
 */
function getUserAgent(request: NextRequest): string {
  return request.headers.get("user-agent") || "unknown";
}

/**
 * Write audit log to database
 *
 * Stores audit log entry in database for querying and retention.
 * Falls back to console logging if database write fails.
 *
 * @param entry Audit log entry
 */
async function writeAuditLogToDatabase(entry: AuditLogEntry): Promise<void> {
  try {
    // Write to database for persistence and querying
    await db.auditLog.create({
      data: {
        eventType: entry.eventType,
        severity: entry.severity,
        userId: entry.userId || null,
        organizationId: entry.organizationId || null,
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent || null,
        resource: entry.resource || null,
        resourceId: entry.resourceId || null,
        action: entry.action || null,
        result: entry.result,
        message: entry.message,
        metadata: entry.metadata || {},
        timestamp: entry.timestamp,
      },
    });
  } catch (error) {
    // If database write fails, log to console as fallback
    console.error("[AUDIT LOG DB ERROR]", error);
    logger.warn("[AUDIT LOG FALLBACK]", { entry });
  }
}

/**
 * Write audit log entry
 *
 * Main logging function that:
 * 1. Logs to console (always)
 * 2. Stores in database (for querying)
 *
 * @param entry Audit log entry
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  // Console logging
  const logPrefix = `[AUDIT] [${entry.severity}] [${entry.eventType}]`;
  const logData = {
    ...entry,
    timestamp: entry.timestamp.toISOString(),
  };

  switch (entry.severity) {
    case AuditSeverity.CRITICAL:
    case AuditSeverity.ERROR:
      console.error(logPrefix, JSON.stringify(logData, null, 2));
      break;
    case AuditSeverity.WARNING:
      console.warn(logPrefix, JSON.stringify(logData, null, 2));
      break;
    default:
  }

  // Database storage (async, doesn't block)
  await writeAuditLogToDatabase(entry);
}

/**
 * Log authentication success
 *
 * @param userId User ID
 * @param email User email
 * @param request Request object
 */
export async function logAuthSuccess(
  userId: string,
  email: string,
  request: NextRequest
): Promise<void> {
  await writeAuditLog({
    eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
    severity: AuditSeverity.INFO,
    userId,
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
    action: "LOGIN",
    result: "SUCCESS",
    message: `User ${email} logged in successfully`,
    metadata: { email },
    timestamp: new Date(),
  });
}

/**
 * Log authentication failure
 *
 * @param email Attempted email
 * @param reason Failure reason
 * @param request Request object
 */
export async function logAuthFailure(
  email: string,
  reason: string,
  request: NextRequest
): Promise<void> {
  await writeAuditLog({
    eventType: AuditEventType.AUTH_LOGIN_FAILURE,
    severity: AuditSeverity.WARNING,
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
    action: "LOGIN",
    result: "FAILURE",
    message: `Login failed for ${email}: ${reason}`,
    metadata: { email, reason },
    timestamp: new Date(),
  });
}

/**
 * Log authorization failure
 *
 * @param userId User ID
 * @param resource Resource being accessed
 * @param action Action attempted
 * @param reason Denial reason
 * @param request Request object
 */
export async function logAuthzFailure(
  userId: string,
  resource: string,
  action: string,
  reason: string,
  request: NextRequest,
  organizationId?: string
): Promise<void> {
  await writeAuditLog({
    eventType: AuditEventType.AUTHZ_ACCESS_DENIED,
    severity: AuditSeverity.WARNING,
    userId,
    organizationId,
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
    resource,
    action,
    result: "FAILURE",
    message: `Access denied to ${resource}: ${reason}`,
    metadata: { reason },
    timestamp: new Date(),
  });
}

/**
 * Log file upload
 *
 * @param userId User ID
 * @param organizationId Organization ID
 * @param fileName File name
 * @param fileSize File size
 * @param fileType File type
 * @param request Request object
 */
export async function logFileUpload(
  userId: string,
  organizationId: string,
  fileName: string,
  fileSize: number,
  fileType: string,
  request: NextRequest
): Promise<void> {
  await writeAuditLog({
    eventType: AuditEventType.FILE_UPLOAD,
    severity: AuditSeverity.INFO,
    userId,
    organizationId,
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
    resource: "FILE",
    action: "UPLOAD",
    result: "SUCCESS",
    message: `File uploaded: ${fileName}`,
    metadata: { fileName, fileSize, fileType },
    timestamp: new Date(),
  });
}

/**
 * Log document verification
 *
 * @param adminUserId Admin user ID who performed verification
 * @param documentId Document ID
 * @param documentType Document type
 * @param verificationStatus APPROVED or REJECTED
 * @param organizationId Organization ID
 * @param request Request object
 * @param rejectionReason Optional rejection reason
 */
export async function logDocumentVerification(
  adminUserId: string,
  documentId: string,
  documentType: string,
  verificationStatus: "APPROVED" | "REJECTED",
  organizationId: string,
  request: NextRequest,
  rejectionReason?: string
): Promise<void> {
  await writeAuditLog({
    eventType:
      verificationStatus === "APPROVED"
        ? AuditEventType.DOCUMENT_VERIFIED
        : AuditEventType.DOCUMENT_REJECTED,
    severity: AuditSeverity.INFO,
    userId: adminUserId,
    organizationId,
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
    resource: "DOCUMENT",
    resourceId: documentId,
    action: "VERIFY",
    result: "SUCCESS",
    message: `Document ${documentType} ${verificationStatus.toLowerCase()} for organization ${organizationId}`,
    metadata: {
      documentType,
      verificationStatus,
      rejectionReason: rejectionReason || null,
    },
    timestamp: new Date(),
  });
}

/**
 * Log rate limit violation
 *
 * @param userId User ID (if authenticated)
 * @param limitName Rate limit name
 * @param endpoint Endpoint that was rate limited
 * @param request Request object
 * @param organizationId Organization ID (optional)
 */
export async function logRateLimitViolation(
  limitName: string,
  endpoint: string,
  request: NextRequest,
  userId?: string,
  organizationId?: string
): Promise<void> {
  await writeAuditLog({
    eventType: AuditEventType.RATE_LIMIT_EXCEEDED,
    severity: AuditSeverity.WARNING,
    userId: userId || undefined,
    organizationId: organizationId || undefined,
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
    resource: endpoint,
    action: "RATE_LIMIT",
    result: "FAILURE",
    message: `Rate limit exceeded for ${limitName} on ${endpoint}`,
    metadata: { limitName, endpoint },
    timestamp: new Date(),
  });
}

/**
 * Log CSRF violation
 *
 * @param endpoint Endpoint that rejected request
 * @param request Request object
 * @param userId User ID (if authenticated)
 */
export async function logCSRFViolation(
  endpoint: string,
  request: NextRequest,
  userId?: string
): Promise<void> {
  await writeAuditLog({
    eventType: AuditEventType.CSRF_VIOLATION,
    severity: AuditSeverity.ERROR,
    userId: userId || undefined,
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
    resource: endpoint,
    action: "CSRF_CHECK",
    result: "FAILURE",
    message: `CSRF token validation failed on ${endpoint}`,
    metadata: { endpoint },
    timestamp: new Date(),
  });
}

/**
 * Log admin action
 *
 * @param adminUserId Admin user ID
 * @param action Action performed
 * @param resource Resource affected
 * @param resourceId Resource ID
 * @param request Request object
 * @param metadata Additional metadata
 */
export async function logAdminAction(
  adminUserId: string,
  action: string,
  resource: string,
  resourceId: string,
  request: NextRequest,
  metadata?: Record<string, unknown>
): Promise<void> {
  await writeAuditLog({
    eventType: AuditEventType.ADMIN_ACTION,
    severity: AuditSeverity.INFO,
    userId: adminUserId,
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
    resource,
    resourceId,
    action,
    result: "SUCCESS",
    message: `Admin ${action} on ${resource} ${resourceId}`,
    metadata: metadata || {},
    timestamp: new Date(),
  });
}

/**
 * Query audit logs with filters
 *
 * @param filters Query filters
 * @returns Audit log entries
 */
export async function queryAuditLogs(filters: {
  userId?: string;
  organizationId?: string;
  eventType?: AuditEventType;
  severity?: AuditSeverity;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const where: Prisma.AuditLogWhereInput = {};

  if (filters.userId) where.userId = filters.userId;
  if (filters.organizationId) where.organizationId = filters.organizationId;
  if (filters.eventType) where.eventType = filters.eventType;
  if (filters.severity) where.severity = filters.severity;

  if (filters.startDate || filters.endDate) {
    where.timestamp = {};
    if (filters.startDate) where.timestamp.gte = filters.startDate;
    if (filters.endDate) where.timestamp.lte = filters.endDate;
  }

  const limit = Math.min(filters.limit || 100, 1000);
  const offset = filters.offset || 0;

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: limit,
      skip: offset,
    }),
    db.auditLog.count({ where }),
  ]);

  return {
    logs,
    total,
    limit,
    offset,
  };
}

/**
 * Get audit log statistics
 *
 * @param organizationId Optional organization filter
 * @param startDate Optional start date
 * @param endDate Optional end date
 * @returns Statistics
 */
export async function getAuditLogStats(
  organizationId?: string,
  startDate?: Date,
  endDate?: Date
) {
  const where: Prisma.AuditLogWhereInput = {};

  if (organizationId) where.organizationId = organizationId;

  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) (where.timestamp as Prisma.DateTimeFilter).gte = startDate;
    if (endDate) (where.timestamp as Prisma.DateTimeFilter).lte = endDate;
  }

  const [
    totalLogs,
    authFailures,
    authzFailures,
    rateLimitViolations,
    csrfViolations,
    fileUploads,
    documentVerifications,
  ] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.count({
      where: { ...where, eventType: AuditEventType.AUTH_LOGIN_FAILURE },
    }),
    db.auditLog.count({
      where: { ...where, eventType: AuditEventType.AUTHZ_ACCESS_DENIED },
    }),
    db.auditLog.count({
      where: { ...where, eventType: AuditEventType.RATE_LIMIT_EXCEEDED },
    }),
    db.auditLog.count({
      where: { ...where, eventType: AuditEventType.CSRF_VIOLATION },
    }),
    db.auditLog.count({
      where: { ...where, eventType: AuditEventType.FILE_UPLOAD },
    }),
    db.auditLog.count({
      where: {
        ...where,
        eventType: {
          in: [
            AuditEventType.DOCUMENT_VERIFIED,
            AuditEventType.DOCUMENT_REJECTED,
          ],
        },
      },
    }),
  ]);

  return {
    totalLogs,
    authFailures,
    authzFailures,
    rateLimitViolations,
    csrfViolations,
    fileUploads,
    documentVerifications,
  };
}

// ============================================================================
// PHASE 2: FOUNDATION RULE AUDIT FUNCTIONS
// ============================================================================

/**
 * Log match proposal creation
 *
 * @param userId Dispatcher user ID
 * @param proposalId Proposal ID
 * @param loadId Load ID
 * @param truckId Truck ID
 * @param request Request object
 */
export async function logMatchProposalCreated(
  userId: string,
  proposalId: string,
  loadId: string,
  truckId: string,
  request: NextRequest,
  organizationId?: string
): Promise<void> {
  await writeAuditLog({
    eventType: AuditEventType.MATCH_PROPOSAL_CREATED,
    severity: AuditSeverity.INFO,
    userId,
    organizationId,
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
    resource: "MATCH_PROPOSAL",
    resourceId: proposalId,
    action: "CREATE",
    result: "SUCCESS",
    message: `Match proposal created: Load ${loadId} -> Truck ${truckId}`,
    metadata: { loadId, truckId, proposalId },
    timestamp: new Date(),
  });
}

/**
 * Log match proposal response (approve/reject)
 *
 * @param userId Carrier user ID
 * @param proposalId Proposal ID
 * @param action APPROVE or REJECT
 * @param request Request object
 */
export async function logMatchProposalResponse(
  userId: string,
  proposalId: string,
  action: "APPROVE" | "REJECT",
  request: NextRequest,
  organizationId?: string
): Promise<void> {
  await writeAuditLog({
    eventType:
      action === "APPROVE"
        ? AuditEventType.MATCH_PROPOSAL_APPROVED
        : AuditEventType.MATCH_PROPOSAL_REJECTED,
    severity: AuditSeverity.INFO,
    userId,
    organizationId,
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
    resource: "MATCH_PROPOSAL",
    resourceId: proposalId,
    action,
    result: "SUCCESS",
    message: `Match proposal ${action.toLowerCase()}d by carrier`,
    metadata: { proposalId, action },
    timestamp: new Date(),
  });
}

/**
 * Log truck request creation
 *
 * @param userId Shipper user ID
 * @param requestId Request ID
 * @param loadId Load ID
 * @param truckId Truck ID
 * @param request Request object
 */
export async function logTruckRequestCreated(
  userId: string,
  requestId: string,
  loadId: string,
  truckId: string,
  request: NextRequest,
  organizationId?: string
): Promise<void> {
  await writeAuditLog({
    eventType: AuditEventType.TRUCK_REQUEST_CREATED,
    severity: AuditSeverity.INFO,
    userId,
    organizationId,
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
    resource: "TRUCK_REQUEST",
    resourceId: requestId,
    action: "CREATE",
    result: "SUCCESS",
    message: `Truck request created: Load ${loadId} -> Truck ${truckId}`,
    metadata: { loadId, truckId, requestId },
    timestamp: new Date(),
  });
}

/**
 * Log truck request response (approve/reject)
 *
 * @param userId Carrier user ID
 * @param requestId Request ID
 * @param action APPROVE or REJECT
 * @param request Request object
 */
export async function logTruckRequestResponse(
  userId: string,
  requestId: string,
  action: "APPROVE" | "REJECT",
  request: NextRequest,
  organizationId?: string
): Promise<void> {
  await writeAuditLog({
    eventType:
      action === "APPROVE"
        ? AuditEventType.TRUCK_REQUEST_APPROVED
        : AuditEventType.TRUCK_REQUEST_REJECTED,
    severity: AuditSeverity.INFO,
    userId,
    organizationId,
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
    resource: "TRUCK_REQUEST",
    resourceId: requestId,
    action,
    result: "SUCCESS",
    message: `Truck request ${action.toLowerCase()}d by carrier`,
    metadata: { requestId, action },
    timestamp: new Date(),
  });
}

/**
 * Log authority violation attempt
 *
 * Foundation Rule: CARRIER_FINAL_AUTHORITY
 * Logs attempts to bypass carrier authority (e.g., dispatcher trying to assign)
 *
 * @param userId User ID who attempted violation
 * @param attemptedAction Action attempted
 * @param resource Resource type
 * @param resourceId Resource ID
 * @param rule Foundation rule violated
 * @param request Request object
 */
export async function logAuthorityViolation(
  userId: string,
  attemptedAction: string,
  resource: string,
  resourceId: string,
  rule: string,
  request: NextRequest,
  organizationId?: string
): Promise<void> {
  await writeAuditLog({
    eventType: AuditEventType.AUTHORITY_VIOLATION,
    severity: AuditSeverity.WARNING,
    userId,
    organizationId,
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
    resource,
    resourceId,
    action: attemptedAction,
    result: "FAILURE",
    message: `Authority violation: Attempted ${attemptedAction} on ${resource} ${resourceId}`,
    metadata: { rule, attemptedAction },
    timestamp: new Date(),
  });
}

/**
 * Log visibility violation attempt
 *
 * Foundation Rule: SHIPPER_DEMAND_FOCUS, CARRIER_SUPPLY_FOCUS
 * Logs attempts to access restricted resources (e.g., shipper browsing fleet)
 *
 * @param userId User ID who attempted violation
 * @param resource Resource type attempted to access
 * @param rule Foundation rule violated
 * @param request Request object
 */
export async function logVisibilityViolation(
  userId: string,
  resource: string,
  rule: string,
  request: NextRequest,
  organizationId?: string
): Promise<void> {
  await writeAuditLog({
    eventType: AuditEventType.VISIBILITY_VIOLATION,
    severity: AuditSeverity.WARNING,
    userId,
    organizationId,
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
    resource,
    action: "ACCESS",
    result: "FAILURE",
    message: `Visibility violation: Attempted to access ${resource}`,
    metadata: { rule },
    timestamp: new Date(),
  });
}
