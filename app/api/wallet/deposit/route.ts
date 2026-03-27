/**
 * Self-Service Wallet Deposit API (§8 M1)
 *
 * POST /api/wallet/deposit — Shipper/Carrier initiates a deposit request
 * GET  /api/wallet/deposit — List own deposit requests
 *
 * Blueprint §8: "Wallet Top-Up Methods: Bank Transfer Slip, Telebirr, M-Pesa"
 *
 * Flow:
 *   1. User submits deposit request (amount + method + optional slip/reference)
 *   2. System creates WalletDeposit with status=PENDING
 *   3. Admin reviews and approves via existing topup endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { z } from "zod";
import { zodErrorResponse } from "@/lib/validation";
import { handleApiError } from "@/lib/apiErrors";
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";
import {
  createNotificationForRole,
  NotificationType,
} from "@/lib/notifications";

const depositSchema = z.object({
  amount: z.number().positive("Amount must be positive").max(1_000_000),
  paymentMethod: z.enum(["BANK_TRANSFER_SLIP", "TELEBIRR", "MPESA"]),
  externalReference: z.string().max(200).optional(),
  slipFileUrl: z.string().url().max(500).optional(),
  notes: z.string().max(500).optional(),
});

/**
 * POST /api/wallet/deposit
 *
 * Create a deposit request. Status starts as PENDING.
 * Admin must approve before funds are credited.
 */
export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rpsResult = await checkRpsLimit(
      "wallet-deposit",
      ip,
      RPS_CONFIGS.write.rps,
      RPS_CONFIGS.write.burst
    );
    if (!rpsResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please slow down." },
        { status: 429 }
      );
    }

    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireActiveUser();

    // Only SHIPPER and CARRIER can deposit
    if (session.role !== "SHIPPER" && session.role !== "CARRIER") {
      return NextResponse.json(
        { error: "Only shippers and carriers can request deposits" },
        { status: 403 }
      );
    }

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "You must belong to an organization" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = depositSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const data = parsed.data;

    // Bank transfer requires slip
    if (data.paymentMethod === "BANK_TRANSFER_SLIP" && !data.slipFileUrl) {
      return NextResponse.json(
        { error: "Bank transfer deposits require a slip file URL" },
        { status: 400 }
      );
    }

    // Telebirr/M-Pesa require external reference
    if (
      (data.paymentMethod === "TELEBIRR" || data.paymentMethod === "MPESA") &&
      !data.externalReference
    ) {
      return NextResponse.json(
        { error: "Telebirr/M-Pesa deposits require a transaction reference" },
        { status: 400 }
      );
    }

    // Find the user's wallet
    const wallet = await db.financialAccount.findFirst({
      where: { organizationId: session.organizationId, isActive: true },
      select: { id: true },
    });

    if (!wallet) {
      return NextResponse.json(
        { error: "No active wallet found for your organization" },
        { status: 400 }
      );
    }

    // Create deposit request
    const deposit = await db.walletDeposit.create({
      data: {
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        slipFileUrl: data.slipFileUrl || null,
        externalReference: data.externalReference || null,
        notes: data.notes || null,
        financialAccountId: wallet.id,
        requestedById: session.userId,
      },
      select: {
        id: true,
        amount: true,
        paymentMethod: true,
        status: true,
        createdAt: true,
      },
    });

    // Notify admins of new deposit request
    createNotificationForRole({
      role: "ADMIN",
      type: NotificationType.DEPOSIT_REQUESTED,
      title: "New Deposit Request",
      message: `${session.role} deposited ${Number(data.amount).toLocaleString()} ETB via ${data.paymentMethod.replace(/_/g, " ")} — awaiting approval.`,
      metadata: {
        depositId: deposit.id,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        organizationId: session.organizationId,
      },
    }).catch((err) => console.error("Deposit notification failed:", err));

    return NextResponse.json(
      {
        message: "Deposit request submitted. Awaiting admin approval.",
        deposit,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "Deposit request error");
  }
}

/**
 * GET /api/wallet/deposit
 *
 * List deposit requests for the authenticated user's organization.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireActiveUser();

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "You must belong to an organization" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "20"))
    );

    const wallet = await db.financialAccount.findFirst({
      where: { organizationId: session.organizationId, isActive: true },
      select: { id: true },
    });

    if (!wallet) {
      return NextResponse.json({ deposits: [], total: 0 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { financialAccountId: wallet.id };
    if (status && ["PENDING", "CONFIRMED", "REJECTED"].includes(status)) {
      where.status = status;
    }

    const [deposits, total] = await Promise.all([
      db.walletDeposit.findMany({
        where,
        select: {
          id: true,
          amount: true,
          paymentMethod: true,
          status: true,
          externalReference: true,
          notes: true,
          rejectionReason: true,
          createdAt: true,
          approvedAt: true,
          rejectedAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.walletDeposit.count({ where }),
    ]);

    return NextResponse.json({
      deposits,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return handleApiError(error, "List deposits error");
  }
}
