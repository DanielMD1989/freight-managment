'use client';

/**
 * Role-Aware Sidebar Component
 *
 * Unified sidebar navigation for all portal types (Admin, Carrier, Shipper)
 * Shows role-appropriate menu items based on user's role
 */

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ThemeToggle } from './ThemeToggle';

// Simple className utility
function cn(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles: ('ADMIN' | 'SUPER_ADMIN' | 'CARRIER' | 'SHIPPER' | 'DISPATCHER')[];
  children?: NavItem[];
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

interface RoleAwareSidebarProps {
  userRole: string;
  portalType: 'admin' | 'carrier' | 'shipper';
  children?: ReactNode;
}

/**
 * Navigation configuration - role-aware visibility
 */
const navigationSections: Record<string, NavSection[]> = {
  carrier: [
    {
      items: [
        {
          label: 'Dashboard',
          href: '/carrier/dashboard',
          icon: '📊',
          roles: ['CARRIER', 'ADMIN', 'SUPER_ADMIN'],
        },
        {
          label: 'Map',
          href: '/carrier/map',
          icon: '🗺️',
          roles: ['CARRIER', 'ADMIN', 'SUPER_ADMIN'],
        },
      ],
    },
    {
      title: 'DAT Board',
      items: [
        {
          label: 'Post Trucks',
          href: '/carrier?tab=POST_TRUCKS',
          icon: '📤',
          roles: ['CARRIER', 'ADMIN', 'SUPER_ADMIN'],
        },
        {
          label: 'Search Loads',
          href: '/carrier?tab=SEARCH_LOADS',
          icon: '🔍',
          roles: ['CARRIER', 'ADMIN', 'SUPER_ADMIN'],
        },
      ],
    },
    {
      title: 'Truck Management',
      items: [
        {
          label: 'My Trucks',
          href: '/carrier/trucks',
          icon: '🚛',
          roles: ['CARRIER', 'ADMIN', 'SUPER_ADMIN'],
        },
        {
          label: 'Load Matches',
          href: '/carrier/matches',
          icon: '🎯',
          roles: ['CARRIER', 'ADMIN', 'SUPER_ADMIN'],
        },
      ],
    },
    {
      title: 'Financial',
      items: [
        {
          label: 'Wallet',
          href: '/carrier/wallet',
          icon: '💰',
          roles: ['CARRIER', 'ADMIN', 'SUPER_ADMIN'],
        },
      ],
    },
    {
      title: 'Operations',
      items: [
        {
          label: 'Trip History',
          href: '/carrier/trips',
          icon: '📜',
          roles: ['CARRIER', 'ADMIN', 'SUPER_ADMIN'],
        },
        {
          label: 'GPS Tracking',
          href: '/carrier/gps',
          icon: '📍',
          roles: ['CARRIER', 'ADMIN', 'SUPER_ADMIN'],
        },
        {
          label: 'Documents',
          href: '/carrier/documents',
          icon: '📁',
          roles: ['CARRIER', 'ADMIN', 'SUPER_ADMIN'],
        },
      ],
    },
  ],
  shipper: [
    {
      items: [
        {
          label: 'Dashboard',
          href: '/shipper/dashboard',
          icon: '📊',
          roles: ['SHIPPER', 'ADMIN', 'SUPER_ADMIN'],
        },
        {
          label: 'Map',
          href: '/shipper/map',
          icon: '🗺️',
          roles: ['SHIPPER', 'ADMIN', 'SUPER_ADMIN'],
        },
      ],
    },
    {
      title: 'DAT Board',
      items: [
        {
          label: 'Post Loads',
          href: '/shipper?tab=POST_LOADS',
          icon: '📤',
          roles: ['SHIPPER', 'ADMIN', 'SUPER_ADMIN'],
        },
        {
          label: 'Search Trucks',
          href: '/shipper?tab=SEARCH_TRUCKS',
          icon: '🔍',
          roles: ['SHIPPER', 'ADMIN', 'SUPER_ADMIN'],
        },
      ],
    },
    {
      title: 'Load Management',
      items: [
        {
          label: 'My Loads',
          href: '/shipper/loads',
          icon: '📦',
          roles: ['SHIPPER', 'ADMIN', 'SUPER_ADMIN'],
        },
        {
          label: 'Truck Matches',
          href: '/shipper/matches',
          icon: '🎯',
          roles: ['SHIPPER', 'ADMIN', 'SUPER_ADMIN'],
        },
      ],
    },
    {
      title: 'Financial',
      items: [
        {
          label: 'Wallet',
          href: '/shipper/wallet',
          icon: '💰',
          roles: ['SHIPPER', 'ADMIN', 'SUPER_ADMIN'],
        },
      ],
    },
    {
      title: 'Operations',
      items: [
        {
          label: 'Trip History',
          href: '/shipper/trips',
          icon: '📜',
          roles: ['SHIPPER', 'ADMIN', 'SUPER_ADMIN'],
        },
        {
          label: 'Documents',
          href: '/shipper/documents',
          icon: '📁',
          roles: ['SHIPPER', 'ADMIN', 'SUPER_ADMIN'],
        },
      ],
    },
  ],
  admin: [
    {
      title: 'Overview',
      items: [
        {
          label: 'Dashboard',
          href: '/admin',
          icon: '📊',
          roles: ['ADMIN', 'SUPER_ADMIN'],
        },
        {
          label: 'Map',
          href: '/admin/map',
          icon: '🗺️',
          roles: ['ADMIN', 'SUPER_ADMIN', 'DISPATCHER'],
        },
        {
          label: 'Platform Metrics',
          href: '/admin/platform-metrics',
          icon: '📈',
          roles: ['ADMIN', 'SUPER_ADMIN'],
        },
      ],
    },
    {
      title: 'Load & Truck',
      items: [
        {
          label: 'All Loads',
          href: '/admin/loads',
          icon: '📦',
          roles: ['ADMIN', 'SUPER_ADMIN', 'DISPATCHER'],
        },
        {
          label: 'All Trucks',
          href: '/admin/trucks',
          icon: '🚛',
          roles: ['ADMIN', 'SUPER_ADMIN', 'DISPATCHER'],
        },
      ],
    },
    {
      title: 'User Management',
      items: [
        {
          label: 'Users',
          href: '/admin/users',
          icon: '👥',
          roles: ['ADMIN', 'SUPER_ADMIN'],
        },
        {
          label: 'Organizations',
          href: '/admin/organizations',
          icon: '🏢',
          roles: ['ADMIN', 'SUPER_ADMIN'],
        },
        {
          label: 'Verification Queue',
          href: '/admin/verification',
          icon: '✓',
          roles: ['ADMIN', 'SUPER_ADMIN'],
        },
      ],
    },
    {
      title: 'Financial',
      items: [
        {
          label: 'Monitor Wallets',
          href: '/admin/wallets',
          icon: '💰',
          roles: ['ADMIN', 'SUPER_ADMIN'],
        },
        {
          label: 'Commission Settings',
          href: '/admin/commission',
          icon: '💵',
          roles: ['ADMIN', 'SUPER_ADMIN'],
        },
        {
          label: 'Settlement',
          href: '/admin/settlement',
          icon: '💳',
          roles: ['ADMIN', 'SUPER_ADMIN'],
        },
      ],
    },
    {
      title: 'GPS & Operations',
      items: [
        {
          label: 'GPS Management',
          href: '/admin/gps',
          icon: '📍',
          roles: ['ADMIN', 'SUPER_ADMIN'],
        },
        {
          label: 'Trip History',
          href: '/admin/trips',
          icon: '📜',
          roles: ['ADMIN', 'SUPER_ADMIN', 'DISPATCHER'],
        },
        {
          label: 'Bypass Review',
          href: '/admin/bypass-review',
          icon: '⚠️',
          roles: ['ADMIN', 'SUPER_ADMIN'],
        },
      ],
    },
    {
      title: 'Security & Logs',
      items: [
        {
          label: 'Security Dashboard',
          href: '/admin/security',
          icon: '🛡️',
          roles: ['ADMIN', 'SUPER_ADMIN'],
        },
        {
          label: 'Audit Logs',
          href: '/admin/audit-logs',
          icon: '📋',
          roles: ['ADMIN', 'SUPER_ADMIN'],
        },
      ],
    },
    {
      title: 'Configuration',
      items: [
        {
          label: 'System Settings',
          href: '/admin/settings',
          icon: '⚙️',
          roles: ['ADMIN', 'SUPER_ADMIN'],
        },
        {
          label: 'Feature Flags',
          href: '/admin/feature-flags',
          icon: '🚩',
          roles: ['SUPER_ADMIN'],
        },
        {
          label: 'System Health',
          href: '/admin/health',
          icon: '💚',
          roles: ['ADMIN', 'SUPER_ADMIN'],
        },
      ],
    },
  ],
  dispatcher: [
    {
      items: [
        {
          label: 'Dashboard',
          href: '/dispatcher',
          icon: '📊',
          roles: ['DISPATCHER', 'ADMIN', 'SUPER_ADMIN'],
        },
        {
          label: 'Map',
          href: '/dispatcher/map',
          icon: '🗺️',
          roles: ['DISPATCHER', 'ADMIN', 'SUPER_ADMIN'],
        },
      ],
    },
    {
      title: 'Operations',
      items: [
        {
          label: 'All Loads',
          href: '/dispatcher/loads',
          icon: '📦',
          roles: ['DISPATCHER', 'ADMIN', 'SUPER_ADMIN'],
        },
        {
          label: 'All Trucks',
          href: '/dispatcher/trucks',
          icon: '🚛',
          roles: ['DISPATCHER', 'ADMIN', 'SUPER_ADMIN'],
        },
        {
          label: 'Match Proposals',
          href: '/dispatcher/proposals',
          icon: '🎯',
          roles: ['DISPATCHER', 'ADMIN', 'SUPER_ADMIN'],
        },
      ],
    },
    {
      title: 'Monitoring',
      items: [
        {
          label: 'Active Trips',
          href: '/dispatcher/trips',
          icon: '🚚',
          roles: ['DISPATCHER', 'ADMIN', 'SUPER_ADMIN'],
        },
        {
          label: 'Escalations',
          href: '/dispatcher/escalations',
          icon: '⚠️',
          roles: ['DISPATCHER', 'ADMIN', 'SUPER_ADMIN'],
        },
      ],
    },
  ],
};

/**
 * Portal titles and back links
 */
const portalConfig: Record<string, { title: string; icon: string; backLink: { href: string; label: string } }> = {
  admin: {
    title: 'Admin Panel',
    icon: '🛡️',
    backLink: { href: '/', label: 'Back to Platform' },
  },
  carrier: {
    title: 'Carrier Portal',
    icon: '🚛',
    backLink: { href: '/', label: 'Back to Home' },
  },
  shipper: {
    title: 'Shipper Portal',
    icon: '📦',
    backLink: { href: '/', label: 'Back to Home' },
  },
  dispatcher: {
    title: 'Dispatcher Portal',
    icon: '📡',
    backLink: { href: '/', label: 'Back to Home' },
  },
};

export default function RoleAwareSidebar({
  userRole,
  portalType,
}: RoleAwareSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sections = navigationSections[portalType] || [];
  const config = portalConfig[portalType];

  /**
   * Check if user has access to this nav item
   */
  const hasAccess = (item: NavItem): boolean => {
    return item.roles.includes(userRole as any);
  };

  /**
   * Check if route is active (handles query parameters)
   */
  const isActive = (href: string): boolean => {
    // Parse href to separate path and query
    const [hrefPath, hrefQuery] = href.split('?');

    // Check if path matches
    const pathMatches = pathname === hrefPath || pathname?.startsWith(`${hrefPath}/`);

    // If href has query params, check if they match
    if (hrefQuery && pathMatches) {
      const hrefParams = new URLSearchParams(hrefQuery);
      const tabParam = hrefParams.get('tab');
      const currentTab = searchParams.get('tab');

      // For tab-based navigation, require exact tab match
      if (tabParam) {
        return currentTab === tabParam;
      }
    }

    // For paths without query params
    if (!hrefQuery) {
      if (href === `/${portalType}`) {
        return pathname === href;
      }
      return pathMatches;
    }

    return pathMatches;
  };

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Portal Header */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-200 dark:border-slate-700">
        <span className="text-2xl">{config.icon}</span>
        <span className="text-lg font-bold text-gray-900 dark:text-white">{config.title}</span>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        {sections.map((section, sectionIndex) => {
          const visibleItems = section.items.filter(hasAccess);
          if (visibleItems.length === 0) return null;

          return (
            <div key={sectionIndex}>
              {section.title && (
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {section.title}
                </div>
              )}
              <div className="space-y-1">
                {visibleItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                      isActive(item.href)
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-slate-800 dark:hover:text-white'
                    )}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer - Theme Toggle & Back Link */}
      <div className="border-t border-gray-200 dark:border-slate-700 p-4 space-y-2">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Theme</span>
          <ThemeToggle />
        </div>
        <Link
          href={config.backLink.href}
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800"
        >
          <span className="text-lg">🏠</span>
          <span>{config.backLink.label}</span>
        </Link>
      </div>
    </aside>
  );
}
