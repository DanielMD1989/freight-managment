/**
 * Database Connection Layer with Advanced Pooling
 *
 * PHASE 1: Critical Architecture - Connection Pooling for 10K+ DAU
 *
 * Features:
 * - Configurable pool size (10-100 connections)
 * - Connection health monitoring
 * - Metrics collection for observability
 * - Graceful shutdown handling
 * - Query timeout protection
 * - Automatic reconnection on failure
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────┐
 * │                      Application                            │
 * │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
 * │  │ API 1   │  │ API 2   │  │ API 3   │  │ API N   │       │
 * │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘       │
 * │       │            │            │            │              │
 * │       └────────────┼────────────┼────────────┘              │
 * │                    │            │                           │
 * │              ┌─────▼────────────▼─────┐                    │
 * │              │    Connection Pool     │                    │
 * │              │   (min:10, max:100)    │                    │
 * │              │   + Health Monitor     │                    │
 * │              └───────────┬────────────┘                    │
 * └──────────────────────────┼─────────────────────────────────┘
 *                            │
 *                   ┌────────▼────────┐
 *                   │   PostgreSQL    │
 *                   │    Database     │
 *                   └─────────────────┘
 *
 * For production with PgBouncer:
 * - Set DATABASE_URL to PgBouncer URL
 * - Reduce app pool to 5-10 (PgBouncer manages main pool)
 * - Enable PGBOUNCER_ENABLED=true
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool, PoolClient } from "pg";

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Pool configuration based on deployment mode
 */
interface PoolConfig {
  min: number;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  maxUses: number;
  statementTimeout: number;
  queryTimeout: number;
}

/**
 * Get pool configuration based on environment
 */
function getPoolConfig(): PoolConfig {
  const isPgBouncer = process.env.PGBOUNCER_ENABLED === "true";
  const isProduction = process.env.NODE_ENV === "production";

  if (isPgBouncer) {
    // When using PgBouncer, keep app pool small
    // PgBouncer handles the main connection pooling
    return {
      min: parseInt(process.env.DB_POOL_MIN || "2"),
      max: parseInt(process.env.DB_POOL_MAX || "10"),
      idleTimeoutMillis: 10000, // 10 seconds
      connectionTimeoutMillis: 3000, // 3 seconds
      maxUses: 10000,
      statementTimeout: 30000, // 30 seconds
      queryTimeout: 30000,
    };
  }

  if (isProduction) {
    // Production without PgBouncer: larger pool
    return {
      min: parseInt(process.env.DB_POOL_MIN || "10"),
      max: parseInt(process.env.DB_POOL_MAX || "100"),
      idleTimeoutMillis: 30000, // 30 seconds
      connectionTimeoutMillis: 5000, // 5 seconds
      maxUses: 7500,
      statementTimeout: 30000, // 30 seconds
      queryTimeout: 30000,
    };
  }

  // Development: moderate pool
  return {
    min: parseInt(process.env.DB_POOL_MIN || "5"),
    max: parseInt(process.env.DB_POOL_MAX || "20"),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    maxUses: 7500,
    statementTimeout: 60000, // 60 seconds for dev debugging
    queryTimeout: 60000,
  };
}

// =============================================================================
// METRICS & MONITORING
// =============================================================================

/**
 * Pool metrics for monitoring
 */
export interface PoolMetrics {
  totalConnections: number;
  idleConnections: number;
  waitingRequests: number;
  maxConnections: number;
  minConnections: number;
  acquireCount: number;
  releaseCount: number;
  errorCount: number;
  healthChecksPassed: number;
  healthChecksFailed: number;
  lastHealthCheck: Date | null;
  averageAcquireTimeMs: number;
}

/**
 * Internal metrics collector
 */
class MetricsCollector {
  private acquireCount = 0;
  private releaseCount = 0;
  private errorCount = 0;
  private healthChecksPassed = 0;
  private healthChecksFailed = 0;
  private lastHealthCheck: Date | null = null;
  private acquireTimes: number[] = [];
  private readonly maxAcquireTimeSamples = 100;

  recordAcquire(durationMs: number): void {
    this.acquireCount++;
    this.acquireTimes.push(durationMs);
    if (this.acquireTimes.length > this.maxAcquireTimeSamples) {
      this.acquireTimes.shift();
    }
  }

  recordRelease(): void {
    this.releaseCount++;
  }

  recordError(): void {
    this.errorCount++;
  }

  recordHealthCheck(passed: boolean): void {
    this.lastHealthCheck = new Date();
    if (passed) {
      this.healthChecksPassed++;
    } else {
      this.healthChecksFailed++;
    }
  }

  getMetrics(pool: Pool): PoolMetrics {
    const avgAcquireTime =
      this.acquireTimes.length > 0
        ? this.acquireTimes.reduce((a, b) => a + b, 0) /
          this.acquireTimes.length
        : 0;

    return {
      totalConnections: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingRequests: pool.waitingCount,
      maxConnections: pool.options.max || 10,
      minConnections: pool.options.min || 0,
      acquireCount: this.acquireCount,
      releaseCount: this.releaseCount,
      errorCount: this.errorCount,
      healthChecksPassed: this.healthChecksPassed,
      healthChecksFailed: this.healthChecksFailed,
      lastHealthCheck: this.lastHealthCheck,
      averageAcquireTimeMs: Math.round(avgAcquireTime * 100) / 100,
    };
  }

  reset(): void {
    this.acquireCount = 0;
    this.releaseCount = 0;
    this.errorCount = 0;
    this.healthChecksPassed = 0;
    this.healthChecksFailed = 0;
    this.lastHealthCheck = null;
    this.acquireTimes = [];
  }
}

// =============================================================================
// CONNECTION POOL MANAGER
// =============================================================================

/**
 * Database connection manager with health monitoring
 */
class DatabaseManager {
  private pool: Pool | null = null;
  private prisma: PrismaClient | null = null;
  private metrics: MetricsCollector;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private isShuttingDown = false;
  private config: PoolConfig;

  constructor() {
    this.metrics = new MetricsCollector();
    this.config = getPoolConfig();
  }

  /**
   * Initialize the database connection pool
   */
  initialize(): PrismaClient {
    if (this.prisma) {
      return this.prisma;
    }

    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL is not defined");
    }

    // Create the connection pool
    this.pool = new Pool({
      connectionString,
      max: this.config.max,
      min: this.config.min,
      idleTimeoutMillis: this.config.idleTimeoutMillis,
      connectionTimeoutMillis: this.config.connectionTimeoutMillis,
      maxUses: this.config.maxUses,
      // Add statement timeout for long-running queries
      statement_timeout: this.config.statementTimeout,
      query_timeout: this.config.queryTimeout,
    });

    // Pool event handlers
    this.pool.on("connect", (client: PoolClient) => {
      // Set session-level timeout
      client.query(`SET statement_timeout = ${this.config.statementTimeout}`);
    });

    this.pool.on("acquire", () => {
      // Note: Pool 'acquire' event doesn't provide timing info
      // Actual acquire time is measured in timedConnect() method
    });

    this.pool.on("release", () => {
      this.metrics.recordRelease();
    });

    this.pool.on("error", (err: Error) => {
      this.metrics.recordError();
      console.error("[DB Pool] Unexpected error:", err.message);

      // Attempt recovery if not shutting down
      if (!this.isShuttingDown) {
        this.attemptRecovery();
      }
    });

    this.pool.on("remove", () => {});

    // Create Prisma client with pg adapter
    const adapter = new PrismaPg(this.pool);

    this.prisma = new PrismaClient({
      adapter,
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    });

    // Start health monitoring in production
    if (process.env.NODE_ENV === "production") {
      this.startHealthMonitoring();
    }

    // Handle graceful shutdown
    this.setupShutdownHandlers();

    return this.prisma;
  }

  /**
   * Get pool metrics for monitoring
   */
  getMetrics(): PoolMetrics | null {
    if (!this.pool) {
      return null;
    }
    return this.metrics.getMetrics(this.pool);
  }

  /**
   * Get a connection from the pool with timing measurement
   * Records actual acquire time for metrics
   */
  private async timedConnect(): Promise<{
    client: PoolClient;
    acquireTimeMs: number;
  }> {
    if (!this.pool) {
      throw new Error("Pool not initialized");
    }

    const start = Date.now();
    const client = await this.pool.connect();
    const acquireTimeMs = Date.now() - start;

    // Record actual acquire time
    this.metrics.recordAcquire(acquireTimeMs);

    return { client, acquireTimeMs };
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    latencyMs: number;
    acquireTimeMs?: number;
    error?: string;
  }> {
    if (!this.pool) {
      return { healthy: false, latencyMs: 0, error: "Pool not initialized" };
    }

    const start = Date.now();
    let client: PoolClient | null = null;
    let acquireTimeMs = 0;

    try {
      const result = await this.timedConnect();
      client = result.client;
      acquireTimeMs = result.acquireTimeMs;

      await client.query("SELECT 1");
      const latencyMs = Date.now() - start;
      this.metrics.recordHealthCheck(true);
      return { healthy: true, latencyMs, acquireTimeMs };
    } catch (error) {
      this.metrics.recordHealthCheck(false);
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        acquireTimeMs,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Start periodic health monitoring
   */
  private startHealthMonitoring(): void {
    const intervalMs = parseInt(
      process.env.DB_HEALTH_CHECK_INTERVAL_MS || "30000"
    );

    this.healthCheckInterval = setInterval(async () => {
      const result = await this.healthCheck();

      if (!result.healthy) {
        console.error(`[DB Health] UNHEALTHY: ${result.error}`);
      } else if (result.latencyMs > 100) {
        console.warn(`[DB Health] High latency: ${result.latencyMs}ms`);
      }

      // Log metrics periodically
      const metrics = this.getMetrics();
      if (metrics && metrics.errorCount > 0) {
        console.warn(
          `[DB Metrics] errors=${metrics.errorCount}, ` +
            `active=${metrics.totalConnections - metrics.idleConnections}, ` +
            `waiting=${metrics.waitingRequests}`
        );
      }
    }, intervalMs);
  }

  /**
   * Attempt to recover from connection errors
   */
  private async attemptRecovery(): Promise<void> {
    try {
      const result = await this.healthCheck();
      if (result.healthy) {
      } else {
        console.error("[DB] Recovery failed:", result.error);
      }
    } catch (error) {
      console.error("[DB] Recovery error:", error);
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Disconnect Prisma
      if (this.prisma) {
        await this.prisma.$disconnect();
      }

      // End pool
      if (this.pool) {
        await this.pool.end();
      }
    };

    // Guard for Edge Runtime compatibility (Edge Runtime doesn't support process.on)
    if (typeof process !== "undefined" && typeof process.on === "function") {
      process.on("SIGTERM", () => shutdown("SIGTERM"));
      process.on("SIGINT", () => shutdown("SIGINT"));
    }
  }

  /**
   * Get raw pool for advanced operations
   */
  getPool(): Pool | null {
    return this.pool;
  }

  /**
   * Execute raw query with automatic connection handling
   * Uses timedConnect for accurate acquire time metrics
   */
  async executeRaw<T>(query: string, params?: unknown[]): Promise<T[]> {
    if (!this.pool) {
      throw new Error("Database not initialized");
    }

    const { client } = await this.timedConnect();
    try {
      const result = await client.query(query, params);
      return result.rows as T[];
    } finally {
      client.release();
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

const globalForDb = globalThis as unknown as {
  dbManager: DatabaseManager | undefined;
};

/**
 * Database manager singleton
 */
export const dbManager = globalForDb.dbManager ?? new DatabaseManager();

if (process.env.NODE_ENV !== "production") {
  globalForDb.dbManager = dbManager;
}

/**
 * Prisma client instance (main export)
 */
export const db = dbManager.initialize();

/**
 * Get pool metrics for monitoring endpoints
 */
export function getPoolMetrics(): PoolMetrics | null {
  return dbManager.getMetrics();
}

/**
 * Perform database health check
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latencyMs: number;
  error?: string;
}> {
  return dbManager.healthCheck();
}

/**
 * Execute raw SQL query
 */
export async function executeRawQuery<T>(
  query: string,
  params?: unknown[]
): Promise<T[]> {
  return dbManager.executeRaw<T>(query, params);
}
