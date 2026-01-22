/**
 * Structured Logging Service
 *
 * PHASE 3: Application-Level Logging & Monitoring
 *
 * Features:
 * - Structured JSON logging for production
 * - Log levels: debug, info, warn, error, fatal
 * - Request correlation via requestId
 * - Performance timing
 * - Context enrichment (userId, organizationId, etc.)
 * - Log sampling for high-volume events
 * - Console output for development, JSON for production
 *
 * Environment Variables:
 * - LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error' (default: 'info')
 * - LOG_FORMAT: 'json' | 'pretty' (default: 'json' in production)
 * - LOG_SAMPLE_RATE: 0-1 for sampling high-volume logs (default: 1)
 */

// =============================================================================
// TYPES
// =============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  requestId?: string;
  userId?: string;
  organizationId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  metrics?: {
    durationMs?: number;
    memoryUsageMB?: number;
    cpuUsage?: number;
  };
}

interface LoggerConfig {
  level: LogLevel;
  format: 'json' | 'pretty';
  sampleRate: number;
  enableConsole: boolean;
  enableMetrics: boolean;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

function getConfig(): LoggerConfig {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    level: (process.env.LOG_LEVEL as LogLevel) || (isProd ? 'info' : 'debug'),
    format: (process.env.LOG_FORMAT as 'json' | 'pretty') || (isProd ? 'json' : 'pretty'),
    sampleRate: parseFloat(process.env.LOG_SAMPLE_RATE || '1'),
    enableConsole: true,
    enableMetrics: true,
  };
}

// =============================================================================
// METRICS COLLECTION
// =============================================================================

interface RequestMetrics {
  count: number;
  totalDurationMs: number;
  maxDurationMs: number;
  errorCount: number;
  slowCount: number; // > 1000ms
  statusCodes: Record<number, number>;
}

interface LogMetrics {
  requests: RequestMetrics;
  errors: {
    count: number;
    byType: Record<string, number>;
  };
  slowQueries: {
    count: number;
    queries: Array<{ query: string; durationMs: number; timestamp: string }>;
  };
  startTime: number;
}

const metrics: LogMetrics = {
  requests: {
    count: 0,
    totalDurationMs: 0,
    maxDurationMs: 0,
    errorCount: 0,
    slowCount: 0,
    statusCodes: {},
  },
  errors: {
    count: 0,
    byType: {},
  },
  slowQueries: {
    count: 0,
    queries: [],
  },
  startTime: Date.now(),
};

const MAX_SLOW_QUERIES = 100; // Keep last 100 slow queries
const SLOW_QUERY_THRESHOLD_MS = 1000; // 1 second
const SLOW_REQUEST_THRESHOLD_MS = 1000; // 1 second

// =============================================================================
// LOGGER CLASS
// =============================================================================

class Logger {
  private config: LoggerConfig;
  private defaultContext: LogContext = {};

  constructor() {
    this.config = getConfig();
  }

  /**
   * Set default context that will be included in all logs
   */
  setDefaultContext(context: LogContext): void {
    this.defaultContext = { ...this.defaultContext, ...context };
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): ChildLogger {
    return new ChildLogger(this, context);
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  /**
   * Check if log should be sampled (for high-volume logs)
   */
  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  /**
   * Format log entry for output
   */
  private formatEntry(entry: LogEntry): string {
    if (this.config.format === 'json') {
      return JSON.stringify(entry);
    }

    // Pretty format for development
    const levelColors: Record<LogLevel, string> = {
      debug: '\x1b[36m', // cyan
      info: '\x1b[32m',  // green
      warn: '\x1b[33m',  // yellow
      error: '\x1b[31m', // red
      fatal: '\x1b[35m', // magenta
    };
    const reset = '\x1b[0m';
    const color = levelColors[entry.level];

    let output = `${color}[${entry.level.toUpperCase()}]${reset} ${entry.message}`;

    if (entry.context?.requestId) {
      output += ` ${'\x1b[90m'}(${entry.context.requestId})${reset}`;
    }

    if (entry.context?.durationMs !== undefined) {
      output += ` ${'\x1b[90m'}${entry.context.durationMs}ms${reset}`;
    }

    if (entry.error) {
      output += `\n  Error: ${entry.error.message}`;
      if (entry.error.stack && this.config.level === 'debug') {
        output += `\n  ${entry.error.stack}`;
      }
    }

    return output;
  }

  /**
   * Write log entry
   */
  private write(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) return;
    if (level === 'debug' && !this.shouldSample()) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.defaultContext, ...context },
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      };
    }

    // Update metrics
    if (this.config.enableMetrics) {
      if (level === 'error' || level === 'fatal') {
        metrics.errors.count++;
        const errorType = error?.name || 'Unknown';
        metrics.errors.byType[errorType] = (metrics.errors.byType[errorType] || 0) + 1;
      }
    }

    // Output
    if (this.config.enableConsole) {
      const formatted = this.formatEntry(entry);
      if (level === 'error' || level === 'fatal') {
        console.error(formatted);
      } else if (level === 'warn') {
        console.warn(formatted);
      } else {
        console.log(formatted);
      }
    }
  }

  // Log level methods
  debug(message: string, context?: LogContext): void {
    this.write('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.write('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.write('warn', message, context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const err = error instanceof Error ? error : undefined;
    this.write('error', message, context, err);
  }

  fatal(message: string, error?: Error | unknown, context?: LogContext): void {
    const err = error instanceof Error ? error : undefined;
    this.write('fatal', message, context, err);
  }

  // =============================================================================
  // REQUEST LOGGING
  // =============================================================================

  /**
   * Log an incoming HTTP request
   */
  logRequest(context: {
    requestId: string;
    method: string;
    path: string;
    ip?: string;
    userAgent?: string;
    userId?: string;
    organizationId?: string;
  }): void {
    this.debug(`${context.method} ${context.path}`, context);
  }

  /**
   * Log an HTTP response
   */
  logResponse(context: {
    requestId: string;
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    ip?: string;
    userId?: string;
    organizationId?: string;
    error?: string;
  }): void {
    // Update metrics
    if (this.config.enableMetrics) {
      metrics.requests.count++;
      metrics.requests.totalDurationMs += context.durationMs;
      metrics.requests.maxDurationMs = Math.max(metrics.requests.maxDurationMs, context.durationMs);

      if (context.statusCode >= 400) {
        metrics.requests.errorCount++;
      }

      if (context.durationMs > SLOW_REQUEST_THRESHOLD_MS) {
        metrics.requests.slowCount++;
      }

      metrics.requests.statusCodes[context.statusCode] =
        (metrics.requests.statusCodes[context.statusCode] || 0) + 1;
    }

    const level: LogLevel = context.statusCode >= 500 ? 'error' :
                           context.statusCode >= 400 ? 'warn' :
                           context.durationMs > SLOW_REQUEST_THRESHOLD_MS ? 'warn' : 'info';

    const message = `${context.method} ${context.path} ${context.statusCode} ${context.durationMs}ms`;

    this.write(level, message, context);
  }

  // =============================================================================
  // QUERY LOGGING
  // =============================================================================

  /**
   * Log a database query
   */
  logQuery(query: string, durationMs: number, context?: LogContext): void {
    // Track slow queries
    if (this.config.enableMetrics && durationMs > SLOW_QUERY_THRESHOLD_MS) {
      metrics.slowQueries.count++;
      metrics.slowQueries.queries.push({
        query: query.substring(0, 500), // Truncate long queries
        durationMs,
        timestamp: new Date().toISOString(),
      });

      // Keep only last N slow queries
      if (metrics.slowQueries.queries.length > MAX_SLOW_QUERIES) {
        metrics.slowQueries.queries.shift();
      }

      this.warn(`Slow query: ${durationMs}ms`, { ...context, query: query.substring(0, 200) });
    }
  }

  // =============================================================================
  // METRICS ACCESS
  // =============================================================================

  /**
   * Get current metrics
   */
  getMetrics(): {
    requests: RequestMetrics & { avgDurationMs: number };
    errors: LogMetrics['errors'];
    slowQueries: LogMetrics['slowQueries'];
    uptime: number;
  } {
    const avgDurationMs = metrics.requests.count > 0
      ? Math.round(metrics.requests.totalDurationMs / metrics.requests.count)
      : 0;

    return {
      requests: {
        ...metrics.requests,
        avgDurationMs,
      },
      errors: metrics.errors,
      slowQueries: metrics.slowQueries,
      uptime: Date.now() - metrics.startTime,
    };
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void {
    metrics.requests = {
      count: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
      errorCount: 0,
      slowCount: 0,
      statusCodes: {},
    };
    metrics.errors = {
      count: 0,
      byType: {},
    };
    metrics.slowQueries = {
      count: 0,
      queries: [],
    };
    metrics.startTime = Date.now();
  }
}

// =============================================================================
// CHILD LOGGER
// =============================================================================

class ChildLogger {
  constructor(
    private parent: Logger,
    private context: LogContext
  ) {}

  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, { ...this.context, ...context });
  }

  info(message: string, context?: LogContext): void {
    this.parent.info(message, { ...this.context, ...context });
  }

  warn(message: string, context?: LogContext): void {
    this.parent.warn(message, { ...this.context, ...context });
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    this.parent.error(message, error, { ...this.context, ...context });
  }

  fatal(message: string, error?: Error | unknown, context?: LogContext): void {
    this.parent.fatal(message, error, { ...this.context, ...context });
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const logger = new Logger();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a request-scoped logger
 */
export function createRequestLogger(requestId: string, context?: LogContext): ChildLogger {
  return logger.child({ requestId, ...context });
}

/**
 * Measure execution time of an async function
 */
export async function withTiming<T>(
  name: string,
  fn: () => Promise<T>,
  context?: LogContext
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const durationMs = Date.now() - start;
    logger.debug(`${name} completed`, { ...context, durationMs });
    return result;
  } catch (error) {
    const durationMs = Date.now() - start;
    logger.error(`${name} failed`, error, { ...context, durationMs });
    throw error;
  }
}

/**
 * Log function decorator for timing
 */
export function timed(name?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const methodName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      try {
        const result = await originalMethod.apply(this, args);
        const durationMs = Date.now() - start;
        logger.debug(`${methodName} completed`, { durationMs });
        return result;
      } catch (error) {
        const durationMs = Date.now() - start;
        logger.error(`${methodName} failed`, error, { durationMs });
        throw error;
      }
    };

    return descriptor;
  };
}

export default logger;
