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

export interface JobData {
  [key: string]: unknown;
}

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

export type JobProcessor = (
  job: { id: string; name: string; data: JobData },
  updateProgress: (progress: number) => Promise<void>
) => Promise<void>;

const processors: Map<string, JobProcessor> = new Map();

/**
 * Register a job processor
 */
export function registerProcessor(
  queueName: QueueName,
  jobName: string,
  processor: JobProcessor
): void {
  const key = `${queueName}:${jobName}`;
  processors.set(key, processor);
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
 */
export async function stopWorkers(): Promise<void> {
  if (!bullmqWorkers) return;

  for (const [queueName, worker] of bullmqWorkers) {
    await worker.close();
    logger.info(`Worker stopped: ${queueName}`);
  }

  bullmqWorkers = null;
  logger.info('All workers stopped');
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize the queue system
 */
export async function initializeQueues(): Promise<void> {
  await initializeBullMQ();
  logger.info('Queue system initialized');
}

/**
 * Check if queue system is ready
 */
export function isQueueReady(): boolean {
  return bullmqQueues !== null || true; // In-memory fallback always ready
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
  initializeQueues,
  isQueueReady,
  getQueueInfo,
};
