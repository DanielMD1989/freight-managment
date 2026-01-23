/**
 * Shipper Company Settings Page
 *
 * Phase 2 - Story 16.9B: Company Admin Tools
 * Task 16.9B.5: Company Preference Settings
 */

import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import CompanySettingsClient from '@/app/carrier/settings/CompanySettingsClient';

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

export default async function ShipperSettingsPage() {
  const session = await requireAuth();

  if (session.role !== 'SHIPPER') {
    redirect('/shipper');
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { organizationId: true },
  });

  if (!user?.organizationId) {
    redirect('/shipper');
  }

  const organization = await getOrganizationData(user.organizationId);

  if (!organization) {
    redirect('/shipper');
  }

  // Transform dates for client component
  const transformedOrg = {
    ...organization,
    verifiedAt: organization.verifiedAt?.toISOString() || null,
    createdAt: organization.createdAt.toISOString(),
  };

  return (
    <div className="p-6 min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="mb-6">
        <h1
          className="text-2xl font-bold"
          style={{ color: 'var(--foreground)' }}
        >
          Company Settings
        </h1>
        <p
          className="mt-1"
          style={{ color: 'var(--foreground-muted)' }}
        >
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
      <div
        className="h-12 rounded-lg w-1/3"
        style={{ background: 'var(--bg-tinted)' }}
      />
      <div
        className="h-64 rounded-xl"
        style={{ background: 'var(--bg-tinted)' }}
      />
    </div>
  );
}
