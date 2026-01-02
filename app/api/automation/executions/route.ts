/**
 * Sprint 7: Automation Rule Execution History
 * View and analyze automation rule executions
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { requirePermission, Permission } from '@/lib/rbac';

// GET /api/automation/executions - List rule executions
export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permission.VIEW_RULES);

    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('ruleId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);
    const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : undefined;
    const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : undefined;

    const where: any = {};

    if (ruleId) {
      where.ruleId = ruleId;
    }

    if (status) {
      where.status = status;
    }

    if (from || to) {
      where.executedAt = {};
      if (from) where.executedAt.gte = from;
      if (to) where.executedAt.lte = to;
    }

    const [executions, total] = await Promise.all([
      db.automationRuleExecution.findMany({
        where,
        orderBy: { executedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          rule: {
            select: {
              id: true,
              name: true,
              ruleType: true,
              trigger: true,
            },
          },
        },
      }),
      db.automationRuleExecution.count({ where }),
    ]);

    // Calculate statistics
    const stats = await db.automationRuleExecution.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
    });

    const statusCounts = {
      PENDING: 0,
      RUNNING: 0,
      COMPLETED: 0,
      FAILED: 0,
    };

    stats.forEach((stat) => {
      statusCounts[stat.status] = stat._count.status;
    });

    return NextResponse.json({
      executions,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      stats: statusCounts,
    });
  } catch (error) {
    console.error('List automation executions error:', error);
    return NextResponse.json(
      { error: 'Failed to list automation executions' },
      { status: 500 }
    );
  }
}
