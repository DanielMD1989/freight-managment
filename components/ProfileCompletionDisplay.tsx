'use client';

/**
 * Profile Completion Display Component
 *
 * Sprint 3 - Story 3.4: Profile Completion Tracking
 *
 * Shows profile completion progress for organizations/users
 */

import { useMemo } from 'react';

interface ProfileCompletionProps {
  profile: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    licenseNumber?: string | null;
    taxId?: string | null;
    description?: string | null;
    logo?: string | null;
    website?: string | null;
    documents?: { id: string }[];
  };
  type: 'organization' | 'user';
  showDetails?: boolean;
}

interface CompletionItem {
  field: string;
  label: string;
  completed: boolean;
  weight: number;
  category: 'basic' | 'legal' | 'contact' | 'branding';
}

export default function ProfileCompletionDisplay({
  profile,
  type,
  showDetails = false,
}: ProfileCompletionProps) {
  const completionItems = useMemo((): CompletionItem[] => {
    if (type === 'organization') {
      return [
        // Basic Info (30%)
        { field: 'name', label: 'Organization Name', completed: !!profile.name, weight: 10, category: 'basic' },
        { field: 'description', label: 'Description', completed: !!profile.description, weight: 10, category: 'basic' },
        { field: 'logo', label: 'Logo', completed: !!profile.logo, weight: 10, category: 'basic' },

        // Contact Info (25%)
        { field: 'email', label: 'Email', completed: !!profile.email, weight: 10, category: 'contact' },
        { field: 'phone', label: 'Phone', completed: !!profile.phone, weight: 10, category: 'contact' },
        { field: 'address', label: 'Address', completed: !!profile.address && !!profile.city, weight: 5, category: 'contact' },

        // Legal Info (30%)
        { field: 'licenseNumber', label: 'Business License', completed: !!profile.licenseNumber, weight: 15, category: 'legal' },
        { field: 'taxId', label: 'Tax ID', completed: !!profile.taxId, weight: 15, category: 'legal' },

        // Branding (15%)
        { field: 'website', label: 'Website', completed: !!profile.website, weight: 5, category: 'branding' },
        { field: 'documents', label: 'Documents Uploaded', completed: (profile.documents?.length || 0) > 0, weight: 10, category: 'branding' },
      ];
    }

    // User profile
    return [
      { field: 'name', label: 'Full Name', completed: !!profile.name, weight: 25, category: 'basic' },
      { field: 'email', label: 'Email', completed: !!profile.email, weight: 25, category: 'contact' },
      { field: 'phone', label: 'Phone', completed: !!profile.phone, weight: 25, category: 'contact' },
      { field: 'address', label: 'Address', completed: !!profile.address, weight: 25, category: 'contact' },
    ];
  }, [profile, type]);

  const completionPercentage = useMemo(() => {
    const totalWeight = completionItems.reduce((sum, item) => sum + item.weight, 0);
    const completedWeight = completionItems
      .filter(item => item.completed)
      .reduce((sum, item) => sum + item.weight, 0);

    return Math.round((completedWeight / totalWeight) * 100);
  }, [completionItems]);

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getProgressBgColor = (percentage: number): string => {
    if (percentage >= 80) return 'bg-green-100';
    if (percentage >= 50) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getStatusLabel = (percentage: number): string => {
    if (percentage >= 100) return 'Complete';
    if (percentage >= 80) return 'Almost Complete';
    if (percentage >= 50) return 'In Progress';
    return 'Needs Attention';
  };

  const incompleteItems = completionItems.filter(item => !item.completed);
  const categoryGroups = useMemo(() => {
    const groups: Record<string, CompletionItem[]> = {
      basic: [],
      contact: [],
      legal: [],
      branding: [],
    };

    completionItems.forEach(item => {
      groups[item.category].push(item);
    });

    return groups;
  }, [completionItems]);

  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      basic: 'Basic Information',
      contact: 'Contact Details',
      legal: 'Legal Documents',
      branding: 'Branding & Documents',
    };
    return labels[category] || category;
  };

  const getCategoryCompletion = (category: string): number => {
    const items = categoryGroups[category];
    if (!items || items.length === 0) return 100;

    const completed = items.filter(item => item.completed).length;
    return Math.round((completed / items.length) * 100);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-[#064d51]/15 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-[#064d51]">Profile Completion</h3>
          <p className="text-xs text-[#064d51]/60 mt-1">{getStatusLabel(completionPercentage)}</p>
        </div>
        <div className="text-2xl font-bold text-[#064d51]">{completionPercentage}%</div>
      </div>

      {/* Progress Bar */}
      <div className={`h-3 rounded-full ${getProgressBgColor(completionPercentage)} overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${getProgressColor(completionPercentage)}`}
          style={{ width: `${completionPercentage}%` }}
        />
      </div>

      {/* Quick Stats */}
      <div className="flex justify-between mt-3 text-xs text-[#064d51]/70">
        <span>{completionItems.filter(i => i.completed).length} of {completionItems.length} items</span>
        {incompleteItems.length > 0 && (
          <span className="text-orange-600">{incompleteItems.length} remaining</span>
        )}
      </div>

      {/* Detailed Breakdown */}
      {showDetails && (
        <div className="mt-4 pt-4 border-t border-[#064d51]/15 space-y-4">
          {Object.keys(categoryGroups).map(category => {
            const items = categoryGroups[category];
            if (items.length === 0) return null;

            const categoryCompletion = getCategoryCompletion(category);

            return (
              <div key={category}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-[#064d51]/80">
                    {getCategoryLabel(category)}
                  </span>
                  <span className="text-xs text-[#064d51]/60">{categoryCompletion}%</span>
                </div>

                <div className="space-y-1">
                  {items.map(item => (
                    <div
                      key={item.field}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className={item.completed ? 'text-green-500' : 'text-[#064d51]/30'}>
                        {item.completed ? '✓' : '○'}
                      </span>
                      <span className={item.completed ? 'text-[#064d51]/70' : 'text-[#064d51]/50'}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Suggestions */}
          {incompleteItems.length > 0 && (
            <div className="bg-[#1e9c99]/10 rounded-lg p-3 mt-4">
              <p className="text-xs font-medium text-[#064d51] mb-2">
                Complete these to improve your profile:
              </p>
              <ul className="space-y-1">
                {incompleteItems.slice(0, 3).map(item => (
                  <li key={item.field} className="text-xs text-[#1e9c99] flex items-center gap-1">
                    <span>→</span> Add {item.label}
                  </li>
                ))}
                {incompleteItems.length > 3 && (
                  <li className="text-xs text-[#1e9c99]/80">
                    ...and {incompleteItems.length - 3} more
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Compact version for dashboard cards
 */
export function ProfileCompletionBadge({
  percentage,
  size = 'sm',
}: {
  percentage: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const getColor = (pct: number): string => {
    if (pct >= 80) return 'text-green-600 bg-green-100';
    if (pct >= 50) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${getColor(percentage)} ${sizeClasses[size]}`}>
      <span>{percentage}%</span>
      {percentage >= 100 && <span>✓</span>}
    </span>
  );
}
