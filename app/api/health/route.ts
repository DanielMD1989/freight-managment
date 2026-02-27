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

// Force Node.js runtime (required for ioredis/bullmq compatibility)
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { checkDatabaseHealth, getPoolMetrics } from "@/lib/db";
import { checkRedisHealth, isRedisEnabled } from "@/lib/redis";
import { getRateLimitMetrics } from "@/lib/rateLimit";
import { getCacheStats, getCacheMetrics } from "@/lib/cache";
import {
  checkStorageHealth,
  getStorageProvider,
  isCDNEnabled,
} from "@/lib/storage";
import {
  getMonitoringSummary,
  getSystemMetrics,
  getActiveAlerts,
} from "@/lib/monitoring";
import {
  getQueueInfo,
  getAllQueueStats,
  getWorkerStatus,
  getQueueHealthStatus,
} from "@/lib/queue";
import { logger } from "@/lib/logger";

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

    // Add detailed info if requested (requires authentication in production)
    if (detailed || includeMetrics) {
      if (process.env.NODE_ENV === "production") {
        // In production, require authentication for detailed metrics
        try {
          const { requireAuth } = await import("@/lib/auth");
          await requireAuth();
        } catch {
          return NextResponse.json(
            { error: "Authentication required for detailed health metrics" },
            { status: 401 }
          );
        }
      }
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

      // Add queue health (Phase 4: Background Job Queues)
      try {
        const queueInfo = getQueueInfo();
        const queueStats = await getAllQueueStats();
        const workerStatus = getWorkerStatus();
        const queueHealth = await getQueueHealthStatus();

        // Calculate totals
        const totalJobs = queueStats.reduce(
          (acc, q) => ({
            waiting: acc.waiting + q.waiting,
            active: acc.active + q.active,
            completed: acc.completed + q.completed,
            failed: acc.failed + q.failed,
            delayed: acc.delayed + q.delayed,
          }),
          { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }
        );

        response.queues = {
          enabled: queueInfo.enabled,
          provider: queueHealth.provider,
          ready: queueHealth.ready,
          redisConnected: queueHealth.redisConnected,
          redisPingMs: queueHealth.redisPingMs,
          queuesInitialized: queueHealth.queuesInitialized,
          allQueuesOperational: queueHealth.allQueuesOperational,
          status: queueHealth.ready
            ? "active"
            : queueHealth.error || "not_ready",
          queueCount: queueInfo.queues.length,
          totals: totalJobs,
          ...(queueHealth.pausedQueues.length > 0 && {
            pausedQueues: queueHealth.pausedQueues,
          }),
          ...(queueHealth.error && { error: queueHealth.error }),
        };

        // Add worker status (for graceful shutdown monitoring)
        response.workers = {
          status: workerStatus.status,
          isShuttingDown: workerStatus.isShuttingDown,
          isDraining: workerStatus.isDraining,
          activeWorkers: workerStatus.activeWorkers,
          activeQueues: workerStatus.activeQueues,
        };

        if (detailed) {
          response.queueDetails = queueStats.map((q) => ({
            name: q.name,
            waiting: q.waiting,
            active: q.active,
            completed: q.completed,
            failed: q.failed,
            delayed: q.delayed,
            paused: q.paused,
          }));
        }
      } catch (queueError) {
        response.queues = {
          enabled: false,
          provider: "in-memory",
          ready: false,
          redisConnected: false,
          redisPingMs: null,
          queuesInitialized: false,
          allQueuesOperational: false,
          status: "error",
          error:
            queueError instanceof Error ? queueError.message : "Unknown error",
        };
      }

      // Add storage health (Phase 3: S3 + CDN)
      const storageHealth = await checkStorageHealth();
      response.storage = {
        provider: storageHealth.provider,
        status: storageHealth.healthy ? "healthy" : "unhealthy",
        latencyMs: storageHealth.latencyMs,
        cdnEnabled: storageHealth.cdnEnabled,
        ...(storageHealth.cdnDomain && { cdnDomain: storageHealth.cdnDomain }),
        ...(storageHealth.error && { error: storageHealth.error }),
      };

      // Add monitoring metrics (Phase 3: Application Monitoring)
      const monitoringSummary = getMonitoringSummary();
      const systemMetrics = getSystemMetrics();
      const activeAlerts = getActiveAlerts();

      response.monitoring = {
        status: monitoringSummary.status,
        healthScore: monitoringSummary.healthScore,
        activeAlerts: monitoringSummary.activeAlerts,
        metrics: monitoringSummary.metrics,
      };

      response.system = {
        cpu: {
          usage: systemMetrics.cpu.usage,
          loadAverage: systemMetrics.cpu.loadAverage,
        },
        memory: {
          usagePercent: systemMetrics.memory.usagePercent,
          heapUsedMB: Math.round(systemMetrics.memory.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(systemMetrics.memory.heapTotal / 1024 / 1024),
          rssMB: Math.round(systemMetrics.memory.rss / 1024 / 1024),
        },
        eventLoop: {
          latencyMs: systemMetrics.eventLoop.latencyMs,
        },
        uptime: Math.round(systemMetrics.uptime),
      };

      if (activeAlerts.length > 0) {
        response.alerts = activeAlerts.slice(0, 5).map((a) => ({
          type: a.type,
          severity: a.severity,
          message: a.message,
          timestamp: a.timestamp,
        }));
      }

      // Add logging metrics
      const logMetrics = logger.getMetrics();
      response.logging = {
        requests: {
          total: logMetrics.requests.count,
          avgDurationMs: logMetrics.requests.avgDurationMs,
          maxDurationMs: logMetrics.requests.maxDurationMs,
          errorCount: logMetrics.requests.errorCount,
          slowCount: logMetrics.requests.slowCount,
        },
        errors: {
          total: logMetrics.errors.count,
        },
        slowQueries: {
          count: logMetrics.slowQueries.count,
        },
      };

      // Add environment info
      const queueEnvInfo = getQueueInfo();
      response.environment = {
        nodeEnv: process.env.NODE_ENV,
        pgBouncer: process.env.PGBOUNCER_ENABLED === "true",
        redisEnabled: isRedisEnabled(),
        storageProvider: getStorageProvider(),
        cdnEnabled: isCDNEnabled(),
        monitoringEnabled: process.env.MONITORING_ENABLED !== "false",
        queueProvider: queueEnvInfo.provider,
        queueEnabled: queueEnvInfo.enabled,
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
    jsonResponse.headers.set(
      "Cache-Control",
      "no-cache, no-store, must-revalidate"
    );

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
