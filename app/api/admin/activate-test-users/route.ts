/**
 * Activate Test Users API
 *
 * POST /api/admin/activate-test-users
 *
 * Updates all test users to ACTIVE status
 * Admin only endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const session = await requireAuth();
    if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Update all test users to ACTIVE status
    const result = await db.user.updateMany({
      where: {
        email: {
          contains: 'testfreightet.com',
        },
      },
      data: {
        status: 'ACTIVE',
      },
    });

    // Get updated users
    const users = await db.user.findMany({
      where: {
        email: {
          contains: 'testfreightet.com',
        },
      },
      select: {
        email: true,
        status: true,
        role: true,
      },
    });

    return NextResponse.json({
      message: `Updated ${result.count} test users to ACTIVE status`,
      users,
    });
  } catch (error: any) {
    console.error('Error activating test users:', error);
    // M5 FIX: Don't leak error details
    return NextResponse.json(
      { error: 'Failed to activate test users' },
      { status: 500 }
    );
  }
}

// Also support GET for convenience (admin only)
export async function GET(request: NextRequest) {
  try {
    // Require admin authentication
    const session = await requireAuth();
    if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get test users status
    const users = await db.user.findMany({
      where: {
        email: {
          contains: 'testfreightet.com',
        },
      },
      select: {
        email: true,
        status: true,
        role: true,
      },
    });

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('Error fetching test users:', error);
    // M6 FIX: Don't leak error details
    return NextResponse.json(
      { error: 'Failed to fetch test users' },
      { status: 500 }
    );
  }
}
