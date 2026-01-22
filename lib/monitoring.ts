/**
 * Application Monitoring Service
 *
 * PHASE 3: Application-Level Logging & Monitoring
 *
 * Features:
 * - System metrics (CPU, Memory, Event Loop)
 * - Performance thresholds and alerts
 * - Slow query detection
 * - Health score calculation
 * - Metrics aggregation for dashboards
 *
 * Environment Variables:
 * - ALERT_CPU_THRESHOLD: CPU usage % threshold (default: 80)
 * - ALERT_MEMORY_THRESHOLD: Memory usage % threshold (default: 85)
 * - ALERT_SLOW_QUERY_THRESHOLD_MS: Slow query threshold in ms (default: 1000)
 * - ALERT_ERROR_RATE_THRESHOLD: Error rate % threshold (default: 5)
 * - MONITORING_ENABLED: Enable monitoring (default: true)
 */

import { logger } from './logger';

// =============================================================================
// TYPES
// =============================================================================

export interface SystemMetrics {
  cpu: {
    usage: number; // 0-100
    loadAverage: number[];
  };
  memory: {
    used: number; // bytes
    total: number; // bytes
    usagePercent: number; // 0-100
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  eventLoop: {
    latencyMs: number;
    activeHandles: number;
    activeRequests: number;
  };
  uptime: number; // seconds
  timestamp: string;
}

export interface Alert {
  id: string;
  type: 'cpu' | 'memory' | 'slow_query' | 'error_rate' | 'event_loop';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
}

export interface MonitoringConfig {
  enabled: boolean;
  cpuThreshold: number;
  memoryThreshold: number;
  slowQueryThresholdMs: number;
  errorRateThreshold: number;
  eventLoopThresholdMs: number;
  checkIntervalMs: number;
}

export interface HealthScore {
  score: number; // 0-100
  status: 'healthy' | 'degraded' | 'unhealthy';
  factors: {
    cpu: number;
    memory: number;
    errorRate: number;
    responseTime: number;
  };
}

// =============================================================================
// CONFIGURATION
// =============================================================================

function getConfig(): MonitoringConfig {
  return {
    enabled: process.env.MONITORING_ENABLED !== 'false',
    cpuThreshold: parseInt(process.env.ALERT_CPU_THRESHOLD || '80'),
    memoryThreshold: parseInt(process.env.ALERT_MEMORY_THRESHOLD || '85'),
    slowQueryThresholdMs: parseInt(process.env.ALERT_SLOW_QUERY_THRESHOLD_MS || '1000'),
    errorRateThreshold: parseInt(process.env.ALERT_ERROR_RATE_THRESHOLD || '5'),
    eventLoopThresholdMs: parseInt(process.env.ALERT_EVENT_LOOP_THRESHOLD_MS || '100'),
    checkIntervalMs: parseInt(process.env.MONITORING_CHECK_INTERVAL_MS || '60000'), // 1 minute
  };
}

// =============================================================================
// MONITORING STATE
// =============================================================================

interface MonitoringState {
  alerts: Alert[];
  lastCheck: number;
  cpuHistory: number[];
  memoryHistory: number[];
  responseTimeHistory: number[];
  errorRateHistory: number[];
  requestCount: number;
  errorCount: number;
  lastResetTime: number;
}

const state: MonitoringState = {
  alerts: [],
  lastCheck: 0,
  cpuHistory: [],
  memoryHistory: [],
  responseTimeHistory: [],
  errorRateHistory: [],
  requestCount: 0,
  errorCount: 0,
  lastResetTime: Date.now(),
};

const MAX_HISTORY_SIZE = 60; // Keep last 60 data points (1 hour at 1-minute intervals)
const MAX_ALERTS = 100;

// =============================================================================
// SYSTEM METRICS
// =============================================================================

/**
 * Get current system metrics
 */
export function getSystemMetrics(): SystemMetrics {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  // Calculate CPU usage percentage (approximate)
  const cpuPercent = Math.min(100, Math.round(
    (cpuUsage.user + cpuUsage.system) / 1000000 // Convert to seconds
  ));

  // Get load average (Unix only, returns 0 on Windows)
  let loadAverage = [0, 0, 0];
  try {
    const os = require('os');
    loadAverage = os.loadavg();
  } catch {
    // os module not available
  }

  // Get total system memory
  let totalMemory = 0;
  try {
    const os = require('os');
    totalMemory = os.totalmem();
  } catch {
    totalMemory = memUsage.heapTotal * 2; // Fallback estimate
  }

  const memoryUsagePercent = totalMemory > 0
    ? Math.round((memUsage.rss / totalMemory) * 100)
    : 0;

  // Event loop latency (approximate using setImmediate)
  const eventLoopLatency = measureEventLoopLatency();

  return {
    cpu: {
      usage: cpuPercent,
      loadAverage,
    },
    memory: {
      used: memUsage.rss,
      total: totalMemory,
      usagePercent: memoryUsagePercent,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
    },
    eventLoop: {
      latencyMs: eventLoopLatency,
      activeHandles: (process as any)._getActiveHandles?.()?.length || 0,
      activeRequests: (process as any)._getActiveRequests?.()?.length || 0,
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
}

// Track event loop latency
let lastEventLoopCheck = Date.now();
let eventLoopLatency = 0;

function measureEventLoopLatency(): number {
  return eventLoopLatency;
}

// Periodically measure event loop latency
if (typeof setImmediate !== 'undefined') {
  setInterval(() => {
    const start = Date.now();
    setImmediate(() => {
      eventLoopLatency = Date.now() - start;
    });
  }, 1000);
}

// =============================================================================
// ALERTS
// =============================================================================

/**
 * Create a new alert
 */
function createAlert(
  type: Alert['type'],
  severity: Alert['severity'],
  message: string,
  value: number,
  threshold: number
): Alert {
  const alert: Alert = {
    id: `${type}-${Date.now()}`,
    type,
    severity,
    message,
    value,
    threshold,
    timestamp: new Date().toISOString(),
    resolved: false,
  };

  // Add to alerts list
  state.alerts.unshift(alert);

  // Keep only last N alerts
  if (state.alerts.length > MAX_ALERTS) {
    state.alerts = state.alerts.slice(0, MAX_ALERTS);
  }

  // Log the alert
  if (severity === 'critical') {
    logger.error(`[ALERT] ${message}`, undefined, { alertType: type, value, threshold });
  } else {
    logger.warn(`[ALERT] ${message}`, { alertType: type, value, threshold });
  }

  return alert;
}

/**
 * Check for alert conditions
 */
function checkAlerts(metrics: SystemMetrics): Alert[] {
  const config = getConfig();
  const newAlerts: Alert[] = [];

  // CPU Alert
  if (metrics.cpu.usage > config.cpuThreshold) {
    const severity = metrics.cpu.usage > 95 ? 'critical' : 'warning';
    newAlerts.push(createAlert(
      'cpu',
      severity,
      `High CPU usage: ${metrics.cpu.usage}%`,
      metrics.cpu.usage,
      config.cpuThreshold
    ));
  }

  // Memory Alert
  if (metrics.memory.usagePercent > config.memoryThreshold) {
    const severity = metrics.memory.usagePercent > 95 ? 'critical' : 'warning';
    newAlerts.push(createAlert(
      'memory',
      severity,
      `High memory usage: ${metrics.memory.usagePercent}%`,
      metrics.memory.usagePercent,
      config.memoryThreshold
    ));
  }

  // Event Loop Alert
  if (metrics.eventLoop.latencyMs > config.eventLoopThresholdMs) {
    const severity = metrics.eventLoop.latencyMs > 500 ? 'critical' : 'warning';
    newAlerts.push(createAlert(
      'event_loop',
      severity,
      `High event loop latency: ${metrics.eventLoop.latencyMs}ms`,
      metrics.eventLoop.latencyMs,
      config.eventLoopThresholdMs
    ));
  }

  // Error Rate Alert
  const errorRate = getErrorRate();
  if (errorRate > config.errorRateThreshold) {
    const severity = errorRate > 10 ? 'critical' : 'warning';
    newAlerts.push(createAlert(
      'error_rate',
      severity,
      `High error rate: ${errorRate.toFixed(1)}%`,
      errorRate,
      config.errorRateThreshold
    ));
  }

  return newAlerts;
}

/**
 * Get current error rate
 */
function getErrorRate(): number {
  if (state.requestCount === 0) return 0;
  return (state.errorCount / state.requestCount) * 100;
}

/**
 * Record a request for error rate tracking
 */
export function recordRequest(isError: boolean = false): void {
  state.requestCount++;
  if (isError) {
    state.errorCount++;
  }
}

/**
 * Get active (unresolved) alerts
 */
export function getActiveAlerts(): Alert[] {
  return state.alerts.filter(a => !a.resolved);
}

/**
 * Get all alerts
 */
export function getAllAlerts(limit: number = 50): Alert[] {
  return state.alerts.slice(0, limit);
}

/**
 * Resolve an alert
 */
export function resolveAlert(alertId: string): boolean {
  const alert = state.alerts.find(a => a.id === alertId);
  if (alert && !alert.resolved) {
    alert.resolved = true;
    alert.resolvedAt = new Date().toISOString();
    logger.info(`[ALERT RESOLVED] ${alert.message}`, { alertId });
    return true;
  }
  return false;
}

// =============================================================================
// HEALTH SCORE
// =============================================================================

/**
 * Calculate overall health score
 */
export function calculateHealthScore(): HealthScore {
  const metrics = getSystemMetrics();
  const logMetrics = logger.getMetrics();
  const config = getConfig();

  // Calculate individual factor scores (0-100, higher is better)
  const cpuScore = Math.max(0, 100 - metrics.cpu.usage);
  const memoryScore = Math.max(0, 100 - metrics.memory.usagePercent);

  const errorRate = getErrorRate();
  const errorRateScore = Math.max(0, 100 - (errorRate * 10)); // 10% error = 0 score

  const avgResponseTime = logMetrics.requests.avgDurationMs;
  const responseTimeScore = avgResponseTime < 100 ? 100 :
                           avgResponseTime < 500 ? 80 :
                           avgResponseTime < 1000 ? 60 :
                           avgResponseTime < 2000 ? 40 : 20;

  // Weighted average
  const score = Math.round(
    cpuScore * 0.2 +
    memoryScore * 0.2 +
    errorRateScore * 0.3 +
    responseTimeScore * 0.3
  );

  // Determine status
  let status: HealthScore['status'] = 'healthy';
  if (score < 50) {
    status = 'unhealthy';
  } else if (score < 80) {
    status = 'degraded';
  }

  return {
    score,
    status,
    factors: {
      cpu: Math.round(cpuScore),
      memory: Math.round(memoryScore),
      errorRate: Math.round(errorRateScore),
      responseTime: Math.round(responseTimeScore),
    },
  };
}

// =============================================================================
// MONITORING SERVICE
// =============================================================================

let monitoringInterval: NodeJS.Timeout | null = null;

/**
 * Start the monitoring service
 */
export function startMonitoring(): void {
  const config = getConfig();

  if (!config.enabled) {
    logger.info('Monitoring disabled');
    return;
  }

  if (monitoringInterval) {
    logger.warn('Monitoring already started');
    return;
  }

  logger.info('Starting monitoring service', {
    checkIntervalMs: config.checkIntervalMs,
    cpuThreshold: config.cpuThreshold,
    memoryThreshold: config.memoryThreshold,
  });

  // Run initial check
  runMonitoringCheck();

  // Schedule periodic checks
  monitoringInterval = setInterval(runMonitoringCheck, config.checkIntervalMs);
}

/**
 * Stop the monitoring service
 */
export function stopMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    logger.info('Monitoring service stopped');
  }
}

/**
 * Run a single monitoring check
 */
function runMonitoringCheck(): void {
  const metrics = getSystemMetrics();
  state.lastCheck = Date.now();

  // Update history
  state.cpuHistory.push(metrics.cpu.usage);
  state.memoryHistory.push(metrics.memory.usagePercent);

  if (state.cpuHistory.length > MAX_HISTORY_SIZE) {
    state.cpuHistory.shift();
  }
  if (state.memoryHistory.length > MAX_HISTORY_SIZE) {
    state.memoryHistory.shift();
  }

  // Check for alerts
  checkAlerts(metrics);

  // Reset counters periodically (every hour)
  const hourMs = 60 * 60 * 1000;
  if (Date.now() - state.lastResetTime > hourMs) {
    state.requestCount = 0;
    state.errorCount = 0;
    state.lastResetTime = Date.now();
  }
}

// =============================================================================
// METRICS AGGREGATION
// =============================================================================

/**
 * Get aggregated monitoring data for dashboards
 */
export function getMonitoringData(): {
  system: SystemMetrics;
  health: HealthScore;
  alerts: {
    active: Alert[];
    recent: Alert[];
  };
  history: {
    cpu: number[];
    memory: number[];
  };
  requests: {
    count: number;
    errorCount: number;
    errorRate: number;
  };
  config: MonitoringConfig;
} {
  const logMetrics = logger.getMetrics();

  return {
    system: getSystemMetrics(),
    health: calculateHealthScore(),
    alerts: {
      active: getActiveAlerts(),
      recent: getAllAlerts(10),
    },
    history: {
      cpu: state.cpuHistory,
      memory: state.memoryHistory,
    },
    requests: {
      count: state.requestCount,
      errorCount: state.errorCount,
      errorRate: getErrorRate(),
    },
    config: getConfig(),
  };
}

/**
 * Get a summary of monitoring status
 */
export function getMonitoringSummary(): {
  status: 'ok' | 'warning' | 'critical';
  healthScore: number;
  activeAlerts: number;
  metrics: {
    cpu: number;
    memory: number;
    errorRate: number;
    avgResponseTime: number;
  };
} {
  const health = calculateHealthScore();
  const activeAlerts = getActiveAlerts();
  const metrics = getSystemMetrics();
  const logMetrics = logger.getMetrics();

  let status: 'ok' | 'warning' | 'critical' = 'ok';
  if (activeAlerts.some(a => a.severity === 'critical')) {
    status = 'critical';
  } else if (activeAlerts.length > 0 || health.status === 'degraded') {
    status = 'warning';
  }

  return {
    status,
    healthScore: health.score,
    activeAlerts: activeAlerts.length,
    metrics: {
      cpu: metrics.cpu.usage,
      memory: metrics.memory.usagePercent,
      errorRate: getErrorRate(),
      avgResponseTime: logMetrics.requests.avgDurationMs,
    },
  };
}

// =============================================================================
// SLOW QUERY TRACKING
// =============================================================================

/**
 * Record a slow query
 */
export function recordSlowQuery(query: string, durationMs: number): void {
  const config = getConfig();

  if (durationMs > config.slowQueryThresholdMs) {
    createAlert(
      'slow_query',
      durationMs > config.slowQueryThresholdMs * 2 ? 'critical' : 'warning',
      `Slow query detected: ${durationMs}ms`,
      durationMs,
      config.slowQueryThresholdMs
    );

    logger.logQuery(query, durationMs);
  }
}

// =============================================================================
// AUTO-START IN PRODUCTION
// =============================================================================

// Auto-start monitoring in production
if (process.env.NODE_ENV === 'production') {
  // Delay start to allow app initialization
  setTimeout(() => {
    startMonitoring();
  }, 5000);
}

export default {
  getSystemMetrics,
  getMonitoringData,
  getMonitoringSummary,
  calculateHealthScore,
  getActiveAlerts,
  getAllAlerts,
  resolveAlert,
  recordRequest,
  recordSlowQuery,
  startMonitoring,
  stopMonitoring,
};
