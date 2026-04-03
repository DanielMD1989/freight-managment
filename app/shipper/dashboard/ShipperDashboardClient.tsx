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

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import DateRangePicker, {
  getDefaultDateRange,
  type DateRangeValue,
} from "@/components/DateRangePicker";
import {
  StatCard,
  DashboardSection,
  QuickActionButton,
  StatusBadge,
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
  charts?: {
    loadsOverTime: Array<{ date: string; count: number }>;
    spendingOverTime: Array<{ date: string; amount: number }>;
  };
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
  activeLoads: Load[];
  postedLoads: Load[];
  recentDeliveries: Load[];
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
  activeLoads,
  postedLoads,
  recentDeliveries,
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

  // Chart data with date range picker
  const [dateRange, setDateRange] = useState<DateRangeValue>(
    getDefaultDateRange("30d")
  );
  const [chartData, setChartData] = useState<{
    loadsOverTime: Array<{ date: string; count: number }>;
    spendingOverTime: Array<{ date: string; amount: number }>;
  }>({
    loadsOverTime: dashboardData?.charts?.loadsOverTime || [],
    spendingOverTime: dashboardData?.charts?.spendingOverTime || [],
  });

  const fetchChartData = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      const res = await fetch(`/api/shipper/dashboard?${params}`);
      if (res.ok) {
        const data = await res.json();
        setChartData({
          loadsOverTime: data.charts?.loadsOverTime || [],
          spendingOverTime: data.charts?.spendingOverTime || [],
        });
      }
    } catch {
      // keep existing data on error
    }
  }, [dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  const firstName =
    user.name?.split(" ")[0] || user.email?.split("@")[0] || "Shipper";
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

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
              action={{
                label: "View All",
                href: "/shipper/loads?status=active",
              }}
              noPadding
            >
              {activeLoads.length > 0 ? (
                <div
                  className="divide-y"
                  style={{ borderColor: "var(--border)" }}
                >
                  {activeLoads.slice(0, 5).map((load) => (
                    <Link
                      key={load.id}
                      href={
                        load.status === "IN_TRANSIT"
                          ? `/shipper/loads/${load.id}/tracking`
                          : `/shipper/loads/${load.id}`
                      }
                      className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-[var(--bg-tinted)]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span
                            className="text-sm font-medium"
                            style={{ color: "var(--foreground)" }}
                          >
                            Load #{load.id.slice(-6)}
                          </span>
                          <span style={{ color: "var(--foreground-muted)" }}>
                            •
                          </span>
                          <span
                            className="truncate text-sm"
                            style={{ color: "var(--foreground-muted)" }}
                          >
                            {load.pickupCity} → {load.deliveryCity}
                          </span>
                        </div>
                        <div
                          className="flex items-center gap-2 text-xs"
                          style={{ color: "var(--foreground-muted)" }}
                        >
                          <span>{load.truckType}</span>
                          <span>•</span>
                          <span>{(load.weight || 0).toLocaleString()} kg</span>
                        </div>
                      </div>
                      <StatusBadge status={load.status} />
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
                    Assigned and in-transit loads will appear here
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
              action={{ label: "View All", href: "/shipper/loadboard" }}
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
              action={{ label: "View All", href: "/shipper/loadboard" }}
              noPadding
            >
              {postedLoads.length > 0 ? (
                <div
                  className="divide-y"
                  style={{ borderColor: "var(--border)" }}
                >
                  {postedLoads.slice(0, 4).map((load) => (
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
              {recentDeliveries.length > 0 ? (
                <div
                  className="divide-y"
                  style={{ borderColor: "var(--border)" }}
                >
                  {recentDeliveries.slice(0, 4).map((load) => (
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

          {/* Charts + Documents */}
          <div className="space-y-6">
            {/* Spending Chart (Recharts) */}
            <DashboardSection
              title="Spending Overview"
              subtitle="Your shipping costs"
            >
              <div className="mb-3">
                <DateRangePicker value={dateRange} onChange={setDateRange} />
              </div>
              {chartData.spendingOverTime.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData.spendingOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#064d5115" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) =>
                        new Date(d).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      }
                      tick={{ fontSize: 11, fill: "#064d51" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#064d51" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid rgba(6,77,81,0.15)",
                        borderRadius: "8px",
                        fontSize: "13px",
                      }}
                      labelFormatter={(d) =>
                        new Date(d).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      }
                      formatter={
                        ((value: number) => [
                          `${value.toLocaleString()} ETB`,
                          "Spent",
                        ]) as unknown as (value: unknown) => string
                      }
                    />
                    <Bar
                      dataKey="amount"
                      name="Spending"
                      fill="#1e9c99"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[200px] items-center justify-center text-sm text-[#064d51]/40">
                  No spending data for this period
                </div>
              )}
            </DashboardSection>

            {/* Loads Over Time (Line Chart) */}
            <DashboardSection
              title="Loads Posted"
              subtitle="Load creation trend"
            >
              {chartData.loadsOverTime.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData.loadsOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#064d5115" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) =>
                        new Date(d).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      }
                      tick={{ fontSize: 11, fill: "#064d51" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#064d51" }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid rgba(6,77,81,0.15)",
                        borderRadius: "8px",
                        fontSize: "13px",
                      }}
                      labelFormatter={(d) =>
                        new Date(d).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="Loads"
                      stroke="#064d51"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#064d51" }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[180px] items-center justify-center text-sm text-[#064d51]/40">
                  No load data for this period
                </div>
              )}
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
