/**
 * Color System - Ported from Flutter AppColors
 * Ocean Blue primary, Burnt Orange accent, Material Design 3 semantics
 */

export const colors = {
  // Primary - Ocean Blue
  primary50: "#F0F9FF",
  primary100: "#E0F2FE",
  primary200: "#BAE6FD",
  primary300: "#7DD3FC",
  primary400: "#38BDF8",
  primary500: "#0EA5E9",
  primary600: "#0284C7",
  primary700: "#0369A1",
  primary800: "#075985",
  primary900: "#0C4A6E",

  // Accent - Burnt Orange
  accent50: "#FFF7ED",
  accent100: "#FFEDD5",
  accent200: "#FED7AA",
  accent300: "#FDBA74",
  accent400: "#FB923C",
  accent500: "#F97316",
  accent600: "#EA580C",
  accent700: "#C2410C",
  accent800: "#9A3412",
  accent900: "#7C2D12",

  // Neutral - Slate
  slate50: "#F8FAFC",
  slate100: "#F1F5F9",
  slate200: "#E2E8F0",
  slate300: "#CBD5E1",
  slate400: "#94A3B8",
  slate500: "#64748B",
  slate600: "#475569",
  slate700: "#334155",
  slate800: "#1E293B",
  slate900: "#0F172A",

  // Semantic
  error: "#EF4444",
  errorLight: "#FEE2E2",
  errorDark: "#B91C1C",
  warning: "#F59E0B",
  warningLight: "#FEF3C7",
  warningDark: "#B45309",
  success: "#10B981",
  successLight: "#D1FAE5",
  successDark: "#047857",
  info: "#3B82F6",
  infoLight: "#DBEAFE",
  infoDark: "#1D4ED8",

  // Surface
  white: "#FFFFFF",
  black: "#000000",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  surfaceVariant: "#F1F5F9",
  border: "#E2E8F0",
  divider: "#E2E8F0",

  // Text
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  textTertiary: "#94A3B8",
  textInverse: "#FFFFFF",

  // Navigation (dark sidebar)
  navBackground: "#0F172A",
  navSurface: "#1E293B",
  navText: "#E2E8F0",
  navTextMuted: "#94A3B8",
  navActive: "#0EA5E9",
  navActiveText: "#FFFFFF",
} as const;

export const darkColors = {
  ...colors,
  background: "#0F172A",
  surface: "#1E293B",
  surfaceVariant: "#334155",
  border: "#334155",
  divider: "#334155",
  textPrimary: "#F1F5F9",
  textSecondary: "#CBD5E1",
  textTertiary: "#64748B",
} as const;

export type ColorScheme = typeof colors;
