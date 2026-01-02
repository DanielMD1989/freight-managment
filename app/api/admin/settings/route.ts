/**
 * System Settings API
 *
 * Sprint 10 - Story 10.6: System Configuration
 *
 * Allows admins to view and update platform settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';

const settingsSchema = z.object({
  // Rate Limiting
  rateLimitDocumentUpload: z.number().int().min(1).max(1000).optional(),
  rateLimitTruckPosting: z.number().int().min(1).max(1000).optional(),
  rateLimitFileDownload: z.number().int().min(1).max(10000).optional(),
  rateLimitAuthAttempts: z.number().int().min(1).max(100).optional(),

  // Match Score Thresholds
  matchScoreMinimum: z.number().int().min(0).max(100).optional(),
  matchScoreGood: z.number().int().min(0).max(100).optional(),
  matchScoreExcellent: z.number().int().min(0).max(100).optional(),

  // Email Notifications
  emailNotificationsEnabled: z.boolean().optional(),
  emailNotifyDocumentApproval: z.boolean().optional(),
  emailNotifyDocumentRejection: z.boolean().optional(),
  emailNotifyLoadAssignment: z.boolean().optional(),
  emailNotifyPodVerification: z.boolean().optional(),

  // Platform Fees (percentages)
  shipperCommissionRate: z.number().min(0).max(100).optional(),
  carrierCommissionRate: z.number().min(0).max(100).optional(),

  // File Upload Limits (in MB)
  maxFileUploadSizeMb: z.number().int().min(1).max(100).optional(),
  maxDocumentsPerEntity: z.number().int().min(1).max(50).optional(),

  // General Settings
  platformMaintenanceMode: z.boolean().optional(),
  platformMaintenanceMessage: z.string().max(500).optional(),
  requireEmailVerification: z.boolean().optional(),
  requirePhoneVerification: z.boolean().optional(),
});

/**
 * GET /api/admin/settings
 *
 * Get current platform settings
 */
export async function GET(request: NextRequest) {
  try {
    // Require admin access
    const session = await requireAuth();

    if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get settings from database (or use defaults if not set)
    // For MVP, we'll use a single settings record with id 'system'
    let settings = await db.systemSettings.findUnique({
      where: { id: 'system' },
    });

    // If no settings exist, create default settings
    if (!settings) {
      settings = await db.systemSettings.create({
        data: {
          id: 'system',
          // Rate Limiting defaults
          rateLimitDocumentUpload: 10,
          rateLimitTruckPosting: 100,
          rateLimitFileDownload: 100,
          rateLimitAuthAttempts: 5,

          // Match Score defaults
          matchScoreMinimum: 40,
          matchScoreGood: 70,
          matchScoreExcellent: 85,

          // Email Notifications defaults
          emailNotificationsEnabled: true,
          emailNotifyDocumentApproval: true,
          emailNotifyDocumentRejection: true,
          emailNotifyLoadAssignment: true,
          emailNotifyPodVerification: true,

          // Platform Fees defaults (5% each)
          shipperCommissionRate: 5.0,
          carrierCommissionRate: 5.0,

          // File Upload defaults
          maxFileUploadSizeMb: 10,
          maxDocumentsPerEntity: 20,

          // General defaults
          platformMaintenanceMode: false,
          platformMaintenanceMessage: null,
          requireEmailVerification: false,
          requirePhoneVerification: false,

          // Metadata
          lastModifiedBy: session.userId,
        },
      });
    }

    return NextResponse.json({
      settings,
      message: 'System settings retrieved successfully',
    });
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve settings' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/settings
 *
 * Update platform settings
 */
export async function PATCH(request: NextRequest) {
  try {
    // Require admin access
    const session = await requireAuth();

    if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = settingsSchema.parse(body);

    // Validate commission rates don't exceed 100% total
    if (validatedData.shipperCommissionRate !== undefined && validatedData.carrierCommissionRate !== undefined) {
      if (validatedData.shipperCommissionRate + validatedData.carrierCommissionRate > 100) {
        return NextResponse.json(
          { error: 'Total commission rates cannot exceed 100%' },
          { status: 400 }
        );
      }
    }

    // Validate match score thresholds are in ascending order
    if (
      validatedData.matchScoreMinimum !== undefined &&
      validatedData.matchScoreGood !== undefined &&
      validatedData.matchScoreExcellent !== undefined
    ) {
      if (!(validatedData.matchScoreMinimum < validatedData.matchScoreGood && validatedData.matchScoreGood < validatedData.matchScoreExcellent)) {
        return NextResponse.json(
          { error: 'Match score thresholds must be in ascending order (minimum < good < excellent)' },
          { status: 400 }
        );
      }
    }

    // Update settings
    const updatedSettings = await db.systemSettings.upsert({
      where: { id: 'system' },
      create: {
        id: 'system',
        ...validatedData,
        lastModifiedBy: session.userId,
      },
      update: {
        ...validatedData,
        lastModifiedBy: session.userId,
        lastModifiedAt: new Date(),
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.userId,
        action: 'SETTINGS_UPDATED',
        entityType: 'SYSTEM_SETTINGS',
        entityId: 'system',
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        metadata: {
          changes: validatedData,
        },
      },
    });

    return NextResponse.json({
      settings: updatedSettings,
      message: 'System settings updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Update settings error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
