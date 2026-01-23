/**
 * Background Worker Queue (BullMQ)
 *
 * PHASE 4: Low Priority - Offload Heavy Tasks from API
 *
 * Features:
 * - Multiple queues for different job types
 * - Job retry with exponential backoff
 * - Job priority and scheduling
 * - Rate limiting per queue
 * - Progress tracking
 * - Job metrics and monitoring
 *
 * Recommended for:
 * - Distance matrix calculations
 * - Email/SMS notifications
 * - PDF generation
 * - Cleanup tasks
 * - Bulk operations
 * - Periodic/scheduled jobs
 *
 * Usage:
 * ```typescript
 * import { queues, addJob } from '@/lib/queue';
 *
 * // Add a job
 * await addJob('email', 'send', {
 *   to: 'user@example.com',
 *   subject: 'Welcome!',
 *   template: 'welcome',
 * });
 *
 * // Add a scheduled job
 * await addJob('cleanup', 'expire-loads', {}, {
 *   delay: 60000, // 1 minute
 *   repeat: { cron: '0 * * * *' }, // Every hour
 * });
 * ```
 */

import { logger } from './logger';

// =============================================================================
// TYPES
// =============================================================================

export type QueueName =
  | 'email'
  | 'sms'
  | 'notifications'
  | 'distance-matrix'
  | 'pdf'
  | 'cleanup'
  | 'bulk'
  | 'scheduled';

// JobData is a base type for queue job data
// Specific job data types (EmailJobData, SMSJobData, etc.) extend this
export type JobData = Record<string, unknown>;

export interface JobOptions {
  delay?: number;
  priority?: number;
  attempts?: number;
  backoff?: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
  repeat?: {
    cron?: string;
    every?: number;
    limit?: number;
  };
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
}

export interface QueueJob {
  id: string;
  name: string;
  data: JobData;
  progress: number;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  attemptsMade: number;
  failedReason?: string;
  createdAt: Date;
  processedOn?: Date;
  finishedOn?: Date;
}

export interface QueueStats {
  name: QueueName;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

interface QueueConfig {
  enabled: boolean;
  redisUrl: string | null;
  redisHost: string;
  redisPort: number;
  redisPassword: string | null;
  defaultJobOptions: JobOptions;
}

function getConfig(): QueueConfig {
  return {
    enabled: process.env.QUEUE_ENABLED === 'true' ||
             process.env.REDIS_ENABLED === 'true' ||
             !!process.env.REDIS_URL,
    redisUrl: process.env.REDIS_URL || null,
    redisHost: process.env.REDIS_HOST || 'localhost',
    redisPort: parseInt(process.env.REDIS_PORT || '6379'),
    redisPassword: process.env.REDIS_PASSWORD || null,
    defaultJobOptions: {
      attempts: parseInt(process.env.QUEUE_DEFAULT_ATTEMPTS || '3'),
      backoff: {
        type: 'exponential',
        delay: parseInt(process.env.QUEUE_BACKOFF_DELAY || '1000'),
      },
      removeOnComplete: 100, // Keep last 100 completed jobs
      removeOnFail: 1000, // Keep last 1000 failed jobs
    },
  };
}

// =============================================================================
// QUEUE DEFINITIONS
// =============================================================================

const QUEUE_CONFIGS: Record<QueueName, {
  concurrency: number;
  rateLimit?: { max: number; duration: number };
}> = {
  'email': {
    concurrency: 5,
    rateLimit: { max: 100, duration: 60000 }, // 100 per minute
  },
  'sms': {
    concurrency: 3,
    rateLimit: { max: 30, duration: 60000 }, // 30 per minute (API limits)
  },
  'notifications': {
    concurrency: 10,
  },
  'distance-matrix': {
    concurrency: 2,
    rateLimit: { max: 10, duration: 60000 }, // Google API limits
  },
  'pdf': {
    concurrency: 3,
  },
  'cleanup': {
    concurrency: 1,
  },
  'bulk': {
    concurrency: 2,
  },
  'scheduled': {
    concurrency: 5,
  },
};

// =============================================================================
// IN-MEMORY FALLBACK (when Redis not available)
// =============================================================================

interface InMemoryJob {
  id: string;
  queue: QueueName;
  name: string;
  data: JobData;
  options: JobOptions;
  status: QueueJob['status'];
  progress: number;
  attemptsMade: number;
  failedReason?: string;
  createdAt: Date;
  processedOn?: Date;
  finishedOn?: Date;
}

const inMemoryJobs: Map<string, InMemoryJob> = new Map();
const inMemoryQueues: Map<QueueName, InMemoryJob[]> = new Map();
let jobIdCounter = 0;

function generateJobId(): string {
  return `job_${Date.now()}_${++jobIdCounter}`;
}

// =============================================================================
// BULLMQ IMPLEMENTATION
// =============================================================================

let bullmqQueues: Map<QueueName, any> | null = null;
let bullmqWorkers: Map<QueueName, any> | null = null;
let redisConnection: any | null = null;

// =============================================================================
// GRACEFUL SHUTDOWN STATE
// =============================================================================

let isShuttingDown = false;
let isDraining = false;
let shutdownPromise: Promise<void> | null = null;

export type WorkerStatus = 'running' | 'draining' | 'stopped';

/**
 * Get current worker status for health checks
 */
export function getWorkerStatus(): {
  status: WorkerStatus;
  isShuttingDown: boolean;
  isDraining: boolean;
  activeWorkers: number;
  activeQueues: number;
} {
  let status: WorkerStatus = 'stopped';
  if (bullmqWorkers && bullmqWorkers.size > 0) {
    status = isDraining ? 'draining' : 'running';
  }

  return {
    status,
    isShuttingDown,
    isDraining,
    activeWorkers: bullmqWorkers?.size ?? 0,
    activeQueues: bullmqQueues?.size ?? 0,
  };
}

/**
 * Initialize BullMQ queues
 */
async function initializeBullMQ(): Promise<boolean> {
  const config = getConfig();

  if (!config.enabled) {
    logger.info('Queue system disabled - using in-memory fallback');
    return false;
  }

  try {
    // Dynamic import to avoid bundling issues
    const dynamicRequire = (moduleName: string): any => {
      return eval('require')(moduleName);
    };

    const { Queue, Worker, QueueEvents } = dynamicRequire('bullmq');
    const IORedis = dynamicRequire('ioredis');

    // Create Redis connection for BullMQ
    const connection = config.redisUrl
      ? new IORedis(config.redisUrl, { maxRetriesPerRequest: null })
      : new IORedis({
          host: config.redisHost,
          port: config.redisPort,
          password: config.redisPassword || undefined,
          maxRetriesPerRequest: null,
        });

    // Store connection reference for health checks
    redisConnection = connection;

    bullmqQueues = new Map();
    bullmqWorkers = new Map();

    // Initialize queues
    for (const [queueName, queueConfig] of Object.entries(QUEUE_CONFIGS)) {
      const queue = new Queue(queueName, {
        connection,
        defaultJobOptions: config.defaultJobOptions,
      });

      bullmqQueues.set(queueName as QueueName, queue);
      logger.info(`Queue initialized: ${queueName}`);
    }

    logger.info('BullMQ queues initialized successfully');
    return true;
  } catch (error) {
    logger.error('Failed to initialize BullMQ, using in-memory fallback', error);
    bullmqQueues = null;
    return false;
  }
}

// =============================================================================
// QUEUE API
// =============================================================================

/**
 * Add a job to a queue
 */
export async function addJob(
  queueName: QueueName,
  jobName: string,
  data: JobData,
  options: JobOptions = {}
): Promise<string> {
  const config = getConfig();
  const mergedOptions = { ...config.defaultJobOptions, ...options };

  // Try BullMQ first
  if (bullmqQueues?.has(queueName)) {
    const queue = bullmqQueues.get(queueName)!;
    const job = await queue.add(jobName, data, mergedOptions);

    logger.debug('Job added to queue', {
      queueName,
      jobName,
      jobId: job.id,
    });

    return job.id;
  }

  // Fallback to in-memory
  const jobId = generateJobId();
  const job: InMemoryJob = {
    id: jobId,
    queue: queueName,
    name: jobName,
    data,
    options: mergedOptions,
    status: options.delay ? 'delayed' : 'waiting',
    progress: 0,
    attemptsMade: 0,
    createdAt: new Date(),
  };

  inMemoryJobs.set(jobId, job);

  if (!inMemoryQueues.has(queueName)) {
    inMemoryQueues.set(queueName, []);
  }
  inMemoryQueues.get(queueName)!.push(job);

  logger.debug('Job added to in-memory queue', {
    queueName,
    jobName,
    jobId,
  });

  // Process in-memory jobs asynchronously
  processInMemoryJob(queueName);

  return jobId;
}

/**
 * Add multiple jobs in bulk
 */
export async function addBulkJobs(
  queueName: QueueName,
  jobs: Array<{ name: string; data: JobData; options?: JobOptions }>
): Promise<string[]> {
  const jobIds: string[] = [];

  for (const job of jobs) {
    const id = await addJob(queueName, job.name, job.data, job.options);
    jobIds.push(id);
  }

  return jobIds;
}

/**
 * Get job by ID
 */
export async function getJob(
  queueName: QueueName,
  jobId: string
): Promise<QueueJob | null> {
  if (bullmqQueues?.has(queueName)) {
    const queue = bullmqQueues.get(queueName)!;
    const job = await queue.getJob(jobId);

    if (!job) return null;

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      progress: job.progress || 0,
      status: await job.getState(),
      attemptsMade: job.attemptsMade || 0,
      failedReason: job.failedReason,
      createdAt: new Date(job.timestamp),
      processedOn: job.processedOn ? new Date(job.processedOn) : undefined,
      finishedOn: job.finishedOn ? new Date(job.finishedOn) : undefined,
    };
  }

  // In-memory fallback
  const job = inMemoryJobs.get(jobId);
  if (!job || job.queue !== queueName) return null;

  return {
    id: job.id,
    name: job.name,
    data: job.data,
    progress: job.progress,
    status: job.status,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason,
    createdAt: job.createdAt,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
  };
}

/**
 * Get queue statistics
 */
export async function getQueueStats(queueName: QueueName): Promise<QueueStats> {
  if (bullmqQueues?.has(queueName)) {
    const queue = bullmqQueues.get(queueName)!;
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      name: queueName,
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: await queue.isPaused(),
    };
  }

  // In-memory fallback
  const jobs = inMemoryQueues.get(queueName) || [];

  return {
    name: queueName,
    waiting: jobs.filter(j => j.status === 'waiting').length,
    active: jobs.filter(j => j.status === 'active').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
    delayed: jobs.filter(j => j.status === 'delayed').length,
    paused: false,
  };
}

/**
 * Get all queue statistics
 */
export async function getAllQueueStats(): Promise<QueueStats[]> {
  const stats: QueueStats[] = [];

  for (const queueName of Object.keys(QUEUE_CONFIGS) as QueueName[]) {
    stats.push(await getQueueStats(queueName));
  }

  return stats;
}

/**
 * Pause a queue
 */
export async function pauseQueue(queueName: QueueName): Promise<boolean> {
  if (bullmqQueues?.has(queueName)) {
    const queue = bullmqQueues.get(queueName)!;
    await queue.pause();
    logger.info('Queue paused', { queueName });
    return true;
  }
  return false;
}

/**
 * Resume a queue
 */
export async function resumeQueue(queueName: QueueName): Promise<boolean> {
  if (bullmqQueues?.has(queueName)) {
    const queue = bullmqQueues.get(queueName)!;
    await queue.resume();
    logger.info('Queue resumed', { queueName });
    return true;
  }
  return false;
}

/**
 * Remove a job
 */
export async function removeJob(
  queueName: QueueName,
  jobId: string
): Promise<boolean> {
  if (bullmqQueues?.has(queueName)) {
    const queue = bullmqQueues.get(queueName)!;
    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
      return true;
    }
    return false;
  }

  // In-memory fallback
  if (inMemoryJobs.has(jobId)) {
    inMemoryJobs.delete(jobId);
    const jobs = inMemoryQueues.get(queueName);
    if (jobs) {
      const index = jobs.findIndex(j => j.id === jobId);
      if (index !== -1) {
        jobs.splice(index, 1);
      }
    }
    return true;
  }
  return false;
}

/**
 * Retry a failed job
 */
export async function retryJob(
  queueName: QueueName,
  jobId: string
): Promise<boolean> {
  if (bullmqQueues?.has(queueName)) {
    const queue = bullmqQueues.get(queueName)!;
    const job = await queue.getJob(jobId);
    if (job) {
      await job.retry();
      return true;
    }
    return false;
  }

  // In-memory fallback
  const job = inMemoryJobs.get(jobId);
  if (job && job.status === 'failed') {
    job.status = 'waiting';
    job.attemptsMade = 0;
    job.failedReason = undefined;
    processInMemoryJob(queueName);
    return true;
  }
  return false;
}

/**
 * Clean old jobs from a queue
 */
export async function cleanQueue(
  queueName: QueueName,
  grace: number = 3600000, // 1 hour
  status: 'completed' | 'failed' = 'completed'
): Promise<number> {
  if (bullmqQueues?.has(queueName)) {
    const queue = bullmqQueues.get(queueName)!;
    const jobs = await queue.clean(grace, 1000, status);
    logger.info('Queue cleaned', { queueName, status, removed: jobs.length });
    return jobs.length;
  }
  return 0;
}

// =============================================================================
// JOB PROCESSORS
// =============================================================================

// JobProcessor type uses generic to allow specific job data types
// The processor receives job data that extends JobData
export type JobProcessor<T extends JobData = JobData> = (
  job: { id: string; name: string; data: T },
  updateProgress: (progress: number) => Promise<void>
) => Promise<void>;

// Internal storage uses the base JobProcessor type
const processors: Map<string, JobProcessor<JobData>> = new Map();

/**
 * Register a job processor
 * Accepts processors with specific job data types
 */
export function registerProcessor<T extends JobData>(
  queueName: QueueName,
  jobName: string,
  processor: JobProcessor<T>
): void {
  const key = `${queueName}:${jobName}`;
  // Type assertion is safe because T extends JobData
  processors.set(key, processor as JobProcessor<JobData>);
  logger.info('Job processor registered', { queueName, jobName });
}

/**
 * Process in-memory jobs (fallback)
 */
async function processInMemoryJob(queueName: QueueName): Promise<void> {
  const jobs = inMemoryQueues.get(queueName) || [];
  const waitingJob = jobs.find(j => j.status === 'waiting');

  if (!waitingJob) return;

  const key = `${queueName}:${waitingJob.name}`;
  const processor = processors.get(key);

  if (!processor) {
    logger.warn('No processor registered for job', {
      queueName,
      jobName: waitingJob.name,
    });
    return;
  }

  waitingJob.status = 'active';
  waitingJob.processedOn = new Date();

  try {
    await processor(
      { id: waitingJob.id, name: waitingJob.name, data: waitingJob.data },
      async (progress) => {
        waitingJob.progress = progress;
      }
    );

    waitingJob.status = 'completed';
    waitingJob.finishedOn = new Date();
    waitingJob.progress = 100;

    logger.debug('In-memory job completed', {
      queueName,
      jobId: waitingJob.id,
    });
  } catch (error) {
    waitingJob.attemptsMade++;
    const maxAttempts = waitingJob.options.attempts || 3;

    if (waitingJob.attemptsMade >= maxAttempts) {
      waitingJob.status = 'failed';
      waitingJob.failedReason = error instanceof Error ? error.message : 'Unknown error';
      waitingJob.finishedOn = new Date();

      logger.error('In-memory job failed', error, {
        queueName,
        jobId: waitingJob.id,
        attempts: waitingJob.attemptsMade,
      });
    } else {
      waitingJob.status = 'waiting';
      logger.warn('In-memory job will retry', {
        queueName,
        jobId: waitingJob.id,
        attempt: waitingJob.attemptsMade,
      });

      // Retry after backoff
      const backoffDelay = waitingJob.options.backoff?.delay || 1000;
      setTimeout(() => processInMemoryJob(queueName), backoffDelay * waitingJob.attemptsMade);
    }
  }

  // Process next job
  setImmediate(() => processInMemoryJob(queueName));
}

// =============================================================================
// WORKER INITIALIZATION
// =============================================================================

/**
 * Start workers for all queues
 */
export async function startWorkers(): Promise<void> {
  const config = getConfig();

  if (!config.enabled || !bullmqQueues) {
    logger.info('Workers using in-memory processing');
    return;
  }

  try {
    const dynamicRequire = (moduleName: string): any => {
      return eval('require')(moduleName);
    };

    const { Worker } = dynamicRequire('bullmq');
    const IORedis = dynamicRequire('ioredis');

    const connection = config.redisUrl
      ? new IORedis(config.redisUrl, { maxRetriesPerRequest: null })
      : new IORedis({
          host: config.redisHost,
          port: config.redisPort,
          password: config.redisPassword || undefined,
          maxRetriesPerRequest: null,
        });

    bullmqWorkers = new Map();

    for (const [queueName, queueConfig] of Object.entries(QUEUE_CONFIGS)) {
      const worker = new Worker(
        queueName,
        async (job: any) => {
          const key = `${queueName}:${job.name}`;
          const processor = processors.get(key);

          if (!processor) {
            throw new Error(`No processor registered for ${key}`);
          }

          await processor(
            { id: job.id, name: job.name, data: job.data },
            async (progress) => {
              await job.updateProgress(progress);
            }
          );
        },
        {
          connection,
          concurrency: queueConfig.concurrency,
          limiter: queueConfig.rateLimit,
        }
      );

      worker.on('completed', (job: any) => {
        logger.debug('Job completed', {
          queueName,
          jobId: job.id,
          jobName: job.name,
        });
      });

      worker.on('failed', (job: any, err: Error) => {
        logger.error('Job failed', err, {
          queueName,
          jobId: job?.id,
          jobName: job?.name,
        });
      });

      bullmqWorkers.set(queueName as QueueName, worker);
      logger.info(`Worker started: ${queueName}`, { concurrency: queueConfig.concurrency });
    }

    logger.info('All workers started');
  } catch (error) {
    logger.error('Failed to start workers', error);
  }
}

/**
 * Stop all workers gracefully
 * Workers will finish processing current jobs before stopping
 */
export async function stopWorkers(): Promise<void> {
  if (!bullmqWorkers) return;

  isDraining = true;
  logger.info('Workers entering draining mode - waiting for active jobs to complete');

  const closePromises: Promise<void>[] = [];

  for (const [queueName, worker] of bullmqWorkers) {
    closePromises.push(
      worker.close().then(() => {
        logger.info(`Worker stopped: ${queueName}`);
      }).catch((error: Error) => {
        logger.error(`Error stopping worker: ${queueName}`, error);
      })
    );
  }

  await Promise.all(closePromises);
  bullmqWorkers = null;
  isDraining = false;
  logger.info('All workers stopped');
}

/**
 * Close all queues
 */
export async function closeQueues(): Promise<void> {
  if (!bullmqQueues) return;

  const closePromises: Promise<void>[] = [];

  for (const [queueName, queue] of bullmqQueues) {
    closePromises.push(
      queue.close().then(() => {
        logger.info(`Queue closed: ${queueName}`);
      }).catch((error: Error) => {
        logger.error(`Error closing queue: ${queueName}`, error);
      })
    );
  }

  await Promise.all(closePromises);
  bullmqQueues = null;
  logger.info('All queues closed');
}

/**
 * Graceful shutdown handler
 * 1. Stops accepting new jobs
 * 2. Waits for active jobs to complete (draining)
 * 3. Closes all workers
 * 4. Closes all queues
 * 5. Exits process
 */
export async function gracefulShutdown(signal: string): Promise<void> {
  // Prevent multiple shutdown attempts
  if (isShuttingDown) {
    logger.info(`Shutdown already in progress, ignoring ${signal}`);
    return shutdownPromise ?? Promise.resolve();
  }

  isShuttingDown = true;
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  shutdownPromise = (async () => {
    try {
      // Step 1: Stop workers (will wait for active jobs to finish)
      await stopWorkers();

      // Step 2: Close all queues
      await closeQueues();

      logger.info('Graceful shutdown completed successfully');
    } catch (error) {
      logger.error('Error during graceful shutdown', error);
    }
  })();

  return shutdownPromise;
}

// Register signal handlers for graceful shutdown
// Only register once to avoid duplicate handlers
let signalHandlersRegistered = false;

export function registerShutdownHandlers(): void {
  if (signalHandlersRegistered) return;
  signalHandlersRegistered = true;

  process.on('SIGTERM', async () => {
    await gracefulShutdown('SIGTERM');
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await gracefulShutdown('SIGINT');
    process.exit(0);
  });

  logger.info('Graceful shutdown handlers registered (SIGTERM, SIGINT)');
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize the queue system
 */
export async function initializeQueues(): Promise<void> {
  await initializeBullMQ();
  registerShutdownHandlers();
  logger.info('Queue system initialized');
}

/**
 * Queue health status details
 */
export interface QueueHealthStatus {
  ready: boolean;
  provider: 'bullmq' | 'in-memory';
  redisConnected: boolean;
  redisPingMs: number | null;
  queuesInitialized: boolean;
  allQueuesOperational: boolean;
  pausedQueues: string[];
  error?: string;
}

/**
 * Check if queue system is ready (comprehensive check)
 *
 * For BullMQ:
 * - Redis must respond to PING
 * - Queues must be initialized
 * - At least one queue must not be paused
 *
 * For in-memory:
 * - Always ready when BullMQ is disabled
 *
 * @returns true if ready to accept jobs, false otherwise
 */
export async function isQueueReady(): Promise<boolean> {
  const status = await getQueueHealthStatus();
  return status.ready;
}

/**
 * Synchronous queue ready check (for backward compatibility)
 * WARNING: Does not verify Redis connection - use isQueueReady() for full check
 */
export function isQueueReadySync(): boolean {
  const config = getConfig();

  // If queue system is disabled, in-memory fallback is ready
  if (!config.enabled) {
    return true;
  }

  // BullMQ: check if queues are initialized (does not verify Redis connection)
  return bullmqQueues !== null && bullmqQueues.size > 0;
}

/**
 * Get detailed queue health status
 * Performs Redis ping and checks all queue states
 */
export async function getQueueHealthStatus(): Promise<QueueHealthStatus> {
  const config = getConfig();

  // If queue system is disabled, in-memory fallback is always ready
  if (!config.enabled) {
    return {
      ready: true,
      provider: 'in-memory',
      redisConnected: false,
      redisPingMs: null,
      queuesInitialized: true,
      allQueuesOperational: true,
      pausedQueues: [],
    };
  }

  // Check if BullMQ queues are initialized
  if (!bullmqQueues || bullmqQueues.size === 0) {
    return {
      ready: false,
      provider: 'bullmq',
      redisConnected: false,
      redisPingMs: null,
      queuesInitialized: false,
      allQueuesOperational: false,
      pausedQueues: [],
      error: 'BullMQ queues not initialized',
    };
  }

  // Check Redis connection with PING
  let redisConnected = false;
  let redisPingMs: number | null = null;

  if (redisConnection) {
    try {
      const pingStart = Date.now();
      const pingResult = await Promise.race([
        redisConnection.ping(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Redis ping timeout')), 5000)
        ),
      ]);
      redisPingMs = Date.now() - pingStart;
      redisConnected = pingResult === 'PONG';
    } catch (error) {
      redisConnected = false;
      redisPingMs = null;
      logger.warn('Redis ping failed during health check', { error });
    }
  }

  // If Redis is down, queue is not ready
  if (!redisConnected) {
    return {
      ready: false,
      provider: 'bullmq',
      redisConnected: false,
      redisPingMs: null,
      queuesInitialized: true,
      allQueuesOperational: false,
      pausedQueues: [],
      error: 'Redis connection failed',
    };
  }

  // Check queue states (paused, can accept jobs)
  const pausedQueues: string[] = [];
  let hasOperationalQueue = false;

  try {
    for (const [queueName, queue] of bullmqQueues) {
      const isPaused = await queue.isPaused();
      if (isPaused) {
        pausedQueues.push(queueName);
      } else {
        hasOperationalQueue = true;
      }
    }
  } catch (error) {
    logger.warn('Failed to check queue states', { error });
    return {
      ready: false,
      provider: 'bullmq',
      redisConnected,
      redisPingMs,
      queuesInitialized: true,
      allQueuesOperational: false,
      pausedQueues: [],
      error: 'Failed to check queue states',
    };
  }

  // Ready if Redis is connected and at least one queue is operational
  const allQueuesOperational = pausedQueues.length === 0;
  const ready = redisConnected && hasOperationalQueue;

  return {
    ready,
    provider: 'bullmq',
    redisConnected,
    redisPingMs,
    queuesInitialized: true,
    allQueuesOperational,
    pausedQueues,
    ...(pausedQueues.length === bullmqQueues.size && {
      error: 'All queues are paused',
    }),
  };
}

/**
 * Get queue system info
 */
export function getQueueInfo(): {
  enabled: boolean;
  provider: 'bullmq' | 'in-memory';
  queues: QueueName[];
} {
  return {
    enabled: getConfig().enabled,
    provider: bullmqQueues ? 'bullmq' : 'in-memory',
    queues: Object.keys(QUEUE_CONFIGS) as QueueName[],
  };
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default {
  addJob,
  addBulkJobs,
  getJob,
  getQueueStats,
  getAllQueueStats,
  pauseQueue,
  resumeQueue,
  removeJob,
  retryJob,
  cleanQueue,
  registerProcessor,
  startWorkers,
  stopWorkers,
  closeQueues,
  gracefulShutdown,
  registerShutdownHandlers,
  getWorkerStatus,
  initializeQueues,
  isQueueReady,
  isQueueReadySync,
  getQueueHealthStatus,
  getQueueInfo,
};
