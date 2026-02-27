/**
 * Admin Corridor Management Page
 *
 * Service Fee Implementation - Task 3: Admin UI for Corridor Management
 *
 * Manage corridor pricing configurations for service fees
 */

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import CorridorManagementClient from "./CorridorManagementClient";

export const metadata = {
  title: "Corridor Pricing | Admin",
  description: "Manage corridor pricing for service fees",
};

export default async function CorridorManagementPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Only admins can access
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    redirect("/unauthorized");
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Corridor Pricing
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Configure per-kilometer service fees by corridor
          </p>
        </div>

        {/* Client Component */}
        <CorridorManagementClient />
      </div>
    </div>
  );
}
