/**
 * Sprint 8: Escrow Management System
 *
 * Automatic fund hold/release on load lifecycle
 * - Hold shipper funds in escrow when load is assigned
 * - Release funds to carrier when load is delivered
 *
 * Note: Service fees are handled separately via Corridor-based pricing
 * (see lib/serviceFeeManagement.ts)
 */

import { db } from './db';
import { Decimal } from 'decimal.js';

export interface EscrowHoldResult {
  success: boolean;
  escrowAmount: Decimal;
  shipperBalance: Decimal;
  error?: string;
  transactionId?: string;
}

export interface EscrowReleaseResult {
  success: boolean;
  carrierPayout: Decimal;
  platformRevenue: Decimal;
  error?: string;
  transactionId?: string;
}

/**
 * Hold funds in escrow when load is assigned
 *
 * Flow:
 * 1. Get total fare amount
 * 2. Check shipper wallet balance
 * 3. Debit shipper wallet
 * 4. Credit escrow account
 * 5. Update load.escrowFunded = true
 *
 * @param loadId - Load ID to hold funds for
 * @returns EscrowHoldResult with success status and amounts
 */
export async function holdFundsInEscrow(loadId: string): Promise<EscrowHoldResult> {
  // Get load details
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      shipperId: true,
      totalFareEtb: true,
      rate: true,
      escrowFunded: true,
      status: true,
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
      escrowAmount: new Decimal(0),
      shipperBalance: new Decimal(0),
      error: 'Load not found',
    };
  }

  // Check if already funded
  if (load.escrowFunded) {
    return {
      success: false,
      escrowAmount: new Decimal(0),
      shipperBalance: new Decimal(0),
      error: 'Load already funded in escrow',
    };
  }

  // Get total fare (use totalFareEtb if available, otherwise fall back to rate)
  const totalFare = load.totalFareEtb
    ? new Decimal(load.totalFareEtb)
    : new Decimal(load.rate);

  // Escrow amount = just the fare (service fees are handled separately)
  const escrowAmount = totalFare;

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
      escrowAmount,
      shipperBalance: new Decimal(0),
      error: 'Shipper wallet not found',
    };
  }

  const shipperBalance = new Decimal(shipperWallet.balance);

  // Check sufficient balance
  if (shipperBalance.lessThan(escrowAmount)) {
    return {
      success: false,
      escrowAmount,
      shipperBalance,
      error: `Insufficient balance. Required: ${escrowAmount.toFixed(2)} ETB, Available: ${shipperBalance.toFixed(2)} ETB`,
    };
  }

  // Get or create escrow account
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
    // Create escrow account if doesn't exist
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

  // Create journal entry for escrow hold
  const journalEntry = await db.journalEntry.create({
    data: {
      transactionType: 'ESCROW_FUND',
      description: `Escrow hold for load ${loadId} - ${load.shipper.name}`,
      reference: loadId,
      loadId,
      metadata: {
        totalFare: totalFare.toFixed(2),
        escrowAmount: escrowAmount.toFixed(2),
      },
      lines: {
        create: [
          // Debit shipper wallet
          {
            amount: escrowAmount,
            isDebit: true,
            accountId: shipperWallet.id,
          },
          // Credit escrow account
          {
            amount: escrowAmount,
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
          decrement: escrowAmount.toNumber(),
        },
      },
    }),
    db.financialAccount.update({
      where: { id: escrowAccount.id },
      data: {
        balance: {
          increment: escrowAmount.toNumber(),
        },
      },
    }),
  ]);

  // Update load escrow status
  await db.load.update({
    where: { id: loadId },
    data: {
      escrowFunded: true,
      escrowAmount: escrowAmount.toNumber(),
    },
  });

  return {
    success: true,
    escrowAmount,
    shipperBalance: shipperBalance.sub(escrowAmount),
    transactionId: journalEntry.id,
  };
}

/**
 * Release funds from escrow when load is delivered
 *
 * Flow:
 * 1. Verify load is delivered and POD verified
 * 2. Debit escrow account
 * 3. Credit carrier wallet (full fare)
 * 4. Update load.settlementStatus = 'PAID'
 *
 * Note: Service fees are deducted separately via lib/serviceFeeManagement.ts
 *
 * @param loadId - Load ID to release funds for
 * @returns EscrowReleaseResult with success status and amounts
 */
export async function releaseFundsFromEscrow(loadId: string): Promise<EscrowReleaseResult> {
  // Get load details
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      shipperId: true,
      assignedTruckId: true,
      assignedTruck: {
        select: {
          carrierId: true,
          carrier: {
            select: {
              name: true,
            },
          },
        },
      },
      totalFareEtb: true,
      rate: true,
      escrowFunded: true,
      escrowAmount: true,
      podVerified: true,
      status: true,
      settlementStatus: true,
    },
  });

  if (!load) {
    return {
      success: false,
      carrierPayout: new Decimal(0),
      platformRevenue: new Decimal(0),
      error: 'Load not found',
    };
  }

  // Validation checks
  if (!load.escrowFunded) {
    return {
      success: false,
      carrierPayout: new Decimal(0),
      platformRevenue: new Decimal(0),
      error: 'Load not funded in escrow',
    };
  }

  if (!load.podVerified) {
    return {
      success: false,
      carrierPayout: new Decimal(0),
      platformRevenue: new Decimal(0),
      error: 'POD not verified - cannot release funds',
    };
  }

  if (load.settlementStatus === 'PAID') {
    return {
      success: false,
      carrierPayout: new Decimal(0),
      platformRevenue: new Decimal(0),
      error: 'Load already settled',
    };
  }

  if (!load.assignedTruck?.carrierId) {
    return {
      success: false,
      carrierPayout: new Decimal(0),
      platformRevenue: new Decimal(0),
      error: 'No carrier assigned',
    };
  }

  // Get total fare - carrier receives full amount
  const totalFare = load.totalFareEtb
    ? new Decimal(load.totalFareEtb)
    : new Decimal(load.rate);

  // Carrier payout = full fare (service fees are handled separately)
  const carrierPayout = totalFare;

  // Get accounts
  const [escrowAccount, carrierWallet] = await Promise.all([
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
        organizationId: load.assignedTruck.carrierId,
        accountType: 'CARRIER_WALLET',
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
      carrierPayout,
      platformRevenue: new Decimal(0),
      error: 'Escrow account not found',
    };
  }

  if (!carrierWallet) {
    return {
      success: false,
      carrierPayout,
      platformRevenue: new Decimal(0),
      error: 'Carrier wallet not found',
    };
  }

  // Amount to release from escrow
  const escrowReleaseAmount = new Decimal(load.escrowAmount || 0);

  // Check escrow has sufficient balance
  const escrowBalance = new Decimal(escrowAccount.balance);
  if (escrowBalance.lessThan(escrowReleaseAmount)) {
    return {
      success: false,
      carrierPayout,
      platformRevenue: new Decimal(0),
      error: `Insufficient escrow balance. Required: ${escrowReleaseAmount.toFixed(2)} ETB, Available: ${escrowBalance.toFixed(2)} ETB`,
    };
  }

  // Create journal entry for escrow release
  const journalEntry = await db.journalEntry.create({
    data: {
      transactionType: 'ESCROW_RELEASE',
      description: `Escrow release for load ${loadId} - ${load.assignedTruck.carrier.name}`,
      reference: loadId,
      loadId,
      metadata: {
        totalFare: totalFare.toFixed(2),
        carrierPayout: carrierPayout.toFixed(2),
      },
      lines: {
        create: [
          // Debit escrow account (full amount)
          {
            amount: escrowReleaseAmount,
            isDebit: true,
            accountId: escrowAccount.id,
          },
          // Credit carrier wallet (full payout)
          {
            amount: carrierPayout,
            isDebit: false,
            accountId: carrierWallet.id,
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
          decrement: escrowReleaseAmount.toNumber(),
        },
      },
    }),
    db.financialAccount.update({
      where: { id: carrierWallet.id },
      data: {
        balance: {
          increment: carrierPayout.toNumber(),
        },
      },
    }),
  ]);

  // Update load settlement status
  await db.load.update({
    where: { id: loadId },
    data: {
      settlementStatus: 'PAID',
      settledAt: new Date(),
    },
  });

  return {
    success: true,
    carrierPayout,
    platformRevenue: new Decimal(0), // Service fees handled separately
    transactionId: journalEntry.id,
  };
}

/**
 * Refund escrowed funds back to shipper (e.g., if load is cancelled)
 *
 * @param loadId - Load ID to refund
 * @returns EscrowHoldResult with refund details
 */
export async function refundEscrowFunds(loadId: string): Promise<EscrowHoldResult> {
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      shipperId: true,
      escrowFunded: true,
      escrowAmount: true,
      status: true,
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
      escrowAmount: new Decimal(0),
      shipperBalance: new Decimal(0),
      error: 'Load not found',
    };
  }

  if (!load.escrowFunded) {
    return {
      success: false,
      escrowAmount: new Decimal(0),
      shipperBalance: new Decimal(0),
      error: 'Load not funded in escrow',
    };
  }

  const escrowAmount = new Decimal(load.escrowAmount || 0);

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
      escrowAmount,
      shipperBalance: new Decimal(0),
      error: 'Accounts not found',
    };
  }

  // Create journal entry for refund
  const journalEntry = await db.journalEntry.create({
    data: {
      transactionType: 'REFUND',
      description: `Escrow refund for load ${loadId} - ${load.shipper.name}`,
      reference: loadId,
      loadId,
      metadata: {
        escrowAmount: escrowAmount.toFixed(2),
        reason: `Load ${load.status}`,
      },
      lines: {
        create: [
          // Debit escrow
          {
            amount: escrowAmount,
            isDebit: true,
            accountId: escrowAccount.id,
          },
          // Credit shipper wallet
          {
            amount: escrowAmount,
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
          decrement: escrowAmount.toNumber(),
        },
      },
    }),
    db.financialAccount.update({
      where: { id: shipperWallet.id },
      data: {
        balance: {
          increment: escrowAmount.toNumber(),
        },
      },
    }),
  ]);

  // Update load
  await db.load.update({
    where: { id: loadId },
    data: {
      escrowFunded: false,
      escrowAmount: 0,
      settlementStatus: 'REFUNDED',
    },
  });

  const newBalance = new Decimal(shipperWallet.balance).add(escrowAmount);

  return {
    success: true,
    escrowAmount,
    shipperBalance: newBalance,
    transactionId: journalEntry.id,
  };
}
