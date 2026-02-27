/**
 * Carrier Load Matches Page
 *
 * View matching loads for carrier's truck postings
 * Sprint 12 - Story 12.4: Matching Loads View
 */

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import LoadMatchesClient from "./LoadMatchesClient";

interface TruckPosting {
  id: string;
  status: string;
  truck: {
    licensePlate: string;
    truckType: string;
  };
  originCity: {
    name: string;
  };
  destinationCity: {
    name: string;
  } | null;
}

/**
 * Fetch carrier's active truck postings
 */
async function getActiveTruckPostings(
  sessionCookie: string,
  organizationId: string
): Promise<TruckPosting[] | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    const response = await fetch(
      `${baseUrl}/api/truck-postings?organizationId=${organizationId}&status=ACTIVE&limit=50`,
      {
        headers: {
          Cookie: `session=${sessionCookie}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Failed to fetch truck postings:", response.status);
      return null;
    }

    const data = await response.json();
    return data.postings || [];
  } catch (error) {
    console.error("Error fetching truck postings:", error);
    return null;
  }
}

/**
 * Carrier Load Matches Page
 */
export default async function CarrierMatchesPage() {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/carrier/matches");
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== "CARRIER" && session.role !== "ADMIN")) {
    redirect("/unauthorized");
  }

  if (!session.organizationId) {
    redirect("/carrier?error=no-organization");
  }

  // Fetch active truck postings
  const truckPostings = await getActiveTruckPostings(
    sessionCookie.value,
    session.organizationId
  );

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Load Matches</h1>
        <p className="mt-2 text-gray-600">
          Find loads that match your available trucks
        </p>
      </div>

      {/* Load Matches Client Component */}
      <LoadMatchesClient truckPostings={truckPostings || []} />
    </div>
  );
}
