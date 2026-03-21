/**
 * Create Admin User Page
 *
 * G-SA1-1: Blueprint §10 — SUPER_ADMIN creates Admin accounts.
 * Only accessible to SUPER_ADMIN (requirePermission(CREATE_ADMIN)).
 */

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import CreateAdminForm from "./CreateAdminForm";

export default async function CreateAdminPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/admin/users/create");
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || session.role !== "SUPER_ADMIN") {
    redirect("/unauthorized");
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Create Admin Account
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Onboard a new Admin user to the platform
        </p>
      </div>

      <CreateAdminForm />
    </div>
  );
}
