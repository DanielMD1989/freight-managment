/**
 * Card component - material design elevation
 */
import React from "react";
import { View, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { colors } from "../theme/colors";
import { borderRadius, spacing } from "../theme/spacing";

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: "elevated" | "outlined" | "filled";
  padding?: keyof typeof spacing;
}

export function Card({
  children,
  style,
  variant = "elevated",
  padding = "lg",
}: CardProps) {
  return (
    <View
      style={[
        styles.base,
        variantStyles[variant],
        { padding: spacing[padding] },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.xl,
  },
});

const variantStyles: Record<string, ViewStyle> = {
  elevated: {
    backgroundColor: colors.surface,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  outlined: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filled: {
    backgroundColor: colors.surfaceVariant,
  },
};
