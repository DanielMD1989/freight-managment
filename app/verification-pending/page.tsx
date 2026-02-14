/**
 * Sprint 2: User Verification Workflow
 * Page shown to users whose accounts are pending verification
 *
 * Features:
 * - Verification status checklist with progress
 * - Auto-refresh status every 30 seconds
 * - Document upload link
 * - Contact support button
 */

import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { VerificationStatusClient } from "./VerificationStatusClient";

export const dynamic = "force-dynamic";

export default async function VerificationPendingPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // If user is already ACTIVE, redirect to appropriate portal
  if (session.status === "ACTIVE") {
    if (session.role === "CARRIER") {
      redirect("/carrier");
    } else if (session.role === "SHIPPER") {
      redirect("/shipper");
    } else if (session.role === "DISPATCHER") {
      redirect("/dispatcher");
    } else if (session.role === "ADMIN" || session.role === "SUPER_ADMIN") {
      redirect("/admin");
    }
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-12">
      <VerificationStatusClient
        initialStatus={session.status ?? "REGISTERED"}
        userRole={session.role}
        userEmail={session.email}
      />
    </div>
  );
}
