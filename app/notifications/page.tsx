/**
 * All Notifications Page
 *
 * Full-page notification list — linked from NotificationBell footer.
 * Shows more history than the bell dropdown (limit=50).
 */

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import NotificationsPageClient from "./NotificationsPageClient";

export default async function NotificationsPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/notifications");
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session) {
    redirect("/login?redirect=/notifications");
  }

  return <NotificationsPageClient userRole={session.role as string} />;
}
