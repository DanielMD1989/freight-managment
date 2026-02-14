/**
 * User Verification Status API
 *
 * Returns the current verification status of a user's account.
 * Used by both web and mobile apps to show pending verification UI.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

interface VerificationStep {
  id: string;
  label: string;
  status: "completed" | "pending" | "not_started";
  description?: string;
}

/**
 * GET /api/user/verification-status
 * Returns verification status for the authenticated user
 */
export async function GET() {
  try {
    const session = await requireAuth();

    // Fetch user with organization and documents
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        createdAt: true,
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
            isVerified: true,
            verifiedAt: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user has uploaded any documents (via loads they created)
    const documentCount = await db.document.count({
      where: {
        load: {
          createdById: user.id,
        },
      },
    });

    const hasDocuments = documentCount > 0;

    // Build verification steps
    const steps: VerificationStep[] = [
      {
        id: "account_created",
        label: "Account Created",
        status: "completed",
        description: `Registered on ${new Date(user.createdAt).toLocaleDateString()}`,
      },
      {
        id: "documents_uploaded",
        label: "Documents Uploaded",
        status: hasDocuments ? "completed" : "not_started",
        description: hasDocuments
          ? `${documentCount} document(s) uploaded`
          : "Upload your verification documents",
      },
      {
        id: "admin_review",
        label: "Admin Review",
        status:
          user.status === "ACTIVE"
            ? "completed"
            : user.status === "PENDING_VERIFICATION"
              ? "pending"
              : "not_started",
        description:
          user.status === "ACTIVE"
            ? "Verification complete"
            : user.status === "PENDING_VERIFICATION"
              ? "Your documents are being reviewed"
              : "Submit documents for review",
      },
      {
        id: "account_activated",
        label: "Account Activated",
        status: user.status === "ACTIVE" ? "completed" : "not_started",
        description:
          user.status === "ACTIVE"
            ? "Full marketplace access granted"
            : "Pending activation",
      },
    ];

    // Calculate overall progress
    const completedSteps = steps.filter((s) => s.status === "completed").length;
    const progressPercent = Math.round((completedSteps / steps.length) * 100);

    // Determine if user can access marketplace
    const canAccessMarketplace = user.status === "ACTIVE";

    // Determine what actions the user should take
    const nextAction = !hasDocuments
      ? {
          type: "upload_documents",
          label: "Upload Documents",
          description: "Please upload your verification documents to continue.",
        }
      : user.status === "PENDING_VERIFICATION"
        ? {
            type: "wait_review",
            label: "Awaiting Review",
            description:
              "Your documents are being reviewed. This usually takes 1-2 business days.",
          }
        : user.status === "REGISTERED"
          ? {
              type: "submit_review",
              label: "Submit for Review",
              description:
                "Your documents have been uploaded. Submit them for admin review.",
            }
          : null;

    return NextResponse.json({
      status: user.status,
      userRole: user.role,
      canAccessMarketplace,
      organization: user.organization
        ? {
            id: user.organization.id,
            name: user.organization.name,
            type: user.organization.type,
            isVerified: user.organization.isVerified,
          }
        : null,
      verification: {
        steps,
        progressPercent,
        documentsUploaded: hasDocuments,
        documentCount,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
      },
      nextAction,
      estimatedReviewTime:
        user.status === "PENDING_VERIFICATION" ? "1-2 business days" : null,
    });
  } catch (error) {
    console.error("Failed to get verification status:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to retrieve verification status" },
      { status: 500 }
    );
  }
}
