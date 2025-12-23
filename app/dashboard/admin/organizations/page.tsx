"use client";

import { useEffect, useState } from "react";

interface Organization {
  id: string;
  name: string;
  type: string;
  verificationType: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  createdAt: string;
  _count?: {
    users: number;
    loads?: number;
    trucks?: number;
  };
}

export default function AdminOrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const response = await fetch("/api/organizations");
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations || []);
      }
    } catch (error) {
      console.error("Failed to fetch organizations:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeBadge = (type: string) => {
    const badges: Record<string, string> = {
      SHIPPER: "bg-green-100 text-green-800",
      CARRIER_COMPANY: "bg-yellow-100 text-yellow-800",
      CARRIER_INDIVIDUAL: "bg-yellow-100 text-yellow-800",
      LOGISTICS_AGENT: "bg-indigo-100 text-indigo-800",
    };
    return badges[type] || "bg-gray-100 text-gray-800";
  };

  const getVerificationBadge = (verification: string) => {
    const badges: Record<string, string> = {
      VERIFIED: "bg-green-100 text-green-800",
      PENDING: "bg-yellow-100 text-yellow-800",
      UNVERIFIED: "bg-gray-100 text-gray-800",
    };
    return badges[verification] || "bg-gray-100 text-gray-800";
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Organization Management
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          View and manage all organizations on the platform
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading...</p>
        </div>
      ) : organizations.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No organizations found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {organizations.map((org) => (
            <div
              key={org.id}
              className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {org.name}
                    </h3>
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getTypeBadge(
                        org.type
                      )}`}
                    >
                      {org.type.replace(/_/g, " ")}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getVerificationBadge(
                        org.verificationType
                      )}`}
                    >
                      {org.verificationType === "VERIFIED" && "✓ "}
                      {org.verificationType}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-4">
                    {org.contactEmail && (
                      <div>
                        <span className="font-medium">Email:</span>{" "}
                        {org.contactEmail}
                      </div>
                    )}
                    {org.contactPhone && (
                      <div>
                        <span className="font-medium">Phone:</span>{" "}
                        {org.contactPhone}
                      </div>
                    )}
                    <div>
                      <span className="font-medium">Created:</span>{" "}
                      {new Date(org.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {org.address && (
                    <div className="text-sm text-gray-600 mb-4">
                      <span className="font-medium">Address:</span> {org.address}
                    </div>
                  )}

                  {org._count && (
                    <div className="flex items-center space-x-6 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">
                          {org._count.users}
                        </span>{" "}
                        <span className="text-gray-500">
                          user{org._count.users !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {org._count.loads !== undefined && (
                        <div>
                          <span className="font-medium text-gray-700">
                            {org._count.loads}
                          </span>{" "}
                          <span className="text-gray-500">
                            load{org._count.loads !== 1 ? "s" : ""}
                          </span>
                        </div>
                      )}
                      {org._count.trucks !== undefined && (
                        <div>
                          <span className="font-medium text-gray-700">
                            {org._count.trucks}
                          </span>{" "}
                          <span className="text-gray-500">
                            truck{org._count.trucks !== 1 ? "s" : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="ml-4">
                  <button
                    className="text-sm font-medium text-blue-600 hover:text-blue-500"
                    onClick={() =>
                      alert(
                        "Organization detail view and verification tools coming in Phase 2"
                      )
                    }
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {organizations.length > 0 && (
        <div className="mt-4 text-sm text-gray-600">
          Showing {organizations.length} organization
          {organizations.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
