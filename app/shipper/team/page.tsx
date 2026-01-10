/**
 * Shipper Team Management Page
 *
 * Phase 2 - Story 16.9B: Company Admin Tools
 * Task 16.9B.1: Company User Management
 */

import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import TeamManagementClient from '@/app/carrier/team/TeamManagementClient';

async function getTeamData(organizationId: string) {
  const [organization, members, invitations] = await Promise.all([
    db.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        type: true,
        isVerified: true,
      },
    }),
    db.user.findMany({
      where: { organizationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    db.invitation.findMany({
      where: {
        organizationId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return { organization, members, invitations };
}

export default async function ShipperTeamPage() {
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

  const { organization, members, invitations } = await getTeamData(user.organizationId);

  if (!organization) {
    redirect('/shipper');
  }

  // Transform data for client component
  const transformedMembers = members.map((m) => ({
    id: m.id,
    name: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email,
    email: m.email,
    role: m.role,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
    lastLoginAt: m.lastLoginAt?.toISOString() || null,
  }));

  const transformedInvitations = invitations.map((inv) => ({
    id: inv.id,
    email: inv.email,
    role: inv.role,
    createdAt: inv.createdAt.toISOString(),
    expiresAt: inv.expiresAt.toISOString(),
  }));

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Team Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your company's team members and invitations
        </p>
      </div>

      <Suspense fallback={<TeamSkeleton />}>
        <TeamManagementClient
          organization={organization}
          initialMembers={transformedMembers}
          initialInvitations={transformedInvitations}
          currentUserId={session.userId}
        />
      </Suspense>
    </div>
  );
}

function TeamSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
      <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
    </div>
  );
}
