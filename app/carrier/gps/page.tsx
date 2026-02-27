/**
 * GPS Tracking Page
 *
 * Track truck locations via GPS devices with auto-refresh
 * Sprint 12 - Story 12.5: GPS Tracking
 */

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import GPSTrackingClient from "./GPSTrackingClient";

interface TruckWithGPS {
  id: string;
  licensePlate: string;
  truckType: string;
  isAvailable: boolean;
  currentCity: string | null;
  gpsDevice: {
    id: string;
    imei: string;
    status: string;
    lastSeenAt: string;
  } | null;
}

/**
 * Fetch trucks with GPS devices
 */
async function getTrucksWithGPS(
  organizationId: string
): Promise<TruckWithGPS[]> {
  try {
    const trucks = await db.truck.findMany({
      where: {
        carrierId: organizationId,
      },
      select: {
        id: true,
        licensePlate: true,
        truckType: true,
        isAvailable: true,
        currentCity: true,
        gpsDevice: {
          select: {
            id: true,
            imei: true,
            status: true,
            lastSeenAt: true,
          },
        },
      },
      orderBy: {
        licensePlate: "asc",
      },
    });

    return trucks as TruckWithGPS[];
  } catch (error) {
    console.error("Error fetching trucks:", error);
    return [];
  }
}

/**
 * GPS Tracking Page
 */
export default async function GPSTrackingPage() {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/carrier/gps");
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== "CARRIER" && session.role !== "ADMIN")) {
    redirect("/unauthorized");
  }

  if (!session.organizationId) {
    redirect("/carrier?error=no-organization");
  }

  // Fetch initial trucks data (will be refreshed by client)
  const trucks = await getTrucksWithGPS(session.organizationId);

  return <GPSTrackingClient initialTrucks={trucks} />;
}
