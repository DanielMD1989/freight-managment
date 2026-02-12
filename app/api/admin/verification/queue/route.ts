/**
 * Admin Verification Queue API
 *
 * GET /api/admin/verification/queue - Get documents pending verification
 *
 * Query Parameters:
 * - status: Filter by verification status (PENDING, APPROVED, REJECTED, EXPIRED)
 * - organizationId: Filter by organization ID
 * - documentType: Filter by document type
 * - entityType: Filter by entity type (company, truck, all)
 * - limit: Number of results per page (default: 50)
 * - offset: Number of results to skip (default: 0)
 *
 * Sprint 8 - Story 8.9: Back-Office Verification Dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, Permission } from "@/lib/rbac";
import { VerificationStatus, Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    // Require admin or ops permission
    const session = await requirePermission(Permission.VERIFY_DOCUMENTS);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as VerificationStatus | null;
    const organizationId = searchParams.get("organizationId");
    const documentType = searchParams.get("documentType");
    const entityType = searchParams.get("entityType") || "all"; // company, truck, or all
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clauses
    const companyWhere: Prisma.CompanyDocumentWhereInput = {};
    const truckWhere: Prisma.TruckDocumentWhereInput = {};

    if (status) {
      companyWhere.verificationStatus = status;
      truckWhere.verificationStatus = status;
    }

    if (organizationId) {
      companyWhere.organizationId = organizationId;
      // For truck documents, we need to join through truck to get organization
      truckWhere.truck = {
        carrierId: organizationId,
      };
    }

    if (documentType) {
      companyWhere.type = documentType as Prisma.EnumCompanyDocumentTypeFilter;
      truckWhere.type = documentType as Prisma.EnumTruckDocumentTypeFilter;
    }

    // Fetch documents based on entity type
    let companyDocuments: Prisma.CompanyDocumentGetPayload<{ include: { organization: { select: { id: true; name: true; contactEmail: true; contactPhone: true; isVerified: true } } } }>[] = [];
    let truckDocuments: Prisma.TruckDocumentGetPayload<{ include: { truck: { select: { id: true; licensePlate: true; carrier: { select: { id: true; name: true; contactEmail: true; contactPhone: true; isVerified: true } } } } } }>[] = [];

    if (entityType === "company" || entityType === "all") {
      companyDocuments = await db.companyDocument.findMany({
        where: companyWhere,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              contactEmail: true,
              contactPhone: true,
              isVerified: true,
            },
          },
        },
        orderBy: { uploadedAt: "desc" },
        take: limit,
        skip: offset,
      });
    }

    if (entityType === "truck" || entityType === "all") {
      truckDocuments = await db.truckDocument.findMany({
        where: truckWhere,
        include: {
          truck: {
            select: {
              id: true,
              licensePlate: true,
              carrier: {
                select: {
                  id: true,
                  name: true,
                  contactEmail: true,
                  contactPhone: true,
                  isVerified: true,
                },
              },
            },
          },
        },
        orderBy: { uploadedAt: "desc" },
        take: limit,
        skip: offset,
      });
    }

    // Transform and combine documents
    const formattedCompanyDocs = companyDocuments.map((doc) => ({
      id: doc.id,
      entityType: "company" as const,
      type: doc.type,
      fileName: doc.fileName,
      fileUrl: doc.fileUrl,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      verificationStatus: doc.verificationStatus,
      uploadedAt: doc.uploadedAt,
      verifiedAt: doc.verifiedAt,
      expiresAt: doc.expiresAt,
      rejectionReason: doc.rejectionReason,
      uploadedById: doc.uploadedById,
      verifiedById: doc.verifiedById,
      organization: doc.organization,
      entity: {
        id: doc.organization.id,
        name: doc.organization.name,
      },
    }));

    const formattedTruckDocs = truckDocuments.map((doc) => ({
      id: doc.id,
      entityType: "truck" as const,
      type: doc.type,
      fileName: doc.fileName,
      fileUrl: doc.fileUrl,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      verificationStatus: doc.verificationStatus,
      uploadedAt: doc.uploadedAt,
      verifiedAt: doc.verifiedAt,
      expiresAt: doc.expiresAt,
      rejectionReason: doc.rejectionReason,
      uploadedById: doc.uploadedById,
      verifiedById: doc.verifiedById,
      organization: doc.truck.carrier,
      entity: {
        id: doc.truck.id,
        name: `Truck ${doc.truck.licensePlate}`,
      },
    }));

    // Combine and sort by upload date (newest first)
    const allDocuments = [...formattedCompanyDocs, ...formattedTruckDocs].sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );

    // Get total counts for pagination
    const totalCompanyCount =
      entityType === "company" || entityType === "all"
        ? await db.companyDocument.count({ where: companyWhere })
        : 0;

    const totalTruckCount =
      entityType === "truck" || entityType === "all"
        ? await db.truckDocument.count({ where: truckWhere })
        : 0;

    const totalCount = totalCompanyCount + totalTruckCount;

    return NextResponse.json({
      documents: allDocuments,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    console.error("Verification queue error:", error);

    if (error instanceof Error && error.name === "ForbiddenError") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof Error && error.name === "UnauthorizedError") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
