/**
 * Driver Management Page — Task 18
 *
 * Lists carrier's drivers with filtering and management actions.
 */

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import DriverManagementClient from "./DriverManagementClient";

async function getDrivers(sessionCookie: string, status?: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    const params = new URLSearchParams({ limit: "50" });
    if (status) params.set("status", status);

    const res = await fetch(`${baseUrl}/api/drivers?${params}`, {
      headers: { Cookie: `session=${sessionCookie}` },
      cache: "no-store",
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function DriversPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/carrier/drivers");
  }

  const session = await verifyToken(sessionCookie.value);
  if (
    !session ||
    (session.role !== "CARRIER" &&
      session.role !== "ADMIN" &&
      session.role !== "SUPER_ADMIN")
  ) {
    redirect("/unauthorized");
  }

  const data = await getDrivers(sessionCookie.value);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-md shadow-indigo-500/25">
              <span className="text-lg text-white">👤</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                Driver Management
              </h1>
              <p className="text-sm text-slate-500">
                Invite, approve, and manage your drivers
              </p>
            </div>
          </div>
        </div>

        <DriverManagementClient
          initialDrivers={data?.drivers ?? []}
          initialTotal={data?.total ?? 0}
        />
      </div>
    </div>
  );
}
