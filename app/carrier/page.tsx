/**
 * Carrier Main Page - Redirects to Dashboard
 *
 * Preserves auth checks so /carrier remains a valid URL (bookmarks, error redirects),
 * then forwards to the dashboard landing page.
 */

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

export const metadata = {
  title: "FreightET - Carrier Portal",
  description: "Carrier portal — redirects to dashboard",
};

export default async function CarrierPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/carrier/dashboard");
  }

  const session = await verifyToken(sessionCookie.value);

  if (
    !session ||
    (session.role !== "CARRIER" &&
      session.role !== "ADMIN" &&
      session.role !== "SUPER_ADMIN")
  ) {
    redirect("/unauthorized");
  }

  redirect("/carrier/dashboard");
}
