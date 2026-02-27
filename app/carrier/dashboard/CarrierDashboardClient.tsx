"use client";

/**
 * Carrier Dashboard Client Component
 *
 * Sprint 20 - Dashboard Visual Redesign
 * Clean, minimal, well-proportioned design
 *
 * Stats: Total Trucks, Active Trucks, On Job, Pending Approvals, Total Earnings
 * Quick Actions: Post Truck, Search Loads, Register Truck
 * Sections: Active Jobs, Available Loads, Recent Activity, Fleet Overview, Notifications
 */

import React from "react";
import Link from "next/link";
import {
  StatCard,
  DashboardSection,
  QuickActionButton,
  StatusBadge,
  EarningsChart,
  TruckIcon,
  ClockIcon,
  CurrencyIcon,
  PackageIcon,
  MapIcon,
  SearchIcon,
  CheckCircleIcon,
} from "@/components/dashboard";
import { formatCurrency } from "@/lib/formatters";

interface DashboardData {
  totalTrucks: number;
  activeTrucks: number;
  activePostings: number;
  completedDeliveries: number;
  inTransitTrips?: number;
  totalServiceFeesPaid: number;
  totalDistance?: number;
  wallet: {
    balance: number;
    currency: string;
  };
  recentPostings: number;
  pendingApprovals?: number;
}

interface Load {
  id: string;
  pickupCity: string;
  deliveryCity: string;
  status: string;
  price?: number;
  weight?: number;
  distance?: number;
  equipmentType?: string;
  truckType?: string;
  pickupDate?: string;
  deliveryDate?: string;
  eta?: string;
  createdAt: string;
}

interface User {
  userId: string;
  email: string;
  role: string;
  organizationId?: string;
  name?: string;
}

interface Truck {
  id: string;
  isAvailable: boolean;
  licensePlate?: string;
  truckType?: string;
  status?: string;
}

interface CarrierDashboardClientProps {
  user: User;
  dashboardData: DashboardData | null;
  recentLoads: Load[];
  trucks: Truck[];
  recommendedLoads?: Load[];
  activeLoad?: Load | null;
}

// PlusIcon and FleetIcon - keep local as they're not in shared icons yet
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

const FleetIcon = () => (
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
      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
    />
  </svg>
);

export default function CarrierDashboardClient({
  user,
  dashboardData,
  recentLoads,
  trucks,
  recommendedLoads,
}: CarrierDashboardClientProps) {
  const data = dashboardData || {
    totalTrucks: 0,
    activeTrucks: 0,
    activePostings: 0,
    completedDeliveries: 0,
    inTransitTrips: 0,
    totalServiceFeesPaid: 0,
    totalDistance: 0,
    wallet: { balance: 0, currency: "ETB" },
    recentPostings: 0,
    pendingApprovals: 0,
  };

  // Use dashboard API data for accurate counts (trucks prop is limited to 5 for display)
  const totalTrucks = data.totalTrucks;
  const availableTrucks = data.activeTrucks;
  const trucksOnJob = totalTrucks - availableTrucks;
  const firstName =
    user.name?.split(" ")[0] || user.email?.split("@")[0] || "Carrier";
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Get active loads (in transit or assigned)
  const activeJobs = recentLoads.filter(
    (l) =>
      l.status === "IN_TRANSIT" ||
      l.status === "ASSIGNED" ||
      l.status === "PICKED_UP"
  );

  // Get recommended loads
  const availableLoads = (
    recommendedLoads || recentLoads.filter((l) => l.status === "POSTED")
  ).slice(0, 4);

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
            title="Total Trucks"
            value={totalTrucks}
            icon={<TruckIcon />}
            color="primary"
          />
          <StatCard
            title="Available Trucks"
            value={availableTrucks}
            icon={<CheckCircleIcon />}
            color="success"
            subtitle="Ready for jobs"
          />
          <StatCard
            title="Trucks on Job"
            value={trucksOnJob}
            icon={<MapIcon />}
            color="accent"
            trend={
              trucksOnJob > 0 ? { value: "Active", positive: true } : undefined
            }
          />
          <StatCard
            title="Pending Approvals"
            value={data.pendingApprovals || 0}
            icon={<ClockIcon />}
            color="warning"
          />
          <StatCard
            title="Wallet Balance"
            value={formatCurrency(data.wallet.balance, data.wallet.currency)}
            subtitle="This month"
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
              href="/carrier/loadboard?tab=POST_TRUCKS"
              icon={<PlusIcon />}
              label="Post Truck"
              description="Make truck available"
              variant="primary"
            />
            <QuickActionButton
              href="/carrier/loadboard?tab=SEARCH_LOADS"
              icon={<SearchIcon />}
              label="Search Loads"
              description="Find freight to haul"
              variant="outline"
            />
            <QuickActionButton
              href="/carrier/trucks/add"
              icon={<TruckIcon />}
              label="Register Truck"
              description="Add new vehicle"
              variant="outline"
            />
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Active Jobs - 2/3 width */}
          <div className="lg:col-span-2">
            <DashboardSection
              title="My Active Jobs"
              subtitle="Currently assigned loads"
              action={{ label: "View All", href: "/carrier/map" }}
              noPadding
            >
              {activeJobs.length > 0 ? (
                <div
                  className="divide-y"
                  style={{ borderColor: "var(--border)" }}
                >
                  {activeJobs.slice(0, 5).map((load) => (
                    <Link
                      key={load.id}
                      href={`/carrier/loads/${load.id}`}
                      className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-[var(--bg-tinted)]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span
                            className="text-sm font-medium"
                            style={{ color: "var(--foreground)" }}
                          >
                            {load.pickupCity || "N/A"}
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
                            {load.deliveryCity || "N/A"}
                          </span>
                        </div>
                        <div
                          className="flex items-center gap-2 text-xs"
                          style={{ color: "var(--foreground-muted)" }}
                        >
                          {load.truckType && <span>{load.truckType}</span>}
                          {load.weight && (
                            <>
                              <span>•</span>
                              <span>{load.weight.toLocaleString()} kg</span>
                            </>
                          )}
                          {load.eta && (
                            <>
                              <span>•</span>
                              <span>ETA: {load.eta}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {load.price && (
                          <span
                            className="text-sm font-semibold"
                            style={{ color: "var(--foreground)" }}
                          >
                            {formatCurrency(load.price)}
                          </span>
                        )}
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
                    <TruckIcon />
                  </div>
                  <p
                    className="mb-1 text-sm font-medium"
                    style={{ color: "var(--foreground)" }}
                  >
                    No active jobs
                  </p>
                  <p
                    className="mb-4 text-xs"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    Search for loads to find your next job
                  </p>
                  <Link
                    href="/carrier/loadboard?tab=SEARCH_LOADS"
                    className="bg-primary-500 hover:bg-primary-600 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
                  >
                    <SearchIcon />
                    Search Loads
                  </Link>
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
                      href={`/carrier/loads/${load.id}`}
                      className="flex items-start gap-3 px-6 py-4 transition-colors hover:bg-[var(--bg-tinted)]"
                    >
                      <div
                        className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full"
                        style={{
                          background:
                            load.status === "DELIVERED" ||
                            load.status === "COMPLETED"
                              ? "var(--success-500)"
                              : "var(--primary-500)",
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-sm font-medium"
                          style={{ color: "var(--foreground)" }}
                        >
                          {load.pickupCity || "N/A"} →{" "}
                          {load.deliveryCity || "N/A"}
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
          {/* Available Loads */}
          <div className="lg:col-span-2">
            <DashboardSection
              title="Available Loads"
              subtitle="Recommended loads for your fleet"
              action={{
                label: "View All",
                href: "/carrier/loadboard?tab=SEARCH_LOADS",
              }}
              noPadding
            >
              {availableLoads.length > 0 ? (
                <div
                  className="divide-y"
                  style={{ borderColor: "var(--border)" }}
                >
                  {availableLoads.map((load) => (
                    <Link
                      key={load.id}
                      href={`/carrier/loads/${load.id}`}
                      className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-[var(--bg-tinted)]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span
                            className="text-sm font-medium"
                            style={{ color: "var(--foreground)" }}
                          >
                            {load.pickupCity || "N/A"}
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
                            {load.deliveryCity || "N/A"}
                          </span>
                        </div>
                        <div
                          className="flex items-center gap-2 text-xs"
                          style={{ color: "var(--foreground-muted)" }}
                        >
                          {(load.equipmentType || load.truckType) && (
                            <span>
                              {(
                                load.equipmentType ||
                                load.truckType ||
                                ""
                              ).replace(/_/g, " ")}
                            </span>
                          )}
                          {load.weight && (
                            <>
                              <span>•</span>
                              <span>{load.weight.toLocaleString()} kg</span>
                            </>
                          )}
                          {load.distance && (
                            <>
                              <span>•</span>
                              <span>{load.distance} km</span>
                            </>
                          )}
                          {load.pickupDate && (
                            <>
                              <span>•</span>
                              <span>
                                {new Date(load.pickupDate).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {load.price && (
                          <div
                            className="text-sm font-semibold"
                            style={{ color: "var(--foreground)" }}
                          >
                            {formatCurrency(load.price)}
                          </div>
                        )}
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
                    No available loads
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    Check back later for new shipments
                  </p>
                </div>
              )}
            </DashboardSection>
          </div>

          {/* Fleet Overview + Notifications */}
          <div className="space-y-6">
            {/* Fleet Overview */}
            <DashboardSection
              title="Fleet Overview"
              subtitle="Truck status summary"
              action={{ label: "Manage", href: "/carrier/trucks" }}
              noPadding
            >
              {trucks.length > 0 ? (
                <div
                  className="divide-y"
                  style={{ borderColor: "var(--border)" }}
                >
                  {trucks.slice(0, 3).map((truck) => (
                    <Link
                      key={truck.id}
                      href={`/carrier/trucks/${truck.id}`}
                      className="flex items-center justify-between px-6 py-3 transition-colors hover:bg-[var(--bg-tinted)]"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-lg"
                          style={{ background: "var(--bg-tinted)" }}
                        >
                          <TruckIcon />
                        </div>
                        <div>
                          <p
                            className="text-sm font-medium"
                            style={{ color: "var(--foreground)" }}
                          >
                            {truck.licensePlate || "Truck"}
                          </p>
                          <p
                            className="text-xs"
                            style={{ color: "var(--foreground-muted)" }}
                          >
                            {truck.truckType || "Standard"}
                          </p>
                        </div>
                      </div>
                      <StatusBadge
                        status={truck.isAvailable ? "AVAILABLE" : "ON_JOB"}
                      />
                    </Link>
                  ))}
                  {trucks.length > 3 && (
                    <div className="px-6 py-3 text-center">
                      <Link
                        href="/carrier/trucks"
                        className="text-sm font-medium transition-colors"
                        style={{ color: "var(--primary-500)" }}
                      >
                        View all {trucks.length} trucks
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <div
                    className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full"
                    style={{ background: "var(--bg-tinted)" }}
                  >
                    <FleetIcon />
                  </div>
                  <p
                    className="mb-1 text-sm font-medium"
                    style={{ color: "var(--foreground)" }}
                  >
                    No trucks registered
                  </p>
                  <p
                    className="mb-3 text-xs"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    Add your first truck to start
                  </p>
                  <Link
                    href="/carrier/trucks/add"
                    className="bg-primary-500 hover:bg-primary-600 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors"
                  >
                    <PlusIcon />
                    Add Truck
                  </Link>
                </div>
              )}
            </DashboardSection>

            {/* Earnings Chart */}
            <DashboardSection title="Earnings" subtitle="Revenue overview">
              <EarningsChart organizationId={user.organizationId} />
            </DashboardSection>

            {/* Notifications */}
            <DashboardSection
              title="Notifications"
              subtitle="Important updates"
              noPadding
            >
              <div className="py-8 text-center">
                <div
                  className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ background: "var(--bg-tinted)" }}
                >
                  <svg
                    className="h-5 w-5"
                    style={{ color: "var(--foreground-muted)" }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                </div>
                <p
                  className="text-sm"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  No new notifications
                </p>
              </div>
            </DashboardSection>
          </div>
        </div>
      </div>
    </div>
  );
}
