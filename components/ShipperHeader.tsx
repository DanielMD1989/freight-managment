"use client";

/**
 * Shipper Header Component
 *
 * Sprint 19 - Profile Menu + Settings Navigation
 *
 * Portal header bar for all shipper pages with user info and actions
 * Uses portal-header styles from globals.css
 */

import NotificationBell from "@/components/NotificationBell";
import ProfileMenu from "@/components/ProfileMenu";

interface ShipperHeaderProps {
  user: {
    firstName?: string;
    lastName?: string;
    role: string;
    email?: string;
  };
}

export default function ShipperHeader({ user }: ShipperHeaderProps) {
  return (
    <div className="portal-header">
      {/* Spacer to push user info to the right */}
      <div className="flex-1" />

      {/* User Info & Actions */}
      <div className="flex items-center gap-4">
        <NotificationBell />

        <div className="hidden h-8 w-px bg-white/20 sm:block" />

        {/* Profile Menu Dropdown */}
        <ProfileMenu user={user} portalPrefix="/shipper" />
      </div>
    </div>
  );
}
