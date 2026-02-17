/**
 * Feature Flag Single Item API
 *
 * PHASE 4: Feature Flag System for Safe Rollouts
 *
 * Endpoints:
 * - GET /api/feature-flags/[key] - Get a single feature flag
 * - PATCH /api/feature-flags/[key] - Update a feature flag
 * - DELETE /api/feature-flags/[key] - Delete a feature flag
 *
 * Access: Admin only
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import {
  getFeatureFlag,
  updateFeatureFlag,
  deleteFeatureFlag,
  isFeatureEnabled,
} from "@/lib/featureFlags";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ key: string }>;
}

/**
 * GET /api/feature-flags/[key]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth();
    const { key } = await params;

    // For non-admins, only return evaluation result
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      const enabled = await isFeatureEnabled(key, {
        userId: session.userId,
        organizationId: session.organizationId,
        role: session.role,
      });

      return NextResponse.json({
        key,
        enabled,
        timestamp: new Date().toISOString(),
      });
    }

    // For admins, return full flag details
    const flag = await getFeatureFlag(key);

    if (!flag) {
      return NextResponse.json(
        { error: `Feature flag '${key}' not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({ flag });
  } catch (error) {
    logger.error("Feature flag GET error", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to retrieve feature flag" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/feature-flags/[key]
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireAuth();
    const { key } = await params;

    // Admin only
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      enabled,
      category,
      rolloutPercentage,
      targetRules,
      metadata,
    } = body;

    // Build updates object (only include provided fields)
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (enabled !== undefined) updates.enabled = enabled;
    if (category !== undefined) updates.category = category;
    if (rolloutPercentage !== undefined)
      updates.rolloutPercentage = rolloutPercentage;
    if (targetRules !== undefined) updates.targetRules = targetRules;
    if (metadata !== undefined) updates.metadata = metadata;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No updates provided" },
        { status: 400 }
      );
    }

    const flag = await updateFeatureFlag(key, updates, session.userId);

    if (!flag) {
      return NextResponse.json(
        { error: `Feature flag '${key}' not found` },
        { status: 404 }
      );
    }

    logger.info("Feature flag updated via API", {
      flagKey: key,
      userId: session.userId,
      updates: Object.keys(updates),
    });

    return NextResponse.json({ flag });
  } catch (error) {
    logger.error("Feature flag PATCH error", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update feature flag" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/feature-flags/[key]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireAuth();
    const { key } = await params;

    // Admin only
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      );
    }

    // Prevent deleting core flags
    const flag = await getFeatureFlag(key);
    if (flag?.category === "core") {
      return NextResponse.json(
        { error: "Cannot delete core feature flags" },
        { status: 403 }
      );
    }

    const deleted = await deleteFeatureFlag(key, session.userId);

    if (!deleted) {
      return NextResponse.json(
        { error: `Feature flag '${key}' not found` },
        { status: 404 }
      );
    }

    logger.info("Feature flag deleted via API", {
      flagKey: key,
      userId: session.userId,
    });

    return NextResponse.json({ success: true, key });
  } catch (error) {
    logger.error("Feature flag DELETE error", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete feature flag" },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/feature-flags/[key]
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
