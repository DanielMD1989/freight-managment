"use client";

/**
 * System Health Client Component
 *
 * Sprint 10 - Story 10.8: System Health Monitoring
 */

import { useState, useEffect } from "react";

interface ServiceHealth {
  name: string;
  status: "healthy" | "degraded" | "down";
  latency: number;
  lastCheck: string;
  uptime: number;
  message?: string;
}

interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  activeConnections: number;
  requestsPerMinute: number;
  errorRate: number;
}

interface HealthData {
  overall: "healthy" | "degraded" | "down";
  services: ServiceHealth[];
  metrics: SystemMetrics;
  lastUpdated: string;
}

export default function SystemHealthClient() {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchHealthData = async () => {
    // Simulate API call with mock data
    await new Promise((resolve) => setTimeout(resolve, 500));

    const mockData: HealthData = {
      overall: "healthy",
      services: [
        {
          name: "Database (PostgreSQL)",
          status: "healthy",
          latency: 12,
          lastCheck: new Date().toISOString(),
          uptime: 99.99,
        },
        {
          name: "Redis Cache",
          status: "healthy",
          latency: 3,
          lastCheck: new Date().toISOString(),
          uptime: 99.95,
        },
        {
          name: "WebSocket Server",
          status: "healthy",
          latency: 8,
          lastCheck: new Date().toISOString(),
          uptime: 99.9,
        },
        {
          name: "GPS Data Processor",
          status: "healthy",
          latency: 45,
          lastCheck: new Date().toISOString(),
          uptime: 99.85,
        },
        {
          name: "Email Service",
          status: "healthy",
          latency: 120,
          lastCheck: new Date().toISOString(),
          uptime: 99.8,
        },
        {
          name: "SMS Gateway",
          status: "healthy",
          latency: 200,
          lastCheck: new Date().toISOString(),
          uptime: 99.7,
        },
        {
          name: "File Storage (S3)",
          status: "healthy",
          latency: 85,
          lastCheck: new Date().toISOString(),
          uptime: 99.99,
        },
        {
          name: "Cron Job Scheduler",
          status: "healthy",
          latency: 5,
          lastCheck: new Date().toISOString(),
          uptime: 99.95,
        },
      ],
      metrics: {
        cpu: 32,
        memory: 58,
        disk: 45,
        activeConnections: 127,
        requestsPerMinute: 1250,
        errorRate: 0.02,
      },
      lastUpdated: new Date().toISOString(),
    };

    setHealthData(mockData);
    setLoading(false);
  };

  useEffect(() => {
    fetchHealthData();

    if (autoRefresh) {
      const interval = setInterval(fetchHealthData, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const getStatusColor = (status: "healthy" | "degraded" | "down"): string => {
    switch (status) {
      case "healthy":
        return "text-green-600 bg-green-100";
      case "degraded":
        return "text-yellow-600 bg-yellow-100";
      case "down":
        return "text-red-600 bg-red-100";
    }
  };

  const getStatusIcon = (status: "healthy" | "degraded" | "down"): string => {
    switch (status) {
      case "healthy":
        return "✓";
      case "degraded":
        return "⚠";
      case "down":
        return "✕";
    }
  };

  const getMetricColor = (
    value: number,
    thresholds: [number, number]
  ): string => {
    if (value < thresholds[0]) return "text-green-600";
    if (value < thresholds[1]) return "text-yellow-600";
    return "text-red-600";
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading system health...</p>
        </div>
      </div>
    );
  }

  if (!healthData) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-red-800">Failed to load health data</p>
        <button
          onClick={fetchHealthData}
          className="mt-2 text-red-600 underline hover:text-red-700"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <div
        className={`rounded-lg p-6 ${
          healthData.overall === "healthy"
            ? "border border-green-200 bg-green-50"
            : healthData.overall === "degraded"
              ? "border border-yellow-200 bg-yellow-50"
              : "border border-red-200 bg-red-50"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full text-3xl ${getStatusColor(healthData.overall)}`}
            >
              {getStatusIcon(healthData.overall)}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                System{" "}
                {healthData.overall === "healthy"
                  ? "Healthy"
                  : healthData.overall === "degraded"
                    ? "Degraded"
                    : "Down"}
              </h2>
              <p className="text-gray-600">
                All {healthData.services.length} services operational
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300"
              />
              Auto-refresh
            </label>
            <button
              onClick={fetchHealthData}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Refresh Now
            </button>
          </div>
        </div>
      </div>

      {/* System Metrics */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-600">CPU Usage</div>
          <div
            className={`text-2xl font-bold ${getMetricColor(healthData.metrics.cpu, [50, 80])}`}
          >
            {healthData.metrics.cpu}%
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full ${healthData.metrics.cpu < 50 ? "bg-green-500" : healthData.metrics.cpu < 80 ? "bg-yellow-500" : "bg-red-500"}`}
              style={{ width: `${healthData.metrics.cpu}%` }}
            />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-600">Memory Usage</div>
          <div
            className={`text-2xl font-bold ${getMetricColor(healthData.metrics.memory, [60, 85])}`}
          >
            {healthData.metrics.memory}%
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full ${healthData.metrics.memory < 60 ? "bg-green-500" : healthData.metrics.memory < 85 ? "bg-yellow-500" : "bg-red-500"}`}
              style={{ width: `${healthData.metrics.memory}%` }}
            />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-600">Disk Usage</div>
          <div
            className={`text-2xl font-bold ${getMetricColor(healthData.metrics.disk, [70, 90])}`}
          >
            {healthData.metrics.disk}%
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full ${healthData.metrics.disk < 70 ? "bg-green-500" : healthData.metrics.disk < 90 ? "bg-yellow-500" : "bg-red-500"}`}
              style={{ width: `${healthData.metrics.disk}%` }}
            />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-600">Active Connections</div>
          <div className="text-2xl font-bold text-blue-600">
            {healthData.metrics.activeConnections}
          </div>
          <div className="mt-2 text-xs text-gray-500">WebSocket + HTTP</div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-600">Requests/min</div>
          <div className="text-2xl font-bold text-blue-600">
            {healthData.metrics.requestsPerMinute.toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-gray-500">API traffic</div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-600">Error Rate</div>
          <div
            className={`text-2xl font-bold ${healthData.metrics.errorRate < 1 ? "text-green-600" : healthData.metrics.errorRate < 5 ? "text-yellow-600" : "text-red-600"}`}
          >
            {healthData.metrics.errorRate}%
          </div>
          <div className="mt-2 text-xs text-gray-500">Last hour</div>
        </div>
      </div>

      {/* Services Status */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-medium text-gray-900">Service Status</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {healthData.services.map((service, index) => (
            <div
              key={index}
              className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-4">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${getStatusColor(service.status)}`}
                >
                  {getStatusIcon(service.status)}
                </span>
                <div>
                  <div className="font-medium text-gray-900">
                    {service.name}
                  </div>
                  {service.message && (
                    <div className="text-sm text-gray-500">
                      {service.message}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-8 text-sm">
                <div className="text-right">
                  <div className="text-gray-500">Latency</div>
                  <div
                    className={`font-medium ${service.latency < 100 ? "text-green-600" : service.latency < 500 ? "text-yellow-600" : "text-red-600"}`}
                  >
                    {service.latency}ms
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-gray-500">Uptime</div>
                  <div className="font-medium text-gray-900">
                    {service.uptime}%
                  </div>
                </div>
                <div className="w-32 text-right">
                  <div className="text-gray-500">Last Check</div>
                  <div className="text-xs text-gray-600">
                    {new Date(service.lastCheck).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Last Updated */}
      <div className="text-center text-sm text-gray-500">
        Last updated: {new Date(healthData.lastUpdated).toLocaleString()}
      </div>
    </div>
  );
}
