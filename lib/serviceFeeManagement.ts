/**
 * Service Fee Management Module
 *
 * Service Fee Implementation - Task 2
 *
 * Reserve/deduct/refund service fees via wallet
 * - Reserve fee from shipper wallet when load is ASSIGNED
 * - Deduct fee to platform when load is COMPLETED
 * - Refund fee to shipper when load is CANCELLED
 */

import { db } from './db';
import { Decimal } from 'decimal.js';
import { ServiceFeeStatus } from '@prisma/client';
import { calculateServiceFee, findMatchingCorridor } from './serviceFeeCalculation';

export interface ServiceFeeReserveResult {
  success: boolean;
  serviceFee: Decimal;
  shipperBalance: Decimal;
  error?: string;
  transactionId?: string;
}

export interface ServiceFeeDeductResult {
  success: boolean;
  serviceFee: Decimal;
  platformRevenue: Decimal;
  error?: string;
  transactionId?: string;
}

export interface ServiceFeeRefundResult {
  success: boolean;
  serviceFee: Decimal;
  shipperBalance: Decimal;
  error?: string;
  transactionId?: string;
}

/**
 * Reserve service fee from shipper wallet when load is assigned
 *
 * Flow:
 * 1. Calculate service fee from corridor
 * 2. Check shipper wallet balance
 * 3. Debit shipper wallet
 * 4. Credit escrow account (separate from freight escrow)
 * 5. Update load.serviceFeeStatus = RESERVED
 *
 * @param loadId - Load ID to reserve service fee for
 * @returns ServiceFeeReserveResult with success status and amounts
 */
export async function reserveServiceFee(loadId: string): Promise<ServiceFeeReserveResult> {
  // Get load details
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      shipperId: true,
      serviceFeeEtb: true,
      serviceFeeStatus: true,
      corridorId: true,
      corridor: true,
      pickupLocation: {
        select: { region: true },
      },
      deliveryLocation: {
        select: { region: true },
      },
      pickupCity: true,
      deliveryCity: true,
      shipper: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!load) {
    return {
      success: false,
      serviceFee: new Decimal(0),
      shipperBalance: new Decimal(0),
      error: 'Load not found',
    };
  }

  // Check if already reserved
  if (load.serviceFeeStatus === 'RESERVED' || load.serviceFeeStatus === 'DEDUCTED') {
    return {
      success: false,
      serviceFee: new Decimal(0),
      shipperBalance: new Decimal(0),
      error: `Service fee already ${load.serviceFeeStatus.toLowerCase()}`,
    };
  }

  // Calculate service fee if not already calculated
  let serviceFeeAmount: Decimal;
  let corridorId = load.corridorId;

  if (load.serviceFeeEtb) {
    serviceFeeAmount = new Decimal(load.serviceFeeEtb);
  } else {
    // Calculate from corridor
    const feeCalc = await calculateServiceFee(loadId);

    if (!feeCalc) {
      // No matching corridor - skip service fee
      await db.load.update({
        where: { id: loadId },
        data: {
          serviceFeeStatus: 'WAIVED',
          serviceFeeEtb: 0,
        },
      });

      return {
        success: true,
        serviceFee: new Decimal(0),
        shipperBalance: new Decimal(0),
        error: 'No matching corridor found - service fee waived',
      };
    }

    serviceFeeAmount = new Decimal(feeCalc.finalFee);
    corridorId = feeCalc.corridorId;
  }

  // Skip if fee is zero
  if (serviceFeeAmount.isZero()) {
    await db.load.update({
      where: { id: loadId },
      data: {
        serviceFeeStatus: 'WAIVED',
        serviceFeeEtb: 0,
        corridorId,
      },
    });

    return {
      success: true,
      serviceFee: new Decimal(0),
      shipperBalance: new Decimal(0),
    };
  }

  // Get shipper wallet
  const shipperWallet = await db.financialAccount.findFirst({
    where: {
      organizationId: load.shipperId,
      accountType: 'SHIPPER_WALLET',
      isActive: true,
    },
    select: {
      id: true,
      balance: true,
    },
  });

  if (!shipperWallet) {
    return {
      success: false,
      serviceFee: serviceFeeAmount,
      shipperBalance: new Decimal(0),
      error: 'Shipper wallet not found',
    };
  }

  const shipperBalance = new Decimal(shipperWallet.balance);

  // Check sufficient balance
  if (shipperBalance.lessThan(serviceFeeAmount)) {
    return {
      success: false,
      serviceFee: serviceFeeAmount,
      shipperBalance,
      error: `Insufficient balance for service fee. Required: ${serviceFeeAmount.toFixed(2)} ETB, Available: ${shipperBalance.toFixed(2)} ETB`,
    };
  }

  // Get or create escrow account for service fees
  let escrowAccount = await db.financialAccount.findFirst({
    where: {
      accountType: 'ESCROW',
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!escrowAccount) {
    escrowAccount = await db.financialAccount.create({
      data: {
        accountType: 'ESCROW',
        balance: 0,
        currency: 'ETB',
        isActive: true,
      },
      select: {
        id: true,
      },
    });
  }

  // Create journal entry for service fee reserve
  const journalEntry = await db.journalEntry.create({
    data: {
      transactionType: 'SERVICE_FEE_RESERVE',
      description: `Service fee reserve for load ${loadId} - ${load.shipper.name}`,
      reference: loadId,
      loadId,
      metadata: {
        serviceFee: serviceFeeAmount.toFixed(2),
        corridorId,
        type: 'SERVICE_FEE',
      },
      lines: {
        create: [
          // Debit shipper wallet
          {
            amount: serviceFeeAmount,
            isDebit: true,
            accountId: shipperWallet.id,
          },
          // Credit escrow account
          {
            amount: serviceFeeAmount,
            isDebit: false,
            accountId: escrowAccount.id,
          },
        ],
      },
    },
    select: {
      id: true,
    },
  });

  // Update account balances
  await Promise.all([
    db.financialAccount.update({
      where: { id: shipperWallet.id },
      data: {
        balance: {
          decrement: serviceFeeAmount.toNumber(),
        },
      },
    }),
    db.financialAccount.update({
      where: { id: escrowAccount.id },
      data: {
        balance: {
          increment: serviceFeeAmount.toNumber(),
        },
      },
    }),
  ]);

  // Update load with service fee info
  await db.load.update({
    where: { id: loadId },
    data: {
      corridorId,
      serviceFeeEtb: serviceFeeAmount.toNumber(),
      serviceFeeStatus: 'RESERVED',
      serviceFeeReservedAt: new Date(),
    },
  });

  return {
    success: true,
    serviceFee: serviceFeeAmount,
    shipperBalance: shipperBalance.sub(serviceFeeAmount),
    transactionId: journalEntry.id,
  };
}

/**
 * Deduct service fee to platform when load is completed
 *
 * Flow:
 * 1. Verify load has reserved service fee
 * 2. Debit escrow account
 * 3. Credit platform revenue
 * 4. Update load.serviceFeeStatus = DEDUCTED
 *
 * @param loadId - Load ID to deduct service fee for
 * @returns ServiceFeeDeductResult with success status and amounts
 */
export async function deductServiceFee(loadId: string): Promise<ServiceFeeDeductResult> {
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      serviceFeeEtb: true,
      serviceFeeStatus: true,
      shipper: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!load) {
    return {
      success: false,
      serviceFee: new Decimal(0),
      platformRevenue: new Decimal(0),
      error: 'Load not found',
    };
  }

  // Verify fee is reserved
  if (load.serviceFeeStatus !== 'RESERVED') {
    if (load.serviceFeeStatus === 'DEDUCTED') {
      return {
        success: false,
        serviceFee: new Decimal(0),
        platformRevenue: new Decimal(0),
        error: 'Service fee already deducted',
      };
    }

    if (load.serviceFeeStatus === 'WAIVED') {
      return {
        success: true,
        serviceFee: new Decimal(0),
        platformRevenue: new Decimal(0),
        error: 'Service fee was waived - nothing to deduct',
      };
    }

    return {
      success: false,
      serviceFee: new Decimal(0),
      platformRevenue: new Decimal(0),
      error: `Cannot deduct fee - current status: ${load.serviceFeeStatus}`,
    };
  }

  const serviceFeeAmount = new Decimal(load.serviceFeeEtb || 0);

  if (serviceFeeAmount.isZero()) {
    await db.load.update({
      where: { id: loadId },
      data: {
        serviceFeeStatus: 'DEDUCTED',
        serviceFeeDeductedAt: new Date(),
      },
    });

    return {
      success: true,
      serviceFee: new Decimal(0),
      platformRevenue: new Decimal(0),
    };
  }

  // Get accounts
  const [escrowAccount, platformAccount] = await Promise.all([
    db.financialAccount.findFirst({
      where: {
        accountType: 'ESCROW',
        isActive: true,
      },
      select: {
        id: true,
        balance: true,
      },
    }),
    db.financialAccount.findFirst({
      where: {
        accountType: 'PLATFORM_REVENUE',
        isActive: true,
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (!escrowAccount) {
    return {
      success: false,
      serviceFee: serviceFeeAmount,
      platformRevenue: new Decimal(0),
      error: 'Escrow account not found',
    };
  }

  // Create or get platform revenue account
  let platformAccountId = platformAccount?.id;
  if (!platformAccountId) {
    const newPlatformAccount = await db.financialAccount.create({
      data: {
        accountType: 'PLATFORM_REVENUE',
        balance: 0,
        currency: 'ETB',
        isActive: true,
      },
      select: {
        id: true,
      },
    });
    platformAccountId = newPlatformAccount.id;
  }

  // Check escrow balance
  const escrowBalance = new Decimal(escrowAccount.balance);
  if (escrowBalance.lessThan(serviceFeeAmount)) {
    return {
      success: false,
      serviceFee: serviceFeeAmount,
      platformRevenue: new Decimal(0),
      error: `Insufficient escrow balance. Required: ${serviceFeeAmount.toFixed(2)} ETB, Available: ${escrowBalance.toFixed(2)} ETB`,
    };
  }

  // Create journal entry for service fee deduction
  const journalEntry = await db.journalEntry.create({
    data: {
      transactionType: 'SERVICE_FEE_DEDUCT',
      description: `Service fee deduction for load ${loadId} - ${load.shipper.name}`,
      reference: loadId,
      loadId,
      metadata: {
        serviceFee: serviceFeeAmount.toFixed(2),
        type: 'SERVICE_FEE',
      },
      lines: {
        create: [
          // Debit escrow account
          {
            amount: serviceFeeAmount,
            isDebit: true,
            accountId: escrowAccount.id,
          },
          // Credit platform revenue
          {
            amount: serviceFeeAmount,
            isDebit: false,
            accountId: platformAccountId,
          },
        ],
      },
    },
    select: {
      id: true,
    },
  });

  // Update account balances
  await Promise.all([
    db.financialAccount.update({
      where: { id: escrowAccount.id },
      data: {
        balance: {
          decrement: serviceFeeAmount.toNumber(),
        },
      },
    }),
    db.financialAccount.update({
      where: { id: platformAccountId },
      data: {
        balance: {
          increment: serviceFeeAmount.toNumber(),
        },
      },
    }),
  ]);

  // Update load
  await db.load.update({
    where: { id: loadId },
    data: {
      serviceFeeStatus: 'DEDUCTED',
      serviceFeeDeductedAt: new Date(),
    },
  });

  return {
    success: true,
    serviceFee: serviceFeeAmount,
    platformRevenue: serviceFeeAmount,
    transactionId: journalEntry.id,
  };
}

/**
 * Refund service fee to shipper when load is cancelled
 *
 * @param loadId - Load ID to refund service fee for
 * @returns ServiceFeeRefundResult with refund details
 */
export async function refundServiceFee(loadId: string): Promise<ServiceFeeRefundResult> {
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      shipperId: true,
      serviceFeeEtb: true,
      serviceFeeStatus: true,
      shipper: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!load) {
    return {
      success: false,
      serviceFee: new Decimal(0),
      shipperBalance: new Decimal(0),
      error: 'Load not found',
    };
  }

  // Only refund if fee was reserved
  if (load.serviceFeeStatus !== 'RESERVED') {
    if (load.serviceFeeStatus === 'REFUNDED') {
      return {
        success: false,
        serviceFee: new Decimal(0),
        shipperBalance: new Decimal(0),
        error: 'Service fee already refunded',
      };
    }

    if (load.serviceFeeStatus === 'PENDING' || load.serviceFeeStatus === 'WAIVED') {
      return {
        success: true,
        serviceFee: new Decimal(0),
        shipperBalance: new Decimal(0),
        error: 'No service fee to refund',
      };
    }

    if (load.serviceFeeStatus === 'DEDUCTED') {
      return {
        success: false,
        serviceFee: new Decimal(0),
        shipperBalance: new Decimal(0),
        error: 'Cannot refund - service fee already deducted to platform',
      };
    }

    return {
      success: false,
      serviceFee: new Decimal(0),
      shipperBalance: new Decimal(0),
      error: `Cannot refund fee - current status: ${load.serviceFeeStatus}`,
    };
  }

  const serviceFeeAmount = new Decimal(load.serviceFeeEtb || 0);

  if (serviceFeeAmount.isZero()) {
    await db.load.update({
      where: { id: loadId },
      data: {
        serviceFeeStatus: 'REFUNDED',
        serviceFeeRefundedAt: new Date(),
      },
    });

    return {
      success: true,
      serviceFee: new Decimal(0),
      shipperBalance: new Decimal(0),
    };
  }

  // Get accounts
  const [escrowAccount, shipperWallet] = await Promise.all([
    db.financialAccount.findFirst({
      where: {
        accountType: 'ESCROW',
        isActive: true,
      },
      select: {
        id: true,
        balance: true,
      },
    }),
    db.financialAccount.findFirst({
      where: {
        organizationId: load.shipperId,
        accountType: 'SHIPPER_WALLET',
        isActive: true,
      },
      select: {
        id: true,
        balance: true,
      },
    }),
  ]);

  if (!escrowAccount || !shipperWallet) {
    return {
      success: false,
      serviceFee: serviceFeeAmount,
      shipperBalance: new Decimal(0),
      error: 'Accounts not found',
    };
  }

  // Create journal entry for refund
  const journalEntry = await db.journalEntry.create({
    data: {
      transactionType: 'SERVICE_FEE_REFUND',
      description: `Service fee refund for load ${loadId} - ${load.shipper.name}`,
      reference: loadId,
      loadId,
      metadata: {
        serviceFee: serviceFeeAmount.toFixed(2),
        type: 'SERVICE_FEE',
        reason: 'Load cancelled',
      },
      lines: {
        create: [
          // Debit escrow
          {
            amount: serviceFeeAmount,
            isDebit: true,
            accountId: escrowAccount.id,
          },
          // Credit shipper wallet
          {
            amount: serviceFeeAmount,
            isDebit: false,
            accountId: shipperWallet.id,
          },
        ],
      },
    },
    select: {
      id: true,
    },
  });

  // Update balances
  await Promise.all([
    db.financialAccount.update({
      where: { id: escrowAccount.id },
      data: {
        balance: {
          decrement: serviceFeeAmount.toNumber(),
        },
      },
    }),
    db.financialAccount.update({
      where: { id: shipperWallet.id },
      data: {
        balance: {
          increment: serviceFeeAmount.toNumber(),
        },
      },
    }),
  ]);

  // Update load
  await db.load.update({
    where: { id: loadId },
    data: {
      serviceFeeStatus: 'REFUNDED',
      serviceFeeRefundedAt: new Date(),
    },
  });

  const newBalance = new Decimal(shipperWallet.balance).add(serviceFeeAmount);

  return {
    success: true,
    serviceFee: serviceFeeAmount,
    shipperBalance: newBalance,
    transactionId: journalEntry.id,
  };
}

/**
 * Assign corridor to a load and calculate service fee
 * (Called when load is posted with route information)
 */
export async function assignCorridorToLoad(loadId: string): Promise<{
  success: boolean;
  corridorId?: string;
  serviceFee?: number;
  error?: string;
}> {
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      pickupLocation: {
        select: { region: true },
      },
      deliveryLocation: {
        select: { region: true },
      },
      pickupCity: true,
      deliveryCity: true,
      corridorId: true,
    },
  });

  if (!load) {
    return { success: false, error: 'Load not found' };
  }

  if (load.corridorId) {
    return { success: true, corridorId: load.corridorId };
  }

  // Determine regions
  const originRegion = load.pickupLocation?.region || load.pickupCity;
  const destinationRegion = load.deliveryLocation?.region || load.deliveryCity;

  if (!originRegion || !destinationRegion) {
    return { success: true, error: 'No region information available' };
  }

  // Find matching corridor
  const match = await findMatchingCorridor(originRegion, destinationRegion);

  if (!match) {
    return { success: true, error: 'No matching corridor found' };
  }

  // Calculate fee
  const feeCalc = await calculateServiceFee(loadId);

  // Update load with corridor
  await db.load.update({
    where: { id: loadId },
    data: {
      corridorId: match.corridor.id,
      serviceFeeEtb: feeCalc?.finalFee || 0,
    },
  });

  return {
    success: true,
    corridorId: match.corridor.id,
    serviceFee: feeCalc?.finalFee || 0,
  };
}
