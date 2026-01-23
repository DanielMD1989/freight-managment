/**
 * Next.js Instrumentation
 *
 * This file runs once when the Next.js server starts.
 * Used for:
 * - Configuration validation
 * - Loading secrets from AWS Secrets Manager
 * - Initializing monitoring services
 * - Initializing background job queues and workers
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { config, validateConfig, applySecrets, logConfig } = await import('@/lib/config');

    console.log('\n========================================');
    console.log('  Freight Platform - Starting Server');
    console.log('========================================\n');

    // Load secrets from AWS Secrets Manager (if enabled)
    try {
      await applySecrets();
    } catch (error) {
      console.warn('[Startup] Failed to load secrets from AWS:', error);
    }

    // Log current configuration
    logConfig();

    // Validate configuration
    const errors = validateConfig();
    const criticalErrors = errors.filter(e => e.severity === 'error');
    const warnings = errors.filter(e => e.severity === 'warning');

    // Log warnings
    if (warnings.length > 0) {
      console.log('\n[Config] Warnings:');
      for (const warning of warnings) {
        console.warn(`  - ${warning.field}: ${warning.message}`);
      }
    }

    // Log critical errors (but don't throw - let the app start)
    if (criticalErrors.length > 0) {
      console.log('\n[Config] Errors (may cause issues):');
      for (const error of criticalErrors) {
        console.error(`  - ${error.field}: ${error.message}`);
      }
    }

    // In production, throw on critical errors
    if (config.app.nodeEnv === 'production' && criticalErrors.length > 0) {
      const errorMessages = criticalErrors.map(e => `${e.field}: ${e.message}`).join('\n');
      throw new Error(`Configuration validation failed:\n${errorMessages}`);
    }

    // =========================================
    // Initialize Background Job Queues
    // =========================================
    console.log('\n[Startup] Initializing background job queues...');

    try {
      // Import queue modules
      const { initializeQueues, startWorkers, getQueueInfo } = await import('@/lib/queue');
      const { registerAllProcessors } = await import('@/lib/queue/processors');

      // Step 1: Initialize BullMQ queues (connects to Redis)
      await initializeQueues();

      // Step 2: Register all job processors
      // - Email: send, bulk
      // - SMS: send
      // - Notifications: create, bulk
      // - Distance Matrix: calculate
      // - PDF: generate
      // - Cleanup: expire-loads, expire-postings, gps-data
      // - Bulk: status-update
      // - Scheduled: auto-settle
      registerAllProcessors();

      // Step 3: Start workers for all queues
      await startWorkers();

      // Log queue system info
      const queueInfo = getQueueInfo();
      console.log(`[Startup] Queue system ready:`);
      console.log(`  - Provider: ${queueInfo.provider}`);
      console.log(`  - Enabled: ${queueInfo.enabled}`);
      console.log(`  - Queues: ${queueInfo.queues.join(', ')}`);
    } catch (queueError) {
      // Don't fail server startup if queues fail - they have in-memory fallback
      console.error('[Startup] Queue initialization error (using in-memory fallback):', queueError);
    }

    console.log('\n[Startup] Server initialization complete');
    console.log('========================================\n');
  }
}
