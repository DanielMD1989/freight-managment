/**
 * Typography System - Ported from Flutter theme
 * Uses system fonts (San Francisco on iOS, Roboto on Android)
 */
import { Platform, TextStyle } from "react-native";

const fontFamily = Platform.select({
  ios: "System",
  android: "Roboto",
  default: "System",
});

export const typography = {
  displayLarge: {
    fontFamily,
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 40,
    letterSpacing: -0.5,
  } as TextStyle,
  displayMedium: {
    fontFamily,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 36,
    letterSpacing: -0.25,
  } as TextStyle,
  displaySmall: {
    fontFamily,
    fontSize: 24,
    fontWeight: "600",
    lineHeight: 32,
  } as TextStyle,
  headlineLarge: {
    fontFamily,
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 28,
  } as TextStyle,
  headlineMedium: {
    fontFamily,
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 26,
  } as TextStyle,
  headlineSmall: {
    fontFamily,
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 24,
  } as TextStyle,
  titleLarge: {
    fontFamily,
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 24,
  } as TextStyle,
  titleMedium: {
    fontFamily,
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 22,
  } as TextStyle,
  titleSmall: {
    fontFamily,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  } as TextStyle,
  bodyLarge: {
    fontFamily,
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 24,
  } as TextStyle,
  bodyMedium: {
    fontFamily,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
  } as TextStyle,
  bodySmall: {
    fontFamily,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 16,
  } as TextStyle,
  labelLarge: {
    fontFamily,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  } as TextStyle,
  labelMedium: {
    fontFamily,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
  } as TextStyle,
  labelSmall: {
    fontFamily,
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 14,
    letterSpacing: 0.5,
  } as TextStyle,
} as const;
