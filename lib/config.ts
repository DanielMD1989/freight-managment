/**
 * Centralized Configuration Management
 *
 * PHASE 4: Low Priority - Long-term Maintainability
 *
 * Features:
 * - Typed configuration access
 * - Environment-based defaults
 * - Required value validation
 * - AWS Secrets Manager support
 * - Configuration versioning
 * - Startup validation
 *
 * Usage:
 * ```typescript
 * import { config, validateConfig } from '@/lib/config';
 *
 * // Access configuration
 * const dbUrl = config.database.url;
 * const jwtSecret = config.auth.jwtSecret;
 *
 * // Validate on startup (in instrumentation.ts or layout.tsx)
 * validateConfig();
 * ```
 */

// =============================================================================
// CONFIGURATION VERSION
// =============================================================================

export const CONFIG_VERSION = '1.0.0';

// =============================================================================
// TYPES
// =============================================================================

export interface DatabaseConfig {
  url: string;
  poolMin: number;
  poolMax: number;
  healthCheckIntervalMs: number;
  pgBouncerEnabled: boolean;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtEncryptionKey: string;
  jwtExpiresIn: string;
  jwtEnableEncryption: boolean;
  nextAuthUrl: string;
  nextAuthSecret: string;
}

export interface RedisConfig {
  enabled: boolean;
  url: string | null;
  host: string;
  port: number;
  password: string | null;
  db: number;
}

export interface StorageConfig {
  provider: 'local' | 's3' | 'cloudinary';
  uploadDir: string;
  awsRegion: string;
  awsAccessKeyId: string | null;
  awsSecretAccessKey: string | null;
  awsS3Bucket: string | null;
  cdnEnabled: boolean;
  cdnDomain: string | null;
  cloudinaryCloudName: string | null;
  cloudinaryApiKey: string | null;
  cloudinaryApiSecret: string | null;
}

export interface EmailConfig {
  provider: 'console' | 'smtp' | 'sendgrid' | 'ses' | 'resend';
  from: string;
  fromName: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string | null;
  smtpPassword: string | null;
  sendgridApiKey: string | null;
  resendApiKey: string | null;
}

export interface SmsConfig {
  afromessageApiKey: string | null;
  afromessageSenderName: string;
}

export interface MonitoringConfig {
  enabled: boolean;
  apiKey: string | null;
  cpuThreshold: number;
  memoryThreshold: number;
  slowQueryThresholdMs: number;
  errorRateThreshold: number;
  eventLoopThresholdMs: number;
  checkIntervalMs: number;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'pretty';
  sampleRate: number;
  requestLogging: boolean;
}

export interface RateLimitConfig {
  enabled: boolean;
  bypassKey: string | null;
}

export interface FeatureFlagsConfig {
  selfDispatch: boolean;
  notifications: boolean;
  emailVerification: boolean;
}

export interface GpsConfig {
  serverPort: number;
  serverHost: string;
}

export interface PaymentConfig {
  chapaSecretKey: string | null;
  chapaPublicKey: string | null;
  chapaWebhookSecret: string | null;
}

export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  publicUrl: string;
  adminEmail: string;
  googleMapsApiKey: string | null;
  googleRoutesApiKey: string | null;
}

export interface Config {
  version: string;
  app: AppConfig;
  database: DatabaseConfig;
  auth: AuthConfig;
  redis: RedisConfig;
  storage: StorageConfig;
  email: EmailConfig;
  sms: SmsConfig;
  monitoring: MonitoringConfig;
  logging: LoggingConfig;
  rateLimit: RateLimitConfig;
  featureFlags: FeatureFlagsConfig;
  gps: GpsConfig;
  payment: PaymentConfig;
}

export interface ConfigValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

// =============================================================================
// ENVIRONMENT HELPERS
// =============================================================================

function getEnv(key: string, defaultValue?: string): string {
  return process.env[key] || defaultValue || '';
}

function getEnvInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvFloat(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

function getEnvOrNull(key: string): string | null {
  const value = process.env[key];
  return value && value.trim() !== '' ? value : null;
}

// =============================================================================
// CONFIGURATION BUILDER
// =============================================================================

function buildConfig(): Config {
  const nodeEnv = (getEnv('NODE_ENV', 'development') as 'development' | 'production' | 'test');
  const isProduction = nodeEnv === 'production';
  const isPgBouncer = getEnvBool('PGBOUNCER_ENABLED', false);

  // Database pool sizes based on environment
  let dbPoolMin = 5;
  let dbPoolMax = 20;
  if (isPgBouncer) {
    dbPoolMin = getEnvInt('DB_POOL_MIN', 2);
    dbPoolMax = getEnvInt('DB_POOL_MAX', 10);
  } else if (isProduction) {
    dbPoolMin = getEnvInt('DB_POOL_MIN', 10);
    dbPoolMax = getEnvInt('DB_POOL_MAX', 100);
  } else {
    dbPoolMin = getEnvInt('DB_POOL_MIN', 5);
    dbPoolMax = getEnvInt('DB_POOL_MAX', 20);
  }

  return {
    version: CONFIG_VERSION,

    app: {
      nodeEnv,
      port: getEnvInt('PORT', 3000),
      publicUrl: getEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
      adminEmail: getEnv('ADMIN_EMAIL', 'admin@freightplatform.com'),
      googleMapsApiKey: getEnvOrNull('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'),
      googleRoutesApiKey: getEnvOrNull('GOOGLE_ROUTES_API_KEY'),
    },

    database: {
      url: getEnv('DATABASE_URL', ''),
      poolMin: dbPoolMin,
      poolMax: dbPoolMax,
      healthCheckIntervalMs: getEnvInt('DB_HEALTH_CHECK_INTERVAL_MS', 30000),
      pgBouncerEnabled: isPgBouncer,
    },

    auth: {
      jwtSecret: getEnv('JWT_SECRET', 'development-jwt-secret-min-32-chars!'),
      jwtEncryptionKey: getEnv('JWT_ENCRYPTION_KEY', 'dev-encrypt-key-32bytes-padding!'),
      jwtExpiresIn: getEnv('JWT_EXPIRES_IN', '7d'),
      jwtEnableEncryption: getEnvBool('JWT_ENABLE_ENCRYPTION', true),
      nextAuthUrl: getEnv('NEXTAUTH_URL', 'http://localhost:3000'),
      nextAuthSecret: getEnv('NEXTAUTH_SECRET', ''),
    },

    redis: {
      enabled: getEnvBool('REDIS_ENABLED', false) || !!getEnvOrNull('REDIS_URL'),
      url: getEnvOrNull('REDIS_URL'),
      host: getEnv('REDIS_HOST', 'localhost'),
      port: getEnvInt('REDIS_PORT', 6379),
      password: getEnvOrNull('REDIS_PASSWORD'),
      db: getEnvInt('REDIS_DB', 0),
    },

    storage: {
      provider: (getEnv('STORAGE_PROVIDER', 'local') as 'local' | 's3' | 'cloudinary'),
      uploadDir: getEnv('UPLOAD_DIR', 'uploads'),
      awsRegion: getEnv('AWS_REGION', 'us-east-1'),
      awsAccessKeyId: getEnvOrNull('AWS_ACCESS_KEY_ID'),
      awsSecretAccessKey: getEnvOrNull('AWS_SECRET_ACCESS_KEY'),
      awsS3Bucket: getEnvOrNull('AWS_S3_BUCKET'),
      cdnEnabled: getEnvBool('CDN_ENABLED', false),
      cdnDomain: getEnvOrNull('CDN_DOMAIN'),
      cloudinaryCloudName: getEnvOrNull('CLOUDINARY_CLOUD_NAME'),
      cloudinaryApiKey: getEnvOrNull('CLOUDINARY_API_KEY'),
      cloudinaryApiSecret: getEnvOrNull('CLOUDINARY_API_SECRET'),
    },

    email: {
      provider: (getEnv('EMAIL_PROVIDER', 'console') as EmailConfig['provider']),
      from: getEnv('EMAIL_FROM', 'noreply@freightplatform.com'),
      fromName: getEnv('EMAIL_FROM_NAME', 'Freight Management Platform'),
      smtpHost: getEnv('SMTP_HOST', 'smtp.gmail.com'),
      smtpPort: getEnvInt('SMTP_PORT', 587),
      smtpUser: getEnvOrNull('SMTP_USER'),
      smtpPassword: getEnvOrNull('SMTP_PASSWORD'),
      sendgridApiKey: getEnvOrNull('SENDGRID_API_KEY'),
      resendApiKey: getEnvOrNull('RESEND_API_KEY'),
    },

    sms: {
      afromessageApiKey: getEnvOrNull('AFROMESSAGE_API_KEY'),
      afromessageSenderName: getEnv('AFROMESSAGE_SENDER_NAME', 'FreightMgt'),
    },

    monitoring: {
      enabled: getEnvBool('MONITORING_ENABLED', true),
      apiKey: getEnvOrNull('MONITORING_API_KEY'),
      cpuThreshold: getEnvInt('ALERT_CPU_THRESHOLD', 80),
      memoryThreshold: getEnvInt('ALERT_MEMORY_THRESHOLD', 85),
      slowQueryThresholdMs: getEnvInt('ALERT_SLOW_QUERY_THRESHOLD_MS', 1000),
      errorRateThreshold: getEnvInt('ALERT_ERROR_RATE_THRESHOLD', 5),
      eventLoopThresholdMs: getEnvInt('ALERT_EVENT_LOOP_THRESHOLD_MS', 100),
      checkIntervalMs: getEnvInt('MONITORING_CHECK_INTERVAL_MS', 60000),
    },

    logging: {
      level: (getEnv('LOG_LEVEL', isProduction ? 'info' : 'debug') as LoggingConfig['level']),
      format: (getEnv('LOG_FORMAT', isProduction ? 'json' : 'pretty') as LoggingConfig['format']),
      sampleRate: getEnvFloat('LOG_SAMPLE_RATE', 1),
      requestLogging: getEnvBool('LOG_REQUESTS', true),
    },

    rateLimit: {
      enabled: getEnvBool('RATE_LIMIT_ENABLED', true),
      bypassKey: getEnvOrNull('RATE_LIMIT_BYPASS_KEY'),
    },

    featureFlags: {
      selfDispatch: getEnvBool('ENABLE_SELF_DISPATCH', true),
      notifications: getEnvBool('ENABLE_NOTIFICATIONS', false),
      emailVerification: getEnvBool('ENABLE_EMAIL_VERIFICATION', false),
    },

    gps: {
      serverPort: getEnvInt('GPS_SERVER_PORT', 5001),
      serverHost: getEnv('GPS_SERVER_HOST', '0.0.0.0'),
    },

    payment: {
      chapaSecretKey: getEnvOrNull('CHAPA_SECRET_KEY'),
      chapaPublicKey: getEnvOrNull('CHAPA_PUBLIC_KEY'),
      chapaWebhookSecret: getEnvOrNull('CHAPA_WEBHOOK_SECRET'),
    },
  };
}

// =============================================================================
// AWS SECRETS MANAGER INTEGRATION
// =============================================================================

interface SecretsManagerConfig {
  enabled: boolean;
  region: string;
  secretId: string;
  cacheTimeMs: number;
}

let secretsCache: Record<string, string> | null = null;
let secretsCacheTime = 0;

/**
 * Get secrets manager configuration
 */
function getSecretsManagerConfig(): SecretsManagerConfig {
  return {
    enabled: getEnvBool('SECRETS_MANAGER_ENABLED', false),
    region: getEnv('AWS_REGION', 'us-east-1'),
    secretId: getEnv('SECRETS_MANAGER_SECRET_ID', 'freight-platform/production'),
    cacheTimeMs: getEnvInt('SECRETS_MANAGER_CACHE_MS', 300000), // 5 minutes
  };
}

/**
 * Load secrets from AWS Secrets Manager
 */
export async function loadSecrets(): Promise<Record<string, string>> {
  const smConfig = getSecretsManagerConfig();

  if (!smConfig.enabled) {
    return {};
  }

  // Check cache
  if (secretsCache && Date.now() - secretsCacheTime < smConfig.cacheTimeMs) {
    return secretsCache;
  }

  try {
    // Dynamic import to avoid bundling issues
    const dynamicRequire = (moduleName: string): any => {
      return eval('require')(moduleName);
    };

    const {
      SecretsManagerClient,
      GetSecretValueCommand,
    } = dynamicRequire('@aws-sdk/client-secrets-manager');

    const client = new SecretsManagerClient({ region: smConfig.region });

    const command = new GetSecretValueCommand({
      SecretId: smConfig.secretId,
    });

    const response = await client.send(command);

    if (response.SecretString) {
      secretsCache = JSON.parse(response.SecretString);
      secretsCacheTime = Date.now();
      return secretsCache!;
    }

    return {};
  } catch (error) {
    console.error('[Config] Failed to load secrets from AWS Secrets Manager:', error);
    return {};
  }
}

/**
 * Apply secrets to environment variables
 */
export async function applySecrets(): Promise<void> {
  const secrets = await loadSecrets();

  for (const [key, value] of Object.entries(secrets)) {
    // Only set if not already defined (env vars take precedence)
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

// =============================================================================
// CONFIGURATION VALIDATION
// =============================================================================

/**
 * Validate configuration and return errors/warnings
 */
export function validateConfig(cfg?: Config): ConfigValidationError[] {
  const errors: ConfigValidationError[] = [];
  const c = cfg || config;

  // Database URL is required
  if (!c.database.url) {
    errors.push({
      field: 'DATABASE_URL',
      message: 'Database URL is required',
      severity: 'error',
    });
  }

  // Production-specific validations
  if (c.app.nodeEnv === 'production') {
    // JWT secrets must be changed from defaults
    if (c.auth.jwtSecret === 'development-jwt-secret-min-32-chars!' ||
        c.auth.jwtSecret.includes('development')) {
      errors.push({
        field: 'JWT_SECRET',
        message: 'JWT_SECRET must be changed from default in production',
        severity: 'error',
      });
    }

    if (c.auth.jwtEncryptionKey === 'dev-encrypt-key-32bytes-padding!' ||
        c.auth.jwtEncryptionKey.includes('dev')) {
      errors.push({
        field: 'JWT_ENCRYPTION_KEY',
        message: 'JWT_ENCRYPTION_KEY must be changed from default in production',
        severity: 'error',
      });
    }

    // NextAuth secret should be set
    if (!c.auth.nextAuthSecret) {
      errors.push({
        field: 'NEXTAUTH_SECRET',
        message: 'NEXTAUTH_SECRET is recommended in production',
        severity: 'warning',
      });
    }

    // Redis should be enabled for distributed systems
    if (!c.redis.enabled) {
      errors.push({
        field: 'REDIS_ENABLED',
        message: 'Redis is recommended in production for rate limiting and caching',
        severity: 'warning',
      });
    }

    // Storage should use S3/Cloudinary
    if (c.storage.provider === 'local') {
      errors.push({
        field: 'STORAGE_PROVIDER',
        message: 'Local storage is not recommended in production. Use S3 or Cloudinary.',
        severity: 'warning',
      });
    }

    // S3 credentials validation
    if (c.storage.provider === 's3') {
      if (!c.storage.awsAccessKeyId || !c.storage.awsSecretAccessKey) {
        errors.push({
          field: 'AWS_ACCESS_KEY_ID',
          message: 'AWS credentials required for S3 storage',
          severity: 'error',
        });
      }
      if (!c.storage.awsS3Bucket) {
        errors.push({
          field: 'AWS_S3_BUCKET',
          message: 'S3 bucket name required',
          severity: 'error',
        });
      }
    }

    // Cloudinary credentials validation
    if (c.storage.provider === 'cloudinary') {
      if (!c.storage.cloudinaryCloudName || !c.storage.cloudinaryApiKey) {
        errors.push({
          field: 'CLOUDINARY_CLOUD_NAME',
          message: 'Cloudinary credentials required for Cloudinary storage',
          severity: 'error',
        });
      }
    }
  }

  // Email provider validation
  if (c.email.provider === 'smtp') {
    if (!c.email.smtpUser || !c.email.smtpPassword) {
      errors.push({
        field: 'SMTP_USER',
        message: 'SMTP credentials required when using SMTP email provider',
        severity: 'warning',
      });
    }
  }

  if (c.email.provider === 'sendgrid' && !c.email.sendgridApiKey) {
    errors.push({
      field: 'SENDGRID_API_KEY',
      message: 'SendGrid API key required when using SendGrid email provider',
      severity: 'error',
    });
  }

  if (c.email.provider === 'resend' && !c.email.resendApiKey) {
    errors.push({
      field: 'RESEND_API_KEY',
      message: 'Resend API key required when using Resend email provider',
      severity: 'error',
    });
  }

  return errors;
}

/**
 * Validate configuration and throw on errors
 */
export function validateConfigOrThrow(): void {
  const errors = validateConfig();
  const criticalErrors = errors.filter(e => e.severity === 'error');
  const warnings = errors.filter(e => e.severity === 'warning');

  // Log warnings
  for (const warning of warnings) {
    console.warn(`[Config Warning] ${warning.field}: ${warning.message}`);
  }

  // Throw on critical errors
  if (criticalErrors.length > 0) {
    const errorMessages = criticalErrors.map(e => `${e.field}: ${e.message}`).join('\n');
    throw new Error(`Configuration validation failed:\n${errorMessages}`);
  }
}

/**
 * Log current configuration (without secrets)
 */
export function logConfig(): void {
  const c = config;
  }

// =============================================================================
// CONFIGURATION EXPORT UTILITIES
// =============================================================================

/**
 * Export configuration as environment variables format
 */
export function exportAsEnvFormat(): string {
  const c = config;
  const lines: string[] = [
    `# Freight Platform Configuration`,
    `# Generated: ${new Date().toISOString()}`,
    `# Version: ${c.version}`,
    ``,
    `# App Configuration`,
    `NODE_ENV="${c.app.nodeEnv}"`,
    `PORT="${c.app.port}"`,
    `NEXT_PUBLIC_APP_URL="${c.app.publicUrl}"`,
    `ADMIN_EMAIL="${c.app.adminEmail}"`,
    ``,
    `# Database`,
    `DATABASE_URL="***REDACTED***"`,
    `DB_POOL_MIN="${c.database.poolMin}"`,
    `DB_POOL_MAX="${c.database.poolMax}"`,
    `PGBOUNCER_ENABLED="${c.database.pgBouncerEnabled}"`,
    ``,
    `# Redis`,
    `REDIS_ENABLED="${c.redis.enabled}"`,
    c.redis.url ? `REDIS_URL="***REDACTED***"` : `# REDIS_URL not set`,
    ``,
    `# Storage`,
    `STORAGE_PROVIDER="${c.storage.provider}"`,
    `CDN_ENABLED="${c.storage.cdnEnabled}"`,
    c.storage.cdnDomain ? `CDN_DOMAIN="${c.storage.cdnDomain}"` : `# CDN_DOMAIN not set`,
    ``,
    `# Monitoring`,
    `MONITORING_ENABLED="${c.monitoring.enabled}"`,
    `ALERT_CPU_THRESHOLD="${c.monitoring.cpuThreshold}"`,
    `ALERT_MEMORY_THRESHOLD="${c.monitoring.memoryThreshold}"`,
    ``,
    `# Logging`,
    `LOG_LEVEL="${c.logging.level}"`,
    `LOG_FORMAT="${c.logging.format}"`,
  ];

  return lines.join('\n');
}

/**
 * Get a summary of configuration for health checks
 */
export function getConfigSummary(): Record<string, unknown> {
  const c = config;
  return {
    version: c.version,
    environment: c.app.nodeEnv,
    database: {
      configured: !!c.database.url,
      poolSize: `${c.database.poolMin}-${c.database.poolMax}`,
      pgBouncer: c.database.pgBouncerEnabled,
    },
    redis: {
      enabled: c.redis.enabled,
    },
    storage: {
      provider: c.storage.provider,
      cdn: c.storage.cdnEnabled,
    },
    monitoring: {
      enabled: c.monitoring.enabled,
    },
    logging: {
      level: c.logging.level,
      format: c.logging.format,
    },
    featureFlags: c.featureFlags,
  };
}

// =============================================================================
// SINGLETON CONFIGURATION
// =============================================================================

// Build configuration on module load
export const config: Config = buildConfig();

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default config;
