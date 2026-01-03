/**
 * Form Error Display Component
 *
 * Shows validation errors in a user-friendly format
 * Sprint 15 - Form Enhancements
 */

'use client';

import { ValidationError } from '@/lib/formValidation';

interface FormErrorDisplayProps {
  errors: ValidationError[];
  className?: string;
}

export default function FormErrorDisplay({ errors, className = '' }: FormErrorDisplayProps) {
  if (errors.length === 0) return null;

  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-red-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">
            {errors.length === 1
              ? 'There is 1 error with your submission'
              : `There are ${errors.length} errors with your submission`}
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <ul className="list-disc list-inside space-y-1">
              {errors.map((error, index) => (
                <li key={index}>{error.message}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline field error component
 */
export function FieldError({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <p className="mt-1 text-sm text-red-600">{message}</p>
  );
}

/**
 * Field wrapper that shows error state
 */
export function FormField({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && <FieldError message={error} />}
    </div>
  );
}
