/**
 * Support Settings Page
 *
 * Sprint 19 - Profile Menu + Settings Navigation
 *
 * Help, support, and reporting page
 */

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import SupportSettingsClient from "./SupportSettingsClient";

export default async function SupportSettingsPage() {
  // Check authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/settings/support");
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session) {
    redirect("/login?redirect=/settings/support");
  }

  return (
    <SupportSettingsClient userId={session.userId} userRole={session.role} />
  );
}
