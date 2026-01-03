'use client';

/**
 * Keyboard Shortcuts Hook
 *
 * Sprint 7 - Story 7.8: Keyboard Navigation
 *
 * Provides keyboard shortcuts for load board and other interactive components
 */

import { useEffect, useCallback } from 'react';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  handler: () => void;
  description: string;
  preventDefault?: boolean;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: ShortcutConfig[];
  enabled?: boolean;
}

/**
 * Hook to handle keyboard shortcuts
 */
export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore when typing in input fields
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
        const shiftMatch = !!shortcut.shift === event.shiftKey;
        const altMatch = !!shortcut.alt === event.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          shortcut.handler();
          return;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown, enabled]);
}

/**
 * Common load board shortcuts
 */
export const LOAD_BOARD_SHORTCUTS = {
  NEW_LOAD: { key: 'n', ctrl: true, description: 'Create new load' },
  SEARCH: { key: '/', description: 'Focus search' },
  REFRESH: { key: 'r', description: 'Refresh data' },
  SELECT_ALL: { key: 'a', ctrl: true, description: 'Select all' },
  DESELECT_ALL: { key: 'Escape', description: 'Deselect all' },
  DELETE: { key: 'Delete', description: 'Delete selected' },
  COPY: { key: 'c', ctrl: true, description: 'Copy selected' },
  EDIT: { key: 'e', description: 'Edit selected' },
  NEXT_ROW: { key: 'ArrowDown', description: 'Next row' },
  PREV_ROW: { key: 'ArrowUp', description: 'Previous row' },
  FIRST_ROW: { key: 'Home', description: 'First row' },
  LAST_ROW: { key: 'End', description: 'Last row' },
  TOGGLE_FILTER: { key: 'f', ctrl: true, description: 'Toggle filters' },
  HELP: { key: '?', description: 'Show shortcuts help' },
};

/**
 * Keyboard Shortcuts Help Modal Component
 */
export function KeyboardShortcutsHelp({
  shortcuts,
  isOpen,
  onClose,
}: {
  shortcuts: ShortcutConfig[];
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  const formatKey = (shortcut: ShortcutConfig): string => {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');
    if (shortcut.meta) parts.push('Cmd');
    parts.push(shortcut.key === ' ' ? 'Space' : shortcut.key);
    return parts.join(' + ');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
          <div className="space-y-2">
            {shortcuts.map((shortcut, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <span className="text-gray-600">{shortcut.description}</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono text-gray-800">
                  {formatKey(shortcut)}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-500 text-center">
            Press <kbd className="px-1 bg-gray-200 rounded">?</kbd> to toggle this help
          </p>
        </div>
      </div>
    </div>
  );
}

export default useKeyboardShortcuts;
