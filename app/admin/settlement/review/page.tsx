/**
 * Global Settlement Review Dashboard
 *
 * Sprint 16 - Story 16.9A: SuperAdmin Tools
 * Task 16.9A.4: Global Settlement Review Dashboard
 *
 * SuperAdmin dashboard for reviewing and managing settlements globally
 */

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SettlementReviewClient from "./SettlementReviewClient";

export const metadata = {
  title: "Settlement Review | Admin",
  description: "Review and manage settlements globally",
};

export default async function SettlementReviewPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Only Super Admins can access
  if (user.role !== "SUPER_ADMIN") {
    redirect("/unauthorized");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Global Settlement Review
              </h1>
              <p className="mt-2 text-gray-600">
                Review and manage all settlements across the platform
              </p>
            </div>
            <a
              href="/admin/settlement"
              className="rounded-lg border border-gray-300 bg-gray-100 px-4 py-2 font-medium text-gray-700 hover:bg-gray-200"
            >
              Back to Automation
            </a>
          </div>
        </div>

        {/* Client Component */}
        <SettlementReviewClient />
      </div>
    </div>
  );
}
