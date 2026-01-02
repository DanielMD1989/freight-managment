/**
 * Sprint 7: Automation Rules Management
 * API endpoints for creating and managing automation rules
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { requirePermission, Permission } from '@/lib/rbac';
import { z } from 'zod';

const createRuleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  ruleType: z.enum(['TIME_BASED', 'GPS_BASED', 'THRESHOLD_BASED', 'CUSTOM']),
  trigger: z.enum([
    'ON_LOAD_CREATED',
    'ON_LOAD_ASSIGNED',
    'ON_PICKUP_PENDING',
    'ON_IN_TRANSIT',
    'ON_STATUS_CHANGE',
    'ON_SCHEDULE',
    'ON_MANUAL',
  ]),
  conditions: z.record(z.string(), z.any()), // JSON object
  actions: z.array(z.record(z.string(), z.any())), // Array of action objects
  isEnabled: z.boolean().optional().default(true),
  priority: z.number().int().optional().default(0),
  schedulePattern: z.string().optional(),
});

// POST /api/automation/rules - Create new automation rule
export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(Permission.MANAGE_RULES);

    const body = await request.json();
    const validatedData = createRuleSchema.parse(body);

    // Calculate next execution time for scheduled rules
    let nextExecutionAt = null;
    if (validatedData.trigger === 'ON_SCHEDULE' && validatedData.schedulePattern) {
      // Simplified: Set to 5 minutes from now
      // In production, use cron-parser to calculate next run
      nextExecutionAt = new Date(Date.now() + 5 * 60 * 1000);
    }

    const rule = await db.automationRule.create({
      data: {
        ...validatedData,
        createdBy: session.userId,
        nextExecutionAt,
      },
    });

    return NextResponse.json({
      message: 'Automation rule created successfully',
      rule,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Create automation rule error:', error);
    return NextResponse.json(
      { error: 'Failed to create automation rule' },
      { status: 500 }
    );
  }
}

// GET /api/automation/rules - List automation rules
export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permission.VIEW_RULES);

    const { searchParams } = new URL(request.url);
    const ruleType = searchParams.get('ruleType');
    const trigger = searchParams.get('trigger');
    const isEnabled = searchParams.get('isEnabled');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);

    const where: any = {};

    if (ruleType) {
      where.ruleType = ruleType;
    }

    if (trigger) {
      where.trigger = trigger;
    }

    if (isEnabled !== null && isEnabled !== undefined) {
      where.isEnabled = isEnabled === 'true';
    }

    const [rules, total] = await Promise.all([
      db.automationRule.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: { executions: true },
          },
        },
      }),
      db.automationRule.count({ where }),
    ]);

    return NextResponse.json({
      rules,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('List automation rules error:', error);
    return NextResponse.json(
      { error: 'Failed to list automation rules' },
      { status: 500 }
    );
  }
}
