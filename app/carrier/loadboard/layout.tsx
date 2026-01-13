/**
 * Carrier Load Board Layout
 *
 * Layout wrapper for carrier load board pages
 */

import { Suspense } from 'react';

export default function CarrierLoadboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={
      <div className="p-6">
        <div className="animate-pulse bg-slate-200 h-8 w-64 rounded-lg mb-6"></div>
        <div className="animate-pulse bg-slate-200 h-96 w-full rounded-xl"></div>
      </div>
    }>
      {children}
    </Suspense>
  );
}
