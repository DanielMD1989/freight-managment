import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";

// Icon Components
const PackageIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const ClipboardIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const TruckIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 17h8M8 17a2 2 0 11-4 0 2 2 0 014 0zm8 0a2 2 0 104 0 2 2 0 00-4 0zM3 9h13a2 2 0 012 2v4H3V9zm13-4l4 4h-4V5z" />
  </svg>
);

const WalletIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const LocationIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const TargetIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const BuildingIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const CurrencyIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const MapIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  </svg>
);

const WarningIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

// Icon mapping for quick actions
const iconMap: Record<string, React.ReactNode> = {
  "📦": <PackageIcon />,
  "📋": <ClipboardIcon />,
  "🚛": <TruckIcon />,
  "💰": <WalletIcon />,
  "🔍": <SearchIcon />,
  "📍": <LocationIcon />,
  "🎯": <TargetIcon />,
  "👥": <UsersIcon />,
  "🏢": <BuildingIcon />,
  "💵": <CurrencyIcon />,
  "🗺️": <MapIcon />,
};

// Color mapping for cards
const colorMap: Record<number, { bg: string; iconBg: string; iconColor: string; hover: string }> = {
  0: { bg: "bg-gradient-to-br from-[var(--primary-600)] to-[var(--primary-700)]", iconBg: "bg-white/20", iconColor: "text-white", hover: "hover:from-[var(--primary-700)] hover:to-[var(--primary-800)]" },
  1: { bg: "bg-gradient-to-br from-[var(--accent-500)] to-[var(--accent-600)]", iconBg: "bg-white/20", iconColor: "text-white", hover: "hover:from-[var(--accent-600)] hover:to-[var(--accent-700)]" },
  2: { bg: "bg-gradient-to-br from-[var(--success-500)] to-[var(--success-600)]", iconBg: "bg-white/20", iconColor: "text-white", hover: "hover:from-[var(--success-600)] hover:to-[var(--success-700)]" },
  3: { bg: "bg-gradient-to-br from-[var(--primary-800)] to-[var(--primary-900)]", iconBg: "bg-white/20", iconColor: "text-white", hover: "hover:from-[var(--primary-900)] hover:to-[var(--neutral-900)]" },
};

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const role = session.role;

  // Redirect to role-specific portal
  switch (role) {
    case "ADMIN":
      redirect("/admin");
    case "SHIPPER":
      redirect("/shipper");
    case "CARRIER":
      redirect("/carrier");
    case "DRIVER":
      redirect("/driver");
    case "DISPATCHER":
      redirect("/dispatcher/dashboard");
    case "PLATFORM_OPS":
      redirect("/ops");
    default:
      break;
  }

  // Quick action cards based on role
  const getQuickActions = () => {
    if (role === "SHIPPER") {
      return [
        {
          title: "Post a Load",
          description: "Create and publish a new freight load",
          href: "/dashboard/loads/new",
          icon: "📦",
        },
        {
          title: "My Loads",
          description: "View and manage your posted loads",
          href: "/dashboard/loads",
          icon: "📋",
        },
        {
          title: "Search Trucks",
          description: "Find available trucks for your loads",
          href: "/dashboard/trucks/search",
          icon: "🚛",
        },
        {
          title: "Wallet",
          description: "Manage your account balance",
          href: "/dashboard/wallet",
          icon: "💰",
        },
      ];
    } else if (role === "CARRIER" || role === "CARRIER_INDIVIDUAL") {
      return [
        {
          title: "Find Loads",
          description: "Browse available freight loads",
          href: "/dashboard/loads/search",
          icon: "🔍",
        },
        {
          title: "My Trucks",
          description: "Manage your fleet",
          href: "/dashboard/trucks",
          icon: "🚛",
        },
        {
          title: "GPS Tracking",
          description: "Track your fleet in real-time",
          href: "/dashboard/gps",
          icon: "📍",
        },
        {
          title: "Wallet",
          description: "View earnings and withdraw funds",
          href: "/dashboard/wallet",
          icon: "💰",
        },
      ];
    } else if (role === "DISPATCHER") {
      return [
        {
          title: "Dispatcher Dashboard",
          description: "View and manage all loads and trucks",
          href: "/dispatcher/dashboard",
          icon: "🎯",
        },
        {
          title: "All Loads",
          description: "View and assign all system loads",
          href: "/dispatcher/dashboard?tab=loads",
          icon: "📋",
        },
        {
          title: "All Trucks",
          description: "Monitor all registered trucks",
          href: "/dispatcher/dashboard?tab=trucks",
          icon: "🚛",
        },
        {
          title: "GPS Tracking",
          description: "Track all active shipments",
          href: "/dashboard/gps/map",
          icon: "📍",
        },
      ];
    } else if (role === "PLATFORM_OPS") {
      return [
        {
          title: "Dispatch",
          description: "Assign trucks to loads",
          href: "/dashboard/dispatch",
          icon: "🎯",
        },
        {
          title: "All Loads",
          description: "View and manage all loads",
          href: "/dashboard/loads/all",
          icon: "📋",
        },
        {
          title: "GPS Map",
          description: "Monitor all active trucks",
          href: "/dashboard/gps/map",
          icon: "🗺️",
        },
      ];
    } else if (role === "ADMIN") {
      return [
        {
          title: "Users",
          description: "Manage system users",
          href: "/dashboard/admin/users",
          icon: "👥",
        },
        {
          title: "Organizations",
          description: "Manage organizations",
          href: "/dashboard/admin/organizations",
          icon: "🏢",
        },
        {
          title: "Financials",
          description: "Monitor accounts and transactions",
          href: "/dashboard/admin/financials",
          icon: "💵",
        },
        {
          title: "GPS Map",
          description: "View all trucks",
          href: "/dashboard/gps/map",
          icon: "🗺️",
        },
      ];
    }
    return [];
  };

  const quickActions = getQuickActions();

  // Get user initials for avatar
  const getInitials = (email: string) => {
    const parts = email.split("@")[0].split(/[._-]/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  // Get role display name
  const getRoleDisplay = (role: string) => {
    const roleMap: Record<string, string> = {
      SHIPPER: "Shipper",
      CARRIER: "Carrier",
      CARRIER_INDIVIDUAL: "Individual Carrier",
      DRIVER: "Driver",
      DISPATCHER: "Dispatcher",
      PLATFORM_OPS: "Platform Operations",
      ADMIN: "Administrator",
      LOGISTICS_AGENT: "3PL Agent",
    };
    return roleMap[role] || role;
  };

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[var(--primary-800)] via-[var(--primary-700)] to-[var(--primary-600)] p-8 text-white">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-bold border-2 border-white/30">
                {getInitials(session.email)}
              </div>
            </div>

            {/* Welcome Text */}
            <div>
              <p className="text-sm font-medium text-white/80">{getGreeting()}</p>
              <h1 className="text-2xl sm:text-3xl font-bold mt-1">
                {session.email.split("@")[0]}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-sm border border-white/20">
                  {getRoleDisplay(session.role)}
                </span>
                {session.organizationId && (
                  <span className="text-sm text-white/70">
                    Org: {session.organizationId.slice(0, 8)}...
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats Placeholder */}
          <div className="hidden lg:flex items-center gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold">--</p>
              <p className="text-xs text-white/70 mt-1">Active Loads</p>
            </div>
            <div className="w-px h-12 bg-white/20"></div>
            <div className="text-center">
              <p className="text-3xl font-bold">--</p>
              <p className="text-xs text-white/70 mt-1">In Transit</p>
            </div>
            <div className="w-px h-12 bg-white/20"></div>
            <div className="text-center">
              <p className="text-3xl font-bold">--</p>
              <p className="text-xs text-white/70 mt-1">Completed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Organization Setup Banner */}
      {!session.organizationId && role !== "ADMIN" && role !== "PLATFORM_OPS" && (
        <div className="rounded-xl border-2 border-[var(--warning-400)] bg-gradient-to-r from-[var(--warning-50)] to-[var(--warning-100)] p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-[var(--warning-200)] flex items-center justify-center text-[var(--warning-700)]">
                <WarningIcon />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-[var(--warning-900)]">
                Complete Your Setup
              </h3>
              <p className="mt-1 text-sm text-[var(--warning-700)]">
                Create an organization to start posting loads or managing trucks. This only takes a minute!
              </p>
            </div>
            <div className="flex-shrink-0">
              <Link
                href="/dashboard/organization/setup"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--warning-600)] text-white font-semibold text-sm shadow-sm hover:bg-[var(--warning-700)] transition-all"
              >
                Create Organization
                <ArrowRightIcon />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-[var(--neutral-900)]">
            Quick Actions
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {quickActions.map((action, index) => {
            const colors = colorMap[index % 4];
            return (
              <Link
                key={action.title}
                href={action.href}
                className={`group relative overflow-hidden rounded-xl ${colors.bg} ${colors.hover} p-6 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1`}
              >
                {/* Decorative Circle */}
                <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10"></div>

                {/* Icon */}
                <div className={`relative w-12 h-12 rounded-lg ${colors.iconBg} flex items-center justify-center ${colors.iconColor} mb-4`}>
                  {iconMap[action.icon] || <PackageIcon />}
                </div>

                {/* Content */}
                <div className="relative">
                  <h3 className="text-lg font-bold text-white mb-1">
                    {action.title}
                  </h3>
                  <p className="text-sm text-white/80">
                    {action.description}
                  </p>
                </div>

                {/* Arrow */}
                <div className="absolute bottom-6 right-6 text-white/50 group-hover:text-white/80 transition-colors">
                  <ChevronRightIcon />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Activity & Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--neutral-50)]">
            <h2 className="text-base font-semibold text-[var(--neutral-900)]">
              Recent Activity
            </h2>
          </div>
          <div className="p-6">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-[var(--neutral-100)] flex items-center justify-center mb-4">
                <ClipboardIcon />
              </div>
              <p className="text-[var(--neutral-600)] font-medium mb-1">No recent activity</p>
              <p className="text-sm text-[var(--neutral-400)]">
                Your activity feed will appear here
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--neutral-50)]">
            <h2 className="text-base font-semibold text-[var(--neutral-900)]">
              Overview
            </h2>
          </div>
          <div className="p-6 space-y-4">
            {/* Stat Items */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--neutral-50)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--primary-100)] flex items-center justify-center text-[var(--primary-600)]">
                  <PackageIcon />
                </div>
                <span className="text-sm font-medium text-[var(--neutral-700)]">Total Loads</span>
              </div>
              <span className="text-lg font-bold text-[var(--neutral-900)]">--</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--neutral-50)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--success-100)] flex items-center justify-center text-[var(--success-600)]">
                  <TruckIcon />
                </div>
                <span className="text-sm font-medium text-[var(--neutral-700)]">Active Trucks</span>
              </div>
              <span className="text-lg font-bold text-[var(--neutral-900)]">--</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--neutral-50)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-100)] flex items-center justify-center text-[var(--accent-600)]">
                  <WalletIcon />
                </div>
                <span className="text-sm font-medium text-[var(--neutral-700)]">Balance</span>
              </div>
              <span className="text-lg font-bold text-[var(--neutral-900)]">ETB --</span>
            </div>

            {/* View All Link */}
            <Link
              href="/dashboard/wallet"
              className="flex items-center justify-center gap-2 w-full mt-4 px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--neutral-700)] hover:bg-[var(--neutral-50)] transition-colors"
            >
              View Full Dashboard
              <ChevronRightIcon />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
