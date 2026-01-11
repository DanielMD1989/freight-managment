'use client';

/**
 * Bulk Actions Toolbar Component
 *
 * Sprint 7 - Story 7.9: Bulk Operations
 *
 * Provides bulk action capabilities for data grids
 */

import { useState } from 'react';

interface BulkAction {
  id: string;
  label: string;
  icon?: string;
  variant?: 'default' | 'danger' | 'success';
  requireConfirmation?: boolean;
  confirmMessage?: string;
}

interface BulkActionsToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  actions: BulkAction[];
  onAction: (actionId: string) => Promise<void>;
  entityName?: string;
}

export default function BulkActionsToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  actions,
  onAction,
  entityName = 'items',
}: BulkActionsToolbarProps) {
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<BulkAction | null>(null);

  if (selectedCount === 0) return null;

  const handleAction = async (action: BulkAction) => {
    if (action.requireConfirmation) {
      setConfirmingAction(action);
      return;
    }

    await executeAction(action.id);
  };

  const executeAction = async (actionId: string) => {
    setProcessingAction(actionId);
    setConfirmingAction(null);

    try {
      await onAction(actionId);
    } finally {
      setProcessingAction(null);
    }
  };

  const getButtonStyles = (variant: BulkAction['variant'] = 'default'): string => {
    switch (variant) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 text-white';
      case 'success':
        return 'bg-green-600 hover:bg-green-700 text-white';
      default:
        return 'bg-white hover:bg-[#f0fdfa] text-[#064d51]/80 border border-[#064d51]/20';
    }
  };

  return (
    <>
      {/* Toolbar */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
        <div className="bg-[#064d51] text-white rounded-lg shadow-2xl px-6 py-3 flex items-center gap-4">
          {/* Selection Count */}
          <div className="flex items-center gap-3 pr-4 border-r border-[#1e9c99]/40">
            <span className="bg-[#1e9c99] text-white text-sm font-bold px-2 py-1 rounded">
              {selectedCount}
            </span>
            <span className="text-sm text-white/80">
              of {totalCount} {entityName} selected
            </span>
          </div>

          {/* Selection Actions */}
          <div className="flex items-center gap-2 pr-4 border-r border-[#1e9c99]/40">
            {selectedCount < totalCount && (
              <button
                onClick={onSelectAll}
                className="text-sm text-[#1e9c99] hover:text-white transition-colors"
              >
                Select All
              </button>
            )}
            <button
              onClick={onDeselectAll}
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              Clear Selection
            </button>
          </div>

          {/* Bulk Actions */}
          <div className="flex items-center gap-2">
            {actions.map(action => (
              <button
                key={action.id}
                onClick={() => handleAction(action)}
                disabled={processingAction !== null}
                className={`
                  px-4 py-2 text-sm font-medium rounded-lg transition-colors
                  flex items-center gap-2
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${getButtonStyles(action.variant)}
                `}
              >
                {processingAction === action.id ? (
                  <span className="animate-spin">⟳</span>
                ) : action.icon ? (
                  <span>{action.icon}</span>
                ) : null}
                {action.label}
              </button>
            ))}
          </div>

          {/* Close Button */}
          <button
            onClick={onDeselectAll}
            className="ml-2 p-2 text-white/60 hover:text-white transition-colors"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-[#064d51] mb-2">
              Confirm Action
            </h3>
            <p className="text-[#064d51]/70 mb-6">
              {confirmingAction.confirmMessage ||
                `Are you sure you want to ${confirmingAction.label.toLowerCase()} ${selectedCount} ${entityName}?`}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmingAction(null)}
                className="px-4 py-2 text-[#064d51]/80 bg-[#064d51]/10 rounded-lg hover:bg-[#064d51]/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => executeAction(confirmingAction.id)}
                className={`px-4 py-2 rounded-lg transition-colors ${getButtonStyles(confirmingAction.variant)}`}
              >
                {confirmingAction.label}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Default bulk actions for loads
 */
export const LOAD_BULK_ACTIONS: BulkAction[] = [
  { id: 'post', label: 'Post', icon: '📤', variant: 'success' },
  { id: 'unpost', label: 'Unpost', icon: '📥' },
  { id: 'copy', label: 'Copy', icon: '📋' },
  { id: 'delete', label: 'Delete', icon: '🗑️', variant: 'danger', requireConfirmation: true },
];

/**
 * Default bulk actions for trucks
 */
export const TRUCK_BULK_ACTIONS: BulkAction[] = [
  { id: 'post', label: 'Post', icon: '📤', variant: 'success' },
  { id: 'unpost', label: 'Unpost', icon: '📥' },
  { id: 'mark-available', label: 'Mark Available', icon: '✓', variant: 'success' },
  { id: 'mark-unavailable', label: 'Mark Unavailable', icon: '✕' },
  { id: 'delete', label: 'Delete', icon: '🗑️', variant: 'danger', requireConfirmation: true },
];
