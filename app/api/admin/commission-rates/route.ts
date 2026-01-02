/**
 * Commission Rates Configuration API
 *
 * Sprint 16 - Story 16.7: Commission & Revenue Tracking
 *
 * Allows admins to view and update platform commission rates
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getCurrentCommissionRates } from '@/lib/commissionCalculation';
import { z } from 'zod';
import { Decimal } from 'decimal.js';

const updateCommissionRatesSchema = z.object({
  shipperRate: z.number().min(0).max(100),
  carrierRate: z.number().min(0).max(100),
  effectiveFrom: z.string().datetime().optional(),
});

/**
 * GET /api/admin/commission-rates
 *
 * Get current commission rates
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Only admins can view commission rates
    if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Get current active rates
    const currentRates = await getCurrentCommissionRates();

    // Get all rate configurations (history)
    const allRates = await db.commissionRate.findMany({
      orderBy: {
        effectiveFrom: 'desc',
      },
      take: 10, // Last 10 rate changes
    });

    return NextResponse.json({
      current: {
        shipperRate: Number(currentRates.shipperRate),
        carrierRate: Number(currentRates.carrierRate),
        totalRate: Number(currentRates.shipperRate.add(currentRates.carrierRate)),
      },
      history: allRates.map((rate) => ({
        id: rate.id,
        shipperRate: Number(rate.shipperRate),
        carrierRate: Number(rate.carrierRate),
        effectiveFrom: rate.effectiveFrom,
        effectiveTo: rate.effectiveTo,
        isActive: rate.isActive,
        createdAt: rate.createdAt,
      })),
    });
  } catch (error) {
    console.error('Get commission rates error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/commission-rates
 *
 * Update commission rates (admin only)
 *
 * Creates a new commission rate configuration with optional effective date
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Only admins can update commission rates
    if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updateCommissionRatesSchema.parse(body);

    const effectiveFrom = validatedData.effectiveFrom
      ? new Date(validatedData.effectiveFrom)
      : new Date();

    // Deactivate current active rates if new rate is effective immediately
    if (effectiveFrom <= new Date()) {
      await db.commissionRate.updateMany({
        where: {
          isActive: true,
        },
        data: {
          isActive: false,
          effectiveTo: new Date(),
        },
      });
    }

    // Create new commission rate configuration
    const newRate = await db.commissionRate.create({
      data: {
        shipperRate: new Decimal(validatedData.shipperRate),
        carrierRate: new Decimal(validatedData.carrierRate),
        effectiveFrom,
        isActive: effectiveFrom <= new Date(),
        createdBy: session.userId,
      },
    });

    // TODO: Create audit log entry
    // await db.auditLog.create({
    //   data: {
    //     userId: session.userId,
    //     action: 'UPDATE_COMMISSION_RATES',
    //     entityType: 'COMMISSION_RATE',
    //     entityId: newRate.id,
    //     description: `Updated commission rates: shipper ${validatedData.shipperRate}%, carrier ${validatedData.carrierRate}%`,
    //   },
    // });

    return NextResponse.json({
      message: 'Commission rates updated successfully',
      rate: {
        id: newRate.id,
        shipperRate: Number(newRate.shipperRate),
        carrierRate: Number(newRate.carrierRate),
        effectiveFrom: newRate.effectiveFrom,
        isActive: newRate.isActive,
      },
    });
  } catch (error) {
    console.error('Update commission rates error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
