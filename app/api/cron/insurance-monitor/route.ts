/**
 * Insurance Monitoring Cron Job (P1)
 *
 * POST /api/cron/insurance-monitor
 *
 * Runs daily. Checks all trucks with approved insurance documents
 * for upcoming expirations and expired policies.
 *
 * Actions:
 *   30 days: INSURANCE_EXPIRING_SOON to carrier
 *   7 days:  INSURANCE_EXPIRING_URGENT to carrier + admin
 *   1 day:   INSURANCE_EXPIRING_FINAL to carrier + admin
 *   0 days:  INSURANCE_EXPIRED — update truck, expire posting, notify
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  notifyOrganization,
  createNotificationForRole,
  NotificationType,
} from "@/lib/notifications";
import { syncTruckInsuranceStatus } from "@/lib/insuranceValidation";

export async function POST(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const summary = {
      processed: 0,
      expiringSoon: 0,
      expiringUrgent: 0,
      expiringFinal: 0,
      expired: 0,
      errors: 0,
    };

    // Find all trucks with approved insurance docs that have expiresAt set
    const trucksWithInsurance = await db.truck.findMany({
      where: {
        insuranceExpiresAt: { not: null },
        insuranceStatus: { in: ["VALID", "EXPIRING"] },
      },
      select: {
        id: true,
        licensePlate: true,
        insuranceStatus: true,
        insuranceExpiresAt: true,
        carrierId: true,
        carrier: { select: { name: true } },
      },
    });

    for (const truck of trucksWithInsurance) {
      try {
        summary.processed++;
        const expiresAt = new Date(truck.insuranceExpiresAt!);
        const msRemaining = expiresAt.getTime() - now.getTime();
        const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));

        const meta = {
          truckId: truck.id,
          licensePlate: truck.licensePlate,
          carrierId: truck.carrierId,
          expiresAt: expiresAt.toISOString(),
          daysRemaining,
        };

        if (daysRemaining <= 0) {
          // EXPIRED — sync status, expire posting, notify
          await syncTruckInsuranceStatus(truck.id);

          await db.truckPosting.updateMany({
            where: { truckId: truck.id, status: "ACTIVE" },
            data: { status: "EXPIRED", updatedAt: now },
          });

          await notifyOrganization({
            organizationId: truck.carrierId,
            type: NotificationType.INSURANCE_EXPIRED,
            title: `Insurance Expired: ${truck.licensePlate}`,
            message: `Insurance for truck ${truck.licensePlate} has expired. Upload a renewed certificate to re-list.`,
            metadata: meta,
          });

          await createNotificationForRole({
            role: "ADMIN",
            type: NotificationType.INSURANCE_EXPIRED,
            title: `Truck Insurance Expired: ${truck.licensePlate}`,
            message: `${truck.carrier.name} truck ${truck.licensePlate} insurance expired. Active postings removed.`,
            metadata: meta,
          });

          summary.expired++;
        } else if (daysRemaining <= 1) {
          await notifyOrganization({
            organizationId: truck.carrierId,
            type: NotificationType.INSURANCE_EXPIRING_FINAL,
            title: `Insurance Expires Tomorrow: ${truck.licensePlate}`,
            message: `Insurance for truck ${truck.licensePlate} expires tomorrow. Upload renewed certificate now.`,
            metadata: meta,
          });
          await createNotificationForRole({
            role: "ADMIN",
            type: NotificationType.INSURANCE_EXPIRING_FINAL,
            title: `Truck Insurance Expires Tomorrow: ${truck.licensePlate}`,
            message: `${truck.carrier.name} truck ${truck.licensePlate} insurance expires in 1 day.`,
            metadata: meta,
          });
          await syncTruckInsuranceStatus(truck.id);
          summary.expiringFinal++;
        } else if (daysRemaining <= 7) {
          await notifyOrganization({
            organizationId: truck.carrierId,
            type: NotificationType.INSURANCE_EXPIRING_URGENT,
            title: `Insurance Expiring Soon: ${truck.licensePlate}`,
            message: `Insurance for truck ${truck.licensePlate} expires in ${daysRemaining} days. Renew now.`,
            metadata: meta,
          });
          await createNotificationForRole({
            role: "ADMIN",
            type: NotificationType.INSURANCE_EXPIRING_URGENT,
            title: `Truck Insurance Expiring: ${truck.licensePlate}`,
            message: `${truck.carrier.name} truck ${truck.licensePlate} insurance expires in ${daysRemaining} days.`,
            metadata: meta,
          });
          await syncTruckInsuranceStatus(truck.id);
          summary.expiringUrgent++;
        } else if (daysRemaining <= 30) {
          await notifyOrganization({
            organizationId: truck.carrierId,
            type: NotificationType.INSURANCE_EXPIRING_SOON,
            title: `Insurance Renewal Reminder: ${truck.licensePlate}`,
            message: `Insurance for truck ${truck.licensePlate} expires in ${daysRemaining} days.`,
            metadata: meta,
          });
          await syncTruckInsuranceStatus(truck.id);
          summary.expiringSoon++;
        }
      } catch (err) {
        console.error(
          `[Insurance Monitor] Error processing truck ${truck.id}:`,
          err
        );
        summary.errors++;
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      ...summary,
    });
  } catch (error) {
    console.error("[Insurance Monitor] Error:", error);
    return NextResponse.json(
      { error: "Insurance monitoring failed" },
      { status: 500 }
    );
  }
}
