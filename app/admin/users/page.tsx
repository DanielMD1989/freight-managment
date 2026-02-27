/**
 * Admin User Management Page
 *
 * View and manage all platform users
 * Sprint 10 - Story 10.2: User Management
 */

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import UserManagementClient from "./UserManagementClient";

interface User {
  id: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isActive: boolean;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  organizationId: string | null;
  organization: {
    id: string;
    name: string;
    type: string;
    isVerified: boolean;
  } | null;
  createdAt: string;
  lastLoginAt: string | null;
}

interface UsersResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Fetch users from API
 */
async function getUsers(
  page: number = 1,
  role?: string,
  search?: string
): Promise<UsersResponse | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session");

    if (!sessionCookie) {
      return null;
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    const params = new URLSearchParams({
      page: page.toString(),
      limit: "20",
    });

    if (role) params.append("role", role);
    if (search) params.append("search", search);

    const response = await fetch(`${baseUrl}/api/admin/users?${params}`, {
      headers: {
        Cookie: `session=${sessionCookie.value}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Failed to fetch users:", response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching users:", error);
    return null;
  }
}

/**
 * Admin User Management Page
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { page?: string; role?: string; search?: string };
}) {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/admin/users");
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || session.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  // Get query parameters
  const page = parseInt(searchParams.page || "1");
  const role = searchParams.role;
  const search = searchParams.search;

  // Fetch users
  const data = await getUsers(page, role, search);

  if (!data) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="mt-2 text-gray-600">Manage all platform users</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">
            Failed to load users. Please try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
        <p className="mt-2 text-gray-600">
          Manage all platform users ({data.pagination.total} total)
        </p>
      </div>

      {/* User Management Client Component */}
      <UserManagementClient
        initialUsers={data.users}
        pagination={data.pagination}
        initialRole={role}
        initialSearch={search}
      />
    </div>
  );
}
