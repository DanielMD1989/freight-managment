/**
 * Carrier Company Settings Page
 *
 * Phase 2 - Story 16.9B: Company Admin Tools
 * Task 16.9B.5: Company Preference Settings
 *
 * Allows company admins to manage organization settings:
 * - Company profile information
 * - Notification preferences
 * - Display preferences
 */

import { Suspense } from "react";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import CompanySettingsClient from "./CompanySettingsClient";

async function getOrganizationData(organizationId: string) {
  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      type: true,
      description: true,
      contactEmail: true,
      contactPhone: true,
      address: true,
      city: true,
      isVerified: true,
      verifiedAt: true,
      licenseNumber: true,
      taxId: true,
      allowNameDisplay: true,
      createdAt: true,
    },
  });

  return organization;
}

export default async function CarrierSettingsPage() {
  const session = await requireAuth();

  if (session.role !== "CARRIER") {
    redirect("/carrier");
  }

  // Get user's organization
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { organizationId: true },
  });

  if (!user?.organizationId) {
    redirect("/carrier");
  }

  const organization = await getOrganizationData(user.organizationId);

  if (!organization) {
    redirect("/carrier");
  }

  // Transform dates for client component
  const transformedOrg = {
    ...organization,
    verifiedAt: organization.verifiedAt?.toISOString() || null,
    createdAt: organization.createdAt.toISOString(),
  };

  return (
    <div className="min-h-screen bg-[var(--bg-tinted)] p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#064d51]">Company Settings</h1>
        <p className="mt-1 text-[#064d51]/70">
          Manage your company profile and preferences
        </p>
      </div>

      <Suspense fallback={<SettingsSkeleton />}>
        <CompanySettingsClient organization={transformedOrg} />
      </Suspense>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-12 w-1/3 rounded-lg bg-[#064d51]/10"></div>
      <div className="h-64 rounded-xl bg-[#064d51]/10"></div>
    </div>
  );
}
