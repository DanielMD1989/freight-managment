/**
 * Notifications Page Client
 *
 * Full-page notification list with mark-as-read, click routing,
 * and relative timestamps. Reuses routing logic from NotificationBell.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
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

interface Props {
  userRole: string;
}

export default function NotificationsPageClient({ userRole }: Props) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications?limit=50");
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
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
        { method: "PUT" }
      );
      if (!response.ok) {
        fetchNotifications();
      }
    } catch {
      fetchNotifications();
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    setMarkingAll(true);

    try {
      const response = await csrfFetch("/api/notifications/mark-all-read", {
        method: "PUT",
      });
      if (!response.ok) {
        fetchNotifications();
      }
    } catch {
      fetchNotifications();
    } finally {
      setMarkingAll(false);
    }
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

  const getNotificationIcon = (type: string) => {
    const iconClass = "w-5 h-5";
    if (type.includes("TRIP") || type.includes("LOAD"))
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
            d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
          />
        </svg>
      );
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
    if (
      type.includes("POD") ||
      type.includes("SETTLEMENT") ||
      type.includes("FEE") ||
      type.includes("WALLET") ||
      type.includes("WITHDRAWAL")
    )
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
    if (
      type.includes("USER") ||
      type.includes("ACCOUNT") ||
      type.includes("REGISTRATION") ||
      type.includes("DOCUMENT")
    )
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
    if (type.includes("TRUCK"))
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
            d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
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
    if (type.includes("TRIP") || type.includes("LOAD"))
      return "bg-indigo-100 text-indigo-600";
    if (type.includes("GPS")) return "bg-blue-100 text-blue-600";
    if (
      type.includes("POD") ||
      type.includes("SETTLEMENT") ||
      type.includes("FEE") ||
      type.includes("WALLET") ||
      type.includes("WITHDRAWAL")
    )
      return "bg-emerald-100 text-emerald-600";
    if (type.includes("EXCEPTION")) return "bg-amber-100 text-amber-600";
    if (
      type.includes("USER") ||
      type.includes("ACCOUNT") ||
      type.includes("REGISTRATION") ||
      type.includes("DOCUMENT")
    )
      return "bg-violet-100 text-violet-600";
    if (type.includes("TRUCK")) return "bg-teal-100 text-teal-600";
    return "bg-slate-100 text-slate-600";
  };

  const getNotificationRoute = (notification: Notification): string | null => {
    const { type, metadata } = notification;
    const isCarrier = userRole === "CARRIER";
    const isShipper = userRole === "SHIPPER";
    const isDispatcher = userRole === "DISPATCHER";
    const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN";

    switch (type) {
      case "TRUCK_APPROVED":
      case "TRUCK_REJECTED":
        return metadata?.truckId
          ? `/carrier/trucks?highlight=${metadata.truckId}`
          : `/carrier/trucks`;

      case "MATCH_PROPOSAL":
        if (isCarrier)
          return `/carrier/proposals?highlight=${metadata?.proposalId ?? ""}`;
        if (isShipper && metadata?.loadId)
          return `/shipper/loads/${metadata.loadId}?tab=proposals`;
        return null;

      case "MATCH_PROPOSAL_ACCEPTED":
        if (metadata?.loadId) {
          return isCarrier
            ? `/carrier/trips/${metadata.loadId}`
            : `/shipper/loads/${metadata.loadId}`;
        }
        return null;

      case "MATCH_PROPOSAL_REJECTED":
        return isCarrier ? `/carrier/proposals` : null;

      case "EXCEPTION_CREATED":
        if (isDispatcher)
          return metadata?.escalationId
            ? `/dispatcher/escalations/${metadata.escalationId}`
            : `/dispatcher/escalations`;
        if (metadata?.loadId) {
          return isCarrier
            ? `/carrier/trips/${metadata.loadId}`
            : `/shipper/loads/${metadata.loadId}`;
        }
        return null;

      case "ESCALATION_ASSIGNED":
        if (isDispatcher && metadata?.escalationId)
          return `/dispatcher/escalations/${metadata.escalationId}`;
        return isDispatcher ? `/dispatcher/escalations` : null;

      case "ESCALATION_RESOLVED":
      case "EXCEPTION_RESOLVED":
        if (metadata?.loadId) {
          if (isCarrier) return `/carrier/trips/${metadata.loadId}`;
          if (isShipper) return `/shipper/loads/${metadata.loadId}`;
          if (isAdmin) return `/admin/trips`;
        }
        return null;

      case "SERVICE_FEE_DEDUCTED":
      case "SERVICE_FEE_REFUNDED":
      case "SERVICE_FEE_RESERVED":
        return isCarrier ? `/carrier/wallet` : `/shipper/wallet`;

      case "SERVICE_FEE_FAILED":
        return isAdmin ? `/admin/settlement/review` : null;

      case "WALLET_TOPUP_CONFIRMED":
        if (isCarrier) return `/carrier/wallet`;
        if (isShipper) return `/shipper/wallet`;
        return `/admin/users`;

      case "WITHDRAWAL_APPROVED":
      case "WITHDRAWAL_REJECTED":
      case "LOW_BALANCE_WARNING":
        return isCarrier ? `/carrier/wallet` : `/shipper/wallet`;

      case "RETURN_LOAD_AVAILABLE":
      case "RETURN_LOAD_MATCHED":
        return `/carrier/loads`;

      case "BYPASS_WARNING":
      case "ACCOUNT_FLAGGED":
        return isAdmin ? `/admin/users` : null;

      case "DOCUMENTS_SUBMITTED":
        return isAdmin ? `/admin/verification` : null;

      case "LOAD_REQUEST_APPROVED":
        return metadata?.loadId ? `/carrier/trips/${metadata.loadId}` : null;
      case "LOAD_REQUEST_REJECTED":
        return metadata?.loadRequestId
          ? `/carrier/load-requests?highlight=${metadata.loadRequestId}`
          : null;
      case "TRUCK_REQUEST_RECEIVED":
        return metadata?.requestId
          ? `/carrier/requests?highlight=${metadata.requestId}`
          : null;

      case "LOAD_REQUEST_RECEIVED":
        return metadata?.loadRequestId
          ? `/shipper/requests?highlight=${metadata.loadRequestId}`
          : null;
      case "TRUCK_REQUEST_APPROVED":
        return metadata?.loadId ? `/shipper/trips/${metadata.loadId}` : null;
      case "TRUCK_REQUEST_REJECTED":
        return metadata?.requestId
          ? `/shipper/requests?tab=my-requests&highlight=${metadata.requestId}`
          : null;

      case "TRIP_STARTED":
      case "TRIP_COMPLETED":
        return metadata?.loadId ? `/carrier/trips/${metadata.loadId}` : null;

      case "TRIP_CANCELLED":
        if (isCarrier) return `/carrier/trips`;
        if (isShipper) return `/shipper/trips`;
        if (isAdmin || isDispatcher) return `/admin/trips`;
        return null;

      case "DELIVERY_CONFIRMED": {
        const entityId = metadata?.tripId ?? metadata?.loadId;
        if (entityId) {
          return isCarrier
            ? `/carrier/trips/${entityId}`
            : `/shipper/trips/${entityId}`;
        }
        return isCarrier ? `/carrier/trips` : `/shipper/trips`;
      }

      case "TRIP_REASSIGNED":
        if (isCarrier) return `/carrier/trips`;
        if (isDispatcher) return `/dispatcher/trips`;
        if (isAdmin) return `/admin/trips`;
        return null;

      case "POD_SUBMITTED":
        if (isShipper && metadata?.loadId)
          return `/shipper/loads/${metadata.loadId}`;
        if (isAdmin && metadata?.loadId) return `/admin/loads`;
        return null;

      case "POD_VERIFIED":
        return metadata?.loadId ? `/carrier/trips/${metadata.loadId}` : null;

      case "TRIP_DELIVERED":
        if (isShipper && metadata?.loadId)
          return `/shipper/loads/${metadata.loadId}`;
        if (isCarrier && metadata?.loadId)
          return `/carrier/trips/${metadata.loadId}`;
        return null;

      case "TRIP_IN_TRANSIT":
        if (isShipper && metadata?.loadId)
          return `/shipper/loads/${metadata.loadId}`;
        return null;

      case "LOAD_ASSIGNED":
        if (isShipper && metadata?.loadId)
          return `/shipper/loads/${metadata.loadId}`;
        if (isCarrier && metadata?.loadId)
          return `/carrier/trips/${metadata.loadId}`;
        return null;

      case "ACCOUNT_APPROVED":
        return isShipper ? `/shipper` : `/carrier/trucks`;

      case "REGISTRATION_RESUBMITTED":
        return isAdmin ? `/admin/verification` : null;

      case "TRUCK_RESUBMITTED":
        return isAdmin ? `/admin/trucks` : null;

      case "POD_UPLOADED":
        return metadata?.loadId ? `/shipper/loads/${metadata.loadId}` : null;

      case "SETTLEMENT_COMPLETE":
        return isCarrier ? `/carrier/wallet` : `/shipper/wallet`;

      case "GPS_OFFLINE":
      case "TRUCK_AT_PICKUP":
      case "TRUCK_AT_DELIVERY":
        return metadata?.loadId ? `/carrier/trips/${metadata.loadId}` : null;

      case "USER_STATUS_CHANGED":
        return `/settings`;

      default:
        return null;
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    await handleMarkAsRead(notification.id);
    const route = getNotificationRoute(notification);
    if (route) {
      router.push(route);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Notifications</h1>
          {unreadCount > 0 && (
            <p className="mt-1 text-sm text-slate-500">
              {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            disabled={markingAll}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
          >
            {markingAll ? "Marking..." : "Mark all as read"}
          </button>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl bg-slate-100"
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && notifications.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
            <svg
              className="h-8 w-8 text-slate-400"
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
          <h3 className="mb-1 text-lg font-semibold text-slate-700">
            All caught up!
          </h3>
          <p className="text-sm text-slate-500">No notifications to display.</p>
        </div>
      )}

      {/* Notification List */}
      {!isLoading && notifications.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {notifications.map((notification, index) => (
            <div
              key={notification.id}
              className={`cursor-pointer px-5 py-4 transition-colors hover:bg-slate-50 ${
                !notification.read ? "bg-teal-50/50" : ""
              } ${index < notifications.length - 1 ? "border-b border-slate-100" : ""}`}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${getIconBgColor(notification.type)}`}
                >
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <h4
                      className={`text-sm ${!notification.read ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}
                    >
                      {notification.title}
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs whitespace-nowrap text-slate-400">
                        {formatTimestamp(notification.createdAt)}
                      </span>
                      {!notification.read && (
                        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-teal-500" />
                      )}
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600">
                    {notification.message}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
