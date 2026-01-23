/**
 * Worker Initialization
 *
 * Registers all queue processors and starts workers for background job processing.
 *
 * ASYNC QUEUE MIGRATION:
 * - Email queue: sendEmail, sendTemplateEmail
 * - SMS queue: sendSMS
 *
 * Call initializeWorkers() during application startup to enable background processing.
 */

import { initializeQueues, startWorkers, isQueueReadySync } from './queue';
import { registerEmailProcessor } from './email';
import { registerTemplateEmailProcessor } from './emailService';
import { registerSmsProcessor } from './sms/afromessage';
import { registerPushProcessor } from './pushWorker';
import { logger } from './logger';

let workersInitialized = false;

/**
 * Initialize all queue workers
 *
 * This function:
 * 1. Initializes the queue system (BullMQ + Redis)
 * 2. Registers all job processors
 * 3. Starts the workers
 *
 * Call this once during application startup.
 */
export async function initializeWorkers(): Promise<void> {
  if (workersInitialized) {
    logger.warn('[WORKERS] Already initialized, skipping');
    return;
  }

  try {
    // Step 1: Initialize queue system
    logger.info('[WORKERS] Initializing queue system...');
    await initializeQueues();

    // Step 2: Register all processors
    logger.info('[WORKERS] Registering processors...');
    registerEmailProcessor();
    registerTemplateEmailProcessor();
    registerSmsProcessor();
    registerPushProcessor();

    // Step 3: Start workers
    logger.info('[WORKERS] Starting workers...');
    await startWorkers();

    workersInitialized = true;
    logger.info('[WORKERS] All workers initialized and running');
  } catch (error) {
    logger.error('[WORKERS] Failed to initialize workers', error);
    throw error;
  }
}

/**
 * Check if workers are initialized
 */
export function areWorkersInitialized(): boolean {
  return workersInitialized;
}

/**
 * Get worker initialization status
 */
export function getWorkerInitStatus(): {
  initialized: boolean;
  queueReady: boolean;
} {
  return {
    initialized: workersInitialized,
    queueReady: isQueueReadySync(),
  };
}
