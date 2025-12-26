/**
 * Error Handling Utility
 *
 * Sprint 9 - Story 9.7: Error Handling & Information Disclosure Prevention
 *
 * Provides safe error responses that prevent information disclosure while
 * maintaining detailed server-side logging for debugging.
 *
 * Security Principles:
 * - Never expose database errors to users
 * - Never expose file paths to users
 * - Never expose stack traces to users
 * - Never expose internal implementation details
 * - Always log detailed errors server-side
 * - Always include request ID for correlation
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

/**
 * Standard error codes for the application
 */
export enum ErrorCode {
  // Authentication & Authorization (400-403)
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Validation Errors (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FORMAT = 'INVALID_FORMAT',

  // Resource Errors (404, 409)
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',

  // Rate Limiting & CSRF (429, 403)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  CSRF_TOKEN_INVALID = 'CSRF_TOKEN_INVALID',

  // Server Errors (500)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  FILE_SYSTEM_ERROR = 'FILE_SYSTEM_ERROR',
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  error: string;
  code: ErrorCode;
  requestId: string;
  timestamp: string;
  details?: Record<string, any>;
}

/**
 * Detailed error for server-side logging
 */
export interface DetailedError {
  requestId: string;
  timestamp: string;
  error: {
    message: string;
    code: ErrorCode;
    statusCode: number;
  };
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    ip?: string;
  };
  user?: {
    userId?: string;
    organizationId?: string;
    role?: string;
  };
  original?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

/**
 * Generate unique request ID
 *
 * @returns Request ID (UUID-like format)
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Get request ID from headers or generate new one
 *
 * @param request NextRequest
 * @returns Request ID
 */
export function getRequestId(request: NextRequest): string {
  const existingId = request.headers.get('x-request-id');
  return existingId || generateRequestId();
}

/**
 * Sanitize error message to prevent information disclosure
 *
 * Removes:
 * - File paths
 * - Database table/column names
 * - SQL queries
 * - Stack traces
 * - Internal implementation details
 *
 * @param message Original error message
 * @returns Sanitized message
 */
export function sanitizeErrorMessage(message: string): string {
  let sanitized = message;

  // Remove file paths (Unix and Windows)
  sanitized = sanitized.replace(/\/[^\s]+\.(ts|js|tsx|jsx|json)/gi, '[file]');
  sanitized = sanitized.replace(/[A-Z]:\\[^\s]+\.(ts|js|tsx|jsx|json)/gi, '[file]');

  // Remove absolute paths
  sanitized = sanitized.replace(/\/Users\/[^\s]+/gi, '[path]');
  sanitized = sanitized.replace(/\/home\/[^\s]+/gi, '[path]');
  sanitized = sanitized.replace(/C:\\Users\\[^\s]+/gi, '[path]');

  // Remove SQL-like patterns
  sanitized = sanitized.replace(/SELECT\s+.+\s+FROM\s+/gi, '[query]');
  sanitized = sanitized.replace(/INSERT\s+INTO\s+/gi, '[query]');
  sanitized = sanitized.replace(/UPDATE\s+.+\s+SET\s+/gi, '[query]');
  sanitized = sanitized.replace(/DELETE\s+FROM\s+/gi, '[query]');

  // Remove table/column references
  sanitized = sanitized.replace(/table\s+["']?\w+["']?/gi, 'table [redacted]');
  sanitized = sanitized.replace(/column\s+["']?\w+["']?/gi, 'column [redacted]');

  // Remove connection strings
  sanitized = sanitized.replace(/postgresql:\/\/[^\s]+/gi, '[database_url]');
  sanitized = sanitized.replace(/mysql:\/\/[^\s]+/gi, '[database_url]');
  sanitized = sanitized.replace(/mongodb:\/\/[^\s]+/gi, '[database_url]');

  // Remove environment variable references
  sanitized = sanitized.replace(/process\.env\.\w+/gi, '[env_var]');

  return sanitized;
}

/**
 * Convert Prisma errors to safe error responses
 *
 * @param error Prisma error
 * @returns Error code and message
 */
export function handlePrismaError(error: any): {
  code: ErrorCode;
  message: string;
  statusCode: number;
} {
  // Prisma Client errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': // Unique constraint violation
        return {
          code: ErrorCode.ALREADY_EXISTS,
          message: 'A record with this information already exists',
          statusCode: 409,
        };

      case 'P2025': // Record not found
        return {
          code: ErrorCode.NOT_FOUND,
          message: 'The requested resource was not found',
          statusCode: 404,
        };

      case 'P2003': // Foreign key constraint violation
        return {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Invalid reference to related resource',
          statusCode: 400,
        };

      case 'P2014': // Required relation violation
        return {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Related resource is required',
          statusCode: 400,
        };

      default:
        return {
          code: ErrorCode.DATABASE_ERROR,
          message: 'A database error occurred',
          statusCode: 500,
        };
    }
  }

  // Prisma validation errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Invalid data provided',
      statusCode: 400,
    };
  }

  // Generic database error
  return {
    code: ErrorCode.DATABASE_ERROR,
    message: 'A database error occurred',
    statusCode: 500,
  };
}

/**
 * Create safe error response for users
 *
 * @param error Original error
 * @param requestId Request ID
 * @param customMessage Optional custom message
 * @param customCode Optional custom error code
 * @returns Safe error response
 */
export function createSafeErrorResponse(
  error: any,
  requestId: string,
  customMessage?: string,
  customCode?: ErrorCode
): {
  response: ErrorResponse;
  statusCode: number;
} {
  let code: ErrorCode;
  let message: string;
  let statusCode: number;

  // Use custom message/code if provided
  if (customMessage && customCode) {
    code = customCode;
    message = customMessage;
    statusCode = getStatusCodeFromErrorCode(customCode);
  }
  // Handle Prisma errors
  else if (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientValidationError
  ) {
    const prismaError = handlePrismaError(error);
    code = prismaError.code;
    message = prismaError.message;
    statusCode = prismaError.statusCode;
  }
  // Handle known error codes
  else if (error.code && Object.values(ErrorCode).includes(error.code)) {
    code = error.code;
    message = error.message || 'An error occurred';
    statusCode = error.statusCode || 500;
  }
  // Generic error
  else {
    code = ErrorCode.INTERNAL_SERVER_ERROR;
    message = 'An unexpected error occurred';
    statusCode = 500;
  }

  // Sanitize message to prevent information disclosure
  const sanitizedMessage = sanitizeErrorMessage(message);

  return {
    response: {
      error: sanitizedMessage,
      code,
      requestId,
      timestamp: new Date().toISOString(),
    },
    statusCode,
  };
}

/**
 * Get HTTP status code from error code
 *
 * @param code Error code
 * @returns HTTP status code
 */
function getStatusCodeFromErrorCode(code: ErrorCode): number {
  switch (code) {
    case ErrorCode.UNAUTHORIZED:
    case ErrorCode.INVALID_CREDENTIALS:
    case ErrorCode.SESSION_EXPIRED:
      return 401;

    case ErrorCode.FORBIDDEN:
    case ErrorCode.INSUFFICIENT_PERMISSIONS:
    case ErrorCode.CSRF_TOKEN_INVALID:
      return 403;

    case ErrorCode.NOT_FOUND:
      return 404;

    case ErrorCode.ALREADY_EXISTS:
    case ErrorCode.CONFLICT:
      return 409;

    case ErrorCode.RATE_LIMIT_EXCEEDED:
      return 429;

    case ErrorCode.VALIDATION_ERROR:
    case ErrorCode.INVALID_INPUT:
    case ErrorCode.MISSING_REQUIRED_FIELD:
    case ErrorCode.INVALID_FILE_TYPE:
    case ErrorCode.FILE_TOO_LARGE:
    case ErrorCode.INVALID_FORMAT:
      return 400;

    default:
      return 500;
  }
}

/**
 * Log detailed error server-side
 *
 * Logs full error details including stack trace for debugging.
 * NEVER send these details to the client.
 *
 * @param error Original error
 * @param request Request object
 * @param requestId Request ID
 * @param userId Optional user ID
 */
export function logDetailedError(
  error: any,
  request: NextRequest,
  requestId: string,
  userId?: string,
  organizationId?: string,
  role?: string
): void {
  const detailedError: DetailedError = {
    requestId,
    timestamp: new Date().toISOString(),
    error: {
      message: error.message || 'Unknown error',
      code: error.code || ErrorCode.INTERNAL_SERVER_ERROR,
      statusCode: error.statusCode || 500,
    },
    request: {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    },
    user: userId ? { userId, organizationId, role } : undefined,
    original: {
      name: error.name || 'Error',
      message: error.message || 'Unknown error',
      stack: error.stack,
      code: error.code,
    },
  };

  // Log to console (in production, send to logging service)
  console.error('[ERROR]', JSON.stringify(detailedError, null, 2));

  // TODO: Send to error tracking service (Sentry, Datadog, etc.)
  // if (process.env.NODE_ENV === 'production') {
  //   sendToErrorTracking(detailedError);
  // }
}

/**
 * Create error response with logging
 *
 * Convenience function that:
 * 1. Generates request ID
 * 2. Logs detailed error server-side
 * 3. Returns safe error response to client
 *
 * @param error Original error
 * @param request Request object
 * @param userId Optional user ID
 * @param customMessage Optional custom message
 * @param customCode Optional custom error code
 * @returns NextResponse with error
 */
export function handleError(
  error: any,
  request: NextRequest,
  userId?: string,
  organizationId?: string,
  role?: string,
  customMessage?: string,
  customCode?: ErrorCode
): NextResponse {
  const requestId = getRequestId(request);

  // Log detailed error server-side
  logDetailedError(error, request, requestId, userId, organizationId, role);

  // Create safe error response
  const { response, statusCode } = createSafeErrorResponse(
    error,
    requestId,
    customMessage,
    customCode
  );

  // Return response with request ID header
  return NextResponse.json(response, {
    status: statusCode,
    headers: {
      'X-Request-Id': requestId,
    },
  });
}

/**
 * Validation error helper
 *
 * @param message Error message
 * @param details Optional validation details
 * @returns Error object
 */
export function createValidationError(
  message: string,
  details?: Record<string, any>
): Error & { code: ErrorCode; statusCode: number; details?: Record<string, any> } {
  const error = new Error(message) as Error & {
    code: ErrorCode;
    statusCode: number;
    details?: Record<string, any>;
  };
  error.code = ErrorCode.VALIDATION_ERROR;
  error.statusCode = 400;
  if (details) {
    error.details = details;
  }
  return error;
}

/**
 * Not found error helper
 *
 * @param resource Resource type
 * @returns Error object
 */
export function createNotFoundError(resource: string = 'Resource'): Error & {
  code: ErrorCode;
  statusCode: number;
} {
  const error = new Error(`${resource} not found`) as Error & {
    code: ErrorCode;
    statusCode: number;
  };
  error.code = ErrorCode.NOT_FOUND;
  error.statusCode = 404;
  return error;
}

/**
 * Unauthorized error helper
 *
 * @param message Error message
 * @returns Error object
 */
export function createUnauthorizedError(message: string = 'Unauthorized'): Error & {
  code: ErrorCode;
  statusCode: number;
} {
  const error = new Error(message) as Error & {
    code: ErrorCode;
    statusCode: number;
  };
  error.code = ErrorCode.UNAUTHORIZED;
  error.statusCode = 401;
  return error;
}

/**
 * Forbidden error helper
 *
 * @param message Error message
 * @returns Error object
 */
export function createForbiddenError(message: string = 'Forbidden'): Error & {
  code: ErrorCode;
  statusCode: number;
} {
  const error = new Error(message) as Error & {
    code: ErrorCode;
    statusCode: number;
  };
  error.code = ErrorCode.FORBIDDEN;
  error.statusCode = 403;
  return error;
}

/**
 * Safe error wrapper for async route handlers
 *
 * Wraps route handler to automatically catch and handle errors.
 *
 * @param handler Route handler function
 * @returns Wrapped handler with error handling
 */
export function withErrorHandling(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse> => {
    try {
      return await handler(request, ...args);
    } catch (error: any) {
      return handleError(error, request);
    }
  };
}
