"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatAge } from "@/lib/loadUtils";

interface Load {
  id: string;
  pickupCity: string;
  deliveryCity: string;
  pickupDate: string;
  deliveryDate: string;
  truckType: string;
  rate: number;
  status: string;
  weight?: number;
  isAnonymous: boolean;
  createdAt: string;
  // [NEW] Grid fields
  postedAt?: string;
  ageMinutes?: number;
  tripKm?: number;
  dhToOriginKm?: number;
  dhAfterDeliveryKm?: number;
  fullPartial?: string;
  bookMode?: string;
  lengthM?: number;
  casesCount?: number;
  dtpReference?: string;
  factorRating?: string;
  rpmEtbPerKm?: number;
  trpmEtbPerKm?: number;
  shipper?: {
    id: string;
    name: string;
    isVerified: boolean;
  };
}

export default function MyLoadsPage() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetchLoads();
  }, [filter]);

  const fetchLoads = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("myLoads", "true");
      if (filter !== "all") {
        params.set("status", filter);
      }

      const response = await fetch(`/api/loads?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setLoads(data.loads || []);
      }
    } catch (error) {
      console.error("Failed to fetch loads:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      DRAFT: "bg-gray-100 text-gray-800",
      POSTED: "bg-blue-100 text-blue-800",
      ASSIGNED: "bg-yellow-100 text-yellow-800",
      IN_TRANSIT: "bg-purple-100 text-purple-800",
      DELIVERED: "bg-green-100 text-green-800",
      CANCELLED: "bg-red-100 text-red-800",
    };
    return badges[status] || "bg-gray-100 text-gray-800";
  };

  const deleteLoad = async (id: string) => {
    if (!confirm("Are you sure you want to delete this load?")) return;

    try {
      const response = await fetch(`/api/loads/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchLoads(); // Refresh the list
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete load");
      }
    } catch (error) {
      console.error("Failed to delete load:", error);
      alert("Failed to delete load");
    }
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">My Loads</h1>
        <Link
          href="/dashboard/loads/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
        >
          + Create New Load
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 flex space-x-2">
        {["all", "DRAFT", "POSTED", "ASSIGNED", "IN_TRANSIT", "DELIVERED"].map(
          (status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`rounded-md px-3 py-1 text-sm font-medium ${
                filter === status
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              } border`}
            >
              {status === "all" ? "All" : status}
            </button>
          )
        )}
      </div>

      {/* Loads Grid - DAT Style */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading...</p>
        </div>
      ) : loads.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 mb-4">No loads found</p>
          <Link
            href="/dashboard/loads/new"
            className="text-blue-600 hover:text-blue-500 font-medium"
          >
            Create your first load →
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Age
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pickup
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Truck
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  F/P
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  DH-O
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Origin
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trip
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Destination
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  DH-D
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Length
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Weight
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cs
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  DTP
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Factor
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rate
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Book
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  RPM
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  tRPM
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loads.map((load) => (
                <tr key={load.id} className="hover:bg-gray-50">
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {load.ageMinutes !== undefined
                      ? formatAge(load.ageMinutes)
                      : "—"}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(load.pickupDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {load.truckType.replace(/_/g, " ")}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {load.fullPartial || "—"}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {load.dhToOriginKm || "—"}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {load.pickupCity}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {load.tripKm || "—"}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {load.deliveryCity}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {load.dhAfterDeliveryKm || "—"}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {load.shipper?.name || "—"}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {load.lengthM ? `${load.lengthM}m` : "—"}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {load.weight ? `${load.weight}kg` : "—"}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {load.casesCount || "—"}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {load.dtpReference || "—"}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {load.factorRating || "—"}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                    {load.rate.toLocaleString()} ETB
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {load.bookMode || "—"}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {load.rpmEtbPerKm || "—"}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {load.trpmEtbPerKm || "—"}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusBadge(
                        load.status
                      )}`}
                    >
                      {load.status}
                    </span>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm">
                    <div className="flex flex-col space-y-1">
                      <Link
                        href={`/dashboard/loads/${load.id}`}
                        className="text-blue-600 hover:text-blue-500 font-medium"
                      >
                        View
                      </Link>
                      {(load.status === "DRAFT" ||
                        load.status === "POSTED") && (
                        <>
                          <Link
                            href={`/dashboard/loads/${load.id}/edit`}
                            className="text-gray-600 hover:text-gray-500 font-medium"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => deleteLoad(load.id)}
                            className="text-red-600 hover:text-red-500 font-medium text-left"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
