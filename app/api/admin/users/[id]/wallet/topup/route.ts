/**
 * Admin Wallet Top-Up API
 *
 * Allows admins to manually credit a user's wallet
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';
import { zodErrorResponse } from '@/lib/validation';

const topUpSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  paymentMethod: z.string().optional().default('MANUAL'),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * POST /api/admin/users/[id]/wallet/topup
 *
 * Credit funds to a user's wallet
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();

    // Only admins can access this endpoint
    if (!['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { amount, paymentMethod, reference, notes } = topUpSchema.parse(body);

    // Get the user and their organization
    const user = await db.user.findUnique({
      where: { id },
      include: { organization: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.organizationId) {
      return NextResponse.json(
        { error: 'User has no organization' },
        { status: 400 }
      );
    }

    // Find the wallet
    const wallet = await db.financialAccount.findFirst({
      where: {
        organizationId: user.organizationId,
        accountType: {
          in: ['SHIPPER_WALLET', 'CARRIER_WALLET'],
        },
        isActive: true,
      },
    });

    if (!wallet) {
      return NextResponse.json(
        { error: 'No wallet found for this user' },
        { status: 404 }
      );
    }

    // Create journal entry and update balance atomically
    const description = notes || `Manual top-up by admin via ${paymentMethod}`;

    const result = await db.$transaction(async (tx) => {
      // Create journal entry for the deposit
      const journalEntry = await tx.journalEntry.create({
        data: {
          transactionType: 'DEPOSIT',
          description,
          reference: reference || null,
          metadata: {
            paymentMethod,
            processedBy: session.userId,
            processedByEmail: session.email,
            adminTopUp: true,
          },
          lines: {
            create: [
              {
                accountId: wallet.id,
                amount,
                isDebit: true, // Debit to wallet = increase balance
              },
            ],
          },
        },
      });

      // Update wallet balance
      const updatedWallet = await tx.financialAccount.update({
        where: { id: wallet.id },
        data: {
          balance: {
            increment: amount,
          },
        },
      });

      return {
        journalEntry,
        updatedWallet,
      };
    });

    return NextResponse.json({
      success: true,
      newBalance: Number(result.updatedWallet.balance),
      transactionId: result.journalEntry.id,
      message: `Successfully added ${amount} ETB to wallet`,
    });
  } catch (error) {
    console.error('Wallet top-up error:', error);

    if (error instanceof z.ZodError) {
      return zodErrorResponse(error);
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
