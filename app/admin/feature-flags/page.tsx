/**
 * Feature Flags Management Page
 *
 * Sprint 10 - Story 10.7: Feature Flag System
 *
 * Allows admins to toggle features on/off for the platform
 */

import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import FeatureFlagsClient from "./FeatureFlagsClient";

export const metadata = {
  title: "Feature Flags | Admin",
  description: "Manage platform feature flags",
};

export default async function FeatureFlagsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin/feature-flags");
  }

  // Only Super Admins can access feature flags
  if (user.role !== "SUPER_ADMIN") {
    redirect("/unauthorized");
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Feature Flags</h1>
        <p className="mt-2 text-gray-600">
          Enable or disable platform features
        </p>
      </div>

      <FeatureFlagsClient />
    </div>
  );
}
