import * as React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function Textarea({ className = '', ...props }: TextareaProps) {
  return (
    <textarea
      className={`flex min-h-[80px] w-full rounded-md border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] placeholder:text-[#064d51]/50 focus:outline-none focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99] disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-gray-500 ${className}`}
      {...props}
    />
  );
}
