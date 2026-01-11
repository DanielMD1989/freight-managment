'use client';

/**
 * Carrier Dashboard Client Component
 *
 * Minimalistic, action-focused dashboard
 * Prioritizes essential daily operations info
 */

import Link from 'next/link';

// WhatsApp support number
const SUPPORT_WHATSAPP = '+251911000000'; // Replace with actual support number

interface DashboardData {
  totalTrucks: number;
  activeTrucks: number;
  activePostings: number;
  completedDeliveries: number;
  totalRevenue: number;
  wallet: {
    balance: number;
    currency: string;
  };
  recentPostings: number;
  nearbyMatches?: number;
}

interface Load {
  id: string;
  origin: string;
  destination: string;
  status: string;
  price?: number;
  weight?: number;
  distance?: number;
  equipmentType?: string;
  truckType?: string;
  pickupDate?: string;
  deliveryDate?: string;
  eta?: string;
  createdAt: string;
}

interface User {
  userId: string;
  email: string;
  role: string;
  organizationId?: string;
  name?: string;
}

interface CarrierDashboardClientProps {
  user: User;
  dashboardData: DashboardData | null;
  recentLoads: Load[];
  trucks: { id: string; isAvailable: boolean }[];
  recommendedLoads?: Load[];
  activeLoad?: Load | null;
}

function formatCurrency(amount: number, currency: string = 'ETB'): string {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Compact KPI Card - No charts, no heavy styling
function KpiCard({
  label,
  value,
  subValue,
  icon,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200/60">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-600">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-800">{value}</p>
          <p className="text-xs text-slate-500">{label}</p>
          {subValue && <p className="text-xs text-slate-400">{subValue}</p>}
        </div>
      </div>
    </div>
  );
}

// Quick Action Button with hover tooltip
function QuickAction({
  href,
  icon,
  label,
  emoji,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  emoji: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col items-center"
    >
      {/* Button */}
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-teal-500/30 group-hover:from-teal-700 group-hover:to-teal-600 transition-all group-hover:scale-110 group-hover:shadow-xl">
        {icon}
      </div>

      {/* Hover Tooltip */}
      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="bg-slate-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1.5 shadow-lg">
          <span>{emoji}</span>
          <span>{label}</span>
        </div>
        {/* Arrow */}
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45" />
      </div>
    </Link>
  );
}

// Compact Load Card for Active Load
function ActiveLoadCard({ load }: { load: Load }) {
  return (
    <Link
      href={`/carrier/loads/${load.id}`}
      className="block bg-white rounded-xl border border-slate-200/60 p-4 hover:border-teal-300 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          {load.status === 'IN_TRANSIT' ? 'In Transit' : load.status === 'ASSIGNED' ? 'Assigned' : 'Active'}
        </span>
        {load.eta && (
          <span className="text-xs text-slate-500">ETA: {load.eta}</span>
        )}
      </div>

      {/* Pickup */}
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-sm font-medium text-slate-800">{load.origin}</span>
      </div>

      {/* Dropoff */}
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-rose-500" />
        <span className="text-sm font-medium text-slate-800">{load.destination}</span>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        {load.price && (
          <span className="text-lg font-bold text-teal-600">{formatCurrency(load.price)}</span>
        )}
        {(load.equipmentType || load.truckType) && (
          <span className="text-xs text-slate-500">{load.equipmentType || load.truckType}</span>
        )}
      </div>
    </Link>
  );
}

// Recommended Load Card - Enhanced with more details
function RecommendedLoadCard({ load }: { load: Load }) {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Link
      href={`/carrier/loads/${load.id}`}
      className="block bg-white rounded-xl border border-slate-200/60 p-4 hover:border-teal-300 hover:shadow-sm transition-all"
    >
      {/* Route with connecting line */}
      <div className="relative pl-4 mb-3">
        {/* Vertical connecting line */}
        <div className="absolute left-[5px] top-2 bottom-2 w-px bg-slate-200" />

        {/* Pickup Location */}
        <div className="flex items-start gap-3 mb-3 relative">
          <div className="absolute left-[-12px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 mb-0.5">Pickup</p>
            <p className="text-sm font-medium text-slate-800 truncate">{load.origin}</p>
          </div>
        </div>

        {/* Dropoff Location */}
        <div className="flex items-start gap-3 relative">
          <div className="absolute left-[-12px] top-1 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-white shadow-sm" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 mb-0.5">Dropoff</p>
            <p className="text-sm font-medium text-slate-800 truncate">{load.destination}</p>
          </div>
        </div>
      </div>

      {/* Details Row */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2">
          {/* Equipment Badge */}
          {(load.equipmentType || load.truckType) && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-teal-50 text-teal-700 border border-teal-100">
              {(load.equipmentType || load.truckType || '').replace(/_/g, ' ')}
            </span>
          )}
        </div>

        {/* Distance or Date */}
        <div className="text-right">
          {load.distance ? (
            <span className="text-xs text-slate-500">{load.distance} km</span>
          ) : load.pickupDate ? (
            <span className="text-xs text-slate-500">{formatDate(load.pickupDate)}</span>
          ) : null}
        </div>
      </div>

      {/* Weight if available */}
      {load.weight && (
        <div className="mt-2 text-xs text-slate-400">
          {load.weight.toLocaleString()} kg
        </div>
      )}
    </Link>
  );
}

// Support Button with smart fallback - E2E implementation
function SupportButton() {
  const handleSupport = async () => {
    // 1. Check if in-app chat widget exists (Intercom, Crisp, Tawk, etc.)
    const win = window as unknown as {
      Intercom?: (action: string) => void;
      $crisp?: { push: (args: unknown[]) => void };
      Tawk_API?: { maximize: () => void };
    };

    // Try Intercom
    if (win.Intercom) {
      win.Intercom('show');
      return;
    }

    // Try Crisp
    if (win.$crisp) {
      win.$crisp.push(['do', 'chat:open']);
      return;
    }

    // Try Tawk
    if (win.Tawk_API?.maximize) {
      win.Tawk_API.maximize();
      return;
    }

    // 2. Fallback to WhatsApp
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const message = encodeURIComponent('Hi, I need help with FreightET carrier app');
    const phoneNumber = SUPPORT_WHATSAPP.replace('+', '');

    if (isMobile) {
      // Mobile: Use WhatsApp deep link
      const whatsappDeepLink = `whatsapp://send?phone=${phoneNumber}&text=${message}`;

      // Create a hidden link and click it
      const link = document.createElement('a');
      link.href = whatsappDeepLink;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 3. Fallback: If WhatsApp doesn't open after 2 seconds, go to help center
      setTimeout(() => {
        // Check if page is still visible (user didn't leave to WhatsApp)
        if (document.visibilityState === 'visible') {
          window.location.href = '/help';
        }
      }, 2000);
    } else {
      // Desktop: Open WhatsApp Web
      const whatsappWebUrl = `https://wa.me/${phoneNumber}?text=${message}`;
      const newWindow = window.open(whatsappWebUrl, '_blank');

      // 3. Fallback if popup blocked
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        window.location.href = '/help';
      }
    }
  };

  return (
    <button
      onClick={handleSupport}
      className="inline-flex items-center gap-2.5 px-6 py-3 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow"
    >
      <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
      Need Help?
    </button>
  );
}

export default function CarrierDashboardClient({
  user,
  dashboardData,
  recentLoads,
  trucks,
  recommendedLoads,
  activeLoad,
}: CarrierDashboardClientProps) {
  const data = dashboardData || {
    totalTrucks: 0,
    activeTrucks: 0,
    activePostings: 0,
    completedDeliveries: 0,
    totalRevenue: 0,
    wallet: { balance: 0, currency: 'ETB' },
    recentPostings: 0,
    nearbyMatches: 0,
  };

  const availableTrucks = trucks.filter(t => t.isAvailable).length;
  const inUseTrucks = trucks.length - availableTrucks;

  // Get active load from recentLoads if not provided
  const currentActiveLoad = activeLoad || recentLoads.find(
    l => l.status === 'IN_TRANSIT' || l.status === 'ASSIGNED'
  );

  // Get recommended loads (top 3)
  const topRecommendedLoads = (recommendedLoads || recentLoads.filter(
    l => l.status === 'POSTED'
  )).slice(0, 3);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-8">

        {/* Header - Simple */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">
            Welcome, {user.name?.split(' ')[0] || 'Carrier'}
          </h1>
        </div>

        {/* KPI Summary - 4 Compact Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <KpiCard
            label="Active Loads"
            value={data.activePostings}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            }
          />
          <KpiCard
            label="Nearby Matches"
            value={data.nearbyMatches || 0}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          />
          <KpiCard
            label="Wallet Balance"
            value={formatCurrency(data.wallet.balance, data.wallet.currency)}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            }
          />
          <KpiCard
            label="Fleet Status"
            value={`${availableTrucks}/${trucks.length || data.totalTrucks}`}
            subValue={`${inUseTrucks} in use`}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
            }
          />
        </div>

        {/* Quick Actions - Icon buttons with hover tooltips */}
        <div className="flex items-center gap-6 mb-10 pb-4">
          <QuickAction
            href="/carrier?tab=SEARCH_LOADS"
            label="Find Loads"
            emoji="🔍"
            icon={
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
          <QuickAction
            href="/carrier?tab=POST_TRUCKS"
            label="Post Truck"
            emoji="🚛"
            icon={
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            }
          />
          <QuickAction
            href="/carrier/trucks"
            label="View Fleet"
            emoji="📋"
            icon={
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
          />
          <QuickAction
            href="/carrier/map"
            label="Track Map"
            emoji="🗺️"
            icon={
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            }
          />
        </div>

        {/* Active Load Section */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Active Load</h2>
          {currentActiveLoad ? (
            <ActiveLoadCard load={currentActiveLoad} />
          ) : (
            <div className="bg-slate-100 rounded-xl p-4 text-center">
              <p className="text-sm text-slate-600">No active loads. Here are recommended loads.</p>
            </div>
          )}
        </div>

        {/* Recommended Loads - 3 Cards Only */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Recommended Loads</h2>
          {topRecommendedLoads.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {topRecommendedLoads.map((load) => (
                  <RecommendedLoadCard key={load.id} load={load} />
                ))}
              </div>
              <div className="mt-3 text-center">
                <Link
                  href="/carrier?tab=SEARCH_LOADS"
                  className="text-sm font-medium text-teal-600 hover:text-teal-700"
                >
                  View All Loads →
                </Link>
              </div>
            </>
          ) : (
            <div className="bg-slate-100 rounded-xl p-4 text-center">
              <p className="text-sm text-slate-600">No recommended loads at the moment.</p>
              <Link
                href="/carrier?tab=SEARCH_LOADS"
                className="text-sm font-medium text-teal-600 hover:text-teal-700 mt-2 inline-block"
              >
                Search for Loads →
              </Link>
            </div>
          )}
        </div>

        {/* Support Section - Smart Button */}
        <div className="text-center border-t border-slate-200 pt-8 mt-4">
          <SupportButton />
        </div>

      </div>
    </div>
  );
}
