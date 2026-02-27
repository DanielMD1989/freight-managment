/**
 * Admin Bypass Review Dashboard
 *
 * Sprint 16 - Story 16.6: Anti-Bypass Detection & Incentives
 *
 * Admin dashboard for reviewing flagged organizations
 */

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import BypassReviewClient from "./BypassReviewClient";

export const metadata = {
  title: "Bypass Review | Admin",
  description: "Review organizations flagged for suspicious bypass attempts",
};

export default async function BypassReviewPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Only admins can access
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    redirect("/unauthorized");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Bypass Detection Review
          </h1>
          <p className="mt-2 text-gray-600">
            Review and manage organizations flagged for suspicious bypass
            attempts
          </p>
        </div>

        {/* Client Component */}
        <BypassReviewClient />
      </div>
    </div>
  );
}
