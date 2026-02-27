/**
 * Truck Matches Page
 *
 * View matching trucks for shipper's posted loads
 * Sprint 11 - Story 11.4: Matching Trucks View
 */

import Link from "next/link";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import TruckMatchesClient from "./TruckMatchesClient";

interface Load {
  id: string;
  pickupCity: string | null;
  deliveryCity: string | null;
  pickupDate: string;
  deliveryDate: string;
  truckType: string;
  weight: number;
  status: string;
}

/**
 * Fetch shipper's posted loads
 */
async function getPostedLoads(organizationId: string): Promise<Load[]> {
  try {
    const loads = await db.load.findMany({
      where: {
        shipperId: organizationId,
        status: "POSTED",
      },
      select: {
        id: true,
        pickupCity: true,
        deliveryCity: true,
        pickupDate: true,
        deliveryDate: true,
        truckType: true,
        weight: true,
        status: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return loads.map((load) => ({
      ...load,
      weight: Number(load.weight),
      pickupDate: load.pickupDate.toISOString(),
      deliveryDate: load.deliveryDate.toISOString(),
      truckType: load.truckType.toString(),
      status: load.status.toString(),
    }));
  } catch (error) {
    console.error("Error fetching posted loads:", error);
    return [];
  }
}

/**
 * Truck Matches Page
 */
export default async function TruckMatchesPage({
  searchParams,
}: {
  searchParams: { loadId?: string };
}) {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/shipper/matches");
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== "SHIPPER" && session.role !== "ADMIN")) {
    redirect("/unauthorized");
  }

  if (!session.organizationId) {
    redirect("/shipper?error=no-organization");
  }

  // Fetch posted loads
  const postedLoads = await getPostedLoads(session.organizationId);

  // Get selected load ID from query param or use first posted load
  const selectedLoadId = searchParams.loadId || postedLoads[0]?.id;

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Truck Matches</h1>
        <p className="mt-2 text-gray-600">
          Find available carriers for your posted loads
        </p>
      </div>

      {postedLoads.length === 0 ? (
        /* No Posted Loads */
        <div className="rounded-lg bg-white p-12 text-center shadow">
          <div className="mb-4 text-6xl">🚛</div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            No Posted Loads
          </h3>
          <p className="mb-6 text-gray-600">
            You need to post a load before you can view truck matches.
          </p>
          <Link
            href="/shipper/loads/create"
            className="inline-block rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700"
          >
            Post a Load
          </Link>
        </div>
      ) : (
        /* Truck Matches Client Component */
        <TruckMatchesClient
          postedLoads={postedLoads}
          selectedLoadId={selectedLoadId}
        />
      )}
    </div>
  );
}
