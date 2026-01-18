'use client';

/**
 * DashboardSection Component
 *
 * Reusable section wrapper for dashboard content
 * Sprint 20 - Dashboard Visual Redesign
 */

import React from 'react';
import Link from 'next/link';

interface DashboardSectionProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    href: string;
  };
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export default function DashboardSection({
  title,
  subtitle,
  action,
  children,
  className = '',
  noPadding = false,
}: DashboardSectionProps) {
  return (
    <div
      className={`rounded-xl border overflow-hidden ${className}`}
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Header */}
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div>
          <h3
            className="text-base font-semibold"
            style={{ color: 'var(--foreground)' }}
          >
            {title}
          </h3>
          {subtitle && (
            <p
              className="text-sm mt-0.5"
              style={{ color: 'var(--foreground-muted)' }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {action && (
          <Link
            href={action.href}
            className="text-sm font-medium transition-colors hover:opacity-80"
            style={{ color: 'var(--primary-500)' }}
          >
            {action.label}
          </Link>
        )}
      </div>

      {/* Content */}
      <div className={noPadding ? '' : 'p-6'}>
        {children}
      </div>
    </div>
  );
}
