/**
 * Shipper Portal Layout
 *
 * Layout with role-aware sidebar navigation
 * Sprint 14 - Professional UI Transformation
 */

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import RoleAwareSidebar from "@/components/RoleAwareSidebar";
import ShipperHeader from "@/components/ShipperHeader";

export default async function ShipperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/shipper");
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session) {
    redirect("/login?redirect=/shipper");
  }

  // H7 FIX: Intentional admin access for support purposes
  // ADMIN and SUPER_ADMIN can access shipper panel to assist users
  // This is a documented design decision for customer support workflows
  const isShipper = session.role === "SHIPPER";
  const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";

  if (!isShipper && !isAdmin) {
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
      <RoleAwareSidebar userRole={session.role} portalType="shipper" />
      <div className="flex flex-1 flex-col overflow-auto">
        <ShipperHeader
          user={{
            firstName: user?.firstName || "",
            lastName: user?.lastName || "",
            email: user?.email || "",
            role: session.role,
          }}
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
