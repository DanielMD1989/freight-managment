import { NextResponse } from "next/server";
import { z } from "zod";
import { zodErrorResponse } from "@/lib/validation";

/**
 * Shared API error handler for route catch blocks.
 *
 * Maps auth/rbac/validation errors to proper HTTP status codes
 * instead of returning generic 500s.
 *
 * Usage:
 *   } catch (error) {
 *     return handleApiError(error, "Create truck error");
 *   }
 */
export function handleApiError(error: unknown, context: string): NextResponse {
  console.error(`${context}:`, error);

  // Zod validation errors → 400
  if (error instanceof z.ZodError) {
    return zodErrorResponse(error);
  }

  if (error instanceof Error) {
    // Auth errors → 401
    if (
      error.message === "Unauthorized" ||
      error.message === "Unauthorized: User not found" ||
      error.name === "UnauthorizedError"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Forbidden errors → 403
    if (
      error.message.startsWith("Forbidden") ||
      error.name === "ForbiddenError"
    ) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
  }

  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
