import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";

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
      // If no specific role, show generic dashboard
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {session.email}!
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Role: <span className="font-semibold">{session.role}</span>
        </p>
        {session.organizationId && (
          <p className="mt-1 text-gray-600">
            Organization ID: <span className="font-semibold">{session.organizationId}</span>
          </p>
        )}
      </div>

      {/* Organization Setup Banner */}
      {!session.organizationId && role !== "ADMIN" && role !== "PLATFORM_OPS" && (
        <div className="mb-8 rounded-lg bg-yellow-50 border-2 border-yellow-400 p-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-lg font-semibold text-yellow-800">
                Set Up Your Organization
              </h3>
              <p className="mt-2 text-sm text-yellow-700">
                You need to create an organization before you can post loads or manage trucks. This only takes a minute!
              </p>
              <div className="mt-4">
                <Link
                  href="/dashboard/organization/setup"
                  className="inline-flex items-center rounded-md bg-yellow-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yellow-500"
                >
                  Create Organization Now →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.title}
              href={action.href}
              className="block rounded-lg bg-white p-6 shadow hover:shadow-md transition-shadow"
            >
              <div className="text-4xl mb-3">{action.icon}</div>
              <h3 className="text-lg font-semibold text-gray-900">
                {action.title}
              </h3>
              <p className="mt-2 text-sm text-gray-600">{action.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity - Placeholder */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">
          Recent Activity
        </h2>
        <p className="text-sm text-gray-500">
          Activity feed will be implemented in a future update.
        </p>
      </div>
    </div>
  );
}
