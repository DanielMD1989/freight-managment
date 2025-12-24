import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import LogoutButton from "./LogoutButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const role = session.role;

  // Navigation items based on role
  const shipperNav = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "My Loads", href: "/dashboard/loads" },
    { name: "Search Trucks", href: "/dashboard/trucks/search" },
    { name: "Wallet", href: "/dashboard/wallet" },
  ];

  const carrierNav = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Find Loads", href: "/dashboard/loads/search" },
    { name: "My Trucks", href: "/dashboard/trucks" },
    { name: "Wallet", href: "/dashboard/wallet" },
    { name: "GPS Tracking", href: "/dashboard/gps" },
  ];

  const opsNav = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Find Loads", href: "/dashboard/loads/search" },
    { name: "Dispatch", href: "/dashboard/dispatch" },
    { name: "All Loads", href: "/dashboard/loads/all" },
    { name: "GPS Map", href: "/dashboard/gps/map" },
  ];

  const adminNav = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Find Loads", href: "/dashboard/loads/search" },
    { name: "Users", href: "/dashboard/admin/users" },
    { name: "Organizations", href: "/dashboard/admin/organizations" },
    { name: "All Loads", href: "/dashboard/loads/all" },
    { name: "Financials", href: "/dashboard/admin/financials" },
    { name: "GPS Map", href: "/dashboard/gps/map" },
  ];

  let navItems = shipperNav;
  if (role === "CARRIER" || role === "CARRIER_INDIVIDUAL") {
    navItems = carrierNav;
  } else if (role === "LOGISTICS_AGENT") {
    // 3PL gets both shipper and carrier features
    navItems = [
      { name: "Dashboard", href: "/dashboard" },
      { name: "My Loads", href: "/dashboard/loads" },
      { name: "Find Loads", href: "/dashboard/loads/search" },
      { name: "My Trucks", href: "/dashboard/trucks" },
      { name: "Wallet", href: "/dashboard/wallet" },
      { name: "GPS Tracking", href: "/dashboard/gps" },
    ];
  } else if (role === "PLATFORM_OPS") {
    navItems = opsNav;
  } else if (role === "ADMIN") {
    navItems = adminNav;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <div className="flex shrink-0 items-center">
                <Link href="/dashboard">
                  <h1 className="text-xl font-bold text-blue-600">
                    🚛 Freight Platform
                  </h1>
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm">
                <p className="font-medium text-gray-900">{session.email}</p>
                <p className="text-xs text-gray-500">{session.role}</p>
              </div>
              <LogoutButton />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
