"use client";

/**
 * Notification Settings Client Component
 *
 * Sprint 19 - Profile Menu + Settings Navigation
 *
 * Notification preferences management
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { getCSRFToken } from "@/lib/csrfFetch";

interface NotificationSettingsClientProps {
  userId: string;
  email: string;
  phone: string | null;
  preferences: Record<string, boolean>;
}

interface NotificationCategory {
  id: string;
  name: string;
  description: string;
  types: {
    id: string;
    label: string;
    description: string;
  }[];
}

const notificationCategories: NotificationCategory[] = [
  {
    id: "loads",
    name: "Load Updates",
    description: "Notifications about your loads",
    types: [
      {
        id: "LOAD_ASSIGNED",
        label: "Load Assigned",
        description: "When a load is assigned to a truck",
      },
      {
        id: "LOAD_STATUS_CHANGE",
        label: "Status Changes",
        description: "When load status changes",
      },
      {
        id: "LOAD_REQUEST_RECEIVED",
        label: "Load Requests",
        description: "When you receive a load request",
      },
    ],
  },
  {
    id: "gps",
    name: "GPS & Tracking",
    description: "GPS and truck tracking alerts",
    types: [
      {
        id: "GPS_OFFLINE",
        label: "GPS Offline",
        description: "When a truck GPS goes offline",
      },
      {
        id: "TRUCK_AT_PICKUP",
        label: "Pickup Arrival",
        description: "When truck arrives at pickup",
      },
      {
        id: "TRUCK_AT_DELIVERY",
        label: "Delivery Arrival",
        description: "When truck arrives at delivery",
      },
      {
        id: "BYPASS_WARNING",
        label: "Bypass Alerts",
        description: "Route bypass detection alerts",
      },
    ],
  },
  {
    id: "finance",
    name: "Finance & Settlements",
    description: "Financial notifications",
    types: [
      {
        id: "POD_SUBMITTED",
        label: "POD Submitted",
        description: "When proof of delivery is uploaded",
      },
      {
        id: "SETTLEMENT_COMPLETED",
        label: "Settlement Complete",
        description: "When settlement is processed",
      },
    ],
  },
  {
    id: "account",
    name: "Account & Security",
    description: "Account-related notifications",
    types: [
      {
        id: "SECURITY_ALERT",
        label: "Security Alerts",
        description: "Unusual login activity",
      },
      {
        id: "ACCOUNT_UPDATE",
        label: "Account Updates",
        description: "Important account changes",
      },
    ],
  },
];

export default function NotificationSettingsClient({
  email,
  phone,
  preferences,
}: NotificationSettingsClientProps) {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Record<string, boolean>>(preferences);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleToggle = (typeId: string) => {
    setPrefs((prev) => {
      const updated = { ...prev, [typeId]: !prev[typeId] };
      setHasChanges(true);
      return updated;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch("/api/user/notification-preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        credentials: "include",
        body: JSON.stringify({ preferences: prefs }),
      });

      if (!response.ok) {
        throw new Error("Failed to save preferences");
      }

      toast.success("Notification preferences saved");
      setHasChanges(false);
      router.refresh();
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnableAll = (categoryId: string) => {
    const category = notificationCategories.find((c) => c.id === categoryId);
    if (category) {
      setPrefs((prev) => {
        const updated = { ...prev };
        category.types.forEach((type) => {
          updated[type.id] = true;
        });
        setHasChanges(true);
        return updated;
      });
    }
  };

  const handleDisableAll = (categoryId: string) => {
    const category = notificationCategories.find((c) => c.id === categoryId);
    if (category) {
      setPrefs((prev) => {
        const updated = { ...prev };
        category.types.forEach((type) => {
          updated[type.id] = false;
        });
        setHasChanges(true);
        return updated;
      });
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Notification Preferences
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Choose which notifications you want to receive
          </p>
        </div>
        {hasChanges && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        )}
      </div>

      {/* Notification Channels */}
      <div className="mb-8 rounded-lg bg-gray-50 p-4 dark:bg-slate-800">
        <h3 className="mb-3 text-sm font-medium text-gray-900 dark:text-white">
          Notification Channels
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex items-center gap-3 rounded-lg bg-white p-3 dark:bg-slate-900">
            <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5 text-blue-600 dark:text-blue-400"
              >
                <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
                <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Email
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {email}
              </p>
            </div>
            <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              Active
            </span>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-white p-3 dark:bg-slate-900">
            <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900/30">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5 text-purple-600 dark:text-purple-400"
              >
                <path
                  fillRule="evenodd"
                  d="M2 3.5A1.5 1.5 0 013.5 2h1.148a1.5 1.5 0 011.465 1.175l.716 3.223a1.5 1.5 0 01-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 006.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 011.767-1.052l3.223.716A1.5 1.5 0 0118 15.352V16.5a1.5 1.5 0 01-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 012.43 8.326 13.019 13.019 0 012 5V3.5z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                SMS
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {phone || "Not configured"}
              </p>
            </div>
            <span
              className={`rounded px-2 py-1 text-xs font-medium ${
                phone
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
              }`}
            >
              {phone ? "Active" : "Not set"}
            </span>
          </div>
        </div>
      </div>

      {/* Notification Categories */}
      <div className="space-y-6">
        {notificationCategories.map((category) => (
          <div
            key={category.id}
            className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700"
          >
            <div className="flex items-center justify-between bg-gray-50 px-4 py-3 dark:bg-slate-800">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  {category.name}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {category.description}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEnableAll(category.id)}
                  className="text-xs text-teal-600 hover:text-teal-700 dark:text-teal-400"
                >
                  Enable all
                </button>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <button
                  onClick={() => handleDisableAll(category.id)}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400"
                >
                  Disable all
                </button>
              </div>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-slate-700">
              {category.types.map((type) => (
                <div
                  key={type.id}
                  className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {type.label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {type.description}
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={prefs[type.id] ?? true}
                      onChange={() => handleToggle(type.id)}
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-gray-200 peer-checked:bg-teal-600 peer-focus:ring-4 peer-focus:ring-teal-300 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-teal-800"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
