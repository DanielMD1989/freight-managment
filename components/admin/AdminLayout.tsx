/**
 * Admin Layout Component
 * Sprint 1 - Story 1.5: Admin Dashboard
 *
 * Layout wrapper for admin pages with sidebar navigation
 */

'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Building2,
  Truck,
  Package,
  Settings,
  FileText,
  DollarSign,
  AlertTriangle,
  MapPin,
  Bell,
  Shield,
  TrendingUp,
  Route,
} from 'lucide-react';

interface AdminLayoutProps {
  children: ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const navigationItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    label: 'Users',
    href: '/admin/users',
    icon: Users,
  },
  {
    label: 'Organizations',
    href: '/admin/organizations',
    icon: Building2,
  },
  {
    label: 'Loads',
    href: '/admin/loads',
    icon: Package,
  },
  {
    label: 'Trucks',
    href: '/admin/trucks',
    icon: Truck,
  },
  {
    label: 'GPS Devices',
    href: '/admin/gps',
    icon: MapPin,
  },
  {
    label: 'Bypass Review',
    href: '/admin/bypass-review',
    icon: AlertTriangle,
  },
  {
    label: 'Settlement',
    href: '/admin/settlement',
    icon: DollarSign,
  },
  {
    label: 'Commission Rates',
    href: '/admin/commission',
    icon: TrendingUp,
  },
  {
    label: 'Corridor Pricing',
    href: '/admin/corridors',
    icon: Route,
  },
  {
    label: 'Service Fees',
    href: '/admin/service-fees',
    icon: DollarSign,
  },
  {
    label: 'Notifications',
    href: '/admin/notifications',
    icon: Bell,
  },
  {
    label: 'Audit Logs',
    href: '/admin/audit-logs',
    icon: FileText,
  },
  {
    label: 'Security',
    href: '/admin/security',
    icon: Shield,
  },
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: Settings,
  },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-gray-200 bg-white">
        <div className="flex h-full flex-col">
          {/* Logo/Brand */}
          <div className="flex h-16 items-center border-b border-gray-200 px-6">
            <Link href="/admin" className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-blue-600" />
              <span className="text-lg font-bold">Admin Panel</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto p-4">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || pathname?.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="border-t border-gray-200 p-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <LayoutDashboard className="h-5 w-5" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
