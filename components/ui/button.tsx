import * as React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'accent';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const variantStyles = {
  // Primary button - Ocean Blue gradient
  default: 'bg-gradient-to-r from-primary-700 to-primary-600 text-white hover:from-primary-800 hover:to-primary-700 shadow-md hover:shadow-lg',
  // Accent button - Burnt Orange gradient
  accent: 'bg-gradient-to-r from-accent-700 to-accent-600 text-white hover:from-accent-800 hover:to-accent-700 shadow-md hover:shadow-lg',
  // Destructive - Red
  destructive: 'bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-700 hover:to-red-600 shadow-md hover:shadow-lg',
  // Outline - bordered
  outline: 'border-2 border-primary-600 text-primary-700 bg-transparent hover:bg-primary-50 dark:border-primary-500 dark:text-primary-400 dark:hover:bg-primary-900/20',
  // Secondary - subtle
  secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
  // Ghost - minimal
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
  // Link - text only
  link: 'text-primary-600 underline-offset-4 hover:underline hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300',
};

const sizeStyles = {
  default: 'h-10 px-5 py-2.5',
  sm: 'h-9 px-4 py-2 text-sm',
  lg: 'h-12 px-8 py-3 text-base',
  icon: 'h-10 w-10',
};

export function Button({
  className = '',
  variant = 'default',
  size = 'default',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
