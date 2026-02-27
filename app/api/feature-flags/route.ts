/**
 * Feature Flags API
 *
 * PHASE 4: Feature Flag System for Safe Rollouts
 *
 * Endpoints:
 * - GET /api/feature-flags - List all feature flags
 * - GET /api/feature-flags?evaluate=true - Get evaluated flags for current user
 * - POST /api/feature-flags - Create a new feature flag (Admin only)
 *
 * Access: Admin for management, any authenticated user for evaluation
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import {
  getAllFeatureFlags,
  createFeatureFlag,
  getFeatureFlagsForClient,
  getFeatureFlagStats,
  type FlagCategory,
} from "@/lib/featureFlags";
import { logger } from "@/lib/logger";

/**
 * GET /api/feature-flags
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = request.nextUrl;
    const evaluate = searchParams.get("evaluate") === "true";
    const category = searchParams.get("category") as FlagCategory | null;

    // For non-admins, only return evaluated flags
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      const evaluatedFlags = await getFeatureFlagsForClient({
        userId: session.userId,
        organizationId: session.organizationId,
        role: session.role,
      });

      return NextResponse.json({
        flags: evaluatedFlags,
        timestamp: new Date().toISOString(),
      });
    }

    // For admins, return full flag details
    if (evaluate) {
      const evaluatedFlags = await getFeatureFlagsForClient({
        userId: session.userId,
        organizationId: session.organizationId,
        role: session.role,
      });

      return NextResponse.json({
        flags: evaluatedFlags,
        timestamp: new Date().toISOString(),
      });
    }

    // Get all flags
    let flags = await getAllFeatureFlags();

    // Filter by category if specified
    if (category) {
      flags = flags.filter((f) => f.category === category);
    }

    const stats = getFeatureFlagStats();

    return NextResponse.json({
      flags,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Feature flags GET error", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to retrieve feature flags" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/feature-flags
 */
export async function POST(request: NextRequest) {
  try {
    // CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireAuth();

    // Admin only
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      key,
      name,
      description,
      enabled = false,
      category = "beta",
      rolloutPercentage = 0,
      targetRules,
      metadata,
    } = body;

    // Validation
    if (!key || !name) {
      return NextResponse.json(
        { error: "key and name are required" },
        { status: 400 }
      );
    }

    // Validate key format
    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      return NextResponse.json(
        {
          error:
            "key must be lowercase alphanumeric with underscores, starting with a letter",
        },
        { status: 400 }
      );
    }

    // Check if flag already exists
    const existing = await getAllFeatureFlags();
    if (existing.some((f) => f.key === key)) {
      return NextResponse.json(
        { error: `Feature flag with key '${key}' already exists` },
        { status: 409 }
      );
    }

    const flag = await createFeatureFlag(
      {
        key,
        name,
        description: description || "",
        enabled,
        category,
        rolloutPercentage,
        targetRules,
        metadata,
        updatedBy: session.userId,
      },
      session.userId
    );

    logger.info("Feature flag created via API", {
      flagKey: key,
      userId: session.userId,
    });

    return NextResponse.json({ flag }, { status: 201 });
  } catch (error) {
    logger.error("Feature flags POST error", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create feature flag" },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/feature-flags
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
