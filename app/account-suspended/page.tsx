/**
 * Account Suspended Page
 *
 * Shown when a user's account has been suspended by an admin.
 * No resubmit option — user must contact support.
 */

import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AccountSuspendedClient } from "./AccountSuspendedClient";

export const dynamic = "force-dynamic";

export default async function AccountSuspendedPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // If user is not SUSPENDED, redirect to home
  if (session.status !== "SUSPENDED") {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-12">
      <AccountSuspendedClient userEmail={session.email} />
    </div>
  );
}
