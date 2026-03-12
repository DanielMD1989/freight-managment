/**
 * Account Rejected Page (Server Component)
 *
 * Renders when a user's registration has been rejected.
 * Mirrors mobile's account-rejected.tsx — shows rejection reason,
 * resubmit option, and logout.
 */

import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AccountRejectedClient } from "./AccountRejectedClient";

export const dynamic = "force-dynamic";

export default async function AccountRejectedPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // If user is not REJECTED, redirect to home (middleware or page.tsx will route correctly)
  if (session.status !== "REJECTED") {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-12">
      <AccountRejectedClient
        userEmail={session.email}
        userRole={session.role}
      />
    </div>
  );
}
