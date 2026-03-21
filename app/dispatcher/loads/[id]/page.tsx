/**
 * Dispatcher Load Detail Page
 *
 * Read-only load detail view for dispatchers.
 * G-D3: Dispatcher full visibility per Blueprint §5.
 */

import Link from "next/link";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import DispatcherLoadDetailClient from "./DispatcherLoadDetailClient";

export interface DispatcherLoadDetail {
  id: string;
  status: string;
  pickupCity: string | null;
  deliveryCity: string | null;
  pickupDate: string | null;
  deliveryDate: string | null;
  truckType: string | null;
  weight: number | null;
  cargoDescription: string | null;
  createdAt: string;
  shipper: {
    id: string;
    name: string;
  } | null;
  assignedTruck: {
    id: string;
    licensePlate: string;
    truckType: string;
    carrier: {
      id: string;
      name: string;
    } | null;
  } | null;
  trip: {
    id: string;
    status: string;
    createdAt: string;
    exceptionAt: string | null;
    exceptionReason: string | null;
  } | null;
}

export default async function DispatcherLoadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/dispatcher/loads");
  }

  const session = await verifyToken(sessionCookie.value);

  if (
    !session ||
    (session.role !== "DISPATCHER" &&
      session.role !== "ADMIN" &&
      session.role !== "SUPER_ADMIN")
  ) {
    redirect("/unauthorized");
  }

  const { id } = await params;

  const load = await db.load.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      pickupCity: true,
      deliveryCity: true,
      pickupDate: true,
      deliveryDate: true,
      truckType: true,
      weight: true,
      cargoDescription: true,
      createdAt: true,
      shipper: {
        select: {
          id: true,
          name: true,
        },
      },
      assignedTruck: {
        select: {
          id: true,
          licensePlate: true,
          truckType: true,
          carrier: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      trip: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          exceptionAt: true,
          exceptionReason: true,
        },
      },
    },
  });

  if (!load) {
    notFound();
  }

  const serialized: DispatcherLoadDetail = {
    ...load,
    pickupDate: load.pickupDate?.toISOString() ?? null,
    deliveryDate: load.deliveryDate?.toISOString() ?? null,
    createdAt: load.createdAt.toISOString(),
    weight: load.weight ? Number(load.weight) : null,
    trip: load.trip
      ? {
          ...load.trip,
          createdAt: load.trip.createdAt.toISOString(),
          exceptionAt: load.trip.exceptionAt?.toISOString() ?? null,
        }
      : null,
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-8">
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
          <Link href="/dispatcher/loads" className="hover:text-blue-600">
            Loads
          </Link>
          <span>/</span>
          <span className="font-mono">{load.id.slice(0, 8)}...</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Load Details</h1>
        <p className="mt-2 text-gray-600">
          Read-only view — dispatchers propose matches but cannot modify loads
        </p>
      </div>

      <DispatcherLoadDetailClient load={serialized} />
    </div>
  );
}
