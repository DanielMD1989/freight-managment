'use client';

/**
 * QuickActionLink Component
 *
 * Reusable quick action link for admin dashboards
 * Sprint 20 - Dashboard Visual Redesign
 */

import React from 'react';
import Link from 'next/link';
import { ChevronRightIcon } from './icons';

interface QuickActionLinkProps {
  href: string;
  label: string;
  description: string;
  color?: 'primary' | 'secondary' | 'success' | 'accent';
}

const colorStyles = {
  primary: 'bg-primary-500/10 hover:bg-primary-500/20 text-primary-600 dark:text-primary-400',
  secondary: 'bg-secondary-500/10 hover:bg-secondary-500/20 text-secondary-600 dark:text-secondary-400',
  success: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  accent: 'bg-accent-500/10 hover:bg-accent-500/20 text-accent-600 dark:text-accent-400',
};

export default function QuickActionLink({
  href,
  label,
  description,
  color = 'primary',
}: QuickActionLinkProps) {
  return (
    <Link
      href={href}
      className={`block px-4 py-3 rounded-lg transition-colors ${colorStyles[color]}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium">{label}</span>
          <p
            className="text-xs mt-0.5"
            style={{ color: 'var(--foreground-muted)' }}
          >
            {description}
          </p>
        </div>
        <ChevronRightIcon />
      </div>
    </Link>
  );
}
