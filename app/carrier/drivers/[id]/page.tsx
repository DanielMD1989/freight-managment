/**
 * Driver Detail Page — Task 18
 */

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import DriverDetailClient from "./DriverDetailClient";

async function getDriver(sessionCookie: string, driverId: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/drivers/${driverId}`, {
      headers: { Cookie: `session=${sessionCookie}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function DriverDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/carrier/drivers");
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

  const { id } = await params;
  const driver = await getDriver(sessionCookie.value, id);

  if (!driver) {
    redirect("/carrier/drivers?error=driver-not-found");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <DriverDetailClient driver={driver} />
      </div>
    </div>
  );
}
