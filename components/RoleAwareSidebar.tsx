'use client';

/**
 * Role-Aware Sidebar Component
 *
 * Unified sidebar navigation for all portal types (Admin, Carrier, Shipper)
 * Shows role-appropriate menu items based on user's role
 * Uses A2 Modern Navy design system with professional SVG icons
 */

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ThemeToggle } from './ThemeToggle';

// Simple className utility
function cn(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ============================================
// SVG Icon Components
// ============================================

const DashboardIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 12a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
  </svg>
);

const MapIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  </svg>
);

const UploadIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const TruckIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 17h8M8 17a2 2 0 11-4 0 2 2 0 014 0zm8 0a2 2 0 104 0 2 2 0 00-4 0zM3 9h13a2 2 0 012 2v4H3V9zm13-4l4 4h-4V5z" />
  </svg>
);

const TargetIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const WalletIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

const HistoryIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const LocationIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const FolderIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const PackageIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const BuildingIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CurrencyIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CreditCardIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

const WarningIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const ShieldIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const ClipboardIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

const CogIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const FlagIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
  </svg>
);

const HeartIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const BriefcaseIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const SignalIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79M12 12h.008v.007H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
  </svg>
);

// Icon mapping
const iconComponents: Record<string, React.FC> = {
  '📊': DashboardIcon,
  '🗺️': MapIcon,
  '📤': UploadIcon,
  '🔍': SearchIcon,
  '🚛': TruckIcon,
  '🎯': TargetIcon,
  '💰': WalletIcon,
  '📜': HistoryIcon,
  '📍': LocationIcon,
  '📁': FolderIcon,
  '📦': PackageIcon,
  '👥': UsersIcon,
  '🏢': BuildingIcon,
  '✓': CheckCircleIcon,
  '💵': CurrencyIcon,
  '💳': CreditCardIcon,
  '⚠️': WarningIcon,
  '🛡️': ShieldIcon,
  '📋': ClipboardIcon,
  '⚙️': CogIcon,
  '🚩': FlagIcon,
  '💚': HeartIcon,
  '📈': ChartIcon,
  '🏠': HomeIcon,
  '🚚': TruckIcon,
  '📡': SignalIcon,
  '💼': BriefcaseIcon,
};

// Portal icon components
const PortalIcons: Record<string, React.FC<{ className?: string }>> = {
  admin: ({ className }) => (
    <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  carrier: ({ className }) => (
    <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 17h8M8 17a2 2 0 11-4 0 2 2 0 014 0zm8 0a2 2 0 104 0 2 2 0 00-4 0zM3 9h13a2 2 0 012 2v4H3V9zm13-4l4 4h-4V5z" />
    </svg>
  ),
  shipper: ({ className }) => (
    <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  dispatcher: ({ className }) => (
    <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79M12 12h.008v.007H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  ),
};

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
  portalType: 'admin' | 'carrier' | 'shipper' | 'dispatcher';
  children?: ReactNode;
}

/**
 * Navigation configuration - role-aware visibility
 */
const navigationSections: Record<string, NavSection[]> = {
  carrier: [
    {
      items: [
        { label: 'Dashboard', href: '/carrier/dashboard', icon: '📊', roles: ['CARRIER', 'ADMIN', 'SUPER_ADMIN'] },
        { label: 'Map', href: '/carrier/map', icon: '🗺️', roles: ['CARRIER', 'ADMIN', 'SUPER_ADMIN'] },
      ],
    },
    {
      title: 'Marketplace',
      items: [
        { label: 'Loadboard', href: '/carrier/loadboard', icon: '💼', roles: ['CARRIER', 'ADMIN', 'SUPER_ADMIN'] },
        { label: 'Requests', href: '/carrier/requests', icon: '📋', roles: ['CARRIER', 'ADMIN', 'SUPER_ADMIN'] },
      ],
    },
    {
      title: 'Operations',
      items: [
        { label: 'My Trucks', href: '/carrier/trucks', icon: '🚛', roles: ['CARRIER', 'ADMIN', 'SUPER_ADMIN'] },
        { label: 'Trips', href: '/carrier/trips', icon: '🚚', roles: ['CARRIER', 'ADMIN', 'SUPER_ADMIN'] },
        { label: 'GPS Tracking', href: '/carrier/gps', icon: '📍', roles: ['CARRIER', 'ADMIN', 'SUPER_ADMIN'] },
      ],
    },
    {
      title: 'Business',
      items: [
        { label: 'Wallet', href: '/carrier/wallet', icon: '💰', roles: ['CARRIER', 'ADMIN', 'SUPER_ADMIN'] },
        { label: 'Documents', href: '/carrier/documents', icon: '📁', roles: ['CARRIER', 'ADMIN', 'SUPER_ADMIN'] },
      ],
    },
  ],
  shipper: [
    {
      items: [
        { label: 'Dashboard', href: '/shipper/dashboard', icon: '📊', roles: ['SHIPPER', 'ADMIN', 'SUPER_ADMIN'] },
        { label: 'Live Map', href: '/shipper/map', icon: '🗺️', roles: ['SHIPPER', 'ADMIN', 'SUPER_ADMIN'] },
      ],
    },
    {
      title: 'Marketplace',
      items: [
        { label: 'Loadboard', href: '/shipper/loadboard', icon: '💼', roles: ['SHIPPER', 'ADMIN', 'SUPER_ADMIN'] },
        { label: 'Requests', href: '/shipper/requests', icon: '📋', roles: ['SHIPPER', 'ADMIN', 'SUPER_ADMIN'] },
      ],
    },
    {
      title: 'Shipments',
      items: [
        { label: 'My Loads', href: '/shipper/loads', icon: '📦', roles: ['SHIPPER', 'ADMIN', 'SUPER_ADMIN'] },
        { label: 'Trips', href: '/shipper/trips', icon: '🚚', roles: ['SHIPPER', 'ADMIN', 'SUPER_ADMIN'] },
      ],
    },
    {
      title: 'Business',
      items: [
        { label: 'Wallet', href: '/shipper/wallet', icon: '💰', roles: ['SHIPPER', 'ADMIN', 'SUPER_ADMIN'] },
        { label: 'Documents', href: '/shipper/documents', icon: '📁', roles: ['SHIPPER', 'ADMIN', 'SUPER_ADMIN'] },
        { label: 'Team', href: '/shipper/team', icon: '👥', roles: ['SHIPPER', 'ADMIN', 'SUPER_ADMIN'] },
      ],
    },
  ],
  admin: [
    {
      title: 'Overview',
      items: [
        { label: 'Dashboard', href: '/admin', icon: '📊', roles: ['ADMIN', 'SUPER_ADMIN'] },
        { label: 'Analytics', href: '/admin/analytics', icon: '📈', roles: ['ADMIN', 'SUPER_ADMIN'] },
        { label: 'Map', href: '/admin/map', icon: '🗺️', roles: ['ADMIN', 'SUPER_ADMIN', 'DISPATCHER'] },
      ],
    },
    {
      title: 'Operations',
      items: [
        { label: 'All Loads', href: '/admin/loads', icon: '📦', roles: ['ADMIN', 'SUPER_ADMIN', 'DISPATCHER'] },
        { label: 'All Trucks', href: '/admin/trucks', icon: '🚛', roles: ['ADMIN', 'SUPER_ADMIN', 'DISPATCHER'] },
      ],
    },
    {
      title: 'Users',
      items: [
        { label: 'Users', href: '/admin/users', icon: '👥', roles: ['ADMIN', 'SUPER_ADMIN'] },
        { label: 'Organizations', href: '/admin/organizations', icon: '🏢', roles: ['ADMIN', 'SUPER_ADMIN'] },
        { label: 'Verification', href: '/admin/verification', icon: '✓', roles: ['ADMIN', 'SUPER_ADMIN'] },
      ],
    },
    {
      title: 'Financial',
      items: [
        { label: 'Platform Revenue', href: '/admin/service-fees', icon: '💵', roles: ['ADMIN', 'SUPER_ADMIN'] },
        { label: 'Corridors', href: '/admin/corridors', icon: '🛤️', roles: ['ADMIN', 'SUPER_ADMIN'] },
        { label: 'Settlement', href: '/admin/settlement', icon: '💳', roles: ['ADMIN', 'SUPER_ADMIN'] },
      ],
    },
    {
      title: 'GPS & Trips',
      items: [
        { label: 'GPS Management', href: '/admin/gps', icon: '📍', roles: ['ADMIN', 'SUPER_ADMIN'] },
        { label: 'Trip History', href: '/admin/trips', icon: '📜', roles: ['ADMIN', 'SUPER_ADMIN', 'DISPATCHER'] },
        { label: 'Bypass Review', href: '/admin/bypass-review', icon: '⚠️', roles: ['ADMIN', 'SUPER_ADMIN'] },
      ],
    },
    {
      title: 'Security',
      items: [
        { label: 'Security', href: '/admin/security', icon: '🛡️', roles: ['ADMIN', 'SUPER_ADMIN'] },
        { label: 'Audit Logs', href: '/admin/audit-logs', icon: '📋', roles: ['ADMIN', 'SUPER_ADMIN'] },
      ],
    },
    {
      title: 'Settings',
      items: [
        { label: 'System', href: '/admin/settings', icon: '⚙️', roles: ['ADMIN', 'SUPER_ADMIN'] },
        { label: 'Features', href: '/admin/feature-flags', icon: '🚩', roles: ['SUPER_ADMIN'] },
        { label: 'Health', href: '/admin/health', icon: '💚', roles: ['ADMIN', 'SUPER_ADMIN'] },
      ],
    },
  ],
  dispatcher: [
    {
      items: [
        { label: 'Dashboard', href: '/dispatcher', icon: '📊', roles: ['DISPATCHER', 'ADMIN', 'SUPER_ADMIN'] },
        { label: 'Map', href: '/dispatcher/map', icon: '🗺️', roles: ['DISPATCHER', 'ADMIN', 'SUPER_ADMIN'] },
      ],
    },
    {
      title: 'Operations',
      items: [
        { label: 'All Loads', href: '/dispatcher/loads', icon: '📦', roles: ['DISPATCHER', 'ADMIN', 'SUPER_ADMIN'] },
        { label: 'All Trucks', href: '/dispatcher/trucks', icon: '🚛', roles: ['DISPATCHER', 'ADMIN', 'SUPER_ADMIN'] },
        { label: 'Proposals', href: '/dispatcher/proposals', icon: '🎯', roles: ['DISPATCHER', 'ADMIN', 'SUPER_ADMIN'] },
      ],
    },
    {
      title: 'Monitoring',
      items: [
        { label: 'Active Trips', href: '/dispatcher/trips', icon: '🚚', roles: ['DISPATCHER', 'ADMIN', 'SUPER_ADMIN'] },
        { label: 'Escalations', href: '/dispatcher/escalations', icon: '⚠️', roles: ['DISPATCHER', 'ADMIN', 'SUPER_ADMIN'] },
      ],
    },
  ],
};

/**
 * Portal configuration
 */
const portalConfig: Record<string, { title: string; subtitle: string; backLink: { href: string; label: string } }> = {
  admin: {
    title: 'FreightET',
    subtitle: 'Admin',
    backLink: { href: '/', label: 'Back to Platform' },
  },
  carrier: {
    title: 'FreightET',
    subtitle: 'Carrier',
    backLink: { href: '/', label: 'Back to Home' },
  },
  shipper: {
    title: 'FreightET',
    subtitle: 'Shipper',
    backLink: { href: '/', label: 'Back to Home' },
  },
  dispatcher: {
    title: 'FreightET',
    subtitle: 'Dispatcher',
    backLink: { href: '/', label: 'Back to Home' },
  },
};

export default function RoleAwareSidebar({ userRole, portalType }: RoleAwareSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sections = navigationSections[portalType] || [];
  const config = portalConfig[portalType];
  const PortalIcon = PortalIcons[portalType];

  const hasAccess = (item: NavItem): boolean => {
    return item.roles.includes(userRole as any);
  };

  const isActive = (href: string): boolean => {
    const [hrefPath, hrefQuery] = href.split('?');
    const pathMatches = pathname === hrefPath || pathname?.startsWith(`${hrefPath}/`);

    // Special handling for loadboard links - match regardless of query params
    if (hrefPath === '/carrier/loadboard' || hrefPath === '/shipper/loadboard') {
      return pathname?.startsWith(hrefPath) || false;
    }

    if (hrefQuery && pathMatches) {
      const hrefParams = new URLSearchParams(hrefQuery);
      const tabParam = hrefParams.get('tab');
      const currentTab = searchParams.get('tab');
      if (tabParam) {
        return currentTab === tabParam;
      }
    }

    if (!hrefQuery) {
      if (href === `/${portalType}`) {
        return pathname === href;
      }
      return pathMatches;
    }

    return pathMatches;
  };

  const IconComponent = ({ icon }: { icon: string }) => {
    const Component = iconComponents[icon];
    return Component ? <Component /> : <DashboardIcon />;
  };

  return (
    <aside
      className="w-64 min-h-[calc(100vh-4rem)] flex flex-col"
      style={{
        background: 'var(--sidebar-bg)',
        borderRadius: '16px',
        margin: '12px',
        boxShadow: '4px 4px 20px rgba(0, 0, 0, 0.15)'
      }}
    >
      {/* Portal Header */}
      <div
        className="flex items-center gap-3 px-5 py-5"
        style={{ borderBottom: '1px solid var(--sidebar-border)' }}
      >
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg"
          style={{ background: 'var(--primary-600)' }}
        >
          <PortalIcon className="w-6 h-6 text-white" />
        </div>
        <div>
          <span className="text-base font-bold block" style={{ color: 'var(--sidebar-text-active)' }}>{config.title}</span>
          <span className="text-xs" style={{ color: 'var(--sidebar-muted)' }}>{config.subtitle}</span>
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
        {sections.map((section, sectionIndex) => {
          const visibleItems = section.items.filter(hasAccess);
          if (visibleItems.length === 0) return null;

          return (
            <div key={sectionIndex} className={sectionIndex > 0 ? 'pt-4' : ''}>
              {section.title && (
                <div
                  className="flex items-center gap-2 px-3 py-2 mb-1 mt-2"
                  style={{ borderTop: sectionIndex > 0 ? '1px solid var(--sidebar-border)' : 'none', paddingTop: sectionIndex > 0 ? '0.75rem' : '0.5rem' }}
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--sidebar-muted)' }}>
                    {section.title}
                  </span>
                  <div className="flex-1 h-px" style={{ background: 'var(--sidebar-border)' }}></div>
                </div>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 border-l-[3px]"
                      style={{
                        background: active ? 'var(--sidebar-active)' : 'transparent',
                        color: active ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
                        borderColor: active ? 'var(--primary-500)' : 'transparent',
                      }}
                    >
                      <span
                        className="flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                        style={{ color: active ? 'var(--primary-400)' : 'var(--sidebar-text)' }}
                      >
                        <IconComponent icon={item.icon} />
                      </span>
                      <span className="truncate">{item.label}</span>
                      {active && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: 'var(--primary-400)' }}></span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 space-y-1" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
        {/* Theme Toggle */}
        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background: 'var(--sidebar-hover)' }}>
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5" style={{ color: 'var(--sidebar-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            <span className="text-sm font-medium" style={{ color: 'var(--sidebar-text)' }}>Theme</span>
          </div>
          <ThemeToggle />
        </div>

        {/* Back Link */}
        <Link
          href={config.backLink.href}
          className="group flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200"
          style={{ color: 'var(--sidebar-muted)' }}
        >
          <HomeIcon />
          <span>{config.backLink.label}</span>
        </Link>
      </div>
    </aside>
  );
}
