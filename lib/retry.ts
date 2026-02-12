/**
 * Retry Utility
 *
 * PHASE 4: Backend Reliability
 *
 * Provides retry logic for transient failures such as:
 * - Database connection timeouts
 * - Network failures
 * - External API rate limits
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in milliseconds (default: 100) */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds (default: 5000) */
  maxDelayMs?: number;
  /** Exponential backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Whether to add jitter to delays (default: true) */
  jitter?: boolean;
  /** Custom function to determine if error is retryable */
  isRetryable?: (error: unknown) => boolean;
  /** Callback for each retry attempt */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

const defaultOptions: Required<Omit<RetryOptions, 'isRetryable' | 'onRetry'>> = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  jitter: true,
};

/** Type guard for error objects with code property */
function hasErrorCode(error: unknown): error is { code?: string; status?: number; message?: string } {
  return typeof error === 'object' && error !== null;
}

/**
 * Default function to determine if an error is retryable
 */
function defaultIsRetryable(error: unknown): boolean {
  if (!hasErrorCode(error)) return false;

  // Prisma connection errors
  if (error.code === 'P1001') return true; // Can't reach database server
  if (error.code === 'P1002') return true; // Database server timed out
  if (error.code === 'P1008') return true; // Operations timed out
  if (error.code === 'P1017') return true; // Server has closed the connection

  // Network errors
  if (error.code === 'ECONNRESET') return true;
  if (error.code === 'ETIMEDOUT') return true;
  if (error.code === 'ECONNREFUSED') return true;
  if (error.code === 'ENOTFOUND') return true;

  // HTTP status codes that are retryable
  if (error.status === 408) return true; // Request Timeout
  if (error.status === 429) return true; // Too Many Requests
  if (error.status === 500) return true; // Internal Server Error
  if (error.status === 502) return true; // Bad Gateway
  if (error.status === 503) return true; // Service Unavailable
  if (error.status === 504) return true; // Gateway Timeout

  // Check error message for common transient patterns
  const message = error.message?.toLowerCase() || '';
  if (message.includes('timeout')) return true;
  if (message.includes('connection')) return true;
  if (message.includes('temporarily unavailable')) return true;
  if (message.includes('rate limit')) return true;

  return false;
}

/**
 * Calculate delay with optional jitter
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number,
  jitter: boolean
): number {
  // Exponential backoff
  let delay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);

  // Cap at max delay
  delay = Math.min(delay, maxDelayMs);

  // Add jitter (0-50% of delay)
  if (jitter) {
    delay = delay * (1 + Math.random() * 0.5);
  }

  return Math.round(delay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute an async operation with retry logic
 *
 * @param operation The async operation to execute
 * @param options Retry configuration options
 * @returns Result of the operation
 * @throws Last error if all retries fail
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => db.user.findMany(),
 *   { maxAttempts: 3 }
 * );
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = {
    ...defaultOptions,
    ...options,
    isRetryable: options.isRetryable || defaultIsRetryable,
  };

  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry on last attempt
      if (attempt === opts.maxAttempts) {
        break;
      }

      // Check if error is retryable
      if (!opts.isRetryable(error)) {
        throw error;
      }

      // Calculate delay
      const delayMs = calculateDelay(
        attempt,
        opts.initialDelayMs,
        opts.maxDelayMs,
        opts.backoffMultiplier,
        opts.jitter
      );

      // Call onRetry callback if provided
      if (opts.onRetry) {
        opts.onRetry(error, attempt, delayMs);
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(
          `[Retry] Attempt ${attempt}/${opts.maxAttempts} failed, retrying in ${delayMs}ms:`,
          errorMessage
        );
      }

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * Create a retry-wrapped version of a function
 *
 * @param fn The function to wrap
 * @param options Retry configuration options
 * @returns Wrapped function with retry logic
 *
 * @example
 * ```typescript
 * const fetchUserWithRetry = createRetryableFunction(
 *   (id: string) => db.user.findUnique({ where: { id } }),
 *   { maxAttempts: 3 }
 * );
 * const user = await fetchUserWithRetry('user-id');
 * ```
 */
export function createRetryableFunction<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => withRetry(() => fn(...args), options);
}

/**
 * Retry options preset for database operations
 */
export const DATABASE_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 2000,
  backoffMultiplier: 2,
  jitter: true,
  isRetryable: (error) => {
    if (!hasErrorCode(error)) return false;
    // Only retry Prisma connection errors
    if (error.code === 'P1001') return true;
    if (error.code === 'P1002') return true;
    if (error.code === 'P1008') return true;
    if (error.code === 'P1017') return true;
    return false;
  },
};

/**
 * Retry options preset for external API calls
 */
export const EXTERNAL_API_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitter: true,
  isRetryable: (error) => {
    if (!hasErrorCode(error)) return false;
    // Retry on network errors and server errors
    if (error.status === 429) return true; // Rate limited
    if (error.status && error.status >= 500) return true; // Server errors
    if (error.code === 'ECONNRESET') return true;
    if (error.code === 'ETIMEDOUT') return true;
    return false;
  },
};

/**
 * Helper for retrying database queries
 *
 * @example
 * ```typescript
 * const users = await retryDbQuery(() =>
 *   db.user.findMany({ where: { isActive: true } })
 * );
 * ```
 */
export function retryDbQuery<T>(query: () => Promise<T>): Promise<T> {
  return withRetry(query, DATABASE_RETRY_OPTIONS);
}

/**
 * Helper for retrying external API calls
 *
 * @example
 * ```typescript
 * const response = await retryExternalApi(() =>
 *   fetch('https://api.example.com/data')
 * );
 * ```
 */
export function retryExternalApi<T>(apiCall: () => Promise<T>): Promise<T> {
  return withRetry(apiCall, EXTERNAL_API_RETRY_OPTIONS);
}
