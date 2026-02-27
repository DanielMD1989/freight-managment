/**
 * Carrier Load Board
 *
 * Main entry point for carrier load board interface
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import CarrierLoadboardClient from "./CarrierLoadboardClient";

export const metadata = {
  title: "Load Board - Carrier",
  description: "Professional load board for carriers",
};

export default async function CarrierLoadboardPage() {
  // Get session directly from cookie (robust approach)
  const session = await getSession();

  // Redirect if not authenticated
  if (!session) {
    redirect("/login");
  }

  // Verify carrier role
  if (
    session.role !== "CARRIER" &&
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

  return <CarrierLoadboardClient user={user} />;
}
