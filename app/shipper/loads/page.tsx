/**
 * Load Management Page
 *
 * View and manage all loads for shipper
 * Sprint 11 - Story 11.3: Load Management
 */

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import LoadManagementClient from "./LoadManagementClient";

interface Load {
  id: string;
  pickupCity: string;
  deliveryCity: string;
  pickupDate: string;
  deliveryDate: string;
  truckType: string;
  weight: number;
  shipperServiceFee: number | null;
  status: string;
  cargoDescription: string;
  fullPartial: string;
  createdAt: string;
  updatedAt: string;
  postedAt: string | null;
  assignedTruck?: {
    id: string;
    licensePlate: string;
    truckType: string;
  } | null;
}

interface LoadsResponse {
  loads: Load[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Fetch loads from API
 */
// Map UI status filters to actual database statuses
const STATUS_MAP: Record<string, string> = {
  active: "ASSIGNED,PICKUP_PENDING,IN_TRANSIT", // Active trips in progress
  delivered: "DELIVERED",
  completed: "COMPLETED",
  cancelled: "CANCELLED",
  draft: "DRAFT",
  posted: "POSTED",
  unposted: "UNPOSTED",
};

async function getLoads(
  page: number = 1,
  status?: string
): Promise<LoadsResponse | null> {
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
      myLoads: "true", // Only show shipper's own loads
    });

    if (status && status !== "all") {
      // Map UI status to database status(es)
      const dbStatus = STATUS_MAP[status.toLowerCase()] || status.toUpperCase();
      params.append("status", dbStatus);
    }

    const response = await fetch(`${baseUrl}/api/loads?${params}`, {
      headers: {
        Cookie: `session=${sessionCookie.value}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Failed to fetch loads:", response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching loads:", error);
    return null;
  }
}

/**
 * Load Management Page
 */
export default async function LoadsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/shipper/loads");
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== "SHIPPER" && session.role !== "ADMIN")) {
    redirect("/unauthorized");
  }

  // Get query parameters
  const params = await searchParams;
  const page = parseInt(params.page || "1");
  const status = params.status || "all";

  // Fetch loads
  const data = await getLoads(page, status);

  if (!data) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">
            My Loads
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Manage your shipment postings
          </p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-rose-800">
            Failed to load your loads. Please try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 p-2.5 shadow-lg shadow-teal-500/25">
            <Image
              src="/cargo-icon.png"
              alt="My Loads"
              width={40}
              height={40}
              style={{ objectFit: "contain" }}
            />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">My Loads</h1>
            <p className="mt-1 text-slate-500">
              Manage your shipment postings ({data.pagination.total} total)
            </p>
          </div>
        </div>
        <Link
          href="/shipper/loads/create"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 px-6 py-3 font-medium text-white shadow-md shadow-teal-500/25 transition-all hover:shadow-lg hover:shadow-teal-500/30"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Post New Load
        </Link>
      </div>

      {/* Load Management Client Component */}
      <LoadManagementClient
        initialLoads={data.loads}
        pagination={data.pagination}
        initialStatus={status}
      />
    </div>
  );
}
