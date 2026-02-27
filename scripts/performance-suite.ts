#!/usr/bin/env npx tsx

/**
 * Comprehensive Performance Test Suite
 *
 * Tests:
 * 1. API Latency (p50/p90/p99) across endpoints
 * 2. Stress test job creation (50 → 200 RPS)
 * 3. Mobile upload latency simulation
 * 4. WebSocket concurrency (100 → 500 connections)
 *
 * Usage:
 *   npx tsx scripts/performance-suite.ts
 *   npx tsx scripts/performance-suite.ts --test=latency
 *   npx tsx scripts/performance-suite.ts --test=stress
 *   npx tsx scripts/performance-suite.ts --test=upload
 *   npx tsx scripts/performance-suite.ts --test=websocket
 */

import { WebSocket } from "ws";

// =============================================================================
// CONFIGURATION
// =============================================================================

const BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";
const WS_URL = process.env.WS_URL || "ws://localhost:3001";

interface LatencyMetrics {
  endpoint: string;
  method: string;
  requests: number;
  successful: number;
  failed: number;
  latencies: number[];
  errors: string[];
}

interface StressTestResult {
  targetRps: number;
  achievedRps: number;
  successRate: number;
  p50: number;
  p90: number;
  p99: number;
  errors: number;
}

interface WebSocketResult {
  targetConnections: number;
  successfulConnections: number;
  failedConnections: number;
  avgConnectionTime: number;
  maxConnectionTime: number;
  messagesReceived: number;
}

// =============================================================================
// UTILITIES
// =============================================================================

function calculatePercentile(latencies: number[], percentile: number): number {
  if (latencies.length === 0) return 0;
  const sorted = [...latencies].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function makeRequest(
  url: string,
  method: string = "GET",
  body?: object,
  headers: Record<string, string> = {}
): Promise<{ status: number; latency: number; error?: string }> {
  const start = Date.now();
  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-client-type": "mobile",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: response.status,
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 0,
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// TEST 1: API LATENCY MEASUREMENT
// =============================================================================

async function testApiLatency(): Promise<void> {
  console.log("\n" + "=".repeat(70));
  console.log("TEST 1: API LATENCY MEASUREMENT (p50/p90/p99)");
  console.log("=".repeat(70));

  const endpoints = [
    { path: "/api/health", method: "GET", name: "Health Check" },
    { path: "/api/loads", method: "GET", name: "List Loads" },
    { path: "/api/trucks", method: "GET", name: "List Trucks" },
    { path: "/api/trips", method: "GET", name: "List Trips" },
    { path: "/api/notifications", method: "GET", name: "Notifications" },
  ];

  const results: LatencyMetrics[] = [];
  const requestsPerEndpoint = 100;

  for (const endpoint of endpoints) {
    console.log(
      `\n📊 Testing ${endpoint.name} (${endpoint.method} ${endpoint.path})...`
    );

    const metrics: LatencyMetrics = {
      endpoint: endpoint.path,
      method: endpoint.method,
      requests: 0,
      successful: 0,
      failed: 0,
      latencies: [],
      errors: [],
    };

    // Warm-up request
    await makeRequest(`${BASE_URL}${endpoint.path}`, endpoint.method);

    // Run test requests
    for (let i = 0; i < requestsPerEndpoint; i++) {
      const result = await makeRequest(
        `${BASE_URL}${endpoint.path}`,
        endpoint.method
      );
      metrics.requests++;

      if (result.status >= 200 && result.status < 400) {
        metrics.successful++;
        metrics.latencies.push(result.latency);
      } else {
        metrics.failed++;
        if (result.error) metrics.errors.push(result.error);
      }

      // Small delay to avoid overwhelming
      if (i % 10 === 0) await sleep(10);
    }

    results.push(metrics);

    // Print endpoint results
    const p50 = calculatePercentile(metrics.latencies, 50);
    const p90 = calculatePercentile(metrics.latencies, 90);
    const p99 = calculatePercentile(metrics.latencies, 99);
    const avg =
      metrics.latencies.length > 0
        ? metrics.latencies.reduce((a, b) => a + b, 0) /
          metrics.latencies.length
        : 0;

    console.log(
      `   Requests: ${metrics.successful}/${metrics.requests} successful`
    );
    console.log(
      `   Avg: ${avg.toFixed(2)}ms | P50: ${p50.toFixed(2)}ms | P90: ${p90.toFixed(2)}ms | P99: ${p99.toFixed(2)}ms`
    );
  }

  // Summary table
  console.log("\n" + "-".repeat(70));
  console.log("LATENCY SUMMARY");
  console.log("-".repeat(70));
  console.log(
    "| Endpoint                | Avg (ms) | P50 (ms) | P90 (ms) | P99 (ms) |"
  );
  console.log(
    "|-------------------------|----------|----------|----------|----------|"
  );

  for (const m of results) {
    const avg =
      m.latencies.length > 0
        ? (m.latencies.reduce((a, b) => a + b, 0) / m.latencies.length).toFixed(
            1
          )
        : "N/A";
    const p50 = calculatePercentile(m.latencies, 50).toFixed(1);
    const p90 = calculatePercentile(m.latencies, 90).toFixed(1);
    const p99 = calculatePercentile(m.latencies, 99).toFixed(1);

    console.log(
      `| ${m.endpoint.padEnd(23)} | ${avg.padStart(8)} | ${p50.padStart(8)} | ${p90.padStart(8)} | ${p99.padStart(8)} |`
    );
  }
  console.log("-".repeat(70));
}

// =============================================================================
// TEST 2: STRESS TEST JOB CREATION (50 → 200 RPS)
// =============================================================================

async function testJobCreationStress(): Promise<void> {
  console.log("\n" + "=".repeat(70));
  console.log("TEST 2: STRESS TEST JOB CREATION ENDPOINT (50 → 200 RPS)");
  console.log("=".repeat(70));

  const rpsLevels = [50, 100, 150, 200];
  const testDurationSeconds = 10;
  const results: StressTestResult[] = [];

  // Sample load creation payload
  const loadPayload = {
    pickupCity: "Addis Ababa",
    deliveryCity: "Dire Dawa",
    pickupDate: new Date(Date.now() + 86400000).toISOString(),
    deliveryDate: new Date(Date.now() + 172800000).toISOString(),
    truckType: "DRY_VAN",
    weight: 5000,
    cargoDescription: "Test cargo for stress testing performance",
    fullPartial: "FULL",
    isFragile: false,
    requiresRefrigeration: false,
    status: "DRAFT", // Use DRAFT to avoid side effects
  };

  for (const targetRps of rpsLevels) {
    console.log(
      `\n🔥 Testing at ${targetRps} RPS for ${testDurationSeconds}s...`
    );

    const latencies: number[] = [];
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];
    const startTime = Date.now();
    const endTime = startTime + testDurationSeconds * 1000;
    const delayBetweenRequests = 1000 / targetRps;

    let requestsStarted = 0;
    const promises: Promise<void>[] = [];

    // Fire requests at target RPS
    while (Date.now() < endTime) {
      const batchStart = Date.now();

      // Start batch of requests
      for (let i = 0; i < Math.min(10, targetRps / 10); i++) {
        if (Date.now() >= endTime) break;

        requestsStarted++;
        const promise = makeRequest(
          `${BASE_URL}/api/loads`,
          "POST",
          loadPayload
        ).then((result) => {
          if (result.status >= 200 && result.status < 400) {
            successful++;
            latencies.push(result.latency);
          } else if (result.status === 429) {
            // Rate limited - expected under stress
            failed++;
            errors.push("Rate limited (429)");
          } else {
            failed++;
            if (result.error) errors.push(result.error);
          }
        });
        promises.push(promise);
      }

      // Wait to maintain RPS
      const elapsed = Date.now() - batchStart;
      const targetDelay = (1000 / targetRps) * 10;
      if (elapsed < targetDelay) {
        await sleep(targetDelay - elapsed);
      }
    }

    // Wait for all requests to complete
    await Promise.all(promises);

    const actualDuration = (Date.now() - startTime) / 1000;
    const achievedRps = (successful + failed) / actualDuration;

    results.push({
      targetRps,
      achievedRps,
      successRate: (successful / (successful + failed)) * 100,
      p50: calculatePercentile(latencies, 50),
      p90: calculatePercentile(latencies, 90),
      p99: calculatePercentile(latencies, 99),
      errors: failed,
    });

    console.log(`   Achieved: ${achievedRps.toFixed(1)} RPS`);
    console.log(
      `   Success: ${successful}/${successful + failed} (${((successful / (successful + failed)) * 100).toFixed(1)}%)`
    );
    console.log(
      `   P50: ${calculatePercentile(latencies, 50).toFixed(1)}ms | P90: ${calculatePercentile(latencies, 90).toFixed(1)}ms | P99: ${calculatePercentile(latencies, 99).toFixed(1)}ms`
    );

    // Small cooldown between levels
    await sleep(2000);
  }

  // Summary
  console.log("\n" + "-".repeat(70));
  console.log("STRESS TEST SUMMARY - POST /api/loads");
  console.log("-".repeat(70));
  console.log(
    "| Target RPS | Achieved RPS | Success % | P50 (ms) | P90 (ms) | P99 (ms) |"
  );
  console.log(
    "|------------|--------------|-----------|----------|----------|----------|"
  );

  for (const r of results) {
    console.log(
      `| ${r.targetRps.toString().padStart(10)} | ${r.achievedRps.toFixed(1).padStart(12)} | ${r.successRate.toFixed(1).padStart(9)} | ${r.p50.toFixed(1).padStart(8)} | ${r.p90.toFixed(1).padStart(8)} | ${r.p99.toFixed(1).padStart(8)} |`
    );
  }
  console.log("-".repeat(70));

  // Assessment
  const maxSustainable = results.filter((r) => r.successRate >= 95).pop();
  if (maxSustainable) {
    console.log(
      `\n✅ Maximum sustainable RPS (95%+ success): ${maxSustainable.targetRps} RPS`
    );
  } else {
    console.log(
      `\n⚠️  Could not sustain 95% success rate at any tested RPS level`
    );
  }
}

// =============================================================================
// TEST 3: MOBILE UPLOAD LATENCY
// =============================================================================

async function testMobileUploadLatency(): Promise<void> {
  console.log("\n" + "=".repeat(70));
  console.log("TEST 3: MOBILE UPLOAD LATENCY SIMULATION");
  console.log("=".repeat(70));

  // Test different payload sizes simulating mobile uploads
  const payloadSizes = [
    { name: "Small JSON (1KB)", size: 1024 },
    { name: "Medium JSON (10KB)", size: 10240 },
    { name: "Large JSON (50KB)", size: 51200 },
    { name: "GPS Batch (100 positions)", size: 15000 },
  ];

  const results: {
    name: string;
    avgLatency: number;
    p95: number;
    throughput: string;
  }[] = [];

  for (const payload of payloadSizes) {
    console.log(`\n📤 Testing ${payload.name}...`);

    // Generate payload of specified size
    const data = {
      truckId: "test-truck-123",
      positions: Array(Math.floor(payload.size / 150))
        .fill(null)
        .map((_, i) => ({
          latitude: 9.0 + i * 0.001,
          longitude: 38.7 + i * 0.001,
          speed: 60,
          heading: 180,
          altitude: 2400,
          accuracy: 10,
          timestamp: new Date().toISOString(),
        })),
    };

    const latencies: number[] = [];
    const iterations = 50;

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      try {
        // Simulate GPS batch upload
        const response = await fetch(`${BASE_URL}/api/gps/batch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-client-type": "mobile",
          },
          body: JSON.stringify(data),
        });

        const latency = Date.now() - start;
        if (response.status >= 200 && response.status < 500) {
          latencies.push(latency);
        }
      } catch {
        // Ignore errors for latency test
      }

      if (i % 10 === 0) await sleep(50);
    }

    const avgLatency =
      latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0;
    const p95 = calculatePercentile(latencies, 95);
    const throughput = `${(payload.size / 1024 / (avgLatency / 1000)).toFixed(1)} KB/s`;

    results.push({ name: payload.name, avgLatency, p95, throughput });

    console.log(`   Avg Latency: ${avgLatency.toFixed(1)}ms`);
    console.log(`   P95 Latency: ${p95.toFixed(1)}ms`);
    console.log(`   Throughput: ${throughput}`);
  }

  // Summary
  console.log("\n" + "-".repeat(70));
  console.log("MOBILE UPLOAD LATENCY SUMMARY");
  console.log("-".repeat(70));
  console.log(
    "| Payload Type              | Avg (ms) | P95 (ms) | Throughput  |"
  );
  console.log(
    "|---------------------------|----------|----------|-------------|"
  );

  for (const r of results) {
    console.log(
      `| ${r.name.padEnd(25)} | ${r.avgLatency.toFixed(1).padStart(8)} | ${r.p95.toFixed(1).padStart(8)} | ${r.throughput.padStart(11)} |`
    );
  }
  console.log("-".repeat(70));
}

// =============================================================================
// TEST 4: WEBSOCKET CONCURRENCY
// =============================================================================

async function testWebSocketConcurrency(): Promise<void> {
  console.log("\n" + "=".repeat(70));
  console.log("TEST 4: WEBSOCKET CONCURRENCY (100 → 500 CONNECTIONS)");
  console.log("=".repeat(70));

  const concurrencyLevels = [100, 200, 300, 400, 500];
  const results: WebSocketResult[] = [];

  for (const targetConnections of concurrencyLevels) {
    console.log(
      `\n🔌 Testing ${targetConnections} concurrent WebSocket connections...`
    );

    const connections: WebSocket[] = [];
    const connectionTimes: number[] = [];
    let successfulConnections = 0;
    let failedConnections = 0;
    let messagesReceived = 0;

    const startTime = Date.now();

    // Create connections
    const connectionPromises = Array(targetConnections)
      .fill(null)
      .map(async (_, index) => {
        const connStart = Date.now();

        return new Promise<void>((resolve) => {
          try {
            // Use mock URL since WS server may not be running
            const ws = new WebSocket(`${WS_URL}?client=${index}`);

            const timeout = setTimeout(() => {
              ws.close();
              failedConnections++;
              resolve();
            }, 5000);

            ws.on("open", () => {
              clearTimeout(timeout);
              successfulConnections++;
              connectionTimes.push(Date.now() - connStart);
              connections.push(ws);
              resolve();
            });

            ws.on("message", () => {
              messagesReceived++;
            });

            ws.on("error", () => {
              clearTimeout(timeout);
              failedConnections++;
              resolve();
            });

            ws.on("close", () => {
              clearTimeout(timeout);
            });
          } catch {
            failedConnections++;
            resolve();
          }
        });
      });

    // Wait for all connection attempts
    await Promise.all(connectionPromises);

    const totalTime = Date.now() - startTime;
    const avgConnectionTime =
      connectionTimes.length > 0
        ? connectionTimes.reduce((a, b) => a + b, 0) / connectionTimes.length
        : 0;
    const maxConnectionTime =
      connectionTimes.length > 0 ? Math.max(...connectionTimes) : 0;

    results.push({
      targetConnections,
      successfulConnections,
      failedConnections,
      avgConnectionTime,
      maxConnectionTime,
      messagesReceived,
    });

    console.log(`   Successful: ${successfulConnections}/${targetConnections}`);
    console.log(`   Avg Connect Time: ${avgConnectionTime.toFixed(1)}ms`);
    console.log(`   Max Connect Time: ${maxConnectionTime.toFixed(1)}ms`);
    console.log(`   Total Time: ${totalTime}ms`);

    // Cleanup connections
    for (const ws of connections) {
      try {
        ws.close();
      } catch {
        // Ignore cleanup errors
      }
    }

    // Cooldown
    await sleep(2000);
  }

  // Summary
  console.log("\n" + "-".repeat(70));
  console.log("WEBSOCKET CONCURRENCY SUMMARY");
  console.log("-".repeat(70));
  console.log(
    "| Target | Success | Failed | Avg Connect (ms) | Max Connect (ms) |"
  );
  console.log(
    "|--------|---------|--------|------------------|------------------|"
  );

  for (const r of results) {
    console.log(
      `| ${r.targetConnections.toString().padStart(6)} | ${r.successfulConnections.toString().padStart(7)} | ${r.failedConnections.toString().padStart(6)} | ${r.avgConnectionTime.toFixed(1).padStart(16)} | ${r.maxConnectionTime.toFixed(1).padStart(16)} |`
    );
  }
  console.log("-".repeat(70));

  // Assessment
  const maxSuccessful = results.reduce(
    (max, r) => (r.successfulConnections > max.successfulConnections ? r : max),
    results[0]
  );

  if (
    maxSuccessful.successfulConnections >=
    maxSuccessful.targetConnections * 0.9
  ) {
    console.log(
      `\n✅ WebSocket server handled ${maxSuccessful.targetConnections} connections successfully`
    );
  } else {
    console.log(
      `\n⚠️  WebSocket server may need optimization for high concurrency`
    );
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const testArg = args.find((a) => a.startsWith("--test="))?.split("=")[1];

  console.log("\n" + "█".repeat(70));
  console.log("         FREIGHT MANAGEMENT PERFORMANCE TEST SUITE");
  console.log("█".repeat(70));
  console.log(`\nBase URL: ${BASE_URL}`);
  console.log(`WebSocket URL: ${WS_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);

  // Verify API is reachable
  console.log("\n📡 Verifying API connectivity...");
  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    console.log(`   ✅ API reachable (status: ${response.status})`);
  } catch (error) {
    console.error(
      "   ❌ API unreachable. Please ensure the server is running."
    );
    console.error(
      `   Error: ${error instanceof Error ? error.message : "Unknown"}`
    );
    process.exit(1);
  }

  const startTime = Date.now();

  if (!testArg || testArg === "latency") {
    await testApiLatency();
  }

  if (!testArg || testArg === "stress") {
    await testJobCreationStress();
  }

  if (!testArg || testArg === "upload") {
    await testMobileUploadLatency();
  }

  if (!testArg || testArg === "websocket") {
    await testWebSocketConcurrency();
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n" + "█".repeat(70));
  console.log("                    PERFORMANCE SUITE COMPLETE");
  console.log("█".repeat(70));
  console.log(`\nTotal Duration: ${totalDuration}s`);
  console.log(`Completed: ${new Date().toISOString()}`);
}

main().catch(console.error);
