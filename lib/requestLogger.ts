/**
 * Request Logging Wrapper for API Routes
 *
 * PHASE 3: Application-Level Logging & Monitoring
 *
 * Features:
 * - Automatic request/response logging
 * - Performance timing
 * - Error tracking
 * - Request correlation via requestId
 * - Integration with monitoring service
 *
 * Usage:
 * ```typescript
 * import { withRequestLogging } from '@/lib/requestLogger';
 *
 * async function handler(request: NextRequest) {
 *   // ... your handler logic
 * }
 *
 * export const GET = withRequestLogging(handler);
 * export const POST = withRequestLogging(handler);
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger, createRequestLogger } from './logger';
import { recordRequest } from './monitoring';

export type RouteHandler = (
  request: NextRequest,
  context?: { params?: Record<string, string> }
) => Promise<NextResponse> | NextResponse;

export interface RequestLogContext {
  requestId: string;
  method: string;
  path: string;
  ip: string;
  userAgent: string;
  userId?: string;
  organizationId?: string;
}

/**
 * Extract request context from NextRequest
 */
function getRequestContext(request: NextRequest): RequestLogContext {
  const requestId = request.headers.get('x-request-id') || generateRequestId();

  // Get client IP from various headers
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             request.headers.get('x-real-ip') ||
             request.headers.get('cf-connecting-ip') ||
             'unknown';

  return {
    requestId,
    method: request.method,
    path: request.nextUrl.pathname,
    ip,
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `req_${timestamp}_${random}`;
}

/**
 * Wrap an API route handler with request logging
 */
export function withRequestLogging(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, context?: { params?: Record<string, string> }) => {
    const startTime = Date.now();
    const ctx = getRequestContext(request);

    // Create a request-scoped logger
    const reqLogger = createRequestLogger(ctx.requestId, {
      method: ctx.method,
      path: ctx.path,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    // Log incoming request
    reqLogger.debug(`${ctx.method} ${ctx.path}`);

    try {
      // Execute the handler
      const response = await handler(request, context);

      const durationMs = Date.now() - startTime;
      const statusCode = response.status;

      // Record in monitoring
      recordRequest(statusCode >= 400);

      // Log the response
      logger.logResponse({
        requestId: ctx.requestId,
        method: ctx.method,
        path: ctx.path,
        statusCode,
        durationMs,
        ip: ctx.ip,
        ...(statusCode >= 400 && { error: 'Request failed' }),
      });

      // Add request ID to response headers
      const headers = new Headers(response.headers);
      headers.set('x-request-id', ctx.requestId);
      headers.set('x-response-time', `${durationMs}ms`);

      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      const durationMs = Date.now() - startTime;

      // Record error in monitoring
      recordRequest(true);

      // Log the error
      logger.logResponse({
        requestId: ctx.requestId,
        method: ctx.method,
        path: ctx.path,
        statusCode: 500,
        durationMs,
        ip: ctx.ip,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      logger.error('Request handler error', error, {
        requestId: ctx.requestId,
        path: ctx.path,
        method: ctx.method,
      });

      // Re-throw to let Next.js handle the error
      throw error;
    }
  };
}

/**
 * Higher-order function to add logging to multiple handlers
 */
export function withLogging<T extends Record<string, RouteHandler>>(
  handlers: T
): T {
  const wrappedHandlers: Record<string, RouteHandler> = {};

  for (const [method, handler] of Object.entries(handlers)) {
    wrappedHandlers[method] = withRequestLogging(handler);
  }

  return wrappedHandlers as T;
}

/**
 * Log an API error with context
 */
export function logAPIError(
  error: Error | unknown,
  context: {
    requestId?: string;
    path: string;
    method: string;
    userId?: string;
    statusCode?: number;
  }
): void {
  logger.error('API Error', error instanceof Error ? error : undefined, {
    ...context,
    errorType: error instanceof Error ? error.name : 'Unknown',
    errorMessage: error instanceof Error ? error.message : String(error),
  });
}

/**
 * Log a successful API response
 */
export function logAPISuccess(context: {
  requestId?: string;
  path: string;
  method: string;
  statusCode: number;
  durationMs: number;
  userId?: string;
  action?: string;
}): void {
  logger.info(`${context.method} ${context.path} completed`, context);
}

export default {
  withRequestLogging,
  withLogging,
  logAPIError,
  logAPISuccess,
};
