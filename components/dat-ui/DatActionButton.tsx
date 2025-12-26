'use client';

/**
 * DAT Action Button Component
 *
 * Standardized button with color variants matching DAT-style interface
 * Sprint 14 - DAT-Style UI Transformation
 */

import { DatActionButtonProps } from '@/types/dat-ui';

export default function DatActionButton({
  variant,
  size = 'md',
  icon,
  children,
  onClick,
  disabled = false,
  className = '',
}: DatActionButtonProps) {
  // Variant color mappings (DAT-style)
  const variantStyles = {
    primary: 'bg-lime-500 hover:bg-lime-600 text-white', // Green #84CC16
    secondary: 'bg-cyan-500 hover:bg-cyan-600 text-white', // Cyan #06B6D4
    destructive: 'bg-red-500 hover:bg-red-600 text-white', // Red #EF4444
    search: 'bg-blue-500 hover:bg-blue-600 text-white', // Blue #3B82F6
  };

  // Size mappings
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        font-semibold
        rounded-md
        transition-colors
        duration-150
        disabled:opacity-50
        disabled:cursor-not-allowed
        flex items-center gap-2
        ${className}
      `}
    >
      {icon && <span>{icon}</span>}
      {children}
    </button>
  );
}
