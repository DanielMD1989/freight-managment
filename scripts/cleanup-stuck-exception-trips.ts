/**
 * Bug #10 backfill cleanup
 *
 * Walks every Trip currently in EXCEPTION state through to CANCELLED
 * with a cancelReason. This is a one-shot script for production cleanup
 * after the Bug #10 fix (commit 335cee6) ships.
 *
 * Pre-fix behavior: admin clicked "Cancel Trip" on /admin/trips/[id],
 * the UI sent {status:"CANCELLED"} without cancelReason, the API
 * rejected with 400 silently, and the trip stayed in EXCEPTION forever.
 *
 * This script:
 *   1. Lists every Trip with status=EXCEPTION older than 7 days
 *   2. For each, prompts (or with --yes flag, auto-confirms) cancellation
 *   3. PATCHes the trip to CANCELLED with the audit reason
 *      "Backfill: Bug #10 cleanup"
 *   4. Prints a summary count
 *
 * Usage:
 *   DATABASE_URL=... npx ts-node scripts/cleanup-stuck-exception-trips.ts
 *   DATABASE_URL=... npx ts-node scripts/cleanup-stuck-exception-trips.ts --yes
 *   DATABASE_URL=... npx ts-node scripts/cleanup-stuck-exception-trips.ts --dry-run
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as readline from "readline";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

const adapter = new PrismaPg(new Pool({ connectionString }));
const db = new PrismaClient({ adapter });

const args = new Set(process.argv.slice(2));
const AUTO_YES = args.has("--yes");
const DRY_RUN = args.has("--dry-run");
const STALE_DAYS = 7;

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function main() {
  console.log("Bug #10 backfill cleanup — stuck EXCEPTION trips");
  console.log("=================================================");
  console.log(
    `Mode: ${DRY_RUN ? "DRY RUN" : AUTO_YES ? "AUTO YES" : "INTERACTIVE"}`
  );
  console.log(`Stale threshold: ${STALE_DAYS} days`);
  console.log();

  const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);

  const stuck = await db.trip.findMany({
    where: {
      status: "EXCEPTION",
      exceptionAt: { lt: cutoff },
    },
    select: {
      id: true,
      status: true,
      exceptionAt: true,
      exceptionReason: true,
      load: {
        select: {
          id: true,
          pickupCity: true,
          deliveryCity: true,
          shipperId: true,
        },
      },
      truck: {
        select: { licensePlate: true, carrierId: true },
      },
    },
    orderBy: { exceptionAt: "asc" },
  });

  if (stuck.length === 0) {
    console.log("Nothing to clean up. Exiting.");
    await db.$disconnect();
    return;
  }

  console.log(`Found ${stuck.length} stuck EXCEPTION trip(s):`);
  for (const trip of stuck) {
    const ageDays = trip.exceptionAt
      ? Math.floor(
          (Date.now() - trip.exceptionAt.getTime()) / (24 * 60 * 60 * 1000)
        )
      : "?";
    console.log(
      `  - ${trip.id}  age=${ageDays}d  ${trip.load?.pickupCity}->${trip.load?.deliveryCity}  truck=${trip.truck?.licensePlate}  reason="${(trip.exceptionReason ?? "").slice(0, 60)}"`
    );
  }
  console.log();

  if (DRY_RUN) {
    console.log("DRY RUN — no writes performed.");
    await db.$disconnect();
    return;
  }

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const trip of stuck) {
    let go = AUTO_YES;
    if (!go) {
      const ans = await prompt(`Cancel trip ${trip.id}? [y/N] `);
      go = ans === "y" || ans === "yes";
    }

    if (!go) {
      skipped++;
      continue;
    }

    try {
      await db.trip.update({
        where: { id: trip.id },
        data: {
          status: "CANCELLED",
          cancelReason: "Backfill: Bug #10 cleanup",
          cancelledAt: new Date(),
        },
      });
      processed++;
      console.log(`  -> ${trip.id} CANCELLED`);
    } catch (err) {
      failed++;
      console.error(`  !! ${trip.id} failed:`, (err as Error).message);
    }
  }

  console.log();
  console.log(
    `Summary: processed=${processed} skipped=${skipped} failed=${failed}`
  );
  await db.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
