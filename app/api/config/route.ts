/**
 * Configuration API
 *
 * PHASE 4: Centralized Configuration Management
 *
 * Endpoints:
 * - GET /api/config - Get current configuration summary
 * - GET /api/config?validate=true - Validate configuration
 *
 * Access: Admin only
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { config, validateConfig, getConfigSummary, CONFIG_VERSION } from '@/lib/config';

/**
 * GET /api/config
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const session = await requireAuth();
    if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 401 }
      );
    }

    const { searchParams } = request.nextUrl;
    const validate = searchParams.get('validate') === 'true';

    // Get configuration summary (without secrets)
    const summary = getConfigSummary();

    const response: Record<string, unknown> = {
      version: CONFIG_VERSION,
      timestamp: new Date().toISOString(),
      ...summary,
    };

    // Include validation if requested
    if (validate) {
      const errors = validateConfig();
      response.validation = {
        valid: errors.filter(e => e.severity === 'error').length === 0,
        errors: errors.filter(e => e.severity === 'error'),
        warnings: errors.filter(e => e.severity === 'warning'),
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Config API] Error:', error);

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to retrieve configuration' },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/config
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
