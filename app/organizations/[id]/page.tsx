/**
 * Organization Details Page
 * Sprint 1 - Story 1.4: Organization Management
 *
 * Displays detailed information about an organization
 */

import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import OrganizationDetailsClient from "./OrganizationDetailsClient";

interface OrganizationPageProps {
  params: Promise<{
    id: string;
  }>;
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
    console.error("Error fetching organization:", error);
    return null;
  }
}

export default async function OrganizationPage({
  params,
}: OrganizationPageProps) {
  const session = await getSession();
  const { id } = await params;

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">
          Please log in to view this page.
        </p>
      </div>
    );
  }

  const organization = await getOrganization(id);

  if (!organization) {
    notFound();
  }

  // Check if user has permission to view this organization
  const canView =
    session.role === "ADMIN" ||
    session.role === "SUPER_ADMIN" ||
    session.organizationId === organization.id;

  if (!canView) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">
          You don&apos;t have permission to view this organization.
        </p>
      </div>
    );
  }

  return (
    <OrganizationDetailsClient organization={organization} user={session} />
  );
}
