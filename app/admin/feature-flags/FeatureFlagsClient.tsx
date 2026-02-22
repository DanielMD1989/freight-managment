"use client";

/**
 * Feature Flags Client Component
 *
 * Sprint 10 - Story 10.7: Feature Flag System
 *
 * Fetches flags from /api/feature-flags and persists changes
 * via PATCH /api/feature-flags/[key].
 */

import { useState, useEffect, useCallback } from "react";

interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  category: "core" | "experimental" | "beta" | "deprecated";
  rolloutPercentage: number;
  updatedAt?: string;
  updatedBy?: string;
}

async function fetchCsrfToken(): Promise<string> {
  const res = await fetch("/api/csrf-token");
  const data = await res.json();
  return data.csrfToken;
}

export default function FeatureFlagsClient() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const loadFlags = useCallback(async () => {
    try {
      const res = await fetch("/api/feature-flags");
      if (!res.ok) throw new Error("Failed to fetch flags");
      const data = await res.json();
      setFlags(data.flags || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load flags");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  const handleToggle = async (flag: FeatureFlag) => {
    setSaving(flag.key);
    const prev = flags;

    // Optimistic update
    setFlags((f) =>
      f.map((ff) =>
        ff.key === flag.key ? { ...ff, enabled: !ff.enabled } : ff
      )
    );

    try {
      const csrfToken = await fetchCsrfToken();
      const res = await fetch(`/api/feature-flags/${flag.key}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ enabled: !flag.enabled }),
      });

      if (!res.ok) {
        throw new Error("Failed to update flag");
      }

      const data = await res.json();
      setFlags((f) =>
        f.map((ff) => (ff.key === flag.key ? { ...ff, ...data.flag } : ff))
      );
    } catch {
      // Rollback on error
      setFlags(prev);
      setError(`Failed to toggle ${flag.name}`);
    } finally {
      setSaving(null);
    }
  };

  const handleRolloutChange = async (flag: FeatureFlag, percentage: number) => {
    const prev = flags;

    // Optimistic update
    setFlags((f) =>
      f.map((ff) =>
        ff.key === flag.key ? { ...ff, rolloutPercentage: percentage } : ff
      )
    );

    try {
      const csrfToken = await fetchCsrfToken();
      const res = await fetch(`/api/feature-flags/${flag.key}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ rolloutPercentage: percentage }),
      });

      if (!res.ok) throw new Error("Failed to update rollout");
    } catch {
      setFlags(prev);
      setError(`Failed to update rollout for ${flag.name}`);
    }
  };

  const filteredFlags = flags.filter((flag) => {
    if (filterCategory !== "all" && flag.category !== filterCategory) {
      return false;
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        flag.name.toLowerCase().includes(query) ||
        flag.key.toLowerCase().includes(query) ||
        flag.description.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const getCategoryBadge = (category: FeatureFlag["category"]) => {
    const styles = {
      core: "bg-blue-100 text-blue-800",
      experimental: "bg-purple-100 text-purple-800",
      beta: "bg-yellow-100 text-yellow-800",
      deprecated: "bg-gray-100 text-gray-800",
    };

    const labels = {
      core: "Core",
      experimental: "Experimental",
      beta: "Beta",
      deprecated: "Deprecated",
    };

    return (
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[category]}`}
      >
        {labels[category]}
      </span>
    );
  };

  const stats = {
    total: flags.length,
    enabled: flags.filter((f) => f.enabled).length,
    core: flags.filter((f) => f.category === "core").length,
    experimental: flags.filter((f) => f.category === "experimental").length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-2 h-4 w-20 rounded bg-gray-200" />
              <div className="h-8 w-12 rounded bg-gray-200" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500 shadow-sm">
          Loading feature flags...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
          <span className="text-sm text-red-800">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-600">Total Flags</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-600">Enabled</div>
          <div className="text-2xl font-bold text-green-600">
            {stats.enabled}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-600">Core Features</div>
          <div className="text-2xl font-bold text-blue-600">{stats.core}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-600">Experimental</div>
          <div className="text-2xl font-bold text-purple-600">
            {stats.experimental}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search flags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              <option value="core">Core</option>
              <option value="beta">Beta</option>
              <option value="experimental">Experimental</option>
              <option value="deprecated">Deprecated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Flags List */}
      <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
        {filteredFlags.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No feature flags found
          </div>
        ) : (
          filteredFlags.map((flag) => (
            <div key={flag.key} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">{flag.name}</h3>
                    {getCategoryBadge(flag.category)}
                  </div>
                  <p className="mb-2 text-sm text-gray-600">
                    {flag.description}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <code className="rounded bg-gray-100 px-2 py-0.5">
                      {flag.key}
                    </code>
                    {flag.updatedAt && (
                      <span>
                        Modified:{" "}
                        {new Date(flag.updatedAt).toLocaleDateString()}
                      </span>
                    )}
                    {flag.updatedBy && <span>By: {flag.updatedBy}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Rollout Percentage */}
                  {flag.enabled && (
                    <div className="text-right">
                      <label className="mb-1 block text-xs text-gray-500">
                        Rollout
                      </label>
                      <select
                        value={flag.rolloutPercentage}
                        onChange={(e) =>
                          handleRolloutChange(flag, Number(e.target.value))
                        }
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                      >
                        <option value={0}>0%</option>
                        <option value={10}>10%</option>
                        <option value={25}>25%</option>
                        <option value={50}>50%</option>
                        <option value={75}>75%</option>
                        <option value={100}>100%</option>
                      </select>
                    </div>
                  )}

                  {/* Toggle Switch */}
                  <button
                    onClick={() => handleToggle(flag)}
                    disabled={saving === flag.key}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${flag.enabled ? "bg-green-500" : "bg-gray-300"} ${saving === flag.key ? "cursor-wait opacity-50" : "cursor-pointer"} `}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${flag.enabled ? "translate-x-6" : "translate-x-1"} `}
                    />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Warning */}
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <div className="flex gap-2">
          <span className="text-yellow-600">&#9888;</span>
          <div>
            <p className="text-sm font-medium text-yellow-800">
              Caution: Feature flag changes take effect immediately
            </p>
            <p className="mt-1 text-sm text-yellow-700">
              Disabling core features may affect platform functionality. Changes
              are logged in the audit trail.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
