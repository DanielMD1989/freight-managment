/**
 * Carrier Portal Layout
 *
 * Sprint 19 - Profile Menu + Settings Navigation
 *
 * Layout with role-aware sidebar navigation and portal header
 */

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import RoleAwareSidebar from "@/components/RoleAwareSidebar";
import PortalHeader from "@/components/PortalHeader";

export default async function CarrierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/carrier");
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session) {
    redirect("/login?redirect=/carrier");
  }

  // Check if user is a carrier or admin
  if (
    session.role !== "CARRIER" &&
    session.role !== "ADMIN" &&
    session.role !== "SUPER_ADMIN"
  ) {
    redirect("/unauthorized");
  }

  // Fetch user data for header
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { firstName: true, lastName: true, email: true },
  });

  // Layout with sidebar and header
  return (
    <div
      className="flex min-h-screen"
      style={{ background: "var(--background)" }}
    >
      <RoleAwareSidebar userRole={session.role} portalType="carrier" />
      <div className="flex flex-1 flex-col overflow-auto">
        <PortalHeader
          user={{
            firstName: user?.firstName || "",
            lastName: user?.lastName || "",
            email: user?.email || "",
            role: session.role,
          }}
          portalPrefix="/carrier"
        />
        <main
          className="flex-1 overflow-auto"
          style={{ color: "var(--foreground)" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
