/**
 * Admin User Detail/Edit Page
 *
 * View and edit user details
 * Sprint 10 - Story 10.2: User Management
 */

import Link from "next/link";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import UserDetailClient from "./UserDetailClient";

interface UserDetail {
  id: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  status: string;
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
  updatedAt: string;
  lastLoginAt: string | null;
}

interface UserResponse {
  user: UserDetail;
}

/**
 * Fetch user details from API
 */
async function getUser(userId: string): Promise<UserResponse | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session");

    if (!sessionCookie) {
      return null;
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

    const response = await fetch(`${baseUrl}/api/admin/users/${userId}`, {
      headers: {
        Cookie: `session=${sessionCookie.value}`,
      },
      cache: "no-store",
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      console.error("Failed to fetch user:", response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
}

/**
 * Admin User Detail Page
 */
export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/admin/users");
  }

  const session = await verifyToken(sessionCookie.value);

  if (
    !session ||
    (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")
  ) {
    redirect("/unauthorized");
  }

  const { id } = await params;

  // Fetch user details
  const data = await getUser(id);

  if (!data) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
          <Link href="/admin/users" className="hover:text-blue-600">
            Users
          </Link>
          <span>/</span>
          <span>{data.user.email}</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">User Details</h1>
        <p className="mt-2 text-gray-600">View and manage user account</p>
      </div>

      {/* User Detail Client Component */}
      <UserDetailClient user={data.user} currentUserRole={session.role} />
    </div>
  );
}
