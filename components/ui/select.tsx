'use client';

import * as React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  onValueChange?: (value: string) => void;
}

export function Select({ className = '', children, onValueChange, onChange, ...props }: SelectProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (onValueChange) {
      onValueChange(e.target.value);
    }
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <select
      className={`flex h-10 w-full rounded-md border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] focus:outline-none focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99] disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white ${className}`}
      onChange={handleChange}
      {...props}
    >
      {children}
    </select>
  );
}

interface SelectTriggerProps extends React.HTMLAttributes<HTMLDivElement> {}

export function SelectTrigger({ className = '', children, ...props }: SelectTriggerProps) {
  return (
    <div
      className={`flex h-10 w-full items-center justify-between rounded-md border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] dark:border-slate-600 dark:bg-slate-800 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

interface SelectValueProps {
  placeholder?: string;
}

export function SelectValue({ placeholder }: SelectValueProps) {
  return <span className="text-[#064d51]/60 dark:text-gray-400">{placeholder}</span>;
}

interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export function SelectContent({ className = '', children, ...props }: SelectContentProps) {
  return (
    <div
      className={`absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-[#064d51]/20 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

interface SelectItemProps extends React.OptionHTMLAttributes<HTMLOptionElement> {}

export function SelectItem({ className = '', children, ...props }: SelectItemProps) {
  return (
    <option
      className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-[#064d51]/5 dark:hover:bg-slate-700 ${className}`}
      {...props}
    >
      {children}
    </option>
  );
}
