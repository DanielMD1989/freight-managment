/**
 * Carrier Dashboard Page
 *
 * Professional dashboard for carrier portal
 * Design System: Clean & Minimal with Teal accent
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import CarrierDashboardClient from "./CarrierDashboardClient";

export const metadata = {
  title: "Dashboard | Carrier Portal",
  description: "Carrier dashboard - manage your fleet and loads",
};

async function getDashboardData(sessionCookie: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/carrier/dashboard`, {
      headers: {
        Cookie: `session=${sessionCookie}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Failed to fetch dashboard:", response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching dashboard:", error);
    return null;
  }
}

async function getRecentLoads(sessionCookie: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/loads?limit=5&myTrips=true`, {
      headers: {
        Cookie: `session=${sessionCookie}`,
      },
      cache: "no-store",
    });

    if (!response.ok) return [];
    const data = await response.json();
    return data.loads || [];
  } catch {
    return [];
  }
}

async function getTrucks(sessionCookie: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    const response = await fetch(
      `${baseUrl}/api/trucks?myTrucks=true&limit=5`,
      {
        headers: {
          Cookie: `session=${sessionCookie}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) return [];
    const data = await response.json();
    return data.trucks || [];
  } catch {
    return [];
  }
}

export default async function CarrierDashboardPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/carrier/dashboard");
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== "CARRIER" && session.role !== "ADMIN")) {
    redirect("/unauthorized");
  }

  const [dashboardData, recentLoads, trucks] = await Promise.all([
    getDashboardData(sessionCookie.value),
    getRecentLoads(sessionCookie.value),
    getTrucks(sessionCookie.value),
  ]);

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <CarrierDashboardClient
        user={session}
        dashboardData={dashboardData}
        recentLoads={recentLoads}
        trucks={trucks}
      />
    </Suspense>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen animate-pulse bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {/* Header skeleton */}
        <div className="mb-6 h-6 w-40 rounded bg-slate-200" />

        {/* KPI Cards skeleton */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-xl border border-slate-200/60 bg-white p-4"
            />
          ))}
        </div>

        {/* Quick Actions skeleton */}
        <div className="mb-6 flex gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 w-14 rounded-xl bg-slate-200" />
          ))}
        </div>

        {/* Active Load skeleton */}
        <div className="mb-6">
          <div className="mb-3 h-4 w-24 rounded bg-slate-200" />
          <div className="h-24 rounded-xl border border-slate-200/60 bg-white p-4" />
        </div>

        {/* Recommended Loads skeleton */}
        <div className="mb-8">
          <div className="mb-3 h-4 w-36 rounded bg-slate-200" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-xl border border-slate-200/60 bg-white p-4"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
