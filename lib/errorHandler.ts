/**
 * Error Handler Utilities
 *
 * Provides secure error handling to prevent information leakage
 * in production environments.
 */

import { randomUUID } from "crypto";

/**
 * Patterns to remove from error messages
 */
const SENSITIVE_PATTERNS = [
  // File paths (Unix and Windows)
  /\/[\w\-./]+\.(ts|js|tsx|jsx|json)/gi,
  /[A-Z]:\\[\w\-\\./]+\.(ts|js|tsx|jsx|json)/gi,
  // SQL queries
  /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)\b[^;]*/gi,
  // Database connection strings
  /(postgresql|mysql|mongodb|redis):\/\/[^\s]+/gi,
  // Stack trace lines
  /at\s+[\w.<>]+\s+\([^)]+\)/g,
  /at\s+[\w.<>/\\]+:\d+:\d+/g,
  // Environment variables that might leak
  /process\.env\.\w+/gi,
  // IP addresses
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  // Email addresses in error context
  /[\w.-]+@[\w.-]+\.\w+/gi,
];

/**
 * Generic error messages for production
 */
const GENERIC_ERROR_MESSAGES: Record<string, string> = {
  ValidationError: "Invalid request data",
  AuthenticationError: "Authentication failed",
  AuthorizationError: "Access denied",
  NotFoundError: "Resource not found",
  RateLimitError: "Too many requests",
  DatabaseError: "Service temporarily unavailable",
  default: "An unexpected error occurred",
};

/**
 * Sanitizes an error message by removing sensitive information
 * @param message - The original error message
 * @returns Sanitized error message
 */
export function sanitizeErrorMessage(message: string): string {
  let sanitized = message;

  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }

  // Clean up multiple consecutive [REDACTED] markers
  sanitized = sanitized.replace(/(\[REDACTED\]\s*)+/g, "[REDACTED] ");

  return sanitized.trim();
}

/**
 * Creates a safe error response for API endpoints
 * @param error - The original error
 * @param requestId - Optional request ID for debugging
 * @returns Safe error response object
 */
export function createSafeErrorResponse(
  error: Error,
  requestId?: string
): {
  response: { error: string; requestId?: string };
  status: number;
  statusCode: number;
} {
  const isProduction = process.env.NODE_ENV === "production";

  // Determine the error type and get a generic message
  let genericMessage = GENERIC_ERROR_MESSAGES.default;
  let status = 500;

  if (error.name in GENERIC_ERROR_MESSAGES) {
    genericMessage = GENERIC_ERROR_MESSAGES[error.name];
  }

  // Set appropriate status codes
  if (error.name === "ValidationError") status = 400;
  if (error.name === "AuthenticationError") status = 401;
  if (error.name === "AuthorizationError") status = 403;
  if (error.name === "NotFoundError") status = 404;
  if (error.name === "RateLimitError") status = 429;

  // Always use generic messages for API responses to prevent info leakage
  // Even in development, API responses should be safe
  const errorMessage = genericMessage;

  const response: { error: string; requestId?: string } = {
    error: errorMessage,
  };

  if (requestId) {
    response.requestId = requestId;
  }

  return { response, status, statusCode: status };
}

/**
 * Generates a unique request ID for debugging
 * @returns UUID string
 */
export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Logs an error securely (sanitized for production)
 * @param error - The error to log
 * @param context - Additional context
 */
export function logError(
  error: Error,
  context?: Record<string, unknown>
): void {
  const isProduction = process.env.NODE_ENV === "production";

  const logEntry = {
    timestamp: new Date().toISOString(),
    error: isProduction ? sanitizeErrorMessage(error.message) : error.message,
    stack: isProduction ? undefined : error.stack,
    ...context,
  };

  console.error("[ERROR]", JSON.stringify(logEntry));
}
