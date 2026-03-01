/**
 * Shipper Match Proposals Page
 *
 * Read-only view of match proposals for the shipper's loads.
 * Dispatchers create proposals, carriers respond — shippers observe.
 */

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";

const PROPOSALS_PAGE_SIZE = 50;

async function getShipperProposals(organizationId: string) {
  const proposals = await db.matchProposal.findMany({
    where: {
      load: { shipperId: organizationId },
    },
    include: {
      load: {
        select: {
          id: true,
          pickupCity: true,
          deliveryCity: true,
          pickupDate: true,
          weight: true,
          truckType: true,
          status: true,
        },
      },
      truck: {
        select: {
          licensePlate: true,
          truckType: true,
          capacity: true,
        },
      },
      carrier: {
        select: {
          name: true,
        },
      },
      proposedBy: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: PROPOSALS_PAGE_SIZE,
  });

  return proposals;
}

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-500/10 text-amber-600",
  ACCEPTED: "bg-emerald-500/10 text-emerald-600",
  REJECTED: "bg-rose-500/10 text-rose-600",
  EXPIRED: "bg-gray-500/10 text-gray-600",
  CANCELLED: "bg-rose-500/10 text-rose-600",
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(date));
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default async function ShipperProposalsPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/shipper/proposals");
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== "SHIPPER" && session.role !== "ADMIN")) {
    redirect("/unauthorized");
  }

  if (!session.organizationId) {
    redirect("/shipper?error=no-organization");
  }

  const proposals = await getShipperProposals(session.organizationId);

  const pendingCount = proposals.filter((p) => p.status === "PENDING").length;
  const acceptedCount = proposals.filter((p) => p.status === "ACCEPTED").length;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Match Proposals</h1>
        <p className="mt-2 text-gray-600">
          Dispatchers propose truck matches for your posted loads. Carriers
          respond to these proposals.
        </p>
      </div>

      {/* Summary */}
      {proposals.length > 0 && (
        <div className="mb-6 flex gap-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <span className="text-2xl font-bold text-amber-700">
              {pendingCount}
            </span>
            <span className="ml-2 text-sm text-amber-600">Pending</span>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <span className="text-2xl font-bold text-emerald-700">
              {acceptedCount}
            </span>
            <span className="ml-2 text-sm text-emerald-600">Accepted</span>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-2xl font-bold text-slate-700">
              {proposals.length}
            </span>
            <span className="ml-2 text-sm text-slate-600">Total</span>
          </div>
        </div>
      )}

      {/* Proposals List */}
      {proposals.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <svg
              className="h-8 w-8 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            No Match Proposals Yet
          </h3>
          <p className="mx-auto max-w-sm text-gray-500">
            Dispatchers will propose truck matches for your posted loads.
            Proposals will appear here for you to track.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal) => (
            <div
              key={proposal.id}
              className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition-colors hover:border-slate-300"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      statusColors[proposal.status] ||
                      "bg-slate-500/10 text-slate-600"
                    }`}
                  >
                    {proposal.status}
                  </span>
                  <span className="text-sm text-slate-500">
                    {formatDate(proposal.createdAt)}
                  </span>
                  {proposal.status === "PENDING" && (
                    <span className="text-xs text-amber-600">
                      Expires {formatDate(proposal.expiresAt)}
                    </span>
                  )}
                </div>
                <Link
                  href={`/shipper/loads/${proposal.loadId}`}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  View Load
                </Link>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* Load Route */}
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="mb-1 text-xs font-medium text-slate-500">
                    Load
                  </div>
                  <div className="font-semibold text-slate-800">
                    {proposal.load.pickupCity || "N/A"} →{" "}
                    {proposal.load.deliveryCity || "N/A"}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {proposal.load.truckType} •{" "}
                    {Number(proposal.load.weight).toLocaleString()} kg
                  </div>
                </div>

                {/* Truck */}
                <div className="rounded-lg bg-blue-50 p-3">
                  <div className="mb-1 text-xs font-medium text-blue-600">
                    Proposed Truck
                  </div>
                  <div className="font-semibold text-slate-800">
                    {proposal.truck.licensePlate}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {proposal.truck.truckType} •{" "}
                    {Number(proposal.truck.capacity).toLocaleString()} kg
                  </div>
                </div>

                {/* Carrier */}
                <div className="rounded-lg bg-emerald-50 p-3">
                  <div className="mb-1 text-xs font-medium text-emerald-600">
                    Carrier
                  </div>
                  <div className="font-semibold text-slate-800">
                    {proposal.carrier.name}
                  </div>
                  {proposal.proposedRate && (
                    <div className="mt-1 text-sm text-slate-500">
                      Rate: {formatCurrency(Number(proposal.proposedRate))}
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {proposal.notes && (
                <div className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
                  <span className="font-medium">Notes:</span> {proposal.notes}
                </div>
              )}

              {/* Response */}
              {proposal.respondedAt && proposal.responseNotes && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <span className="font-medium text-slate-700">
                    Carrier Response:
                  </span>{" "}
                  <span className="text-slate-600">
                    {proposal.responseNotes}
                  </span>
                </div>
              )}

              {/* Proposed by */}
              {proposal.proposedBy && (
                <div className="mt-2 text-xs text-slate-400">
                  Proposed by {proposal.proposedBy.firstName}{" "}
                  {proposal.proposedBy.lastName}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
