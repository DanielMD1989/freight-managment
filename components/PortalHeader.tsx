"use client";

/**
 * Portal Header Component
 *
 * Sprint 19 - Profile Menu + Settings Navigation
 *
 * Universal header bar for all portal pages (Shipper, Carrier, Admin, Dispatcher)
 * Includes notification bell and profile menu dropdown
 */

import NotificationBell from "@/components/NotificationBell";
import ProfileMenu from "@/components/ProfileMenu";

interface PortalHeaderProps {
  user: {
    firstName?: string;
    lastName?: string;
    role: string;
    email?: string;
  };
  portalPrefix?: string; // e.g., '/shipper', '/carrier', '/admin', '/dispatcher'
}

export default function PortalHeader({
  user,
  portalPrefix = "",
}: PortalHeaderProps) {
  return (
    <div className="portal-header">
      {/* Spacer to push user info to the right */}
      <div className="flex-1" />

      {/* User Info & Actions */}
      <div className="flex items-center gap-4">
        <NotificationBell />

        <div className="hidden h-8 w-px bg-white/20 sm:block" />

        {/* Profile Menu Dropdown */}
        <ProfileMenu user={user} portalPrefix={portalPrefix} />
      </div>
    </div>
  );
}
