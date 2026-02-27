/**
 * Spending Chart Component
 *
 * Sprint 20 - Story 20.3: Shipper Dashboard
 * Simple bar chart showing spending over time
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "@/lib/formatters";

interface SpendingData {
  period: string;
  amount: number;
  label: string;
}

interface SpendingChartProps {
  organizationId?: string;
}

type ViewMode = "weekly" | "monthly";

export default function SpendingChart({ organizationId }: SpendingChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("weekly");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spending, setSpending] = useState<SpendingData[]>([]);
  const [totalSpending, setTotalSpending] = useState(0);

  const fetchSpending = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/wallet/transactions?limit=100`);

      if (!response.ok) {
        // No wallet yet - show empty state
        setSpending([]);
        setTotalSpending(0);
        setLoading(false);
        return;
      }

      const data = await response.json();
      const transactions = data.transactions || [];

      // Aggregate transactions by period
      const aggregated = aggregateByPeriod(transactions, viewMode);
      setSpending(aggregated.data);
      setTotalSpending(aggregated.total);
    } catch (err) {
      console.error("Error fetching spending:", err);
      setError("Failed to load spending data");
    } finally {
      setLoading(false);
    }
  }, [viewMode]);

  useEffect(() => {
    fetchSpending();
  }, [fetchSpending, organizationId]);

  const aggregateByPeriod = (
    transactions: Array<{ amount: number; createdAt: string }>,
    mode: ViewMode
  ) => {
    const now = new Date();
    const periods: Map<string, { amount: number; label: string }> = new Map();
    let total = 0;

    if (mode === "weekly") {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const key = date.toISOString().split("T")[0];
        const label = date.toLocaleDateString("en-US", { weekday: "short" });
        periods.set(key, { amount: 0, label });
      }
    } else {
      // Last 6 months
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const label = date.toLocaleDateString("en-US", { month: "short" });
        periods.set(key, { amount: 0, label });
      }
    }

    // Aggregate negative transactions (spending) - use absolute value
    transactions.forEach((tx) => {
      if (tx.amount < 0) {
        const date = new Date(tx.createdAt);
        let key: string;

        if (mode === "weekly") {
          key = date.toISOString().split("T")[0];
        } else {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        }

        if (periods.has(key)) {
          const current = periods.get(key)!;
          current.amount += Math.abs(tx.amount);
          total += Math.abs(tx.amount);
        }
      }
    });

    const data: SpendingData[] = [];
    periods.forEach((value, key) => {
      data.push({
        period: key,
        amount: value.amount,
        label: value.label,
      });
    });

    return { data, total };
  };

  const maxAmount = Math.max(...spending.map((e) => e.amount), 1);

  // Deterministic skeleton heights to avoid hydration mismatch
  const skeletonHeights = [55, 40, 75, 50, 30, 65, 45];

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="mb-4 flex items-center justify-between">
          <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-8 w-32 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="flex h-32 items-end gap-2">
          {[...Array(viewMode === "weekly" ? 7 : 6)].map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-gray-200 dark:bg-gray-700"
              style={{
                height: `${skeletonHeights[i % skeletonHeights.length]}%`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header with toggle */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p
            className="text-2xl font-bold"
            style={{ color: "var(--foreground)" }}
          >
            {formatCurrency(totalSpending)}
          </p>
          <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
            {viewMode === "weekly" ? "Last 7 days" : "Last 6 months"}
          </p>
        </div>

        {/* Toggle */}
        <div
          className="flex rounded-lg p-0.5"
          style={{ background: "var(--bg-tinted)" }}
        >
          <button
            onClick={() => setViewMode("weekly")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "weekly" ? "bg-white shadow-sm dark:bg-gray-800" : ""
            }`}
            style={{
              color:
                viewMode === "weekly"
                  ? "var(--foreground)"
                  : "var(--foreground-muted)",
            }}
          >
            Weekly
          </button>
          <button
            onClick={() => setViewMode("monthly")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "monthly"
                ? "bg-white shadow-sm dark:bg-gray-800"
                : ""
            }`}
            style={{
              color:
                viewMode === "monthly"
                  ? "var(--foreground)"
                  : "var(--foreground-muted)",
            }}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* Chart */}
      {error ? (
        <div
          className="py-8 text-center text-sm"
          style={{ color: "var(--foreground-muted)" }}
        >
          {error}
        </div>
      ) : spending.length === 0 || totalSpending === 0 ? (
        <div className="py-8 text-center">
          <div
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "var(--bg-tinted)" }}
          >
            <svg
              className="h-6 w-6"
              style={{ color: "var(--foreground-muted)" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <p
            className="text-sm font-medium"
            style={{ color: "var(--foreground)" }}
          >
            No spending yet
          </p>
          <p
            className="mt-1 text-xs"
            style={{ color: "var(--foreground-muted)" }}
          >
            Your spending will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Bar Chart */}
          <div className="flex h-28 items-end gap-1.5">
            {spending.map((item) => {
              const heightPercent =
                maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
              return (
                <div
                  key={item.period}
                  className="group flex flex-1 flex-col items-center"
                >
                  {/* Tooltip on hover */}
                  <div className="relative w-full">
                    <div className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs font-medium whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {formatCurrency(item.amount)}
                    </div>
                    <div
                      className="w-full rounded-t transition-all duration-300 ease-out hover:opacity-80"
                      style={{
                        height: `${Math.max(heightPercent, 4)}%`,
                        minHeight: "4px",
                        background:
                          item.amount > 0
                            ? "linear-gradient(to top, var(--secondary-500), var(--secondary-400))"
                            : "var(--bg-tinted)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Labels */}
          <div className="flex gap-1.5">
            {spending.map((item) => (
              <div
                key={item.period}
                className="flex-1 text-center text-xs"
                style={{ color: "var(--foreground-muted)" }}
              >
                {item.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
