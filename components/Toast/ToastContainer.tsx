'use client';

/**
 * Toast Container Component
 *
 * Professional toast notifications with modern design and animations
 * Design System: Clean & Minimal with Teal accent
 */

import React, { useEffect, useState } from 'react';
import { useToast, Toast as ToastType } from './ToastContext';

const Toast = ({ toast, onRemove }: { toast: ToastType; onRemove: () => void }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(onRemove, 300);
      }, toast.duration - 300);

      return () => clearTimeout(timer);
    }
  }, [toast.duration, onRemove]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(onRemove, 300);
  };

  const getToastStyles = () => {
    switch (toast.type) {
      case 'success':
        return {
          container: 'bg-white border-l-4 border-l-emerald-500',
          iconBg: 'bg-emerald-100',
          iconColor: 'text-emerald-600',
          title: 'text-emerald-800',
        };
      case 'error':
        return {
          container: 'bg-white border-l-4 border-l-rose-500',
          iconBg: 'bg-rose-100',
          iconColor: 'text-rose-600',
          title: 'text-rose-800',
        };
      case 'warning':
        return {
          container: 'bg-white border-l-4 border-l-amber-500',
          iconBg: 'bg-amber-100',
          iconColor: 'text-amber-600',
          title: 'text-amber-800',
        };
      case 'info':
        return {
          container: 'bg-white border-l-4 border-l-teal-500',
          iconBg: 'bg-teal-100',
          iconColor: 'text-teal-600',
          title: 'text-teal-800',
        };
      default:
        return {
          container: 'bg-white border-l-4 border-l-slate-400',
          iconBg: 'bg-slate-100',
          iconColor: 'text-slate-600',
          title: 'text-slate-800',
        };
    }
  };

  const getIcon = () => {
    const iconClass = 'w-5 h-5';
    switch (toast.type) {
      case 'success':
        return (
          <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'error':
        return (
          <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'warning':
        return (
          <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'info':
        return (
          <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const styles = getToastStyles();

  return (
    <div
      className={`
        flex items-start gap-4 p-4 rounded-xl shadow-2xl min-w-[340px] max-w-md
        border border-slate-200/60
        transition-all duration-300 ease-out
        ${styles.container}
        ${isExiting
          ? 'opacity-0 translate-x-8 scale-95'
          : 'opacity-100 translate-x-0 scale-100'
        }
      `}
    >
      <div className={`flex-shrink-0 w-9 h-9 rounded-xl ${styles.iconBg} ${styles.iconColor} flex items-center justify-center`}>
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className={`text-sm font-semibold ${styles.title}`}>{toast.message}</p>
      </div>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div
      className="fixed top-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto animate-in slide-in-from-right-5 duration-300">
          <Toast toast={toast} onRemove={() => removeToast(toast.id)} />
        </div>
      ))}
    </div>
  );
}
