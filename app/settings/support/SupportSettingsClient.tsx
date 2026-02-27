"use client";

/**
 * Support Settings Client Component
 *
 * Sprint 19 - Profile Menu + Settings Navigation
 *
 * Help, support, and reporting functionality
 */

import { useState } from "react";
import { toast } from "react-hot-toast";
import { getCSRFToken } from "@/lib/csrfFetch";

interface SupportSettingsClientProps {
  userId: string;
  userRole: string;
}

export default function SupportSettingsClient({}: SupportSettingsClientProps) {
  const [showReportForm, setShowReportForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportForm, setReportForm] = useState({
    type: "FRAUD",
    description: "",
    entityType: "",
    entityId: "",
  });

  const handleSubmitReport = async () => {
    if (!reportForm.description.trim()) {
      toast.error("Please provide a description");
      return;
    }

    setIsSubmitting(true);
    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch("/api/support/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        credentials: "include",
        body: JSON.stringify(reportForm),
      });

      if (!response.ok) {
        throw new Error("Failed to submit report");
      }

      toast.success(
        "Report submitted successfully. We will review it shortly."
      );
      setShowReportForm(false);
      setReportForm({
        type: "FRAUD",
        description: "",
        entityType: "",
        entityId: "",
      });
    } catch {
      toast.error("Failed to submit report");
    } finally {
      setIsSubmitting(false);
    }
  };

  const helpTopics = [
    {
      title: "Getting Started",
      description: "Learn how to use the platform",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5"
        >
          <path d="M10 1a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 1zM5.05 3.05a.75.75 0 011.06 0l1.062 1.06A.75.75 0 116.11 5.173L5.05 4.11a.75.75 0 010-1.06zm9.9 0a.75.75 0 010 1.06l-1.06 1.062a.75.75 0 01-1.062-1.061l1.061-1.06a.75.75 0 011.06 0zM3 8a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 013 8zm11 0a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 0114 8zm-6.828 2.828a.75.75 0 010 1.061L6.11 12.95a.75.75 0 01-1.06-1.06l1.06-1.06a.75.75 0 011.06 0zm3.594-3.317a.75.75 0 00-1.37.364l-.492 6.861a.75.75 0 001.204.65l1.043-.799.985 3.678a.75.75 0 001.45-.388l-.978-3.646 1.292.204a.75.75 0 00.74-1.16l-3.874-5.764z" />
        </svg>
      ),
      link: "#",
    },
    {
      title: "Posting Loads",
      description: "How to post and manage loads",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5"
        >
          <path d="M6.5 3c-1.051 0-2.093.04-3.125.117A1.49 1.49 0 002 4.607V10.5h9V4.606c0-.771-.59-1.43-1.375-1.489A41.568 41.568 0 006.5 3zM2 12v2.5A1.5 1.5 0 003.5 16h.041a3 3 0 015.918 0h.791a.75.75 0 00.75-.75V12H2z" />
          <path d="M6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM13.25 5a.75.75 0 00-.75.75v8.514a3.001 3.001 0 014.893 1.44c.37-.275.607-.719.607-1.22V6.75a.75.75 0 00-.75-.75h-4z" />
          <path d="M15.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
        </svg>
      ),
      link: "#",
    },
    {
      title: "GPS Tracking",
      description: "Setting up and using GPS tracking",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5"
        >
          <path
            fillRule="evenodd"
            d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z"
            clipRule="evenodd"
          />
        </svg>
      ),
      link: "#",
    },
    {
      title: "Payments & Settlements",
      description: "Understanding payment flows",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5"
        >
          <path
            fillRule="evenodd"
            d="M1 4a1 1 0 011-1h16a1 1 0 011 1v8a1 1 0 01-1 1H2a1 1 0 01-1-1V4zm12 4a3 3 0 11-6 0 3 3 0 016 0zM4 9a1 1 0 100-2 1 1 0 000 2zm13-1a1 1 0 11-2 0 1 1 0 012 0zM1.75 14.5a.75.75 0 000 1.5c4.417 0 8.693.603 12.749 1.73 1.111.309 2.251-.512 2.251-1.696v-.784a.75.75 0 00-1.5 0v.784a.272.272 0 01-.35.25A49.043 49.043 0 001.75 14.5z"
            clipRule="evenodd"
          />
        </svg>
      ),
      link: "#",
    },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Help & Support
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Get help and report issues
        </p>
      </div>

      {/* Contact Support */}
      <div className="mb-8 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 p-6 text-white">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-white/20 p-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-6 w-6"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="mb-1 text-lg font-semibold">Need Help?</h3>
            <p className="mb-4 text-sm text-white/80">
              Our support team is here to help you with any questions or issues.
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                >
                  <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
                  <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
                </svg>
                <span className="text-sm">support@freightet.com</span>
              </div>
              <div className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M2 3.5A1.5 1.5 0 013.5 2h1.148a1.5 1.5 0 011.465 1.175l.716 3.223a1.5 1.5 0 01-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 006.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 011.767-1.052l3.223.716A1.5 1.5 0 0118 15.352V16.5a1.5 1.5 0 01-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 012.43 8.326 13.019 13.019 0 012 5V3.5z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm">+251 911 123 456</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Help Topics */}
      <div className="mb-8">
        <h3 className="mb-4 text-sm font-medium text-gray-900 dark:text-white">
          Help Topics
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {helpTopics.map((topic) => (
            <a
              key={topic.title}
              href={topic.link}
              className="flex items-start gap-3 rounded-lg bg-gray-50 p-4 transition-colors hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              <div className="rounded-lg bg-teal-100 p-2 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400">
                {topic.icon}
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  {topic.title}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {topic.description}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Report Issue */}
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700">
        <div className="bg-gray-50 px-4 py-3 dark:bg-slate-800">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            Report an Issue
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Report fraud, harassment, or other issues
          </p>
        </div>

        {!showReportForm ? (
          <div className="p-4">
            <button
              onClick={() => setShowReportForm(true)}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
              Report Bad Behavior
            </button>
          </div>
        ) : (
          <div className="space-y-4 p-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Report Type
              </label>
              <select
                value={reportForm.type}
                onChange={(e) =>
                  setReportForm({ ...reportForm, type: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:ring-2 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              >
                <option value="FRAUD">Fraud</option>
                <option value="HARASSMENT">Harassment</option>
                <option value="SPAM">Spam</option>
                <option value="SAFETY_VIOLATION">Safety Violation</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Entity Type (optional)
                </label>
                <select
                  value={reportForm.entityType}
                  onChange={(e) =>
                    setReportForm({ ...reportForm, entityType: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:ring-2 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">Select...</option>
                  <option value="USER">User</option>
                  <option value="ORGANIZATION">Organization</option>
                  <option value="LOAD">Load</option>
                  <option value="TRUCK">Truck</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Entity ID (optional)
                </label>
                <input
                  type="text"
                  value={reportForm.entityId}
                  onChange={(e) =>
                    setReportForm({ ...reportForm, entityId: e.target.value })
                  }
                  placeholder="e.g., user ID or load ID"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:ring-2 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description *
              </label>
              <textarea
                value={reportForm.description}
                onChange={(e) =>
                  setReportForm({ ...reportForm, description: e.target.value })
                }
                rows={4}
                placeholder="Please describe the issue in detail..."
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:ring-2 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowReportForm(false);
                  setReportForm({
                    type: "FRAUD",
                    description: "",
                    entityType: "",
                    entityId: "",
                  });
                }}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={isSubmitting || !reportForm.description.trim()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
