/**
 * System Health Dashboard
 *
 * Sprint 10 - Story 10.8: System Health Monitoring
 *
 * Displays platform health metrics and status
 */

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import SystemHealthClient from "./SystemHealthClient";

export const metadata = {
  title: "System Health | Admin",
  description: "Monitor platform health and performance",
};

export default async function SystemHealthPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/admin/health");
  }

  const session = await verifyToken(sessionCookie.value);

  if (
    !session ||
    (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")
  ) {
    redirect("/unauthorized");
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
        <p className="mt-2 text-gray-600">
          Monitor platform health, performance, and service status
        </p>
      </div>

      <SystemHealthClient />
    </div>
  );
}
