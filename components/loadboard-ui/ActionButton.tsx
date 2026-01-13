'use client';

/**
 * Action Button Component
 *
 * Professional button with gradient variants, shadows, and smooth animations
 * Design System: Clean & Minimal with Teal accent
 */

import { ActionButtonProps } from '@/types/loadboard-ui';

export default function ActionButton({
  variant,
  size = 'md',
  icon,
  children,
  onClick,
  disabled = false,
  className = '',
}: ActionButtonProps) {
  // Professional variant styles with gradients and shadows
  const variantStyles = {
    primary: `
      bg-gradient-to-r from-teal-600 to-teal-500
      hover:from-teal-700 hover:to-teal-600
      text-white
      shadow-md shadow-teal-500/25
      hover:shadow-lg hover:shadow-teal-500/30
    `,
    secondary: `
      bg-white
      border-2 border-teal-200
      text-teal-700
      hover:bg-teal-50 hover:border-teal-300
      shadow-sm
    `,
    destructive: `
      bg-gradient-to-r from-rose-600 to-rose-500
      hover:from-rose-700 hover:to-rose-600
      text-white
      shadow-md shadow-rose-500/25
      hover:shadow-lg hover:shadow-rose-500/30
    `,
    search: `
      bg-gradient-to-r from-slate-800 to-slate-700
      hover:from-slate-900 hover:to-slate-800
      text-white
      shadow-md shadow-slate-500/25
      hover:shadow-lg hover:shadow-slate-500/30
    `,
  };

  // Size mappings with better proportions
  const sizeStyles = {
    sm: 'px-3.5 py-2 text-xs gap-1.5',
    md: 'px-5 py-2.5 text-sm gap-2',
    lg: 'px-7 py-3.5 text-base gap-2.5',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        inline-flex items-center justify-center
        font-semibold
        rounded-xl
        transition-all duration-200 ease-out
        transform hover:-translate-y-0.5 active:translate-y-0
        focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        disabled:transform-none disabled:shadow-none
        ${className}
      `}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
}
