export const dynamic = "force-dynamic";
/**
 * CDL Expiry Warning Cron Job
 *
 * POST /api/cron/cdl-expiry
 *
 * Runs daily. Checks all DriverProfiles for upcoming CDL and medical
 * certificate expirations. Notifies driver + carrier org at 30/14/7/0 days.
 * Mirrors insurance-monitor pattern.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createNotification, notifyOrganization } from "@/lib/notifications";

/** Day thresholds and corresponding urgency labels */
const BRACKETS = [
  { maxDays: 0, label: "has expired" },
  { maxDays: 7, label: "expiring soon — 7 days" },
  { maxDays: 14, label: "expires in 14 days" },
  { maxDays: 30, label: "expires in 30 days" },
] as const;

function getBracket(daysRemaining: number) {
  if (daysRemaining <= 0) return BRACKETS[0];
  if (daysRemaining <= 7) return BRACKETS[1];
  if (daysRemaining <= 14) return BRACKETS[2];
  if (daysRemaining <= 30) return BRACKETS[3];
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 401 }
      );
    }

    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const thirtyDaysFromNow = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000
    );

    let checked = 0;
    let notifications = 0;

    // Find all driver profiles with CDL or medical cert expiring within 30 days
    const profiles = await db.driverProfile.findMany({
      where: {
        OR: [
          {
            cdlExpiry: { not: null, lte: thirtyDaysFromNow },
          },
          {
            medicalCertExp: { not: null, lte: thirtyDaysFromNow },
          },
        ],
      },
      select: {
        userId: true,
        cdlExpiry: true,
        medicalCertExp: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            organizationId: true,
          },
        },
      },
    });

    for (const profile of profiles) {
      checked++;
      const driverName =
        [profile.user.firstName, profile.user.lastName]
          .filter(Boolean)
          .join(" ") || "Driver";
      const orgId = profile.user.organizationId;

      // Check CDL expiry
      if (profile.cdlExpiry) {
        const msRemaining =
          new Date(profile.cdlExpiry).getTime() - now.getTime();
        const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
        const bracket = getBracket(daysRemaining);

        if (bracket) {
          const title = `CDL ${bracket.label}`;
          const message = `${driverName}'s CDL ${bracket.label}.`;

          await createNotification({
            userId: profile.userId,
            type: "CDL_EXPIRY_WARNING",
            title,
            message,
            metadata: {
              driverId: profile.userId,
              expiryType: "CDL",
              daysRemaining,
            },
          }).catch(console.error);
          notifications++;

          if (orgId) {
            await notifyOrganization({
              organizationId: orgId,
              type: "CDL_EXPIRY_WARNING",
              title: `Driver CDL ${bracket.label}`,
              message,
              metadata: {
                driverId: profile.userId,
                expiryType: "CDL",
                daysRemaining,
              },
            }).catch(console.error);
            notifications++;
          }
        }
      }

      // Check medical certificate expiry
      if (profile.medicalCertExp) {
        const msRemaining =
          new Date(profile.medicalCertExp).getTime() - now.getTime();
        const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
        const bracket = getBracket(daysRemaining);

        if (bracket) {
          const label = bracket.label.replace("CDL", "Medical Certificate");
          const title = `Medical Certificate ${label}`;
          const message = `${driverName}'s medical certificate ${label}.`;

          await createNotification({
            userId: profile.userId,
            type: "CDL_EXPIRY_WARNING",
            title,
            message,
            metadata: {
              driverId: profile.userId,
              expiryType: "MEDICAL_CERT",
              daysRemaining,
            },
          }).catch(console.error);
          notifications++;

          if (orgId) {
            await notifyOrganization({
              organizationId: orgId,
              type: "CDL_EXPIRY_WARNING",
              title: `Driver Medical Certificate ${label}`,
              message,
              metadata: {
                driverId: profile.userId,
                expiryType: "MEDICAL_CERT",
                daysRemaining,
              },
            }).catch(console.error);
            notifications++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      checked,
      notifications,
    });
  } catch (error) {
    console.error("[CDL Expiry Monitor] Error:", error);
    return NextResponse.json(
      { error: "CDL expiry monitoring failed" },
      { status: 500 }
    );
  }
}
