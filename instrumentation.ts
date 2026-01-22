/**
 * Next.js Instrumentation
 *
 * This file runs once when the Next.js server starts.
 * Used for:
 * - Configuration validation
 * - Loading secrets from AWS Secrets Manager
 * - Initializing monitoring services
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

    console.log('\n[Startup] Server initialization complete');
    console.log('========================================\n');
  }
}
