'use client';

/**
 * Theme Provider Component
 *
 * Provides dark mode support using next-themes
 * Uses class-based dark mode for proper Tailwind integration
 *
 * Sprint 19 - Dark theme as default with neutral light toggle
 */

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { ReactNode } from 'react';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
