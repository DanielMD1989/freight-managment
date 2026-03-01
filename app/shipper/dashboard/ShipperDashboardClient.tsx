"use client";

/**
 * Shipper Dashboard Client Component
 *
 * Sprint 20 - Dashboard Visual Redesign
 * Clean, minimal, well-proportioned design
 *
 * Stats: Total Loads Posted, Active Shipments, Delivered This Month, Pending Loads, Total Spent
 * Quick Actions: Post New Load, Track Shipments, Find Trucks
 * Sections: Active Shipments, My Posted Loads, Carrier Applications, Recent Deliveries, Spending Overview, Notifications
 */

import React from "react";
import Link from "next/link";
import {
  StatCard,
  DashboardSection,
  QuickActionButton,
  StatusBadge,
  SpendingChart,
  PackageIcon,
  TruckIcon,
  ClockIcon,
  CurrencyIcon,
  MapIcon,
  SearchIcon,
  CheckCircleIcon,
  DocumentIcon,
} from "@/components/dashboard";

interface User {
  userId: string;
  email: string;
  role: string;
  organizationId?: string;
  name?: string;
}

interface Load {
  id: string;
  pickupCity: string;
  deliveryCity: string;
  pickupDate: string;
  truckType: string;
  weight: number;
  shipperServiceFee?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface Trip {
  id: string;
  loadId: string;
  status: string;
  truck: {
    plateNumber: string;
    truckType: string;
  };
  carrier: {
    name: string;
  };
  pickupLocation?: {
    address: string;
  };
  deliveryLocation?: {
    address: string;
  };
}

interface DashboardData {
  stats?: {
    totalLoads: number;
    activeLoads: number;
    inTransitLoads: number;
    deliveredLoads: number;
    totalSpent: number;
    pendingPayments: number;
  };
  loadsByStatus?: Array<{ status: string; count: number }>;
}

interface CarrierApplication {
  id: string;
  loadId: string;
  status: string;
  createdAt: string;
  carrier?: {
    name: string;
  };
  truck?: {
    licensePlate: string;
    truckType: string;
  };
  load?: {
    pickupCity: string;
    deliveryCity: string;
  };
}

interface ShipperDashboardClientProps {
  user: User;
  dashboardData: DashboardData | null;
  recentLoads: Load[];
  activeTrips: Trip[];
  carrierApplications?: CarrierApplication[];
}

// PlusIcon - keep local as it's not in shared icons yet
const PlusIcon = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 4v16m8-8H4"
    />
  </svg>
);

export default function ShipperDashboardClient({
  user,
  dashboardData,
  recentLoads,
  activeTrips,
  carrierApplications = [],
}: ShipperDashboardClientProps) {
  const stats = dashboardData?.stats || {
    totalLoads: 0,
    activeLoads: 0,
    inTransitLoads: 0,
    deliveredLoads: 0,
    totalSpent: 0,
    pendingPayments: 0,
  };

  const loadsByStatus = dashboardData?.loadsByStatus || [];

  const firstName =
    user.name?.split(" ")[0] || user.email?.split("@")[0] || "Shipper";
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Filter delivered loads
  const deliveredLoads = recentLoads.filter(
    (l) => l.status === "DELIVERED" || l.status === "COMPLETED"
  );

  // Filter pending applications
  const pendingApplications = carrierApplications.filter(
    (a) => a.status === "PENDING"
  );

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="mx-auto max-w-[1400px]">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1
                className="text-2xl font-bold tracking-tight lg:text-[28px]"
                style={{ color: "var(--foreground)" }}
              >
                Welcome back, {firstName}
              </h1>
              <p
                className="mt-1 text-sm"
                style={{ color: "var(--foreground-muted)" }}
              >
                {today}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid - 5 cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5 lg:gap-5">
          <StatCard
            title="Total Loads Posted"
            value={stats.totalLoads}
            icon={<PackageIcon />}
            color="primary"
          />
          <StatCard
            title="Active Shipments"
            value={stats.inTransitLoads}
            icon={<TruckIcon />}
            color="accent"
            trend={
              stats.inTransitLoads > 0
                ? { value: "In transit", positive: true }
                : undefined
            }
          />
          <StatCard
            title="Delivered This Month"
            value={stats.deliveredLoads}
            icon={<CheckCircleIcon />}
            color="success"
          />
          <StatCard
            title="Pending Loads"
            value={stats.activeLoads}
            icon={<ClockIcon />}
            color="warning"
          />
          <StatCard
            title="Total Spent"
            value={`${stats.totalSpent.toLocaleString()} ETB`}
            subtitle={
              stats.pendingPayments > 0
                ? `${stats.pendingPayments.toLocaleString()} ETB pending`
                : "This month"
            }
            icon={<CurrencyIcon />}
            color="secondary"
          />
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2
            className="mb-4 text-lg font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            Quick Actions
          </h2>
          <div className="flex flex-wrap gap-3">
            <QuickActionButton
              href="/shipper/loads/create"
              icon={<PlusIcon />}
              label="Post New Load"
              description="Create a shipment"
              variant="primary"
            />
            <QuickActionButton
              href="/shipper/map"
              icon={<MapIcon />}
              label="Track Shipments"
              description="Live GPS tracking"
              variant="outline"
            />
            <QuickActionButton
              href="/shipper/loadboard?tab=SEARCH_TRUCKS"
              icon={<SearchIcon />}
              label="Find Trucks"
              description="Search carriers"
              variant="outline"
            />
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Active Shipments - 2/3 width */}
          <div className="lg:col-span-2">
            <DashboardSection
              title="Active Shipments"
              subtitle="Shipments currently in progress"
              action={{ label: "View All", href: "/shipper/map" }}
              noPadding
            >
              {activeTrips.length > 0 ? (
                <div
                  className="divide-y"
                  style={{ borderColor: "var(--border)" }}
                >
                  {activeTrips.slice(0, 5).map((trip) => (
                    <Link
                      key={trip.id}
                      href="/shipper/map"
                      className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-[var(--bg-tinted)]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span
                            className="text-sm font-medium"
                            style={{ color: "var(--foreground)" }}
                          >
                            Load #{trip.loadId.slice(-6)}
                          </span>
                          <span style={{ color: "var(--foreground-muted)" }}>
                            •
                          </span>
                          <span
                            className="truncate text-sm"
                            style={{ color: "var(--foreground-muted)" }}
                          >
                            {trip.carrier?.name || "Unknown Carrier"}
                          </span>
                        </div>
                        <div
                          className="flex items-center gap-2 text-xs"
                          style={{ color: "var(--foreground-muted)" }}
                        >
                          <span>{trip.truck?.plateNumber || "-"}</span>
                          <span>•</span>
                          <span>{trip.truck?.truckType || "-"}</span>
                        </div>
                      </div>
                      <StatusBadge status={trip.status} />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div
                    className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                    style={{ background: "var(--bg-tinted)" }}
                  >
                    <TruckIcon />
                  </div>
                  <p
                    className="mb-1 text-sm font-medium"
                    style={{ color: "var(--foreground)" }}
                  >
                    No active shipments
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    Your shipments will appear here once in transit
                  </p>
                </div>
              )}
            </DashboardSection>
          </div>

          {/* Recent Activity - 1/3 width */}
          <div>
            <DashboardSection
              title="Recent Activity"
              subtitle="Latest updates"
              noPadding
            >
              <div
                className="divide-y"
                style={{ borderColor: "var(--border)" }}
              >
                {recentLoads.length > 0 ? (
                  recentLoads.slice(0, 4).map((load) => (
                    <Link
                      key={load.id}
                      href={`/shipper/loads/${load.id}`}
                      className="flex items-start gap-3 px-6 py-4 transition-colors hover:bg-[var(--bg-tinted)]"
                    >
                      <div
                        className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full"
                        style={{
                          background:
                            load.status === "DELIVERED"
                              ? "var(--success-500)"
                              : "var(--primary-500)",
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-sm font-medium"
                          style={{ color: "var(--foreground)" }}
                        >
                          {load.pickupCity} → {load.deliveryCity}
                        </p>
                        <p
                          className="mt-0.5 text-xs"
                          style={{ color: "var(--foreground-muted)" }}
                        >
                          {new Date(load.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <StatusBadge status={load.status} />
                    </Link>
                  ))
                ) : (
                  <div className="py-8 text-center">
                    <p
                      className="text-sm"
                      style={{ color: "var(--foreground-muted)" }}
                    >
                      No recent activity
                    </p>
                  </div>
                )}
              </div>
            </DashboardSection>
          </div>
        </div>

        {/* Second Row */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* My Posted Loads */}
          <div className="lg:col-span-2">
            <DashboardSection
              title="My Posted Loads"
              subtitle="Your active load postings"
              action={{ label: "View All", href: "/shipper/loads" }}
              noPadding
            >
              {recentLoads.filter((l) => l.status === "POSTED").length > 0 ? (
                <div
                  className="divide-y"
                  style={{ borderColor: "var(--border)" }}
                >
                  {recentLoads
                    .filter((l) => l.status === "POSTED")
                    .slice(0, 4)
                    .map((load) => (
                      <Link
                        key={load.id}
                        href={`/shipper/loads/${load.id}`}
                        className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-[var(--bg-tinted)]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <span
                              className="text-sm font-medium"
                              style={{ color: "var(--foreground)" }}
                            >
                              {load.pickupCity}
                            </span>
                            <svg
                              className="h-4 w-4"
                              style={{ color: "var(--foreground-muted)" }}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17 8l4 4m0 0l-4 4m4-4H3"
                              />
                            </svg>
                            <span
                              className="text-sm font-medium"
                              style={{ color: "var(--foreground)" }}
                            >
                              {load.deliveryCity}
                            </span>
                          </div>
                          <div
                            className="flex items-center gap-2 text-xs"
                            style={{ color: "var(--foreground-muted)" }}
                          >
                            <span>{load.truckType}</span>
                            <span>•</span>
                            <span>
                              {(load.weight || 0).toLocaleString()} kg
                            </span>
                            <span>•</span>
                            <span>
                              {new Date(load.pickupDate).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className="text-sm font-semibold"
                            style={{ color: "var(--foreground)" }}
                          >
                            {(load.shipperServiceFee || 0).toLocaleString()} ETB
                          </div>
                        </div>
                      </Link>
                    ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div
                    className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                    style={{ background: "var(--bg-tinted)" }}
                  >
                    <PackageIcon />
                  </div>
                  <p
                    className="mb-1 text-sm font-medium"
                    style={{ color: "var(--foreground)" }}
                  >
                    No posted loads
                  </p>
                  <p
                    className="mb-4 text-xs"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    Post your first load to find carriers
                  </p>
                  <Link
                    href="/shipper/loads/create"
                    className="bg-primary-500 hover:bg-primary-600 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
                  >
                    <PlusIcon />
                    Post New Load
                  </Link>
                </div>
              )}
            </DashboardSection>
          </div>

          {/* Carrier Applications */}
          <div>
            <DashboardSection
              title="Carrier Applications"
              subtitle="Bids on your loads"
              action={{ label: "View All", href: "/shipper/requests" }}
              noPadding
            >
              {pendingApplications.length > 0 ? (
                <div
                  className="divide-y"
                  style={{ borderColor: "var(--border)" }}
                >
                  {pendingApplications.slice(0, 4).map((app) => (
                    <Link
                      key={app.id}
                      href={`/shipper/requests/${app.id}`}
                      className="flex items-start gap-3 px-6 py-4 transition-colors hover:bg-[var(--bg-tinted)]"
                    >
                      <div
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                        style={{ background: "var(--bg-tinted)" }}
                      >
                        <TruckIcon />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-sm font-medium"
                          style={{ color: "var(--foreground)" }}
                        >
                          {app.carrier?.name || "Carrier"}
                        </p>
                        <p
                          className="mt-0.5 text-xs"
                          style={{ color: "var(--foreground-muted)" }}
                        >
                          {app.load?.pickupCity} → {app.load?.deliveryCity}
                        </p>
                      </div>
                      <StatusBadge status={app.status} />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <div
                    className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full"
                    style={{ background: "var(--bg-tinted)" }}
                  >
                    <TruckIcon />
                  </div>
                  <p
                    className="text-sm"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    No pending applications
                  </p>
                </div>
              )}
            </DashboardSection>
          </div>
        </div>

        {/* Third Row */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Recent Deliveries */}
          <div className="lg:col-span-2">
            <DashboardSection
              title="Recent Deliveries"
              subtitle="Completed shipments"
              action={{ label: "View All", href: "/shipper/trips" }}
              noPadding
            >
              {deliveredLoads.length > 0 ? (
                <div
                  className="divide-y"
                  style={{ borderColor: "var(--border)" }}
                >
                  {deliveredLoads.slice(0, 4).map((load) => (
                    <Link
                      key={load.id}
                      href={`/shipper/loads/${load.id}`}
                      className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-[var(--bg-tinted)]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span
                            className="text-sm font-medium"
                            style={{ color: "var(--foreground)" }}
                          >
                            {load.pickupCity}
                          </span>
                          <svg
                            className="h-4 w-4"
                            style={{ color: "var(--foreground-muted)" }}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 8l4 4m0 0l-4 4m4-4H3"
                            />
                          </svg>
                          <span
                            className="text-sm font-medium"
                            style={{ color: "var(--foreground)" }}
                          >
                            {load.deliveryCity}
                          </span>
                        </div>
                        <div
                          className="flex items-center gap-2 text-xs"
                          style={{ color: "var(--foreground-muted)" }}
                        >
                          <span>{load.truckType}</span>
                          <span>•</span>
                          <span>{(load.weight || 0).toLocaleString()} kg</span>
                          <span>•</span>
                          <span>
                            Delivered{" "}
                            {new Date(load.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className="text-sm font-semibold"
                          style={{ color: "var(--foreground)" }}
                        >
                          {(load.shipperServiceFee || 0).toLocaleString()} ETB
                        </span>
                        <StatusBadge status={load.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div
                    className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                    style={{ background: "var(--bg-tinted)" }}
                  >
                    <CheckCircleIcon />
                  </div>
                  <p
                    className="mb-1 text-sm font-medium"
                    style={{ color: "var(--foreground)" }}
                  >
                    No deliveries yet
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    Completed shipments will appear here
                  </p>
                </div>
              )}
            </DashboardSection>
          </div>

          {/* Spending Overview + Documents */}
          <div className="space-y-6">
            {/* Spending Chart */}
            <DashboardSection
              title="Spending Overview"
              subtitle="Your shipping costs"
            >
              <SpendingChart organizationId={user.organizationId} />
            </DashboardSection>

            {/* Loads by Status */}
            {loadsByStatus.length > 0 && (
              <DashboardSection
                title="Loads by Status"
                subtitle="Distribution of your loads"
              >
                <div className="space-y-3">
                  {loadsByStatus.map((item) => {
                    const total = loadsByStatus.reduce(
                      (sum, s) => sum + s.count,
                      0
                    );
                    const pct = total > 0 ? (item.count / total) * 100 : 0;
                    return (
                      <div
                        key={item.status}
                        className="flex items-center gap-3"
                      >
                        <StatusBadge status={item.status} />
                        <div className="flex-1">
                          <div
                            className="h-2 overflow-hidden rounded-full"
                            style={{ background: "var(--border)" }}
                          >
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${pct}%`,
                                background: "var(--primary-500)",
                              }}
                            />
                          </div>
                        </div>
                        <span
                          className="min-w-[2rem] text-right text-sm font-medium"
                          style={{ color: "var(--foreground)" }}
                        >
                          {item.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </DashboardSection>
            )}

            {/* Documents */}
            <DashboardSection
              title="Documents"
              subtitle="Insurance & contracts"
              action={{ label: "Manage", href: "/shipper/documents" }}
              noPadding
            >
              <div className="space-y-3 p-4">
                <Link
                  href="/shipper/documents"
                  className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-[var(--bg-tinted)]"
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ background: "var(--primary-500)/10" }}
                  >
                    <DocumentIcon />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-medium"
                      style={{ color: "var(--foreground)" }}
                    >
                      Shipping Contracts
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--foreground-muted)" }}
                    >
                      View and manage contracts
                    </p>
                  </div>
                  <svg
                    className="h-4 w-4"
                    style={{ color: "var(--foreground-muted)" }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
                <Link
                  href="/shipper/documents?tab=insurance"
                  className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-[var(--bg-tinted)]"
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ background: "var(--success-500)/10" }}
                  >
                    <CheckCircleIcon />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-medium"
                      style={{ color: "var(--foreground)" }}
                    >
                      Insurance Documents
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--foreground-muted)" }}
                    >
                      Cargo insurance info
                    </p>
                  </div>
                  <svg
                    className="h-4 w-4"
                    style={{ color: "var(--foreground-muted)" }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              </div>
            </DashboardSection>
          </div>
        </div>
      </div>
    </div>
  );
}
