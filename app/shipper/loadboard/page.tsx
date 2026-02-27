/**
 * Shipper Load Board
 *
 * Main entry point for shipper load board interface
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ShipperLoadboardClient from "./ShipperLoadboardClient";

export const metadata = {
  title: "Load Board - Shipper",
  description: "Professional load board for shippers",
};

export default async function ShipperLoadboardPage() {
  // Get session directly from cookie (robust approach)
  const session = await getSession();

  // Redirect if not authenticated
  if (!session) {
    redirect("/login");
  }

  // Verify shipper role
  if (
    session.role !== "SHIPPER" &&
    session.role !== "ADMIN" &&
    session.role !== "SUPER_ADMIN"
  ) {
    redirect("/unauthorized");
  }

  // Pass user data to client component
  const user = {
    userId: session.userId,
    email: session.email,
    role: session.role,
    status: session.status,
    organizationId: session.organizationId,
  };

  return <ShipperLoadboardClient user={user} />;
}
