/**
 * Invite Driver Page — Task 18
 */

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import InviteDriverClient from "./InviteDriverClient";

export default async function InviteDriverPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/carrier/drivers/invite");
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-xl px-4 py-8 sm:px-6 lg:px-8">
        <InviteDriverClient />
      </div>
    </div>
  );
}
