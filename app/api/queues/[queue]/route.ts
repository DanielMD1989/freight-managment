/**
 * Individual Queue Management API
 *
 * PHASE 4: Background Worker Queue (BullMQ)
 *
 * Endpoints:
 * - GET /api/queues/[queue] - Get queue statistics
 * - POST /api/queues/[queue]/pause - Pause queue
 * - POST /api/queues/[queue]/resume - Resume queue
 * - POST /api/queues/[queue]/clean - Clean old jobs
 *
 * Access: Admin only
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import {
  getQueueStats,
  pauseQueue,
  resumeQueue,
  cleanQueue,
  type QueueName,
} from "@/lib/queue";
import { logger } from "@/lib/logger";

const VALID_QUEUES: QueueName[] = [
  "email",
  "sms",
  "notifications",
  "distance-matrix",
  "pdf",
  "cleanup",
  "bulk",
  "scheduled",
];

interface RouteParams {
  params: Promise<{ queue: string }>;
}

/**
 * GET /api/queues/[queue]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth();
    const { queue } = await params;

    // Admin only
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      );
    }

    if (!VALID_QUEUES.includes(queue as QueueName)) {
      return NextResponse.json(
        { error: `Invalid queue. Valid queues: ${VALID_QUEUES.join(", ")}` },
        { status: 400 }
      );
    }

    const stats = await getQueueStats(queue as QueueName);

    return NextResponse.json({
      ...stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Queue GET error", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to retrieve queue statistics" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/queues/[queue]
 * Actions: pause, resume, clean
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireAuth();
    const { queue } = await params;

    // Admin only
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      );
    }

    if (!VALID_QUEUES.includes(queue as QueueName)) {
      return NextResponse.json(
        { error: `Invalid queue. Valid queues: ${VALID_QUEUES.join(", ")}` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action, grace, status } = body as {
      action: "pause" | "resume" | "clean";
      grace?: number;
      status?: "completed" | "failed";
    };

    if (!action) {
      return NextResponse.json(
        { error: "action is required. Valid actions: pause, resume, clean" },
        { status: 400 }
      );
    }

    let result: boolean | number = false;

    switch (action) {
      case "pause":
        result = await pauseQueue(queue as QueueName);
        logger.info("Queue paused via API", { queue, userId: session.userId });
        break;

      case "resume":
        result = await resumeQueue(queue as QueueName);
        logger.info("Queue resumed via API", { queue, userId: session.userId });
        break;

      case "clean":
        result = await cleanQueue(
          queue as QueueName,
          grace || 3600000,
          status || "completed"
        );
        logger.info("Queue cleaned via API", {
          queue,
          userId: session.userId,
          removed: result,
        });
        break;

      default:
        return NextResponse.json(
          { error: "Invalid action. Valid actions: pause, resume, clean" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      queue,
      result,
    });
  } catch (error) {
    logger.error("Queue action error", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to perform queue action" },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/queues/[queue]
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
