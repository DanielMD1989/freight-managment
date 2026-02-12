/**
 * Admin Wallet Top-Up API
 *
 * Allows admins to manually credit a user's wallet
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { validateCSRFWithMobile } from '@/lib/csrf';
import { checkRpsLimit, RPS_CONFIGS } from '@/lib/rateLimit';
import { z } from 'zod';
import { zodErrorResponse } from '@/lib/validation';
// H15 FIX: Import max topup constant
import { MAX_WALLET_TOPUP_AMOUNT, ADMIN_FINANCIAL_OPS_RPS, ADMIN_FINANCIAL_OPS_BURST } from '@/lib/types/admin';

// H15 FIX: Add maximum amount validation to prevent abuse
const topUpSchema = z.object({
  amount: z.number()
    .positive('Amount must be positive')
    .max(MAX_WALLET_TOPUP_AMOUNT, `Maximum topup is ${MAX_WALLET_TOPUP_AMOUNT.toLocaleString()} ETB`),
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
    // M9 FIX: Add rate limiting for financial operations
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') || 'unknown';
    const rpsResult = await checkRpsLimit(
      'admin-wallet-topup',
      ip,
      ADMIN_FINANCIAL_OPS_RPS,
      ADMIN_FINANCIAL_OPS_BURST
    );
    if (!rpsResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please slow down.' },
        { status: 429 }
      );
    }

    // M1 FIX: Add CSRF validation
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

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
