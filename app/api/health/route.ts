/**
 * Health Check API
 *
 * PHASE 1: Critical Architecture - Health Monitoring for 10K+ DAU
 *
 * Endpoints:
 * - GET /api/health - Basic health check
 * - GET /api/health?detailed=true - Detailed health with pool metrics
 *
 * Used by:
 * - Load balancers for health probes
 * - Kubernetes liveness/readiness probes
 * - Monitoring systems (Datadog, New Relic, etc.)
 */

import { NextRequest, NextResponse } from "next/server";
import { checkDatabaseHealth, getPoolMetrics } from "@/lib/db";
import { checkRedisHealth, isRedisEnabled } from "@/lib/redis";
import { getRateLimitMetrics } from "@/lib/rateLimit";
import { getCacheStats, getCacheMetrics } from "@/lib/cache";

/**
 * GET /api/health
 *
 * Returns system health status
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const detailed = request.nextUrl.searchParams.get("detailed") === "true";
  const includeMetrics = request.nextUrl.searchParams.get("metrics") === "true";

  try {
    // Basic health check
    const dbHealth = await checkDatabaseHealth();
    const redisHealth = isRedisEnabled() ? await checkRedisHealth() : null;

    // Determine overall health (Redis is optional, so don't fail if unavailable)
    const isHealthy = dbHealth.healthy;

    // Build response
    const response: Record<string, unknown> = {
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
    };

    // Add database health
    response.database = {
      status: dbHealth.healthy ? "connected" : "disconnected",
      latencyMs: dbHealth.latencyMs,
      ...(dbHealth.error && { error: dbHealth.error }),
    };

    // Add Redis health (if enabled)
    if (redisHealth) {
      response.redis = {
        enabled: true,
        status: redisHealth.connected ? "connected" : "disconnected",
        latencyMs: redisHealth.latencyMs,
        ...(redisHealth.error && { error: redisHealth.error }),
      };
    } else {
      response.redis = {
        enabled: false,
        status: "disabled",
        note: "Using in-memory fallback for rate limiting",
      };
    }

    // Add detailed info if requested (protected in production)
    if (detailed || includeMetrics) {
      const metrics = getPoolMetrics();

      if (metrics) {
        response.pool = {
          totalConnections: metrics.totalConnections,
          idleConnections: metrics.idleConnections,
          activeConnections: metrics.totalConnections - metrics.idleConnections,
          waitingRequests: metrics.waitingRequests,
          maxConnections: metrics.maxConnections,
          minConnections: metrics.minConnections,
          utilizationPercent: Math.round(
            ((metrics.totalConnections - metrics.idleConnections) /
              metrics.maxConnections) *
              100
          ),
        };

        if (detailed) {
          response.poolMetrics = {
            acquireCount: metrics.acquireCount,
            releaseCount: metrics.releaseCount,
            errorCount: metrics.errorCount,
            healthChecksPassed: metrics.healthChecksPassed,
            healthChecksFailed: metrics.healthChecksFailed,
            lastHealthCheck: metrics.lastHealthCheck,
            averageAcquireTimeMs: metrics.averageAcquireTimeMs,
          };
        }
      }

      // Add rate limiting metrics
      const rateLimitMetrics = await getRateLimitMetrics();
      response.rateLimit = {
        redisEnabled: rateLimitMetrics.redisEnabled,
        redisConnected: rateLimitMetrics.redisConnected,
        inMemoryKeys: rateLimitMetrics.inMemoryKeys,
        mode: rateLimitMetrics.redisConnected ? "distributed" : "in-memory",
      };

      // Add cache metrics (Phase 3: Global Caching Layer)
      const cacheStats = getCacheStats();
      const cacheMetricsData = getCacheMetrics();
      response.cache = {
        adapter: cacheStats.adapter,
        hitRate: cacheMetricsData.overall.hitRate,
        targetHitRate: 70, // 70%+ target
        totalHits: cacheMetricsData.overall.totalHits,
        totalMisses: cacheMetricsData.overall.totalMisses,
        status: cacheMetricsData.overall.hitRate >= 70 ? "optimal" : "warming",
        ...(cacheStats.memoryStats && {
          memorySize: cacheStats.memoryStats.size,
          memoryMaxSize: cacheStats.memoryStats.maxSize,
        }),
      };

      if (detailed) {
        response.cacheByNamespace = cacheMetricsData.byNamespace;
      }

      // Add environment info
      response.environment = {
        nodeEnv: process.env.NODE_ENV,
        pgBouncer: process.env.PGBOUNCER_ENABLED === "true",
        redisEnabled: isRedisEnabled(),
      };
    }

    // Create response with appropriate status code
    const httpStatus = isHealthy ? 200 : 503;
    const jsonResponse = NextResponse.json(response, { status: httpStatus });

    // Add CORS headers for development
    if (
      origin &&
      (origin.startsWith("http://localhost") ||
        origin.startsWith("http://127.0.0.1"))
    ) {
      jsonResponse.headers.set("Access-Control-Allow-Origin", origin);
      jsonResponse.headers.set("Access-Control-Allow-Credentials", "true");
    }

    // Cache control - don't cache health checks
    jsonResponse.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");

    return jsonResponse;
  } catch (error) {
    console.error("[Health] Error:", error);

    const errorResponse = NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );

    if (
      origin &&
      (origin.startsWith("http://localhost") ||
        origin.startsWith("http://127.0.0.1"))
    ) {
      errorResponse.headers.set("Access-Control-Allow-Origin", origin);
      errorResponse.headers.set("Access-Control-Allow-Credentials", "true");
    }

    return errorResponse;
  }
}

/**
 * OPTIONS /api/health
 *
 * Handle CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  const response = new NextResponse(null, { status: 204 });

  if (
    origin &&
    (origin.startsWith("http://localhost") ||
      origin.startsWith("http://127.0.0.1"))
  ) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  }

  return response;
}
