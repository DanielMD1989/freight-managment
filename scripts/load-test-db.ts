#!/usr/bin/env npx tsx

/**
 * Database Connection Pool Load Test
 *
 * PHASE 1: Critical Architecture - Load Testing for 10K+ DAU
 *
 * This script tests the database connection pool under simulated load
 * to verify it can handle the expected traffic.
 *
 * Usage:
 *   npx tsx scripts/load-test-db.ts
 *   npx tsx scripts/load-test-db.ts --concurrent=50 --requests=1000 --duration=60
 *
 * Options:
 *   --concurrent=N   Number of concurrent connections (default: 20)
 *   --requests=N     Total number of requests (default: 500)
 *   --duration=N     Test duration in seconds (default: 30)
 *   --query=QUERY    Custom query to run (default: SELECT 1)
 *   --verbose        Enable verbose logging
 */

import { Pool, PoolClient } from "pg";

// =============================================================================
// CONFIGURATION
// =============================================================================

interface TestConfig {
  concurrent: number;
  totalRequests: number;
  durationSeconds: number;
  query: string;
  verbose: boolean;
  connectionString: string;
  poolConfig: {
    min: number;
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  };
}

function parseArgs(): TestConfig {
  const args = process.argv.slice(2);
  const config: TestConfig = {
    concurrent: 20,
    totalRequests: 500,
    durationSeconds: 30,
    query: "SELECT 1",
    verbose: false,
    connectionString:
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/freight_db",
    poolConfig: {
      min: parseInt(process.env.DB_POOL_MIN || "5"),
      max: parseInt(process.env.DB_POOL_MAX || "100"),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    },
  };

  for (const arg of args) {
    if (arg.startsWith("--concurrent=")) {
      config.concurrent = parseInt(arg.split("=")[1]);
    } else if (arg.startsWith("--requests=")) {
      config.totalRequests = parseInt(arg.split("=")[1]);
    } else if (arg.startsWith("--duration=")) {
      config.durationSeconds = parseInt(arg.split("=")[1]);
    } else if (arg.startsWith("--query=")) {
      config.query = arg.split("=")[1];
    } else if (arg === "--verbose") {
      config.verbose = true;
    }
  }

  return config;
}

// =============================================================================
// METRICS
// =============================================================================

interface Metrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  latencies: number[];
  errors: Map<string, number>;
  startTime: number;
  endTime: number;
}

function createMetrics(): Metrics {
  return {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalLatencyMs: 0,
    minLatencyMs: Infinity,
    maxLatencyMs: 0,
    latencies: [],
    errors: new Map(),
    startTime: Date.now(),
    endTime: 0,
  };
}

function calculatePercentile(latencies: number[], percentile: number): number {
  if (latencies.length === 0) return 0;
  const sorted = [...latencies].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function printMetrics(metrics: Metrics, config: TestConfig): void {
  const durationMs = metrics.endTime - metrics.startTime;
  const durationSec = durationMs / 1000;
  const rps = metrics.successfulRequests / durationSec;
  const avgLatency =
    metrics.successfulRequests > 0
      ? metrics.totalLatencyMs / metrics.successfulRequests
      : 0;

  console.log("\n" + "=".repeat(60));
  console.log("LOAD TEST RESULTS");
  console.log("=".repeat(60));

  console.log("\n📊 Configuration:");
  console.log(`   Concurrent connections: ${config.concurrent}`);
  console.log(`   Pool size: min=${config.poolConfig.min}, max=${config.poolConfig.max}`);
  console.log(`   Test duration: ${durationSec.toFixed(2)}s`);

  console.log("\n📈 Throughput:");
  console.log(`   Total requests: ${metrics.totalRequests}`);
  console.log(`   Successful: ${metrics.successfulRequests}`);
  console.log(`   Failed: ${metrics.failedRequests}`);
  console.log(`   Requests/second: ${rps.toFixed(2)}`);

  console.log("\n⏱️  Latency:");
  console.log(`   Min: ${metrics.minLatencyMs.toFixed(2)}ms`);
  console.log(`   Max: ${metrics.maxLatencyMs.toFixed(2)}ms`);
  console.log(`   Avg: ${avgLatency.toFixed(2)}ms`);
  console.log(`   P50: ${calculatePercentile(metrics.latencies, 50).toFixed(2)}ms`);
  console.log(`   P90: ${calculatePercentile(metrics.latencies, 90).toFixed(2)}ms`);
  console.log(`   P95: ${calculatePercentile(metrics.latencies, 95).toFixed(2)}ms`);
  console.log(`   P99: ${calculatePercentile(metrics.latencies, 99).toFixed(2)}ms`);

  if (metrics.errors.size > 0) {
    console.log("\n❌ Errors:");
    for (const [error, count] of metrics.errors.entries()) {
      console.log(`   ${error}: ${count}`);
    }
  }

  // Assessment
  console.log("\n🎯 Assessment:");
  const successRate = (metrics.successfulRequests / metrics.totalRequests) * 100;
  const p99 = calculatePercentile(metrics.latencies, 99);

  if (successRate >= 99.9 && p99 < 100 && rps >= 50) {
    console.log("   ✅ PASS - Ready for 10K+ DAU");
    console.log(`   - Success rate: ${successRate.toFixed(2)}% (>= 99.9%)`);
    console.log(`   - P99 latency: ${p99.toFixed(2)}ms (< 100ms)`);
    console.log(`   - Throughput: ${rps.toFixed(2)} RPS (>= 50 RPS)`);
  } else {
    console.log("   ⚠️  WARNING - May need optimization");
    if (successRate < 99.9) {
      console.log(`   - Success rate: ${successRate.toFixed(2)}% (target: >= 99.9%)`);
    }
    if (p99 >= 100) {
      console.log(`   - P99 latency: ${p99.toFixed(2)}ms (target: < 100ms)`);
    }
    if (rps < 50) {
      console.log(`   - Throughput: ${rps.toFixed(2)} RPS (target: >= 50 RPS)`);
    }
  }

  console.log("\n" + "=".repeat(60));
}

// =============================================================================
// LOAD TEST
// =============================================================================

async function runQuery(
  pool: Pool,
  query: string,
  metrics: Metrics,
  verbose: boolean
): Promise<void> {
  const startTime = Date.now();
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    await client.query(query);
    const latency = Date.now() - startTime;

    metrics.successfulRequests++;
    metrics.totalLatencyMs += latency;
    metrics.minLatencyMs = Math.min(metrics.minLatencyMs, latency);
    metrics.maxLatencyMs = Math.max(metrics.maxLatencyMs, latency);
    metrics.latencies.push(latency);

    if (verbose) {
      console.log(`   ✓ Query completed in ${latency}ms`);
    }
  } catch (error) {
    metrics.failedRequests++;
    const errorMsg =
      error instanceof Error ? error.message : "Unknown error";
    const errorKey = errorMsg.substring(0, 50);
    metrics.errors.set(errorKey, (metrics.errors.get(errorKey) || 0) + 1);

    if (verbose) {
      console.log(`   ✗ Query failed: ${errorMsg}`);
    }
  } finally {
    if (client) {
      client.release();
    }
    metrics.totalRequests++;
  }
}

async function runLoadTest(config: TestConfig): Promise<void> {
  console.log("\n🚀 Starting Database Connection Pool Load Test\n");
  console.log(`   Database: ${config.connectionString.replace(/:[^:@]+@/, ":***@")}`);
  console.log(`   Concurrent: ${config.concurrent}`);
  console.log(`   Total Requests: ${config.totalRequests}`);
  console.log(`   Duration: ${config.durationSeconds}s`);
  console.log(`   Pool: min=${config.poolConfig.min}, max=${config.poolConfig.max}`);

  // Create pool
  const pool = new Pool({
    connectionString: config.connectionString,
    ...config.poolConfig,
  });

  // Test connection
  console.log("\n📡 Testing database connection...");
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    console.log("   ✅ Connection successful");
  } catch (error) {
    console.error("   ❌ Connection failed:", error);
    await pool.end();
    process.exit(1);
  }

  // Initialize metrics
  const metrics = createMetrics();
  let requestsSent = 0;
  let running = true;

  // Progress reporter
  const progressInterval = setInterval(() => {
    const elapsed = (Date.now() - metrics.startTime) / 1000;
    const rps = metrics.successfulRequests / elapsed;
    console.log(
      `   Progress: ${metrics.successfulRequests}/${config.totalRequests} ` +
        `(${rps.toFixed(1)} RPS, ${metrics.failedRequests} errors)`
    );
  }, 5000);

  // Run load test
  console.log("\n🔥 Running load test...\n");

  const endTime = Date.now() + config.durationSeconds * 1000;

  // Worker function
  async function worker(): Promise<void> {
    while (running && requestsSent < config.totalRequests && Date.now() < endTime) {
      requestsSent++;
      await runQuery(pool, config.query, metrics, config.verbose);
    }
  }

  // Start concurrent workers
  const workers = Array(config.concurrent)
    .fill(null)
    .map(() => worker());

  // Wait for completion or timeout
  await Promise.all(workers);
  running = false;
  metrics.endTime = Date.now();

  // Cleanup
  clearInterval(progressInterval);
  await pool.end();

  // Print results
  printMetrics(metrics, config);
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  const config = parseArgs();

  try {
    await runLoadTest(config);
  } catch (error) {
    console.error("Load test failed:", error);
    process.exit(1);
  }
}

main();
