'use client';

/**
 * Character Counter Component
 *
 * Character counter for text inputs showing current/max characters
 */

import React from 'react';
import { CharacterCounterProps } from '@/types/loadboard-ui';

export default function CharacterCounter({
  value,
  maxLength,
  className = '',
}: CharacterCounterProps) {
  const currentLength = value?.length || 0;
  const percentage = (currentLength / maxLength) * 100;

  /**
   * Get color based on character count percentage
   */
  const getColorClass = (): string => {
    if (percentage >= 100) {
      return 'text-red-600 font-semibold'; // At limit
    } else if (percentage >= 90) {
      return 'text-orange-600 font-medium'; // Near limit
    } else if (percentage >= 75) {
      return 'text-yellow-600'; // Getting close
    } else {
      return 'text-gray-500'; // Safe
    }
  };

  return (
    <div className={`text-xs mt-1 ${className}`}>
      <span className={getColorClass()}>
        {currentLength} / {maxLength} characters
      </span>
    </div>
  );
}
