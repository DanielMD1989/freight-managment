'use client';

/**
 * Shipper Header Component
 *
 * Portal header bar for all shipper pages with user info and actions
 * Uses portal-header styles from globals.css
 */

import NotificationBell from '@/components/NotificationBell';
import { clearCSRFToken } from '@/lib/csrfFetch';

interface ShipperHeaderProps {
  user: {
    firstName?: string;
    lastName?: string;
    role: string;
  };
}

export default function ShipperHeader({ user }: ShipperHeaderProps) {
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        clearCSRFToken();
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="portal-header">
      {/* Spacer to push user info to the right */}
      <div className="flex-1" />

      {/* User Info & Actions */}
      <div className="flex items-center gap-4">
        <NotificationBell />

        <div className="h-8 w-px bg-white/20 hidden sm:block" />

        {/* User Info */}
        <div className="portal-header-user" style={{ borderLeft: 'none', paddingLeft: 0, marginLeft: 0 }}>
          <div className="portal-header-avatar">
            {user.firstName?.[0]}{user.lastName?.[0]}
          </div>
          <div className="hidden sm:block">
            <div className="portal-header-name">{user.firstName} {user.lastName}</div>
            <div className="portal-header-role">{user.role}</div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-white hover:bg-white/90 text-[#1e9c99] text-sm font-semibold rounded-lg transition-colors border border-white"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
