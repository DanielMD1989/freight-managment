/**
 * Profile Settings Page
 *
 * Sprint 19 - Profile Menu + Settings Navigation
 *
 * User profile editing page
 */

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import ProfileSettingsClient from "./ProfileSettingsClient";

export default async function ProfileSettingsPage() {
  // Check authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/settings/profile");
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session) {
    redirect("/login?redirect=/settings/profile");
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
      isEmailVerified: true,
      isPhoneVerified: true,
      lastLoginAt: true,
      createdAt: true,
      organization: {
        select: {
          id: true,
          name: true,
          type: true,
          isVerified: true,
        },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <ProfileSettingsClient
      user={{
        ...user,
        lastLoginAt: user.lastLoginAt?.toISOString() || null,
        createdAt: user.createdAt.toISOString(),
      }}
    />
  );
}
