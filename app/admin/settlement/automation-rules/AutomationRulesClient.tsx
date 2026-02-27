/**
 * Automation Rules Engine Client Component
 *
 * Sprint 16 - Story 16.9A: SuperAdmin Tools
 * Task 16.9A.5: Automation Rules Engine
 *
 * Allows SuperAdmins to configure settlement automation rules
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getCSRFToken } from "@/lib/csrfFetch";

interface AutomationSettings {
  settlementAutomationEnabled: boolean;
  autoVerifyPodEnabled: boolean;
  autoVerifyPodTimeoutHours: number;
  settlementBatchSize: number;
  emailNotifySettlementSuccess: boolean;
  emailNotifySettlementFailure: boolean;
  autoSettlementMinAmount: number;
  autoSettlementMaxAmount: number;
}

export default function AutomationRulesClient({
  initialSettings,
}: {
  initialSettings: AutomationSettings;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const hasChanges =
    JSON.stringify(settings) !== JSON.stringify(initialSettings);

  const handleNumberChange = (
    field: keyof AutomationSettings,
    value: string
  ) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setSettings({ ...settings, [field]: numValue });
    }
  };

  const handleBooleanChange = (
    field: keyof AutomationSettings,
    checked: boolean
  ) => {
    setSettings({ ...settings, [field]: checked });
  };

  const validateSettings = (): string | null => {
    if (
      settings.autoVerifyPodTimeoutHours < 1 ||
      settings.autoVerifyPodTimeoutHours > 168
    ) {
      return "POD timeout must be between 1 and 168 hours (7 days)";
    }

    if (
      settings.settlementBatchSize < 1 ||
      settings.settlementBatchSize > 500
    ) {
      return "Batch size must be between 1 and 500";
    }

    if (
      settings.autoSettlementMaxAmount > 0 &&
      settings.autoSettlementMinAmount > settings.autoSettlementMaxAmount
    ) {
      return "Minimum amount cannot exceed maximum amount";
    }

    return null;
  };

  const handleSave = async () => {
    // Validate
    const validationError = validateSettings();
    if (validationError) {
      setErrorMessage(validationError);
      setTimeout(() => setErrorMessage(""), 5000);
      return;
    }

    try {
      setIsSaving(true);
      setSuccessMessage("");
      setErrorMessage("");

      const csrfToken = await getCSRFToken();
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify(settings),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save settings");
      }

      setSuccessMessage("Automation rules saved successfully");
      setTimeout(() => setSuccessMessage(""), 3000);

      // Refresh to get updated settings
      router.refresh();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save settings"
      );
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (
      confirm(
        "Are you sure you want to discard all changes and revert to the current saved settings?"
      )
    ) {
      setSettings(initialSettings);
      setSuccessMessage("");
      setErrorMessage("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-green-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm font-medium text-green-800">
              {successMessage}
            </p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-red-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm font-medium text-red-800">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Master Toggles */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Automation Master Controls
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900">
                Settlement Automation
              </h3>
              <p className="text-sm text-gray-600">
                Enable automatic settlement processing for verified deliveries
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={settings.settlementAutomationEnabled}
                onChange={(e) =>
                  handleBooleanChange(
                    "settlementAutomationEnabled",
                    e.target.checked
                  )
                }
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-gray-200 peer-checked:bg-blue-600 peer-focus:ring-4 peer-focus:ring-blue-300 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
            </label>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900">
                Auto-Verify POD
              </h3>
              <p className="text-sm text-gray-600">
                Automatically verify POD after timeout if shipper doesn&apos;t
                respond
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={settings.autoVerifyPodEnabled}
                onChange={(e) =>
                  handleBooleanChange("autoVerifyPodEnabled", e.target.checked)
                }
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-gray-200 peer-checked:bg-blue-600 peer-focus:ring-4 peer-focus:ring-blue-300 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
            </label>
          </div>
        </div>
      </div>

      {/* POD Verification Settings */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          POD Verification Settings
        </h2>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Auto-Verification Timeout (hours)
            </label>
            <input
              type="number"
              value={settings.autoVerifyPodTimeoutHours}
              onChange={(e) =>
                handleNumberChange("autoVerifyPodTimeoutHours", e.target.value)
              }
              min="1"
              max="168"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              POD will be automatically verified after this many hours if
              shipper doesn&apos;t respond (1-168 hours)
            </p>
          </div>
        </div>
      </div>

      {/* Settlement Processing Settings */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Settlement Processing Settings
        </h2>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Batch Size
            </label>
            <input
              type="number"
              value={settings.settlementBatchSize}
              onChange={(e) =>
                handleNumberChange("settlementBatchSize", e.target.value)
              }
              min="1"
              max="500"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Maximum number of settlements to process in a single batch (1-500)
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Minimum Amount for Auto-Settlement (ETB)
            </label>
            <input
              type="number"
              value={settings.autoSettlementMinAmount}
              onChange={(e) =>
                handleNumberChange("autoSettlementMinAmount", e.target.value)
              }
              min="0"
              step="0.01"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Settlements below this amount require manual approval (0 = no
              minimum)
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Maximum Amount for Auto-Settlement (ETB)
            </label>
            <input
              type="number"
              value={settings.autoSettlementMaxAmount}
              onChange={(e) =>
                handleNumberChange("autoSettlementMaxAmount", e.target.value)
              }
              min="0"
              step="0.01"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Settlements above this amount require manual approval (0 =
              unlimited)
            </p>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Notification Settings
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900">
                Notify on Success
              </h3>
              <p className="text-sm text-gray-600">
                Send email notification when settlements succeed
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={settings.emailNotifySettlementSuccess}
                onChange={(e) =>
                  handleBooleanChange(
                    "emailNotifySettlementSuccess",
                    e.target.checked
                  )
                }
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-gray-200 peer-checked:bg-blue-600 peer-focus:ring-4 peer-focus:ring-blue-300 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
            </label>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900">
                Notify on Failure
              </h3>
              <p className="text-sm text-gray-600">
                Send email notification when settlements fail (recommended)
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={settings.emailNotifySettlementFailure}
                onChange={(e) =>
                  handleBooleanChange(
                    "emailNotifySettlementFailure",
                    e.target.checked
                  )
                }
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-gray-200 peer-checked:bg-blue-600 peer-focus:ring-4 peer-focus:ring-blue-300 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="text-sm text-gray-600">
          {hasChanges ? (
            <span className="font-medium text-orange-600">
              You have unsaved changes
            </span>
          ) : (
            <span>All changes saved</span>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            disabled={!hasChanges || isSaving}
            className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
