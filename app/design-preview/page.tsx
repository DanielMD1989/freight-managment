"use client";

import { useState } from "react";

type ColorScheme = "dark-neutral";

export default function DesignPreviewPage() {
  const [scheme] = useState<ColorScheme>("dark-neutral");

  const schemes = {
    "dark-neutral": {
      name: "Dark + Neutral: Warm Dark Theme",
      description:
        "Dark backgrounds with warm neutral tones and teal accents. Modern yet approachable.",
      colors: {
        bg: "#18181b",
        bgSecondary: "#1f1f23",
        text: "#fafaf9",
        textMuted: "#a8a8a8",
        primary: "#14b8a6",
        primaryHover: "#2dd4bf",
        accent: "#8b5cf6",
        sidebar: "#141417",
        sidebarBorder: "#27272a",
        sidebarText: "#a8a8a8",
        sidebarActive: "#fafaf9",
        sidebarActiveBg: "rgba(20, 184, 166, 0.15)",
        border: "#2e2e32",
        card: "#1f1f23",
        cardBorder: "#2e2e32",
        inputBg: "#27272a",
      },
    },
  };

  const current = schemes[scheme];

  return (
    <div
      className="min-h-screen transition-all duration-300"
      style={{ backgroundColor: current.colors.bg, color: current.colors.text }}
    >
      {/* Header */}
      <div
        className="border-b p-4"
        style={{ borderColor: current.colors.border }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <h1 className="text-2xl font-bold">
            Design Preview: Dark + Neutral Theme
          </h1>
          <div
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{
              backgroundColor: current.colors.primary,
              color: "#ffffff",
            }}
          >
            Selected Theme
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-6">
        {/* Scheme Info */}
        <div className="mb-8">
          <h2 className="mb-2 text-xl font-semibold">{current.name}</h2>
          <p style={{ color: current.colors.textMuted }}>
            {current.description}
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar Preview */}
          <div
            className="col-span-3 min-h-[500px] rounded-xl p-4"
            style={{
              backgroundColor: current.colors.sidebar,
              borderRight: current.colors.sidebarBorder
                ? `1px solid ${current.colors.sidebarBorder}`
                : "none",
            }}
          >
            <div className="mb-6">
              <div
                className="mb-1 text-lg font-bold"
                style={{ color: current.colors.sidebarActive }}
              >
                FreightET
              </div>
              <div
                className="text-xs"
                style={{ color: current.colors.sidebarText }}
              >
                Logistics Platform
              </div>
            </div>

            <nav className="space-y-1">
              {["Dashboard", "Loads", "Trucks", "Reports", "Settings"].map(
                (item, i) => (
                  <div
                    key={item}
                    className="cursor-pointer rounded-lg px-3 py-2.5 text-sm font-medium transition-all"
                    style={{
                      backgroundColor:
                        i === 0
                          ? current.colors.sidebarActiveBg ||
                            `${current.colors.primary}20`
                          : "transparent",
                      color:
                        i === 0
                          ? current.colors.sidebarActive
                          : current.colors.sidebarText,
                      borderLeft:
                        i === 0
                          ? `3px solid ${current.colors.primary}`
                          : "3px solid transparent",
                    }}
                  >
                    {item}
                  </div>
                )
              )}
            </nav>
          </div>

          {/* Main Content Preview */}
          <div className="col-span-9 space-y-6">
            {/* Header Bar */}
            <div
              className="flex items-center justify-between rounded-xl p-4"
              style={{
                backgroundColor: current.colors.bgSecondary,
                border: `1px solid ${current.colors.border}`,
              }}
            >
              <div>
                <h3 className="text-lg font-semibold">Dashboard</h3>
                <p
                  className="text-sm"
                  style={{ color: current.colors.textMuted }}
                >
                  Welcome back, Abebe
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full font-medium text-white"
                  style={{ backgroundColor: current.colors.primary }}
                >
                  AM
                </div>
              </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Total Loads", value: "1,234", change: "+12%" },
                { label: "Active Trucks", value: "56", change: "+5%" },
                { label: "Revenue", value: "ETB 2.5M", change: "+18%" },
                { label: "Pending", value: "23", change: "-3%" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl p-5 transition-all hover:shadow-lg"
                  style={{
                    backgroundColor: current.colors.card,
                    border: `1px solid ${current.colors.cardBorder}`,
                  }}
                >
                  <div
                    className="mb-1 text-sm font-medium"
                    style={{ color: current.colors.textMuted }}
                  >
                    {stat.label}
                  </div>
                  <div className="mb-1 text-2xl font-bold">{stat.value}</div>
                  <div
                    className="text-sm font-medium"
                    style={{
                      color: stat.change.startsWith("+")
                        ? "#10b981"
                        : "#f43f5e",
                    }}
                  >
                    {stat.change}
                  </div>
                </div>
              ))}
            </div>

            {/* Table Preview */}
            <div
              className="overflow-hidden rounded-xl"
              style={{
                backgroundColor: current.colors.card,
                border: `1px solid ${current.colors.cardBorder}`,
              }}
            >
              <div
                className="border-b px-5 py-4"
                style={{ borderColor: current.colors.border }}
              >
                <h3 className="font-semibold">Recent Loads</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: current.colors.bgSecondary }}>
                    <th
                      className="px-5 py-3 text-left text-sm font-semibold"
                      style={{ color: current.colors.textMuted }}
                    >
                      Load ID
                    </th>
                    <th
                      className="px-5 py-3 text-left text-sm font-semibold"
                      style={{ color: current.colors.textMuted }}
                    >
                      Origin
                    </th>
                    <th
                      className="px-5 py-3 text-left text-sm font-semibold"
                      style={{ color: current.colors.textMuted }}
                    >
                      Destination
                    </th>
                    <th
                      className="px-5 py-3 text-left text-sm font-semibold"
                      style={{ color: current.colors.textMuted }}
                    >
                      Status
                    </th>
                    <th
                      className="px-5 py-3 text-right text-sm font-semibold"
                      style={{ color: current.colors.textMuted }}
                    >
                      Price
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      id: "LD-001",
                      origin: "Addis Ababa",
                      dest: "Djibouti",
                      status: "In Transit",
                      price: "ETB 45,000",
                    },
                    {
                      id: "LD-002",
                      origin: "Dire Dawa",
                      dest: "Addis Ababa",
                      status: "Delivered",
                      price: "ETB 32,000",
                    },
                    {
                      id: "LD-003",
                      origin: "Mekelle",
                      dest: "Bahir Dar",
                      status: "Pending",
                      price: "ETB 28,000",
                    },
                  ].map((load) => (
                    <tr
                      key={load.id}
                      className="border-t transition-colors"
                      style={{
                        borderColor: current.colors.border,
                      }}
                    >
                      <td
                        className="px-5 py-4 text-sm font-medium"
                        style={{ color: current.colors.primary }}
                      >
                        {load.id}
                      </td>
                      <td className="px-5 py-4 text-sm">{load.origin}</td>
                      <td className="px-5 py-4 text-sm">{load.dest}</td>
                      <td className="px-5 py-4">
                        <span
                          className="rounded-full px-2.5 py-1 text-xs font-medium"
                          style={{
                            backgroundColor:
                              load.status === "Delivered"
                                ? "rgba(16, 185, 129, 0.15)"
                                : load.status === "In Transit"
                                  ? "rgba(59, 130, 246, 0.15)"
                                  : "rgba(245, 158, 11, 0.15)",
                            color:
                              load.status === "Delivered"
                                ? "#34d399"
                                : load.status === "In Transit"
                                  ? "#60a5fa"
                                  : "#fbbf24",
                          }}
                        >
                          {load.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-sm font-medium">
                        {load.price}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Form Preview */}
            <div
              className="rounded-xl p-6"
              style={{
                backgroundColor: current.colors.card,
                border: `1px solid ${current.colors.cardBorder}`,
              }}
            >
              <h3 className="mb-4 font-semibold">Form Elements</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    className="mb-1.5 block text-sm font-medium"
                    style={{ color: current.colors.textMuted }}
                  >
                    Origin
                  </label>
                  <input
                    type="text"
                    placeholder="Enter origin city"
                    className="w-full rounded-lg px-4 py-2.5 text-sm transition-all outline-none"
                    style={{
                      backgroundColor:
                        current.colors.inputBg || current.colors.bgSecondary,
                      border: `1px solid ${current.colors.border}`,
                      color: current.colors.text,
                    }}
                  />
                </div>
                <div>
                  <label
                    className="mb-1.5 block text-sm font-medium"
                    style={{ color: current.colors.textMuted }}
                  >
                    Destination
                  </label>
                  <input
                    type="text"
                    placeholder="Enter destination"
                    className="w-full rounded-lg px-4 py-2.5 text-sm transition-all outline-none"
                    style={{
                      backgroundColor:
                        current.colors.inputBg || current.colors.bgSecondary,
                      border: `1px solid ${current.colors.border}`,
                      color: current.colors.text,
                    }}
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  className="rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-all"
                  style={{ backgroundColor: current.colors.primary }}
                >
                  Submit
                </button>
                <button
                  className="rounded-lg px-5 py-2.5 text-sm font-medium transition-all"
                  style={{
                    backgroundColor: "transparent",
                    border: `1px solid ${current.colors.border}`,
                    color: current.colors.textMuted,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>

            {/* Color Palette */}
            <div
              className="rounded-xl p-6"
              style={{
                backgroundColor: current.colors.card,
                border: `1px solid ${current.colors.cardBorder}`,
              }}
            >
              <h3 className="mb-4 font-semibold">Color Palette</h3>
              <div className="grid grid-cols-6 gap-3">
                {Object.entries(current.colors).map(([name, color]) => (
                  <div key={name} className="text-center">
                    <div
                      className="mb-2 h-12 w-full rounded-lg"
                      style={{
                        backgroundColor: color,
                        border: `1px solid ${current.colors.border}`,
                      }}
                    />
                    <div
                      className="text-xs font-medium"
                      style={{ color: current.colors.textMuted }}
                    >
                      {name}
                    </div>
                    <div
                      className="text-[10px]"
                      style={{ color: current.colors.textMuted }}
                    >
                      {color}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Confirmation */}
        <div
          className="mt-8 rounded-xl p-6 text-center"
          style={{
            backgroundColor: current.colors.bgSecondary,
            border: `1px solid ${current.colors.border}`,
          }}
        >
          <p className="mb-2" style={{ color: current.colors.text }}>
            <strong>{current.name}</strong>
          </p>
          <p className="text-sm" style={{ color: current.colors.textMuted }}>
            Dark backgrounds with warm neutral tones and vibrant teal accents.
          </p>
        </div>
      </div>
    </div>
  );
}
