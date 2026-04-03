"use client";

import { useState, useCallback } from "react";

export type PeriodPreset = "7d" | "30d" | "90d" | "custom";

export interface DateRangeValue {
  startDate: string;
  endDate: string;
  period: PeriodPreset;
}

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
}

function getPresetRange(preset: "7d" | "30d" | "90d"): {
  startDate: string;
  endDate: string;
} {
  const end = new Date();
  const start = new Date();
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  start.setDate(start.getDate() - days);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

export function getDefaultDateRange(
  preset: PeriodPreset = "30d"
): DateRangeValue {
  if (preset === "custom") {
    const range = getPresetRange("30d");
    return { ...range, period: "custom" };
  }
  return { ...getPresetRange(preset), period: preset };
}

const presets: { label: string; value: PeriodPreset }[] = [
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
  { label: "Custom", value: "custom" },
];

export default function DateRangePicker({
  value,
  onChange,
}: DateRangePickerProps) {
  const [showCustom, setShowCustom] = useState(value.period === "custom");

  const handlePreset = useCallback(
    (preset: PeriodPreset) => {
      if (preset === "custom") {
        setShowCustom(true);
        onChange({ ...value, period: "custom" });
      } else {
        setShowCustom(false);
        onChange({ ...getPresetRange(preset), period: preset });
      }
    },
    [onChange, value]
  );

  const handleCustomDate = useCallback(
    (field: "startDate" | "endDate", dateStr: string) => {
      onChange({ ...value, [field]: dateStr, period: "custom" });
    },
    [onChange, value]
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((p) => (
        <button
          key={p.value}
          onClick={() => handlePreset(p.value)}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            value.period === p.value
              ? "bg-[#064d51] text-white shadow-md"
              : "border border-[#064d51]/20 bg-white text-[#064d51] hover:bg-[#064d51]/10"
          }`}
        >
          {p.label}
        </button>
      ))}

      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={value.startDate}
            onChange={(e) => handleCustomDate("startDate", e.target.value)}
            className="rounded-lg border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] outline-none focus:border-[#1e9c99] focus:ring-1 focus:ring-[#1e9c99]"
          />
          <span className="text-sm text-[#064d51]/60">to</span>
          <input
            type="date"
            value={value.endDate}
            onChange={(e) => handleCustomDate("endDate", e.target.value)}
            className="rounded-lg border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] outline-none focus:border-[#1e9c99] focus:ring-1 focus:ring-[#1e9c99]"
          />
        </div>
      )}
    </div>
  );
}
