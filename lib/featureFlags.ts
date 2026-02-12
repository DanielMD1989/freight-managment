/**
 * Feature Flag Service
 *
 * PHASE 4: Low Priority - Safe Rollout of New Features
 *
 * Features:
 * - Multiple providers: local, database, LaunchDarkly, Unleash
 * - Percentage-based rollouts
 * - User/context targeting
 * - Flag evaluation caching
 * - Audit logging
 *
 * Usage:
 * ```typescript
 * import { isFeatureEnabled, getFeatureFlag } from '@/lib/featureFlags';
 *
 * // Simple boolean check
 * if (await isFeatureEnabled('new_dashboard')) {
 *   // Show new dashboard
 * }
 *
 * // With user context for percentage rollout
 * if (await isFeatureEnabled('beta_feature', { userId: 'user123' })) {
 *   // Show beta feature
 * }
 *
 * // Get flag with metadata
 * const flag = await getFeatureFlag('api_v2');
 * ```
 */

import { logger } from './logger';

// =============================================================================
// TYPES
// =============================================================================

export type FlagCategory = 'core' | 'beta' | 'experimental' | 'deprecated' | 'ops';

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  category: FlagCategory;
  rolloutPercentage: number;
  targetRules?: TargetRule[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface TargetRule {
  id: string;
  attribute: string; // e.g., 'userId', 'role', 'organizationId'
  operator: 'eq' | 'neq' | 'in' | 'nin' | 'contains' | 'startsWith';
  value: string | string[];
  enabled: boolean;
}

export interface EvaluationContext {
  userId?: string;
  organizationId?: string;
  role?: string;
  email?: string;
  attributes?: Record<string, string | number | boolean>;
}

export interface FlagEvaluation {
  key: string;
  enabled: boolean;
  reason: 'flag_disabled' | 'rule_match' | 'percentage_rollout' | 'default';
  ruleId?: string;
}

export type FlagProvider = 'local' | 'database' | 'launchdarkly' | 'unleash';

export interface FeatureFlagConfig {
  provider: FlagProvider;
  cacheTimeMs: number;
  launchDarkly?: {
    sdkKey: string;
  };
  unleash?: {
    url: string;
    apiKey: string;
    appName: string;
  };
}

// =============================================================================
// CONFIGURATION
// =============================================================================

function getConfig(): FeatureFlagConfig {
  return {
    provider: (process.env.FEATURE_FLAG_PROVIDER as FlagProvider) || 'local',
    cacheTimeMs: parseInt(process.env.FEATURE_FLAG_CACHE_MS || '60000'), // 1 minute
    launchDarkly: process.env.LAUNCHDARKLY_SDK_KEY ? {
      sdkKey: process.env.LAUNCHDARKLY_SDK_KEY,
    } : undefined,
    unleash: process.env.UNLEASH_URL ? {
      url: process.env.UNLEASH_URL,
      apiKey: process.env.UNLEASH_API_KEY || '',
      appName: process.env.UNLEASH_APP_NAME || 'freight-platform',
    } : undefined,
  };
}

// =============================================================================
// DEFAULT FLAGS
// =============================================================================

const DEFAULT_FLAGS: FeatureFlag[] = [
  // Core features (enabled by default)
  {
    key: 'gps_tracking',
    name: 'GPS Tracking',
    description: 'Enable real-time GPS tracking for trucks',
    enabled: true,
    category: 'core',
    rolloutPercentage: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    key: 'real_time_notifications',
    name: 'Real-time Notifications',
    description: 'WebSocket-based real-time notifications',
    enabled: true,
    category: 'core',
    rolloutPercentage: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    key: 'auto_settlement',
    name: 'Auto Settlement',
    description: 'Automatically settle loads after delivery confirmation',
    enabled: true,
    category: 'core',
    rolloutPercentage: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    key: 'sms_notifications',
    name: 'SMS Notifications',
    description: 'Send SMS notifications via AfroMessage',
    enabled: true,
    category: 'core',
    rolloutPercentage: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    key: 'bypass_detection',
    name: 'GPS Bypass Detection',
    description: 'Detect when GPS devices are tampered with',
    enabled: true,
    category: 'core',
    rolloutPercentage: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },

  // Beta features (controlled rollout)
  {
    key: 'new_dashboard',
    name: 'New Dashboard UI',
    description: 'Redesigned dashboard with improved metrics',
    enabled: false,
    category: 'beta',
    rolloutPercentage: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    key: 'route_optimization',
    name: 'Route Optimization',
    description: 'Suggest optimal routes for multi-stop loads',
    enabled: false,
    category: 'beta',
    rolloutPercentage: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    key: 'dark_mode',
    name: 'Dark Mode',
    description: 'Enable dark mode UI theme',
    enabled: false,
    category: 'beta',
    rolloutPercentage: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },

  // Experimental features (internal testing)
  {
    key: 'advanced_matching',
    name: 'Advanced Matching Algorithm',
    description: 'ML-based load-truck matching recommendations',
    enabled: false,
    category: 'experimental',
    rolloutPercentage: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    key: 'document_ocr',
    name: 'Document OCR',
    description: 'Automatic extraction of document data using OCR',
    enabled: false,
    category: 'experimental',
    rolloutPercentage: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    key: 'predictive_pricing',
    name: 'Predictive Pricing',
    description: 'AI-powered price suggestions based on market data',
    enabled: false,
    category: 'experimental',
    rolloutPercentage: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },

  // Ops features (operational toggles)
  {
    key: 'maintenance_mode',
    name: 'Maintenance Mode',
    description: 'Show maintenance page to all users',
    enabled: false,
    category: 'ops',
    rolloutPercentage: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    key: 'read_only_mode',
    name: 'Read-Only Mode',
    description: 'Disable all write operations temporarily',
    enabled: false,
    category: 'ops',
    rolloutPercentage: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    key: 'debug_logging',
    name: 'Debug Logging',
    description: 'Enable verbose debug logging',
    enabled: false,
    category: 'ops',
    rolloutPercentage: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
];

// =============================================================================
// IN-MEMORY STORE
// =============================================================================

interface FlagStore {
  flags: Map<string, FeatureFlag>;
  lastSync: number;
}

const store: FlagStore = {
  flags: new Map(),
  lastSync: 0,
};

// Initialize with default flags
for (const flag of DEFAULT_FLAGS) {
  store.flags.set(flag.key, flag);
}

// =============================================================================
// PROVIDER IMPLEMENTATIONS
// =============================================================================

/**
 * Local provider - uses in-memory store
 */
async function getLocalFlag(key: string): Promise<FeatureFlag | null> {
  return store.flags.get(key) || null;
}

async function getAllLocalFlags(): Promise<FeatureFlag[]> {
  return Array.from(store.flags.values());
}

async function setLocalFlag(flag: FeatureFlag): Promise<void> {
  store.flags.set(flag.key, flag);
}

/**
 * LaunchDarkly provider
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- LaunchDarkly SDK is a dynamic external library
let ldClient: any = null;

async function initLaunchDarkly(): Promise<void> {
  const config = getConfig();
  if (!config.launchDarkly?.sdkKey) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-eval -- Dynamic require for optional SDK dependency
    const dynamicRequire = (moduleName: string): unknown => {
      return eval('require')(moduleName);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- LaunchDarkly SDK is optionally loaded
    const LaunchDarkly = dynamicRequire('@launchdarkly/node-server-sdk') as any;
    ldClient = LaunchDarkly.init(config.launchDarkly.sdkKey);
    await ldClient.waitForInitialization();
    logger.info('LaunchDarkly client initialized');
  } catch (error) {
    logger.error('Failed to initialize LaunchDarkly', error);
  }
}

async function getLaunchDarklyFlag(key: string, context: EvaluationContext): Promise<boolean> {
  if (!ldClient) {
    return store.flags.get(key)?.enabled ?? false;
  }

  try {
    const ldContext = {
      kind: 'user',
      key: context.userId || 'anonymous',
      email: context.email,
      custom: {
        organizationId: context.organizationId,
        role: context.role,
        ...context.attributes,
      },
    };

    return await ldClient.variation(key, ldContext, false);
  } catch (error) {
    logger.error('LaunchDarkly evaluation error', error, { flagKey: key });
    return store.flags.get(key)?.enabled ?? false;
  }
}

/**
 * Unleash provider
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Unleash SDK is a dynamic external library
let unleashClient: any = null;

async function initUnleash(): Promise<void> {
  const config = getConfig();
  if (!config.unleash?.url) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-eval -- Dynamic require for optional SDK dependency
    const dynamicRequire = (moduleName: string): unknown => {
      return eval('require')(moduleName);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Unleash SDK is optionally loaded
    const { Unleash } = dynamicRequire('unleash-client') as any;
    unleashClient = new Unleash({
      url: config.unleash.url,
      appName: config.unleash.appName,
      customHeaders: {
        Authorization: config.unleash.apiKey,
      },
    });

    unleashClient.on('ready', () => {
      logger.info('Unleash client ready');
    });

    unleashClient.on('error', (error: Error) => {
      logger.error('Unleash error', error);
    });
  } catch (error) {
    logger.error('Failed to initialize Unleash', error);
  }
}

async function getUnleashFlag(key: string, context: EvaluationContext): Promise<boolean> {
  if (!unleashClient) {
    return store.flags.get(key)?.enabled ?? false;
  }

  try {
    return unleashClient.isEnabled(key, {
      userId: context.userId,
      sessionId: context.userId,
      properties: {
        organizationId: context.organizationId,
        role: context.role,
        ...context.attributes,
      },
    });
  } catch (error) {
    logger.error('Unleash evaluation error', error, { flagKey: key });
    return store.flags.get(key)?.enabled ?? false;
  }
}

// =============================================================================
// FLAG EVALUATION
// =============================================================================

/**
 * Hash a string to a number between 0-100 for consistent percentage rollout
 */
function hashToPercentage(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % 100;
}

/**
 * Evaluate a targeting rule
 */
function evaluateRule(rule: TargetRule, context: EvaluationContext): boolean {
  if (!rule.enabled) return false;

  let contextValue: string | undefined;

  switch (rule.attribute) {
    case 'userId':
      contextValue = context.userId;
      break;
    case 'organizationId':
      contextValue = context.organizationId;
      break;
    case 'role':
      contextValue = context.role;
      break;
    case 'email':
      contextValue = context.email;
      break;
    default:
      contextValue = context.attributes?.[rule.attribute]?.toString();
  }

  if (!contextValue) return false;

  switch (rule.operator) {
    case 'eq':
      return contextValue === rule.value;
    case 'neq':
      return contextValue !== rule.value;
    case 'in':
      return Array.isArray(rule.value) && rule.value.includes(contextValue);
    case 'nin':
      return Array.isArray(rule.value) && !rule.value.includes(contextValue);
    case 'contains':
      return contextValue.includes(rule.value as string);
    case 'startsWith':
      return contextValue.startsWith(rule.value as string);
    default:
      return false;
  }
}

/**
 * Evaluate a feature flag with context
 */
async function evaluateFlag(
  flag: FeatureFlag,
  context: EvaluationContext = {}
): Promise<FlagEvaluation> {
  // Flag is globally disabled
  if (!flag.enabled) {
    return {
      key: flag.key,
      enabled: false,
      reason: 'flag_disabled',
    };
  }

  // Check targeting rules first
  if (flag.targetRules && flag.targetRules.length > 0) {
    for (const rule of flag.targetRules) {
      if (evaluateRule(rule, context)) {
        return {
          key: flag.key,
          enabled: true,
          reason: 'rule_match',
          ruleId: rule.id,
        };
      }
    }
  }

  // Percentage rollout
  if (flag.rolloutPercentage < 100) {
    const hashInput = `${flag.key}:${context.userId || context.organizationId || 'anonymous'}`;
    const percentage = hashToPercentage(hashInput);

    if (percentage >= flag.rolloutPercentage) {
      return {
        key: flag.key,
        enabled: false,
        reason: 'percentage_rollout',
      };
    }
  }

  return {
    key: flag.key,
    enabled: true,
    reason: 'default',
  };
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Check if a feature is enabled
 */
export async function isFeatureEnabled(
  key: string,
  context: EvaluationContext = {}
): Promise<boolean> {
  const config = getConfig();

  // Use external provider if configured
  if (config.provider === 'launchdarkly' && ldClient) {
    return getLaunchDarklyFlag(key, context);
  }

  if (config.provider === 'unleash' && unleashClient) {
    return getUnleashFlag(key, context);
  }

  // Use local evaluation
  const flag = await getLocalFlag(key);
  if (!flag) {
    logger.warn('Unknown feature flag', { flagKey: key });
    return false;
  }

  const evaluation = await evaluateFlag(flag, context);
  return evaluation.enabled;
}

/**
 * Get a feature flag with full details
 */
export async function getFeatureFlag(key: string): Promise<FeatureFlag | null> {
  return getLocalFlag(key);
}

/**
 * Get all feature flags
 */
export async function getAllFeatureFlags(): Promise<FeatureFlag[]> {
  return getAllLocalFlags();
}

/**
 * Update a feature flag
 */
export async function updateFeatureFlag(
  key: string,
  updates: Partial<FeatureFlag>,
  updatedBy: string
): Promise<FeatureFlag | null> {
  const existing = await getLocalFlag(key);
  if (!existing) return null;

  const updated: FeatureFlag = {
    ...existing,
    ...updates,
    key, // Prevent key changes
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  await setLocalFlag(updated);

  logger.info('Feature flag updated', {
    flagKey: key,
    updatedBy,
    changes: updates,
  });

  return updated;
}

/**
 * Create a new feature flag
 */
export async function createFeatureFlag(
  flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>,
  createdBy: string
): Promise<FeatureFlag> {
  const newFlag: FeatureFlag = {
    ...flag,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: createdBy,
  };

  await setLocalFlag(newFlag);

  logger.info('Feature flag created', {
    flagKey: flag.key,
    createdBy,
  });

  return newFlag;
}

/**
 * Delete a feature flag
 */
export async function deleteFeatureFlag(key: string, deletedBy: string): Promise<boolean> {
  const exists = store.flags.has(key);
  if (!exists) return false;

  store.flags.delete(key);

  logger.info('Feature flag deleted', {
    flagKey: key,
    deletedBy,
  });

  return true;
}

/**
 * Get feature flags by category
 */
export async function getFeatureFlagsByCategory(category: FlagCategory): Promise<FeatureFlag[]> {
  const all = await getAllLocalFlags();
  return all.filter(f => f.category === category);
}

/**
 * Initialize feature flag providers
 */
export async function initializeFeatureFlags(): Promise<void> {
  const config = getConfig();

  if (config.provider === 'launchdarkly') {
    await initLaunchDarkly();
  } else if (config.provider === 'unleash') {
    await initUnleash();
  }

  logger.info('Feature flags initialized', { provider: config.provider });
}

// =============================================================================
// CONVENIENCE WRAPPERS
// =============================================================================

/**
 * Wrap a function to only execute if feature is enabled
 */
export function withFeatureFlag<T>(
  flagKey: string,
  fn: () => T | Promise<T>,
  fallback?: T
): (context?: EvaluationContext) => Promise<T | undefined> {
  return async (context?: EvaluationContext) => {
    const enabled = await isFeatureEnabled(flagKey, context);
    if (enabled) {
      return fn();
    }
    return fallback;
  };
}

/**
 * React hook helper - returns flag state
 * Note: This is a server-side helper. For client-side, use the API.
 */
export async function getFeatureFlagsForClient(
  context: EvaluationContext = {}
): Promise<Record<string, boolean>> {
  const flags = await getAllLocalFlags();
  const result: Record<string, boolean> = {};

  for (const flag of flags) {
    const evaluation = await evaluateFlag(flag, context);
    result[flag.key] = evaluation.enabled;
  }

  return result;
}

// =============================================================================
// STATISTICS
// =============================================================================

export function getFeatureFlagStats(): {
  total: number;
  enabled: number;
  disabled: number;
  byCategory: Record<FlagCategory, number>;
} {
  const flags = Array.from(store.flags.values());

  return {
    total: flags.length,
    enabled: flags.filter(f => f.enabled).length,
    disabled: flags.filter(f => !f.enabled).length,
    byCategory: {
      core: flags.filter(f => f.category === 'core').length,
      beta: flags.filter(f => f.category === 'beta').length,
      experimental: flags.filter(f => f.category === 'experimental').length,
      deprecated: flags.filter(f => f.category === 'deprecated').length,
      ops: flags.filter(f => f.category === 'ops').length,
    },
  };
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default {
  isFeatureEnabled,
  getFeatureFlag,
  getAllFeatureFlags,
  updateFeatureFlag,
  createFeatureFlag,
  deleteFeatureFlag,
  getFeatureFlagsByCategory,
  initializeFeatureFlags,
  withFeatureFlag,
  getFeatureFlagsForClient,
  getFeatureFlagStats,
};
