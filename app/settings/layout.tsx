/**
 * Settings Layout
 *
 * Sprint 19 - Profile Menu + Settings Navigation
 *
 * Layout for all user settings pages with sidebar navigation
 */

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import SettingsSidebar from "./SettingsSidebar";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/settings");
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session) {
    redirect("/login?redirect=/settings");
  }

  // Fetch user data
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      organization: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Settings
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your account settings and preferences
          </p>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Sidebar */}
          <div className="flex-shrink-0 lg:w-64">
            <SettingsSidebar />
          </div>

          {/* Main Content */}
          <div className="min-w-0 flex-1">
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
