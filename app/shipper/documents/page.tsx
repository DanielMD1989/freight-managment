/**
 * Document Management Page
 *
 * Upload and manage company documents for verification
 * Sprint 11 - Story 11.5: Document Management
 */

import { Suspense } from "react";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import DocumentManagementClient from "./DocumentManagementClient";

interface Document {
  id: string;
  type: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  verificationStatus: string;
  uploadedAt: string;
  verifiedAt: string | null;
  rejectionReason: string | null;
  expiresAt: string | null;
}

/**
 * Fetch company documents
 */
async function getDocuments(
  organizationId: string
): Promise<Document[] | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session");

    if (!sessionCookie) {
      return null;
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    const response = await fetch(
      `${baseUrl}/api/documents?entityType=company&entityId=${organizationId}`,
      {
        headers: {
          Cookie: `session=${sessionCookie.value}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Failed to fetch documents:", response.status);
      return null;
    }

    const data = await response.json();
    return data.documents || [];
  } catch (error) {
    console.error("Error fetching documents:", error);
    return null;
  }
}

/**
 * Document Management Page
 */
export default async function DocumentsPage() {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/shipper/documents");
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== "SHIPPER" && session.role !== "ADMIN")) {
    redirect("/unauthorized");
  }

  if (!session.organizationId) {
    redirect("/shipper?error=no-organization");
  }

  // Fetch documents
  const documents = await getDocuments(session.organizationId);

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-3xl font-bold"
          style={{ color: "var(--foreground)" }}
        >
          Company Documents
        </h1>
        <p className="mt-2" style={{ color: "var(--foreground-muted)" }}>
          Upload and manage your company verification documents
        </p>
      </div>

      {/* Document Management Client Component */}
      <Suspense fallback={<DocumentsSkeleton />}>
        <DocumentManagementClient
          initialDocuments={documents || []}
          organizationId={session.organizationId}
        />
      </Suspense>
    </div>
  );
}

function DocumentsSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div
        className="h-32 rounded-xl"
        style={{ background: "var(--bg-tinted)" }}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div
          className="h-24 rounded-lg"
          style={{ background: "var(--bg-tinted)" }}
        />
        <div
          className="h-24 rounded-lg"
          style={{ background: "var(--bg-tinted)" }}
        />
      </div>
    </div>
  );
}
