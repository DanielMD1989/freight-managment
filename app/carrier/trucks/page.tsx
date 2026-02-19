/**
 * Truck Management Page
 *
 * List and manage carrier's truck fleet
 * Sprint 12 - Story 12.2: Truck Management
 */

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import TruckManagementClient from "./TruckManagementClient";

interface Truck {
  id: string;
  truckType: string;
  licensePlate: string;
  capacity: number;
  volume: number | null;
  currentCity: string | null;
  currentRegion: string | null;
  isAvailable: boolean;
  status: string;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  carrier: {
    id: string;
    name: string;
    isVerified: boolean;
  };
  gpsDevice: {
    id: string;
    imei: string;
    status: string;
    lastSeenAt: string;
  } | null;
}

/**
 * Fetch trucks with optional approval status filter
 */
async function getTrucks(
  sessionCookie: string,
  page: number = 1,
  truckType?: string,
  status?: string,
  approvalStatus?: string
): Promise<{
  trucks: Truck[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
} | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    const params = new URLSearchParams({
      myTrucks: "true",
      page: page.toString(),
      limit: "20",
    });

    if (truckType && truckType !== "all") {
      params.set("truckType", truckType);
    }

    // Sprint 18: Filter by approval status
    if (approvalStatus) {
      params.set("approvalStatus", approvalStatus);
    }

    const response = await fetch(`${baseUrl}/api/trucks?${params.toString()}`, {
      headers: {
        Cookie: `session=${sessionCookie}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Failed to fetch trucks:", response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching trucks:", error);
    return null;
  }
}

/**
 * Truck Management Page
 * Sprint 18: Shows approved trucks + pending approval section
 */
export default async function TrucksPage({
  searchParams,
}: {
  searchParams: {
    page?: string;
    truckType?: string;
    status?: string;
    tab?: string;
  };
}) {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/carrier/trucks");
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== "CARRIER" && session.role !== "ADMIN")) {
    redirect("/unauthorized");
  }

  if (!session.organizationId) {
    redirect("/carrier?error=no-organization");
  }

  // Parse params
  const page = parseInt(searchParams.page || "1");
  const truckType = searchParams.truckType;
  const status = searchParams.status;
  const activeTab = searchParams.tab || "approved";

  // Sprint 18: Fetch approved and pending trucks separately
  const [approvedData, pendingData, rejectedData] = await Promise.all([
    getTrucks(
      sessionCookie.value,
      activeTab === "approved" ? page : 1,
      truckType,
      status,
      "APPROVED"
    ),
    getTrucks(
      sessionCookie.value,
      activeTab === "pending" ? page : 1,
      undefined,
      undefined,
      "PENDING"
    ),
    getTrucks(
      sessionCookie.value,
      activeTab === "rejected" ? page : 1,
      undefined,
      undefined,
      "REJECTED"
    ),
  ]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-md shadow-teal-500/25">
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">My Trucks</h1>
              <p className="text-sm text-slate-500">
                Manage your trucks and vehicles
              </p>
            </div>
          </div>
        </div>

        {/* Truck Management Client Component */}
        <TruckManagementClient
          initialApprovedTrucks={approvedData?.trucks || []}
          initialPendingTrucks={pendingData?.trucks || []}
          initialRejectedTrucks={rejectedData?.trucks || []}
          approvedPagination={
            approvedData?.pagination || {
              page: 1,
              pageSize: 20,
              total: 0,
              totalPages: 0,
            }
          }
          pendingPagination={
            pendingData?.pagination || {
              page: 1,
              pageSize: 20,
              total: 0,
              totalPages: 0,
            }
          }
          rejectedPagination={
            rejectedData?.pagination || {
              page: 1,
              pageSize: 20,
              total: 0,
              totalPages: 0,
            }
          }
          initialTab={activeTab}
        />
      </div>
    </div>
  );
}
