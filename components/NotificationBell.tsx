/**
 * Notification Bell Component
 *
 * Professional notification center with modern design and animations
 * Design System: Clean & Minimal with Teal accent
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { csrfFetch } from "@/lib/csrfFetch";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  metadata?: Record<string, string>;
}

export default function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await fetch("/api/notifications");
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
        setIsAuthenticated(true);
      } else if (response.status === 401) {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    // Optimistically update local state immediately for better UX
    const notification = notifications.find((n) => n.id === notificationId);
    if (notification && !notification.read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    try {
      const response = await csrfFetch(
        `/api/notifications/${notificationId}/read`,
        {
          method: "PUT",
        }
      );
      if (!response.ok) {
        // Revert on failure
        fetchNotifications();
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      // Revert on error
      fetchNotifications();
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;

    // Optimistically update local state
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    setIsLoading(true);

    try {
      const response = await csrfFetch("/api/notifications/mark-all-read", {
        method: "PUT",
      });
      if (!response.ok) {
        // Revert on failure
        fetchNotifications();
      }
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      // Revert on error
      fetchNotifications();
    } finally {
      setIsLoading(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    const iconClass = "w-5 h-5";
    if (type.includes("GPS"))
      return (
        <svg
          className={iconClass}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      );
    if (type.includes("POD") || type.includes("SETTLEMENT"))
      return (
        <svg
          className={iconClass}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    if (type.includes("USER"))
      return (
        <svg
          className={iconClass}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      );
    if (type.includes("EXCEPTION"))
      return (
        <svg
          className={iconClass}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      );
    return (
      <svg
        className={iconClass}
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
    );
  };

  const getIconBgColor = (type: string) => {
    if (type.includes("GPS")) return "bg-blue-100 text-blue-600";
    if (type.includes("POD") || type.includes("SETTLEMENT"))
      return "bg-emerald-100 text-emerald-600";
    if (type.includes("USER")) return "bg-violet-100 text-violet-600";
    if (type.includes("EXCEPTION")) return "bg-amber-100 text-amber-600";
    if (type.includes("AUTOMATION")) return "bg-cyan-100 text-cyan-600";
    if (type.includes("BYPASS")) return "bg-rose-100 text-rose-600";
    return "bg-slate-100 text-slate-600";
  };

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getNotificationRoute = (notification: Notification): string | null => {
    const { type, metadata } = notification;

    // ========== CARRIER-SIDE NOTIFICATIONS ==========

    // Carrier's outgoing load request was approved by shipper
    if (type === "LOAD_REQUEST_APPROVED" && metadata?.loadId) {
      return `/carrier/trips/${metadata.loadId}`;
    }
    // Carrier's outgoing load request was rejected by shipper
    if (type === "LOAD_REQUEST_REJECTED" && metadata?.loadRequestId) {
      return `/carrier/load-requests?highlight=${metadata.loadRequestId}`;
    }
    // Carrier received incoming truck request from shipper
    if (type === "TRUCK_REQUEST_RECEIVED" && metadata?.requestId) {
      return `/carrier/requests?highlight=${metadata.requestId}`;
    }

    // ========== SHIPPER-SIDE NOTIFICATIONS ==========

    // Shipper received incoming load request from carrier
    if (type === "LOAD_REQUEST_RECEIVED" && metadata?.loadRequestId) {
      return `/shipper/requests?highlight=${metadata.loadRequestId}`;
    }
    // Shipper's outgoing truck request was approved by carrier
    if (type === "TRUCK_REQUEST_APPROVED" && metadata?.loadId) {
      return `/shipper/trips/${metadata.loadId}`;
    }
    // Shipper's outgoing truck request was rejected by carrier
    if (type === "TRUCK_REQUEST_REJECTED" && metadata?.requestId) {
      return `/shipper/requests?tab=my-requests&highlight=${metadata.requestId}`;
    }

    // Trip-related notifications
    if (type === "TRIP_STARTED" && metadata?.loadId) {
      return `/carrier/trips/${metadata.loadId}`;
    }
    if (type === "TRIP_COMPLETED" && metadata?.loadId) {
      return `/carrier/trips/${metadata.loadId}`;
    }
    if (type === "POD_UPLOADED" && metadata?.loadId) {
      return `/shipper/loads/${metadata.loadId}`;
    }

    // GPS and tracking notifications
    if (type.includes("GPS") && metadata?.loadId) {
      return `/carrier/trips/${metadata.loadId}`;
    }

    // Settlement notifications
    if (type.includes("SETTLEMENT") && metadata?.settlementId) {
      return `/carrier/wallet?settlement=${metadata.settlementId}`;
    }

    // User/verification notifications
    if (type.includes("USER") || type.includes("VERIFICATION")) {
      return "/settings";
    }

    // Default: no navigation
    return null;
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    await handleMarkAsRead(notification.id);

    // Navigate to relevant page
    const route = getNotificationRoute(notification);
    if (route) {
      setIsOpen(false);
      router.push(route);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-xl p-2.5 text-slate-500 transition-all duration-200 hover:bg-slate-100 hover:text-slate-700"
        aria-label="Notifications"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex h-5 min-w-[20px] animate-pulse items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-rose-600 px-1.5 text-xs font-bold text-white shadow-lg shadow-rose-500/30">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Panel */}
          <div className="animate-in fade-in slide-in-from-top-2 absolute right-0 z-50 mt-2 w-96 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-teal-50/30 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-600">
                  <svg
                    className="h-4 w-4 text-white"
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
                <h3 className="text-sm font-bold text-slate-800">
                  Notifications
                </h3>
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={isLoading}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-teal-600 transition-colors hover:bg-teal-50 hover:text-teal-700 disabled:opacity-50"
                >
                  {isLoading ? "Marking..." : "Mark all read"}
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                    <svg
                      className="h-7 w-7 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                      />
                    </svg>
                  </div>
                  <h4 className="mb-1 text-sm font-semibold text-slate-700">
                    All caught up!
                  </h4>
                  <p className="text-xs text-slate-500">No new notifications</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`cursor-pointer border-b border-slate-100 px-5 py-4 transition-colors last:border-0 hover:bg-slate-50 ${
                      !notification.read ? "bg-teal-50/50" : ""
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${getIconBgColor(notification.type)}`}
                      >
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <h4 className="truncate text-sm font-semibold text-slate-800">
                            {notification.title}
                          </h4>
                          {!notification.read && (
                            <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-teal-500" />
                          )}
                        </div>
                        <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">
                          {notification.message}
                        </p>
                        <p className="mt-1.5 text-[10px] font-medium tracking-wider text-slate-400 uppercase">
                          {formatTimestamp(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3">
                <a
                  href="/notifications"
                  className="block text-center text-sm font-semibold text-teal-600 transition-colors hover:text-teal-700"
                  onClick={() => setIsOpen(false)}
                >
                  View all notifications
                </a>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
