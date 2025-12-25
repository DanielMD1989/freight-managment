/**
 * Admin Organization Management Page
 *
 * View and manage all platform organizations
 * Sprint 10 - Story 10.3: Organization Management
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import OrganizationManagementClient from './OrganizationManagementClient';

interface Organization {
  id: string;
  name: string;
  type: string;
  description: string | null;
  contactEmail: string;
  contactPhone: string;
  city: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
  createdAt: string;
  _count: {
    users: number;
    trucks: number;
    loads: number;
  };
}

interface OrganizationsResponse {
  organizations: Organization[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Fetch organizations from API
 */
async function getOrganizations(
  page: number = 1,
  type?: string,
  search?: string
): Promise<OrganizationsResponse | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie) {
      return null;
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const params = new URLSearchParams({
      page: page.toString(),
      limit: '20',
    });

    if (type) params.append('type', type);
    if (search) params.append('search', search);

    const response = await fetch(`${baseUrl}/api/organizations?${params}`, {
      headers: {
        Cookie: `session=${sessionCookie.value}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Failed to fetch organizations:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return null;
  }
}

/**
 * Admin Organization Management Page
 */
export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: { page?: string; type?: string; search?: string };
}) {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/admin/organizations');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || session.role !== 'ADMIN') {
    redirect('/unauthorized');
  }

  // Get query parameters
  const page = parseInt(searchParams.page || '1');
  const type = searchParams.type;
  const search = searchParams.search;

  // Fetch organizations
  const data = await getOrganizations(page, type, search);

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Organization Management
          </h1>
          <p className="text-gray-600 mt-2">Manage all platform organizations</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">
            Failed to load organizations. Please try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Organization Management
        </h1>
        <p className="text-gray-600 mt-2">
          Manage all platform organizations ({data.pagination.total} total)
        </p>
      </div>

      {/* Organization Management Client Component */}
      <OrganizationManagementClient
        initialOrganizations={data.organizations}
        pagination={data.pagination}
        initialType={type}
        initialSearch={search}
      />
    </div>
  );
}
