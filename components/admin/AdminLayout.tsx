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
    <div className="flex h-screen overflow-hidden bg-[#f0fdfa]">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-[#064d51]/15 bg-white">
        <div className="flex h-full flex-col">
          {/* Logo/Brand */}
          <div className="flex h-16 items-center border-b border-[#064d51]/15 px-6">
            <Link href="/admin" className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-[#1e9c99]" />
              <span className="text-lg font-bold text-[#064d51]">Admin Panel</span>
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
                      ? 'bg-[#1e9c99]/10 text-[#1e9c99]'
                      : 'text-[#064d51]/80 hover:bg-[#f0fdfa] hover:text-[#064d51]'
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
          <div className="border-t border-[#064d51]/15 p-4">
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[#064d51]/80 hover:bg-[#f0fdfa]"
            >
              <LayoutDashboard className="h-5 w-5" />
              <span>Admin Dashboard</span>
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
