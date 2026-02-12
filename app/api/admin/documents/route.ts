/**
 * Admin Documents API
 *
 * List all documents pending verification across all organizations
 * Sprint 10 - Story 10.4: Document Verification Queue
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, Permission } from '@/lib/rbac';
import { VerificationStatus } from '@prisma/client';

// Type for transformed document with user details
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TransformedDocument = Record<string, any>;

/**
 * GET /api/admin/documents
 *
 * List all documents with filtering for verification queue
 *
 * Query parameters:
 * - status: PENDING | APPROVED | REJECTED (default: PENDING)
 * - entityType: company | truck | all (default: all)
 * - page: number (default: 1)
 * - limit: number (default: 20)
 *
 * Returns paginated list of documents needing verification
 */
export async function GET(request: NextRequest) {
  try {
    // Require admin permission to view documents
    await requirePermission(Permission.VERIFY_DOCUMENTS);

    const { searchParams } = request.nextUrl;
    const status = (searchParams.get('status') || 'PENDING') as VerificationStatus;
    const entityType = searchParams.get('entityType') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Validate status
    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be PENDING, APPROVED, or REJECTED' },
        { status: 400 }
      );
    }

    // Validate entity type
    if (!['company', 'truck', 'all'].includes(entityType)) {
      return NextResponse.json(
        { error: 'Invalid entityType. Must be company, truck, or all' },
        { status: 400 }
      );
    }

    const skip = (page - 1) * limit;

    // Helper to fetch user details
    const fetchUserDetails = async (userIds: string[]) => {
      if (userIds.length === 0) return new Map();
      const users = await db.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });
      return new Map(users.map(u => [u.id, u]));
    };

    // Fetch company documents
    let companyDocuments: TransformedDocument[] = [];
    let companyCount = 0;

    if (entityType === 'company' || entityType === 'all') {
      [companyDocuments, companyCount] = await Promise.all([
        db.companyDocument.findMany({
          where: {
            verificationStatus: status,
          },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
          orderBy: {
            uploadedAt: 'desc',
          },
          skip: entityType === 'company' ? skip : 0,
          take: entityType === 'company' ? limit : undefined,
        }),
        db.companyDocument.count({
          where: {
            verificationStatus: status,
          },
        }),
      ]);

      // Fetch user details for uploadedBy and verifiedBy
      const companyUserIds = companyDocuments.flatMap(doc =>
        [doc.uploadedById, doc.verifiedById].filter(Boolean)
      );
      const companyUserMap = await fetchUserDetails(companyUserIds);

      // Add entityType and user details to each document
      companyDocuments = companyDocuments.map(doc => ({
        ...doc,
        entityType: 'company',
        entityName: doc.organization.name,
        fileSize: Number(doc.fileSize),
        uploadedBy: companyUserMap.get(doc.uploadedById) || { id: doc.uploadedById, email: 'Unknown', firstName: null, lastName: null },
        verifiedBy: doc.verifiedById ? companyUserMap.get(doc.verifiedById) || null : null,
      }));
    }

    // Fetch truck documents
    let truckDocuments: TransformedDocument[] = [];
    let truckCount = 0;

    if (entityType === 'truck' || entityType === 'all') {
      [truckDocuments, truckCount] = await Promise.all([
        db.truckDocument.findMany({
          where: {
            verificationStatus: status,
          },
          include: {
            truck: {
              select: {
                id: true,
                licensePlate: true,
                carrier: {
                  select: {
                    id: true,
                    name: true,
                    type: true,
                  },
                },
              },
            },
          },
          orderBy: {
            uploadedAt: 'desc',
          },
          skip: entityType === 'truck' ? skip : 0,
          take: entityType === 'truck' ? limit : undefined,
        }),
        db.truckDocument.count({
          where: {
            verificationStatus: status,
          },
        }),
      ]);

      // Fetch user details for uploadedBy and verifiedBy
      const truckUserIds = truckDocuments.flatMap(doc =>
        [doc.uploadedById, doc.verifiedById].filter(Boolean)
      );
      const truckUserMap = await fetchUserDetails(truckUserIds);

      // Add entityType and user details to each document
      truckDocuments = truckDocuments.map(doc => ({
        ...doc,
        entityType: 'truck',
        entityName: `${doc.truck.carrier.name} - ${doc.truck.licensePlate}`,
        organization: doc.truck.carrier,
        fileSize: Number(doc.fileSize),
        uploadedBy: truckUserMap.get(doc.uploadedById) || { id: doc.uploadedById, email: 'Unknown', firstName: null, lastName: null },
        verifiedBy: doc.verifiedById ? truckUserMap.get(doc.verifiedById) || null : null,
      }));
    }

    // Combine and paginate if showing all
    let documents: TransformedDocument[] = [];
    let total = 0;

    if (entityType === 'all') {
      // Combine both arrays
      const combined = [...companyDocuments, ...truckDocuments];

      // Sort by uploadedAt descending
      combined.sort((a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );

      // Paginate
      documents = combined.slice(skip, skip + limit);
      total = companyCount + truckCount;
    } else if (entityType === 'company') {
      documents = companyDocuments;
      total = companyCount;
    } else {
      documents = truckDocuments;
      total = truckCount;
    }

    return NextResponse.json({
      documents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      statistics: {
        companyDocuments: companyCount,
        truckDocuments: truckCount,
        total: companyCount + truckCount,
      },
    });
  } catch (error) {
    console.error('Error fetching admin documents:', error);

    if (error instanceof Error && error.name === 'ForbiddenError') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
