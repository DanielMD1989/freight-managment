/**
 * Backfill GpsDevice records for trucks that have imei set but no gpsDeviceId.
 *
 * Root cause: POST /api/trucks with IMEI used to set scalar GPS fields on the
 * truck (imei, gpsProvider, gpsStatus, etc.) but never created a GpsDevice
 * record or set gpsDeviceId. The truck-postings endpoint checks gpsDeviceId,
 * so these trucks could never be posted to the marketplace.
 *
 * Usage: npx tsx scripts/backfill-gps-devices.ts
 */

import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://danieldamitew@localhost:5432/freight_db?schema=public";

async function backfill() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Find trucks with imei but no gpsDeviceId
    const { rows: orphanedTrucks } = await pool.query(`
      SELECT id, imei, "gpsLastSeenAt", "gpsStatus"
      FROM trucks
      WHERE imei IS NOT NULL AND "gpsDeviceId" IS NULL
    `);

    console.log(
      `Found ${orphanedTrucks.length} truck(s) with IMEI but no gpsDeviceId`
    );

    if (orphanedTrucks.length === 0) {
      console.log("Nothing to backfill.");
      return;
    }

    let created = 0;
    let linked = 0;
    let errors = 0;

    for (const truck of orphanedTrucks) {
      try {
        // Check if a GpsDevice already exists with this imei
        const { rows: existing } = await pool.query(
          `SELECT id FROM gps_devices WHERE imei = $1`,
          [truck.imei]
        );

        let deviceId: string;

        if (existing.length > 0) {
          // GpsDevice exists — just link it
          deviceId = existing[0].id;
          console.log(
            `  Truck ${truck.id}: GpsDevice ${deviceId} already exists for IMEI ${truck.imei} — linking`
          );
          linked++;
        } else {
          // Create new GpsDevice
          const lastSeen = truck.gpsLastSeenAt || new Date();
          const { rows: newDevice } = await pool.query(
            `INSERT INTO gps_devices (id, imei, status, "lastSeenAt", "createdAt", "updatedAt")
             VALUES (
               'backfill_' || substr(md5(random()::text), 1, 20),
               $1, 'ACTIVE', $2, NOW(), NOW()
             )
             RETURNING id`,
            [truck.imei, lastSeen]
          );
          deviceId = newDevice[0].id;
          console.log(
            `  Truck ${truck.id}: Created GpsDevice ${deviceId} for IMEI ${truck.imei}`
          );
          created++;
        }

        // Link truck to GpsDevice
        await pool.query(`UPDATE trucks SET "gpsDeviceId" = $1 WHERE id = $2`, [
          deviceId,
          truck.id,
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  Truck ${truck.id}: ERROR — ${msg}`);
        errors++;
      }
    }

    console.log(`\n=== BACKFILL SUMMARY ===`);
    console.log(`Trucks processed:       ${orphanedTrucks.length}`);
    console.log(`GpsDevices created:     ${created}`);
    console.log(`GpsDevices linked:      ${linked}`);
    console.log(`Errors:                 ${errors}`);
  } finally {
    await pool.end();
  }
}

backfill().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
