/**
 * Create Admin/Dispatcher Page
 *
 * §1+§10: SUPER_ADMIN creates Admin; ADMIN creates Dispatcher.
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

  if (
    !session ||
    (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN")
  ) {
    redirect("/unauthorized");
  }

  const isSuperAdmin = session.role === "SUPER_ADMIN";

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {isSuperAdmin ? "Create Admin or Dispatcher" : "Create Dispatcher"}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {isSuperAdmin
            ? "Onboard a new Admin or Dispatcher to the platform"
            : "Onboard a new Dispatcher to the platform"}
        </p>
      </div>

      <CreateAdminForm currentRole={session.role} />
    </div>
  );
}
