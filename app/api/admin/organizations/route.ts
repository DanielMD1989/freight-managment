/**
 * Admin Organizations API
 *
 * GET /api/admin/organizations
 *
 * List all organizations with pagination and aggregated stats
 * Requires admin role authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * GET /api/admin/organizations
 *
 * Query params:
 * - page: number (default 1)
 * - limit: number (default 20, max 100)
 * - type: SHIPPER | CARRIER_COMPANY | BROKER (optional filter)
 * - search: string (optional name search)
 * - isVerified: boolean (optional filter)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Check admin access
    if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const isVerified = searchParams.get('isVerified');

    // Build where clause
    const where: any = {};

    if (type) {
      where.type = type;
    }

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (isVerified !== null && isVerified !== undefined) {
      where.isVerified = isVerified === 'true';
    }

    // Get organizations with aggregated counts
    const [organizations, total] = await Promise.all([
      db.organization.findMany({
        where,
        select: {
          id: true,
          name: true,
          type: true,
          description: true,
          isVerified: true,
          verifiedAt: true,
          contactEmail: true,
          contactPhone: true,
          city: true,
          isFlagged: true,
          flagReason: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              users: true,
              loads: true,
              trucks: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.organization.count({ where }),
    ]);

    // Format response - match the format expected by OrganizationManagementClient
    const formattedOrgs = organizations.map((org) => ({
      id: org.id,
      name: org.name,
      type: org.type,
      description: org.description,
      isVerified: org.isVerified,
      verifiedAt: org.verifiedAt,
      contactEmail: org.contactEmail,
      contactPhone: org.contactPhone,
      city: org.city,
      isFlagged: org.isFlagged,
      flagReason: org.flagReason,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
      // Include both formats for flexibility
      userCount: org._count.users,
      loadCount: org._count.loads,
      truckCount: org._count.trucks,
      _count: {
        users: org._count.users,
        trucks: org._count.trucks,
        loads: org._count.loads,
      },
    }));

    return NextResponse.json({
      organizations: formattedOrgs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Admin organizations error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}
