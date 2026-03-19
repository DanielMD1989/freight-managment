/**
 * Dispatcher Trip Detail Page
 *
 * Shows trip details with exception handling actions.
 * Dispatchers can reassign trucks on EXCEPTION trips.
 */

import { Suspense } from "react";
import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import TripDetailClient from "./TripDetailClient";

export default async function DispatcherTripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAuth();

  if (
    session.role !== "DISPATCHER" &&
    session.role !== "ADMIN" &&
    session.role !== "SUPER_ADMIN"
  ) {
    redirect("/dispatcher");
  }

  const { id } = await params;

  return (
    <div className="p-6">
      <Suspense fallback={<DetailSkeleton />}>
        <TripDetailClient tripId={id} />
      </Suspense>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-12 w-64 rounded-lg bg-gray-200"></div>
      <div className="h-64 rounded-2xl bg-gray-200"></div>
    </div>
  );
}
