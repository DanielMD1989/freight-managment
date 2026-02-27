#!/usr/bin/env npx tsx

/**
 * API Load Test
 *
 * PHASE 1: Critical Architecture - API Load Testing for 10K+ DAU
 *
 * This script tests the API endpoints under simulated load
 * to verify the system can handle the expected traffic.
 *
 * Usage:
 *   npx tsx scripts/load-test-api.ts
 *   npx tsx scripts/load-test-api.ts --concurrent=50 --requests=1000 --endpoint=/api/health
 *
 * Options:
 *   --concurrent=N   Number of concurrent requests (default: 20)
 *   --requests=N     Total number of requests (default: 500)
 *   --duration=N     Test duration in seconds (default: 30)
 *   --endpoint=PATH  API endpoint to test (default: /api/health)
 *   --base-url=URL   Base URL (default: http://localhost:3000)
 *   --verbose        Enable verbose logging
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

interface TestConfig {
  concurrent: number;
  totalRequests: number;
  durationSeconds: number;
  endpoint: string;
  baseUrl: string;
  verbose: boolean;
  method: string;
  body?: string;
  headers: Record<string, string>;
}

function parseArgs(): TestConfig {
  const args = process.argv.slice(2);
  const config: TestConfig = {
    concurrent: 20,
    totalRequests: 500,
    durationSeconds: 30,
    endpoint: "/api/health",
    baseUrl: process.env.API_BASE_URL || "http://localhost:3000",
    verbose: false,
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  };

  for (const arg of args) {
    if (arg.startsWith("--concurrent=")) {
      config.concurrent = parseInt(arg.split("=")[1]);
    } else if (arg.startsWith("--requests=")) {
      config.totalRequests = parseInt(arg.split("=")[1]);
    } else if (arg.startsWith("--duration=")) {
      config.durationSeconds = parseInt(arg.split("=")[1]);
    } else if (arg.startsWith("--endpoint=")) {
      config.endpoint = arg.split("=")[1];
    } else if (arg.startsWith("--base-url=")) {
      config.baseUrl = arg.split("=")[1];
    } else if (arg.startsWith("--method=")) {
      config.method = arg.split("=")[1].toUpperCase();
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
  statusCodes: Map<number, number>;
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
    statusCodes: new Map(),
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
  console.log("API LOAD TEST RESULTS");
  console.log("=".repeat(60));

  console.log("\n📊 Configuration:");
  console.log(
    `   Endpoint: ${config.method} ${config.baseUrl}${config.endpoint}`
  );
  console.log(`   Concurrent requests: ${config.concurrent}`);
  console.log(`   Test duration: ${durationSec.toFixed(2)}s`);

  console.log("\n📈 Throughput:");
  console.log(`   Total requests: ${metrics.totalRequests}`);
  console.log(`   Successful (2xx): ${metrics.successfulRequests}`);
  console.log(`   Failed: ${metrics.failedRequests}`);
  console.log(`   Requests/second: ${rps.toFixed(2)}`);

  console.log("\n📊 Status Codes:");
  for (const [code, count] of [...metrics.statusCodes.entries()].sort()) {
    const pct = ((count / metrics.totalRequests) * 100).toFixed(1);
    console.log(`   ${code}: ${count} (${pct}%)`);
  }

  console.log("\n⏱️  Latency:");
  console.log(`   Min: ${metrics.minLatencyMs.toFixed(2)}ms`);
  console.log(`   Max: ${metrics.maxLatencyMs.toFixed(2)}ms`);
  console.log(`   Avg: ${avgLatency.toFixed(2)}ms`);
  console.log(
    `   P50: ${calculatePercentile(metrics.latencies, 50).toFixed(2)}ms`
  );
  console.log(
    `   P90: ${calculatePercentile(metrics.latencies, 90).toFixed(2)}ms`
  );
  console.log(
    `   P95: ${calculatePercentile(metrics.latencies, 95).toFixed(2)}ms`
  );
  console.log(
    `   P99: ${calculatePercentile(metrics.latencies, 99).toFixed(2)}ms`
  );

  if (metrics.errors.size > 0) {
    console.log("\n❌ Errors:");
    for (const [error, count] of metrics.errors.entries()) {
      console.log(`   ${error}: ${count}`);
    }
  }

  // Assessment
  console.log("\n🎯 Assessment:");
  const successRate =
    (metrics.successfulRequests / metrics.totalRequests) * 100;
  const p99 = calculatePercentile(metrics.latencies, 99);

  if (successRate >= 99 && p99 < 500 && rps >= 50) {
    console.log("   ✅ PASS - API ready for 10K+ DAU");
    console.log(`   - Success rate: ${successRate.toFixed(2)}% (>= 99%)`);
    console.log(`   - P99 latency: ${p99.toFixed(2)}ms (< 500ms)`);
    console.log(`   - Throughput: ${rps.toFixed(2)} RPS (>= 50 RPS)`);
  } else {
    console.log("   ⚠️  WARNING - May need optimization");
    if (successRate < 99) {
      console.log(
        `   - Success rate: ${successRate.toFixed(2)}% (target: >= 99%)`
      );
    }
    if (p99 >= 500) {
      console.log(`   - P99 latency: ${p99.toFixed(2)}ms (target: < 500ms)`);
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

async function makeRequest(
  config: TestConfig,
  metrics: Metrics
): Promise<void> {
  const startTime = Date.now();
  const url = `${config.baseUrl}${config.endpoint}`;

  try {
    const response = await fetch(url, {
      method: config.method,
      headers: config.headers,
      body: config.body,
    });

    const latency = Date.now() - startTime;
    const status = response.status;

    // Track status codes
    metrics.statusCodes.set(status, (metrics.statusCodes.get(status) || 0) + 1);

    if (status >= 200 && status < 300) {
      metrics.successfulRequests++;
      metrics.totalLatencyMs += latency;
      metrics.minLatencyMs = Math.min(metrics.minLatencyMs, latency);
      metrics.maxLatencyMs = Math.max(metrics.maxLatencyMs, latency);
      metrics.latencies.push(latency);

      if (config.verbose) {
        console.log(`   ✓ ${status} in ${latency}ms`);
      }
    } else {
      metrics.failedRequests++;
      const errorKey = `HTTP ${status}`;
      metrics.errors.set(errorKey, (metrics.errors.get(errorKey) || 0) + 1);

      if (config.verbose) {
        console.log(`   ✗ ${status} in ${latency}ms`);
      }
    }
  } catch (error) {
    metrics.failedRequests++;
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    const errorKey = errorMsg.substring(0, 50);
    metrics.errors.set(errorKey, (metrics.errors.get(errorKey) || 0) + 1);

    if (config.verbose) {
      console.log(`   ✗ Error: ${errorMsg}`);
    }
  } finally {
    metrics.totalRequests++;
  }
}

async function runLoadTest(config: TestConfig): Promise<void> {
  console.log("\n🚀 Starting API Load Test\n");
  console.log(
    `   Endpoint: ${config.method} ${config.baseUrl}${config.endpoint}`
  );
  console.log(`   Concurrent: ${config.concurrent}`);
  console.log(`   Total Requests: ${config.totalRequests}`);
  console.log(`   Duration: ${config.durationSeconds}s`);

  // Test connectivity
  console.log("\n📡 Testing API connectivity...");
  try {
    const response = await fetch(`${config.baseUrl}${config.endpoint}`);
    console.log(`   ✅ API reachable (status: ${response.status})`);
  } catch (error) {
    console.error("   ❌ API unreachable:", error);
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
    while (
      running &&
      requestsSent < config.totalRequests &&
      Date.now() < endTime
    ) {
      requestsSent++;
      await makeRequest(config, metrics);
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
