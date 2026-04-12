/**
 * Driver Web Landing Page — Task 20 (Gap 26/27)
 *
 * Drivers primarily use the mobile app. If they log in on the web,
 * they land here with a message directing them to the mobile app.
 */

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DriverPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login");
  }

  const session = await verifyToken(sessionCookie.value);
  if (!session || session.role !== "DRIVER") {
    redirect("/");
  }

  const name = String(session.email || "Driver");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100">
            <span className="text-3xl">🚛</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome, {name}</h1>
          <p className="mt-2 text-sm text-slate-500">FreightET Driver</p>
        </div>

        <div className="mb-6 rounded-lg bg-indigo-50 p-4 text-center">
          <p className="text-sm text-indigo-700">
            Please use the <strong>FreightET Driver</strong> mobile app to
            manage your trips, upload POD, and track deliveries.
          </p>
          <p className="mt-2 text-xs text-indigo-500">
            Download from the App Store or Google Play.
          </p>
        </div>

        <div className="text-center">
          <Link
            href="/api/auth/logout"
            className="text-sm text-slate-500 hover:text-slate-700 hover:underline"
          >
            Log out
          </Link>
        </div>
      </div>
    </div>
  );
}
