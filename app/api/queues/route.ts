/**
 * Queue Management API
 *
 * PHASE 4: Background Worker Queue (BullMQ)
 *
 * Endpoints:
 * - GET /api/queues - Get all queue statistics
 * - POST /api/queues - Add a job to a queue
 *
 * Access: Admin only
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  getAllQueueStats,
  addJob,
  getQueueInfo,
  type QueueName,
  type JobOptions,
} from '@/lib/queue';
import { logger } from '@/lib/logger';

const VALID_QUEUES: QueueName[] = [
  'email',
  'sms',
  'notifications',
  'distance-matrix',
  'pdf',
  'cleanup',
  'bulk',
  'scheduled',
];

/**
 * GET /api/queues
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Admin only
    if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    const stats = await getAllQueueStats();
    const info = getQueueInfo();

    return NextResponse.json({
      ...info,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Queue stats GET error', error);

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to retrieve queue statistics' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/queues
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Admin only
    if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { queue, name, data, options } = body as {
      queue: QueueName;
      name: string;
      data: Record<string, unknown>;
      options?: JobOptions;
    };

    // Validation
    if (!queue || !name) {
      return NextResponse.json(
        { error: 'queue and name are required' },
        { status: 400 }
      );
    }

    if (!VALID_QUEUES.includes(queue)) {
      return NextResponse.json(
        { error: `Invalid queue. Valid queues: ${VALID_QUEUES.join(', ')}` },
        { status: 400 }
      );
    }

    const jobId = await addJob(queue, name, data || {}, options);

    logger.info('Job added via API', {
      queue,
      name,
      jobId,
      userId: session.userId,
    });

    return NextResponse.json({
      success: true,
      jobId,
      queue,
      name,
    }, { status: 201 });
  } catch (error) {
    logger.error('Queue POST error', error);

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to add job to queue' },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/queues
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
