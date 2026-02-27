/**
 * Shipper Load Board Layout
 *
 * Layout wrapper for shipper load board pages
 */

import { Suspense } from "react";

export default function ShipperLoadboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <div className="mb-6 h-8 w-64 animate-pulse rounded-lg bg-slate-200"></div>
          <div className="h-96 w-full animate-pulse rounded-xl bg-slate-200"></div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
