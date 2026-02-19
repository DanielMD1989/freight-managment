/**
 * Edit Load Page
 *
 * Edit an existing load (DRAFT or POSTED status only)
 */

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import EditLoadForm from "./EditLoadForm";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getLoad(sessionCookie: string, loadId: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/loads/${loadId}`, {
      headers: {
        Cookie: `session=${sessionCookie}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.load || data;
  } catch (error) {
    console.error("Error fetching load:", error);
    return null;
  }
}

export default async function EditLoadPage({ params }: PageProps) {
  const resolvedParams = await params;

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect(`/login?redirect=/shipper/loads/${resolvedParams.id}/edit`);
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== "SHIPPER" && session.role !== "ADMIN")) {
    redirect("/unauthorized");
  }

  const load = await getLoad(sessionCookie.value, resolvedParams.id);

  if (!load) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
          <h1 className="mb-2 text-2xl font-bold text-red-900">
            Load Not Found
          </h1>
          <p className="mb-4 text-red-700">
            The load you are looking for does not exist or has been deleted.
          </p>
          <Link href="/shipper/loads" className="text-blue-600 hover:underline">
            ← Back to My Loads
          </Link>
        </div>
      </div>
    );
  }

  // Only DRAFT or POSTED loads can be edited
  if (load.status !== "DRAFT" && load.status !== "POSTED") {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-8 text-center">
          <h1 className="mb-2 text-2xl font-bold text-amber-900">
            Cannot Edit Load
          </h1>
          <p className="mb-4 text-amber-700">
            This load cannot be edited because its status is {load.status}. Only
            DRAFT and POSTED loads can be edited.
          </p>
          <Link
            href={`/shipper/loads/${load.id}`}
            className="text-blue-600 hover:underline"
          >
            ← Back to Load Details
          </Link>
        </div>
      </div>
    );
  }

  // Check ownership
  if (load.shipperId !== session.organizationId && session.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <Link
          href={`/shipper/loads/${load.id}`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to Load Details
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-gray-900">Edit Load</h1>
        <p className="mt-2 text-gray-600">Update your load information</p>
      </div>

      <EditLoadForm load={load} />
    </div>
  );
}
