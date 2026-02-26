import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireActiveUser } from "@/lib/auth";
import { requirePermission, Permission } from "@/lib/rbac";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { z } from "zod";
import { zodErrorResponse } from "@/lib/validation";
import { Prisma } from "@prisma/client";

const withdrawSchema = z.object({
  amount: z.number().positive(),
  bankAccount: z.string().min(10),
  bankName: z.string().min(2),
  accountHolder: z.string().min(2),
});

// POST /api/financial/withdraw - Request withdrawal
export async function POST(request: NextRequest) {
  try {
    // CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    // Require ACTIVE user status for financial transactions
    const session = await requireActiveUser();
    await requirePermission(Permission.WITHDRAW_FUNDS);

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, firstName: true, lastName: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json(
        { error: "User does not belong to an organization" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = withdrawSchema.parse(body);

    // Wrap balance check + withdrawal creation in transaction to prevent race condition
    const withdrawalRequest = await db.$transaction(
      async (tx) => {
        // Get wallet and check balance atomically
        const wallet = await tx.financialAccount.findFirst({
          where: {
            organizationId: user.organizationId,
            accountType: {
              in: ["SHIPPER_WALLET", "CARRIER_WALLET"],
            },
          },
        });

        if (!wallet) {
          throw new Error("WALLET_NOT_FOUND");
        }

        if (parseFloat(wallet.balance.toString()) < validatedData.amount) {
          throw new Error("INSUFFICIENT_BALANCE");
        }

        // Create withdrawal request atomically with balance check
        const withdrawal = await tx.withdrawalRequest.create({
          data: {
            ...validatedData,
            requestedById: session.userId,
            status: "PENDING",
          },
        });

        return withdrawal;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return NextResponse.json({
      message: "Withdrawal request submitted successfully",
      withdrawalRequest,
    });
  } catch (error) {
    console.error("Withdrawal request error:", error);

    if (error instanceof z.ZodError) {
      return zodErrorResponse(error);
    }

    if (error instanceof Error) {
      if (error.message === "WALLET_NOT_FOUND") {
        return NextResponse.json(
          { error: "Wallet not found" },
          { status: 404 }
        );
      }
      if (error.message === "INSUFFICIENT_BALANCE") {
        return NextResponse.json(
          { error: "Insufficient balance" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/financial/withdraw - List withdrawal requests
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");

    const where: Prisma.WithdrawalRequestWhereInput = {};

    // Admin/Ops can see all withdrawals, others see only their own
    if (session.role !== "ADMIN" && session.role !== "PLATFORM_OPS") {
      where.requestedById = session.userId;
    }

    if (status) {
      where.status = status;
    }

    const withdrawals = await db.withdrawalRequest.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ withdrawals });
  } catch (error) {
    console.error("List withdrawals error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
