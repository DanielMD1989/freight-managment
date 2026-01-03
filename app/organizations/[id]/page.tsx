/**
 * Organization Details Page
 * Sprint 1 - Story 1.4: Organization Management
 *
 * Displays detailed information about an organization
 */

import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import OrganizationDetailsClient from './OrganizationDetailsClient';

interface OrganizationPageProps {
  params: {
    id: string;
  };
}

async function getOrganization(id: string) {
  try {
    const organization = await db.organization.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        loads: {
          select: {
            id: true,
            status: true,
          },
        },
        trucks: {
          select: {
            id: true,
            licensePlate: true,
          },
        },
      },
    });

    return organization;
  } catch (error) {
    console.error('Error fetching organization:', error);
    return null;
  }
}

export default async function OrganizationPage({ params }: OrganizationPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Please log in to view this page.</p>
      </div>
    );
  }

  const organization = await getOrganization(params.id);

  if (!organization) {
    notFound();
  }

  // Check if user has permission to view this organization
  const canView =
    session.user.role === 'ADMIN' ||
    session.user.role === 'SUPER_ADMIN' ||
    session.user.organizationId === organization.id;

  if (!canView) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">
          You don't have permission to view this organization.
        </p>
      </div>
    );
  }

  return <OrganizationDetailsClient organization={organization} user={session.user} />;
}
