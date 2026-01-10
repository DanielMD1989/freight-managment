import * as React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'accent';
}

const variantStyles = {
  // Primary - Ocean Blue
  default: 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-300',
  // Secondary - Slate
  secondary: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  // Destructive - Red
  destructive: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  // Outline
  outline: 'border border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-300',
  // Success - Green
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  // Warning - Amber
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  // Info - Cyan
  info: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  // Accent - Burnt Orange
  accent: 'bg-accent-100 text-accent-800 dark:bg-accent-900/40 dark:text-accent-300',
};

export function Badge({ className = '', variant = 'default', children, ...props }: BadgeProps) {
  return (
    <div
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
