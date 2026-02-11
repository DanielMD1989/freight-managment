'use client';

/**
 * Tab State Persistence Hook
 *
 * Persists tab state in URL query parameters for:
 * - Shareable URLs with tab state
 * - Browser back/forward navigation
 * - Page refresh persistence
 *
 * Usage:
 * ```typescript
 * import { useTabState } from '@/lib/hooks/useTabState';
 *
 * function MyTabbedComponent() {
 *   const [activeTab, setActiveTab] = useTabState('overview', 'tab');
 *
 *   return (
 *     <div>
 *       <button onClick={() => setActiveTab('overview')}>Overview</button>
 *       <button onClick={() => setActiveTab('details')}>Details</button>
 *       {activeTab === 'overview' && <Overview />}
 *       {activeTab === 'details' && <Details />}
 *     </div>
 *   );
 * }
 * ```
 *
 * URL will update to: /page?tab=overview or /page?tab=details
 */

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';

/**
 * Custom hook for persisting tab state in URL query parameters
 *
 * @param defaultTab - Default tab to show if none specified in URL
 * @param paramName - URL parameter name (default: 'tab')
 * @param options - Additional options
 * @returns Tuple of [currentTab, setTab]
 */
export function useTabState(
  defaultTab: string,
  paramName: string = 'tab',
  options: {
    /** Use replace instead of push for history */
    replace?: boolean;
    /** Preserve other query params */
    preserveParams?: boolean;
  } = {}
): readonly [string, (tab: string) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const { replace = true, preserveParams = true } = options;

  // Get current tab from URL or use default
  const currentTab = useMemo(() => {
    return searchParams.get(paramName) || defaultTab;
  }, [searchParams, paramName, defaultTab]);

  // Set tab and update URL
  const setTab = useCallback(
    (tab: string) => {
      const params = preserveParams
        ? new URLSearchParams(searchParams.toString())
        : new URLSearchParams();

      if (tab === defaultTab) {
        // Remove param if it's the default (cleaner URLs)
        params.delete(paramName);
      } else {
        params.set(paramName, tab);
      }

      const queryString = params.toString();
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;

      if (replace) {
        router.replace(newUrl, { scroll: false });
      } else {
        router.push(newUrl, { scroll: false });
      }
    },
    [searchParams, router, pathname, paramName, defaultTab, replace, preserveParams]
  );

  return [currentTab, setTab] as const;
}

/**
 * Hook for multiple tab groups on the same page
 *
 * Usage:
 * ```typescript
 * const tabs = useMultiTabState({
 *   main: { default: 'overview', param: 'tab' },
 *   sub: { default: 'settings', param: 'subtab' },
 * });
 *
 * // Access: tabs.main.current, tabs.main.set('details')
 * ```
 */
export function useMultiTabState<T extends Record<string, { default: string; param?: string }>>(
  config: T
): {
  [K in keyof T]: {
    current: string;
    set: (tab: string) => void;
  };
} {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const result = {} as {
    [K in keyof T]: { current: string; set: (tab: string) => void };
  };

  for (const key in config) {
    const { default: defaultTab, param = key } = config[key];
    const current = searchParams.get(param) || defaultTab;

    const set = (tab: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === defaultTab) {
        params.delete(param);
      } else {
        params.set(param, tab);
      }
      const queryString = params.toString();
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(newUrl, { scroll: false });
    };

    result[key] = { current, set };
  }

  return result;
}

export default useTabState;
