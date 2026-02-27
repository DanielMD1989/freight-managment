/**
 * Admin Truck Approval Queue Page
 *
 * Review and approve/reject trucks submitted by carriers
 * Sprint 18 - Truck Approval Workflow
 */

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import TruckApprovalClient from "./TruckApprovalClient";

interface Truck {
  id: string;
  truckType: string;
  licensePlate: string;
  capacity: number;
  volume: number | null;
  currentCity: string | null;
  currentRegion: string | null;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  carrier: {
    id: string;
    name: string;
    isVerified: boolean;
  };
  imei: string | null;
  gpsProvider: string | null;
}

interface TrucksResponse {
  trucks: Truck[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Fetch pending trucks from API
 */
async function getPendingTrucks(
  page: number = 1,
  approvalStatus: string = "PENDING"
): Promise<TrucksResponse | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session");

    if (!sessionCookie) {
      return null;
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    const params = new URLSearchParams({
      page: page.toString(),
      limit: "20",
      approvalStatus,
    });

    const response = await fetch(`${baseUrl}/api/trucks?${params}`, {
      headers: {
        Cookie: `session=${sessionCookie.value}`,
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
 * Fetch approval statistics
 */
async function getApprovalStats(): Promise<{
  pending: number;
  approved: number;
  rejected: number;
} | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session");

    if (!sessionCookie) {
      return null;
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

    const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
      fetch(`${baseUrl}/api/trucks?approvalStatus=PENDING&limit=1`, {
        headers: { Cookie: `session=${sessionCookie.value}` },
        cache: "no-store",
      }),
      fetch(`${baseUrl}/api/trucks?approvalStatus=APPROVED&limit=1`, {
        headers: { Cookie: `session=${sessionCookie.value}` },
        cache: "no-store",
      }),
      fetch(`${baseUrl}/api/trucks?approvalStatus=REJECTED&limit=1`, {
        headers: { Cookie: `session=${sessionCookie.value}` },
        cache: "no-store",
      }),
    ]);

    const pendingData = await pendingRes.json();
    const approvedData = await approvedRes.json();
    const rejectedData = await rejectedRes.json();

    return {
      pending: pendingData.pagination?.total || 0,
      approved: approvedData.pagination?.total || 0,
      rejected: rejectedData.pagination?.total || 0,
    };
  } catch (error) {
    console.error("Error fetching stats:", error);
    return null;
  }
}

/**
 * Admin Truck Approval Queue Page
 */
export default async function AdminTruckApprovalPage({
  searchParams,
}: {
  searchParams: {
    page?: string;
    status?: string;
  };
}) {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/admin/trucks/pending");
  }

  const session = await verifyToken(sessionCookie.value);

  if (
    !session ||
    (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")
  ) {
    redirect("/unauthorized");
  }

  // Get query parameters
  const page = parseInt(searchParams.page || "1");
  const approvalStatus = searchParams.status || "PENDING";

  // Fetch trucks and stats
  const [data, stats] = await Promise.all([
    getPendingTrucks(page, approvalStatus),
    getApprovalStats(),
  ]);

  if (!data) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Truck Approval Queue
          </h1>
          <p className="mt-2 text-gray-600">
            Review and approve trucks submitted by carriers
          </p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">
            Failed to load trucks. Please try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Truck Approval Queue
        </h1>
        <p className="mt-2 text-gray-600">
          Review and approve trucks submitted by carriers ({stats?.pending || 0}{" "}
          pending)
        </p>
      </div>

      {/* Truck Approval Client Component */}
      <TruckApprovalClient
        initialTrucks={data.trucks}
        pagination={data.pagination}
        statistics={stats || { pending: 0, approved: 0, rejected: 0 }}
        initialStatus={approvalStatus}
      />
    </div>
  );
}
